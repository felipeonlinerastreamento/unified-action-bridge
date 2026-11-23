/**
 * Inadimplência — parte do servidor: situação dos clientes vinda do GSystem, régua de cobrança
 * (rotina diária e envio manual) e cobrança avulsa por cliente. Só service role.
 */
import {
  CONFIG_PADRAO, contatoDoGsystem, mensagemCobranca, passoDevido, situacaoDoGsystem, soDigitos,
  somaDias, telefoneWhatsApp, type ConfigCobranca,
} from "./finance-inadimplencia";
import { clienteDoGsystem } from "./finance-gsystem";

type Db = any;
async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Grava em fin_clientes a situação e os contatos do GSystem (não mexe nos contatos de cobrança editados). */
export async function atualizarClientesFinanceiro(lista?: any[]): Promise<{ ok: boolean; clientes: number; inativos: number; semSituacao: number; error?: string }> {
  try {
    const db = await adminDb();
    let brutos = lista;
    if (!brutos) {
      const { listGSystemClientes } = await import("./gsystem-api.server");
      brutos = await listGSystemClientes();
    }
    const agora = new Date().toISOString();
    const porDoc = new Map<string, any>();
    for (const raw of brutos) {
      const c = clienteDoGsystem(raw);
      if (!c) continue;
      const s = situacaoDoGsystem(raw);
      const ct = contatoDoGsystem(raw);
      porDoc.set(c.documento, {
        documento: c.documento, nome: c.nome, gsystem_key: c.key,
        situacao_gsystem: s.texto, ativo_gsystem: s.ativo,
        telefone: ct.telefone, email: ct.email, atualizado_gsystem_em: agora, updated_at: agora,
      });
    }
    const rows = [...porDoc.values()];
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("fin_clientes").upsert(rows.slice(i, i + 500), { onConflict: "documento" });
      if (error) throw error;
    }
    return { ok: true, clientes: rows.length, inativos: rows.filter((r) => r.ativo_gsystem === false).length, semSituacao: rows.filter((r) => r.ativo_gsystem == null).length };
  } catch (e: any) {
    return { ok: false, clientes: 0, inativos: 0, semSituacao: 0, error: String(e?.message ?? e).slice(0, 300) };
  }
}

async function lerConfig(db: Db): Promise<ConfigCobranca & { whatsapp_channel_id: string | null; email_channel_id: string | null }> {
  const { data } = await db.from("fin_cobranca_config").select("*").eq("id", 1).maybeSingle();
  return {
    ...CONFIG_PADRAO,
    ...(data ?? {}),
    passos: Array.isArray(data?.passos) && data.passos.length ? data.passos : CONFIG_PADRAO.passos,
    valor_minimo: Number(data?.valor_minimo ?? 0),
    whatsapp_channel_id: data?.whatsapp_channel_id ?? null,
    email_channel_id: data?.email_channel_id ?? null,
  };
}

/** Canais: os escolhidos na régua; senão os da Central definidos em Configurações › CRM. */
async function canais(db: Db, cfg: { whatsapp_channel_id: string | null; email_channel_id: string | null }) {
  const { marcaContratos } = await import("./contratos-envio.server");
  const brand: any = (await marcaContratos(db)) ?? {};
  return { ...brand, whatsapp_channel_id: cfg.whatsapp_channel_id || brand.whatsapp_channel_id || null, email_channel_id: cfg.email_channel_id || brand.email_channel_id || null };
}

async function enviar(db: Db, brand: any, canal: "whatsapp" | "email", destino: string, texto: string, assunto: string) {
  const { whatsappContrato, emailContrato } = await import("./contratos-envio.server");
  if (canal === "whatsapp") await whatsappContrato(db, brand, destino, texto);
  else {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = esc(texto).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br/>");
    await emailContrato(db, brand, destino, assunto, html);
  }
}

export type ItemRegua = {
  lancamentoId: string; documento: string | null; cliente: string; valor: number; vencimento: string;
  passo: number; canais: { canal: "whatsapp" | "email"; destino: string | null }[]; motivoPulo?: string | null;
};

/**
 * Régua de cobrança. `simular` devolve o que seria enviado hoje sem enviar.
 * Pela rotina (manual = false) só roda se a régua estiver ligada.
 */
