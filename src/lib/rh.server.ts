/**
 * RH — parte do servidor: arquivos (bucket privado rh-arquivos, criado na primeira gravação),
 * resumo diário de avisos por e-mail/WhatsApp e importação dos usuários do sistema.
 * Só service role; quem chama confere rh_allowed() antes.
 */
import { avisosRh, CONFIG_RH_PADRAO, type AvisoRh } from "./rh";

export const BUCKET_RH = "rh-arquivos";
type Db = any;
export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
export const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

let bucketOk = false;
export async function garantirBucket(db: Db) {
  if (bucketOk) return;
  const { data } = await db.storage.getBucket(BUCKET_RH);
  if (!data) {
    const { error } = await db.storage.createBucket(BUCKET_RH, { public: false, fileSizeLimit: 15 * 1024 * 1024 });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Não foi possível criar o armazenamento do RH: ${error.message}`);
  }
  bucketOk = true;
}

export async function carregarDadosRh(db: Db) {
  const ler = async (t: string) => {
    const out: any[] = [];
    for (let de = 0; de < 100_000; de += 1000) {
      const { data, error } = await db.from(t).select("*").order("id").range(de, de + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  const [colabs, ausencias, ferias, horas, documentos] = await Promise.all(
    ["rh_colaboradores", "rh_ausencias", "rh_ferias", "rh_banco_horas", "rh_documentos"].map(ler));
  const { data: config } = await db.from("rh_config").select("*").eq("id", 1).maybeSingle();
  return { colabs, ausencias, ferias, horas, documentos, config };
}

export function textoResumo(avisos: AvisoRh[], hoje: string): string {
  const dataBR = hoje.split("-").reverse().join("/");
  const grupos: [string, AvisoRh["gravidade"]][] = [["Urgente", 1], ["Atenção", 2], ["Informativo", 3]];
  const partes = [`Resumo do RH — ${dataBR}`];
  for (const [nome, g] of grupos) {
    const itens = avisos.filter((a) => a.gravidade === g);
    if (itens.length) partes.push(`\n${nome}:\n${itens.map((a) => `• ${a.texto}`).join("\n")}`);
  }
  return partes.join("\n");
}

/** Resumo diário (rotina) ou manual. Pela rotina, só envia se os avisos estiverem ligados. */
export async function rotinaRh(opts: { manual: boolean }) {
  const db = await adminDb();
  const d = await carregarDadosRh(db);
  const cfg = { ...CONFIG_RH_PADRAO, ...(d.config ?? {}) };
  if (!opts.manual && !d.config?.avisos_ativos) return { ok: true, pulado: true, avisos: 0, enviados: [] as string[] };
  const hoje = hojeSP();
  const avisos = avisosRh({ colabs: d.colabs, ausencias: d.ausencias, ferias: d.ferias, horas: d.horas, documentos: d.documentos, hoje, config: cfg });
  if (!avisos.length) return { ok: true, pulado: false, avisos: 0, enviados: [] as string[] };
  const texto = textoResumo(avisos, hoje);
  const { marcaContratos, whatsappContrato, emailContrato } = await import("./contratos-envio.server");
  const brand: any = (await marcaContratos(db)) ?? {};
  const enviados: string[] = [];
  const erros: string[] = [];
  const tel = String(d.config?.aviso_whatsapp ?? "").replace(/\D/g, "");
  if (tel) {
    try { await whatsappContrato(db, brand, tel.length <= 11 ? `55${tel}` : tel, texto); enviados.push("WhatsApp"); }
    catch (e: any) { erros.push(`WhatsApp: ${e?.message ?? e}`); }
  }
  const email = String(d.config?.aviso_email ?? "").trim();
  if (email) {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    try { await emailContrato(db, brand, email, `Resumo do RH — ${hoje.split("-").reverse().join("/")}`, esc(texto).replace(/\n/g, "<br/>")); enviados.push("e-mail"); }
    catch (e: any) { erros.push(`E-mail: ${e?.message ?? e}`); }
  }
  await db.from("rh_config").update({ ultima_execucao_em: new Date().toISOString() }).eq("id", 1);
  return { ok: !erros.length, pulado: false, avisos: avisos.length, enviados, erros };
}