export async function executarReguaCobranca(opts: { simular: boolean; manual: boolean; limite?: number }) {
  const db = await adminDb();
  const cfg = await lerConfig(db);
  if (!cfg.ativo && !opts.manual && !opts.simular) return { ok: true, pulado: true, motivo: "Régua desligada", itens: [] as ItemRegua[], enviados: 0, erros: 0 };
  const hoje = hojeSP();
  const maxAntes = Math.max(0, ...cfg.passos.map((p) => -p.dias));
  const maxDepois = Math.max(0, ...cfg.passos.map((p) => p.dias));
  const { data: lancs, error } = await db.from("fin_lancamentos")
    .select("id, valor, vencimento, contraparte, documento_contraparte, linha_digitavel, arquivo_url, perda_provavel, promessa_pagamento")
    .eq("tipo", "receber").eq("status", "aberto")
    .gte("vencimento", somaDias(hoje, -(maxDepois + 5))).lte("vencimento", somaDias(hoje, maxAntes))
    .gte("valor", cfg.valor_minimo || 0)
    .limit(3000);
  if (error) throw error;
  const ids = (lancs || []).map((l: any) => l.id);
  const enviadosPor = new Map<string, Set<string>>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from("fin_cobranca_envios").select("lancamento_id, passo").in("lancamento_id", ids.slice(i, i + 300));
    for (const e of data || []) (enviadosPor.get(e.lancamento_id) ?? enviadosPor.set(e.lancamento_id, new Set()).get(e.lancamento_id)!).add(String(e.passo));
  }
  const docs = [...new Set((lancs || []).map((l: any) => soDigitos(l.documento_contraparte)).filter(Boolean))];
  const clientes = new Map<string, any>();
  for (let i = 0; i < docs.length; i += 300) {
    const { data } = await db.from("fin_clientes").select("*").in("documento", docs.slice(i, i + 300));
    for (const c of data || []) clientes.set(c.documento, c);
  }
  // Promessas em vigor suspendem a cobrança do cliente.
  const { data: promessas } = await db.from("fin_cobranca_acoes").select("documento, data_promessa").eq("tipo", "promessa").gte("data_promessa", hoje);
  const comPromessa = new Set((promessas || []).map((p: any) => soDigitos(p.documento)));

  const itens: ItemRegua[] = [];
  for (const l of lancs || []) {
    if (!l.vencimento || l.perda_provavel) continue;
    const p = passoDevido(l.vencimento, hoje, cfg.passos, enviadosPor.get(l.id) ?? new Set());
    if (!p) continue;
    const doc = soDigitos(l.documento_contraparte) || null;
    const c = doc ? clientes.get(doc) : null;
    let motivo: string | null = null;
    if (c?.regua_pausada) motivo = "Régua pausada para o cliente";
    else if (cfg.so_ativos && c?.ativo_gsystem === false) motivo = "Cliente inativo";
    else if (doc && comPromessa.has(doc)) motivo = "Promessa de pagamento em vigor";
    else if (l.promessa_pagamento && l.promessa_pagamento >= hoje) motivo = "Promessa de pagamento em vigor";
    const tel = telefoneWhatsApp(c?.telefone_cobranca || c?.telefone);
    const email = (c?.email_cobranca || c?.email || "").trim() || null;
    const lista: ItemRegua["canais"] = [];
    if (p.whatsapp) lista.push({ canal: "whatsapp", destino: tel });
    if (p.email) lista.push({ canal: "email", destino: email });
    itens.push({ lancamentoId: l.id, documento: doc, cliente: c?.nome || l.contraparte || "Cliente", valor: Number(l.valor), vencimento: l.vencimento, passo: p.dias, canais: lista, motivoPulo: motivo });
  }
  if (opts.simular) return { ok: true, pulado: false, itens, enviados: 0, erros: 0 };

  const brand = await canais(db, cfg);
  let enviados = 0, erros = 0, ultimoErro: string | null = null;
  const porCliente = new Map<string, string[]>();
  const limite = opts.limite ?? 200;
  for (const it of itens) {
    if (it.motivoPulo) continue;
    if (enviados + erros >= limite) break;
    const l = (lancs || []).find((x: any) => x.id === it.lancamentoId);
    const texto = mensagemCobranca(it.passo < 0 ? cfg.mensagem_antes : cfg.mensagem_atraso, it.passo < 0,
      { nome: it.cliente, valor: it.valor, vencimento: it.vencimento, hoje, link: l?.arquivo_url ?? null, linhaDigitavel: l?.linha_digitavel ?? null });
    const assunto = it.passo < 0 ? "Lembrete de vencimento — Online Rastreamento" : "Fatura em aberto — Online Rastreamento";
    for (const ch of it.canais) {
      let status: "enviado" | "erro" | "sem_contato" = "enviado", erro: string | null = null;
      if (!ch.destino) status = "sem_contato";
      else {
        try { await enviar(db, brand, ch.canal, ch.destino, texto, assunto); enviados++; }
        catch (e: any) { status = "erro"; erro = String(e?.message ?? e).slice(0, 300); erros++; ultimoErro = erro; }
      }
      await db.from("fin_cobranca_envios").upsert({ lancamento_id: it.lancamentoId, documento: it.documento, passo: String(it.passo), canal: ch.canal, destino: ch.destino, status, erro }, { onConflict: "lancamento_id,passo,canal", ignoreDuplicates: true });
      if (status === "enviado" && it.documento) (porCliente.get(it.documento) ?? porCliente.set(it.documento, []).get(it.documento)!).push(`${ch.canal} (${it.passo < 0 ? `${-it.passo} dia(s) antes` : `D+${it.passo}`})`);
    }
  }
  for (const [doc, envios] of porCliente) {
    await db.from("fin_cobranca_acoes").insert({ documento: doc, tipo: "regua", observacao: `Régua de cobrança: ${envios.join(", ")}`, created_by: null });
  }
  const resumo = { enviados, erros, ultimoErro, itens: itens.length, pulados: itens.filter((i) => i.motivoPulo).length, manual: opts.manual };
  await db.from("fin_cobranca_config").update({ ultima_execucao_em: new Date().toISOString(), ultima_execucao: resumo }).eq("id", 1);
  return { ok: true, pulado: false, itens, enviados, erros, ultimoErro };
}

/** Cobrança avulsa: uma mensagem com todas as faturas vencidas do cliente, pelos canais escolhidos. */
export async function enviarCobrancaCliente(documento: string, canaisPedidos: { whatsapp: boolean; email: boolean }, userId: string, textoLivre?: string | null) {
  const db = await adminDb();
  const doc = soDigitos(documento);
  const hoje = hojeSP();
  const cfg = await lerConfig(db);
  const { data: c } = await db.from("fin_clientes").select("*").eq("documento", doc).maybeSingle();
  const { formatarDocumento } = await import("./finance-gsystem");
  const { data: lancs, error } = await db.from("fin_lancamentos")
    .select("id, valor, vencimento, contraparte, linha_digitavel, arquivo_url")
    .eq("tipo", "receber").eq("status", "aberto").lt("vencimento", hoje)
    .in("documento_contraparte", [doc, formatarDocumento(doc)]).order("vencimento");
  if (error) throw error;
  if (!lancs?.length) throw new Error("Este cliente não tem faturas vencidas em aberto.");
  const nome = c?.nome || lancs[0].contraparte || "cliente";
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataBR = (iso: string) => iso.split("-").reverse().join("/");
  const total = lancs.reduce((s: number, l: any) => s + Number(l.valor), 0);
  const linhas = lancs.map((l: any) => `• ${dataBR(l.vencimento)} — ${brl(Number(l.valor))}${l.arquivo_url ? ` — boleto: ${l.arquivo_url}` : l.linha_digitavel ? ` — linha: ${l.linha_digitavel}` : ""}`).join("\n");
  const texto = (textoLivre && textoLivre.trim())
    || `Olá, ${String(nome).split(/\s+/)[0]}! Consta(m) em aberto na Online Rastreamento ${lancs.length} fatura(s), total de ${brl(total)}:\n${linhas}\nSe já pagou, por favor nos envie o comprovante. Se precisar combinar outra data, é só responder esta mensagem.`;
  const brand = await canais(db, cfg);
  const feitos: string[] = [];
  const erros: string[] = [];
  const tel = telefoneWhatsApp(c?.telefone_cobranca || c?.telefone);
  const email = (c?.email_cobranca || c?.email || "").trim();
  if (canaisPedidos.whatsapp) {
    if (!tel) erros.push("WhatsApp: cliente sem telefone");
    else { try { await enviar(db, brand, "whatsapp", tel, texto, ""); feitos.push("WhatsApp"); } catch (e: any) { erros.push(`WhatsApp: ${e?.message ?? e}`); } }
  }
  if (canaisPedidos.email) {
    if (!email) erros.push("E-mail: cliente sem e-mail");
    else { try { await enviar(db, brand, "email", email, texto, "Faturas em aberto — Online Rastreamento"); feitos.push("e-mail"); } catch (e: any) { erros.push(`E-mail: ${e?.message ?? e}`); } }
  }
  if (feitos.length) {
    await db.from("fin_cobranca_acoes").insert({
      documento: doc, cliente_nome: nome, tipo: "contato", canal: feitos.join(", ").toLowerCase(), resultado: "enviado",
      valor: Math.round(total * 100) / 100, observacao: `Cobrança enviada por ${feitos.join(" e ")} (${lancs.length} fatura(s)).`,
      lancamento_ids: lancs.map((l: any) => l.id), created_by: userId,
    });
  }
  return { enviados: feitos, erros };
}
