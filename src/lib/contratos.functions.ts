/**
 * Contratos: envio, assinatura eletrônica própria (CPF + código por WhatsApp/e-mail + IP/navegador
 * + hash SHA-256 do texto congelado) e assinatura interna (CONTRATADA e testemunhas).
 * As funções públicas (página /contrato/$token) usam service role e só liberam o texto após o CPF.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  montarDocumento, soDigitos, mascararCpf, mascararDestino, gerarCodigo, formatarDoc, dataExtenso,
  MAX_TENTATIVAS_CODIGO, VALIDADE_CODIGO_MIN, type DadosContrato,
} from "@/lib/contratos";
import { MODELO_CONTRATO_LICENCIAMENTO, MODELO_TERMO_ADESAO } from "@/lib/contratos-modelos";
import { isValidCpf } from "@/lib/crm-proposal";

type Admin = any;
const adminDb = async (): Promise<Admin> => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const ip = () => getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || null;
const ua = () => (getRequestHeader("user-agent") || "").slice(0, 300) || null;

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertContratos(supabase: any) {
  const { data, error } = await supabase.rpc("contratos_allowed");
  if (error || data !== true) throw new Error("Você não tem acesso a Contratos.");
}

async function evento(admin: Admin, contratoId: string, tipo: string, descricao: string | null, userId: string | null = null) {
  await admin.from("contratos_eventos").insert({ contrato_id: contratoId, tipo, descricao, ip: ip(), user_agent: ua(), user_id: userId });
}

async function marca(admin: Admin) {
  const { loadSettings } = await import("./crm-proposal.functions");
  return loadSettings(admin);
}

function baseUrl(brand: any): string {
  let base = String(brand?.public_base_url || "").trim();
  if (!base) {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    base = host ? `https://${host}` : "";
  }
  return base.replace(/\/$/, "");
}

/** Modelos atuais; na primeira vez grava os modelos convertidos dos documentos da empresa. */
async function modelos(admin: Admin) {
  const { data } = await admin.from("contratos_modelos").select("chave, nome, conteudo, versao");
  const porChave = new Map((data || []).map((m: any) => [m.chave, m]));
  const faltam = [
    { chave: "licenciamento", nome: "Contrato de Licenciamento de Uso de Software", conteudo: MODELO_CONTRATO_LICENCIAMENTO },
    { chave: "termo_adesao", nome: "Termo de Adesão (Anexo I)", conteudo: MODELO_TERMO_ADESAO },
  ].filter((m) => !porChave.has(m.chave));
  if (faltam.length) {
    await admin.from("contratos_modelos").upsert(faltam, { onConflict: "chave", ignoreDuplicates: true });
    for (const m of faltam) porChave.set(m.chave, { ...m, versao: 1 });
  }
  return { contrato: porChave.get("licenciamento") as any, termo: porChave.get("termo_adesao") as any };
}

// ------------------------------------------------------------------ envio de mensagens
async function enviarWhatsapp(admin: Admin, brand: any, telefone: string, texto: string) {
  let channelId = brand.whatsapp_channel_id as string | null;
  if (!channelId) {
    const { data: ch } = await admin.from("channels").select("id").eq("is_active", true).not("zapi_instance_id", "is", null).order("created_at").limit(1).maybeSingle();
    channelId = ch?.id ?? null;
  }
  if (!channelId) throw new Error("Nenhum canal de WhatsApp ativo. Defina um em Configurações > CRM.");
  const { loadZapiChannel, zapiSendText } = await import("./zapi.server");
  const channel = await loadZapiChannel(admin, channelId);
  await zapiSendText(channel, telefone, texto);
}

async function enviarEmail(admin: Admin, brand: any, para: string, assunto: string, html: string) {
  const q = admin.from("email_channels").select("email_address, connection_key");
  const { data: ch } = brand.email_channel_id ? await q.eq("id", brand.email_channel_id).maybeSingle() : await q.eq("is_active", true).order("created_at").limit(1).maybeSingle();
  if (!ch) throw new Error("Nenhuma caixa de e-mail configurada. Defina uma em Configurações > CRM.");
  const { getOutlookProfile, sendNewMail, DEFAULT_CONNECTION_KEY } = await import("./outlook.server");
  const connectionKey = ch.connection_key || DEFAULT_CONNECTION_KEY;
  const me = await getOutlookProfile(connectionKey);
  await sendNewMail({ connectionKey, mailbox: ch.email_address, connectedEmail: me.mail || me.userPrincipalName || null }, {
    to: [para.trim()], subject: assunto, html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">${html}</div>`, images: [],
  });
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ------------------------------------------------------------------ funções internas (logado)
export const prepararModelos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertContratos((context as any).supabase);
    const m = await modelos(await adminDb());
    return { ok: true, versoes: { licenciamento: m.contrato?.versao ?? 1, termo_adesao: m.termo?.versao ?? 1 } };
  });

/** Pré-visualização do documento com os modelos atuais (antes de enviar). */
export const previaContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dados: z.any() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertContratos((context as any).supabase);
    const m = await modelos(await adminDb());
    return montarDocumento(m.contrato.conteudo, m.termo.conteudo, data.dados as DadosContrato);
  });

/** Busca dados do cliente e veículos no GSystem pelo CPF/CNPJ. */
export const buscarClienteGsystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ documento: z.string().min(11).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertContratos((context as any).supabase);
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    const doc = soDigitos(data.documento);
    const pick = (o: any, ks: string[]) => { for (const k of ks) { const v = o?.[k]; if (v != null && String(v).trim()) return String(v).trim(); } return ""; };
    let cli: any = null;
    try { const r = await gsystemApiFetch(`/clientes/${encodeURIComponent(doc)}`); cli = Array.isArray(r) ? r[0] : r?.Items?.[0] ?? r; } catch { /* não encontrado */ }
    if (!cli || (!cli.Nome && !cli.RazaoSocial && !cli.Key)) return { encontrado: false } as const;
    const key = pick(cli, ["Key", "key", "Id", "Codigo"]);
    let end: any = cli.Endereco && typeof cli.Endereco === "object" ? cli.Endereco : cli;
    if (key && !pick(end, ["Logradouro", "Rua", "Endereco"])) {
      try { const r = await gsystemApiFetch(`/clientes/enderecos/${encodeURIComponent(key)}`); end = (Array.isArray(r) ? r[0] : r?.Items?.[0] ?? r) || end; } catch { /* sem endereço */ }
    }
    const endereco = [
      [pick(end, ["Logradouro", "Rua", "Endereco"]), pick(end, ["Numero", "numero"])].filter(Boolean).join(", "),
      pick(end, ["Complemento"]), pick(end, ["Bairro", "bairro"]),
      [pick(end, ["Cidade", "Municipio", "cidade"]), pick(end, ["Uf", "UF", "Estado"])].filter(Boolean).join("/"),
      pick(end, ["Cep", "CEP", "cep"]) ? `CEP ${pick(end, ["Cep", "CEP", "cep"])}` : "",
    ].filter(Boolean).join(", ");
    // Veículos do cliente: tenta o filtro por cliente e confere o campo Cliente de cada um.
    const veiculos: any[] = [];
    if (key) {
      let cursor: string | undefined;
      for (let pagina = 0; pagina < 20; pagina++) {
        const qs = new URLSearchParams({ Limit: "100", Cliente: key });
        if (cursor) qs.set("Cursor", cursor);
        let r: any;
        try { r = await gsystemApiFetch(`/veiculos?${qs.toString()}`); } catch { break; }
        const itens: any[] = Array.isArray(r) ? r : r?.Items ?? r?.items ?? [];
        for (const v of itens) {
          const dono = typeof v.Cliente === "object" ? pick(v.Cliente, ["Key", "Id", "Codigo"]) : String(v.Cliente ?? "");
          if (!dono || dono === key) veiculos.push(v);
        }
        cursor = Array.isArray(r) ? undefined : r?.Pagination?.NextCursor;
        if (!cursor || !r?.Pagination?.HasMore) break;
      }
    }
    return {
      encontrado: true as const,
      nome: pick(cli, ["RazaoSocial", "Nome", "NomeFantasia", "DisplayName"]),
      email: pick(cli, ["Email", "email", "EmailFinanceiro"]),
      telefone: pick(cli, ["Celular", "Telefone", "Fone"]),
      endereco,
      veiculos: veiculos.slice(0, 500).map((v) => ({
        placa: pick(v, ["Placa", "placa"]), chassi: pick(v, ["Chassi", "chassi"]), renavam: pick(v, ["Renavam", "renavam"]),
        marca: pick(v, ["Marca", "marca", "Fabricante"]), modelo: pick(v, ["Modelo", "modelo"]), ano: pick(v, ["AnoModelo", "Ano", "AnoFabricacao"]),
      })).filter((v) => v.placa),
    };
  });

/** Congela o texto, gera o hash e envia o link (WhatsApp e/ou e-mail). Também serve para reenviar. */
export const enviarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), whatsapp: z.boolean(), email: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertContratos(supabase);
    const admin = await adminDb();
    const { data: c } = await admin.from("contratos").select("*").eq("id", data.id).maybeSingle();
    if (!c) throw new Error("Contrato não encontrado.");
    if (c.status === "assinado" || c.status === "cancelado") throw new Error("Este contrato já foi assinado ou cancelado.");
    if (!c.signatario_nome || !isValidCpf(c.signatario_cpf)) throw new Error("Informe nome e CPF válido do signatário.");
    if (data.whatsapp && !soDigitos(c.signatario_telefone)) throw new Error("Informe o WhatsApp do signatário.");
    if (data.email && !String(c.signatario_email || "").includes("@")) throw new Error("Informe o e-mail do signatário.");

    if (c.status === "rascunho") {
      const m = await modelos(admin);
      const { html, faltando } = montarDocumento(m.contrato.conteudo, m.termo.conteudo, c.dados as DadosContrato);
      if (faltando.length) throw new Error(`Preencha antes de enviar: ${faltando.join(", ")}.`);
      const hash = await sha256(html);
      const { error } = await admin.from("contratos").update({
        status: "enviado", conteudo_html: html, hash_sha256: hash, enviado_em: new Date().toISOString(),
        modelos_versao: { licenciamento: m.contrato.versao, termo_adesao: m.termo.versao },
      }).eq("id", c.id).eq("status", "rascunho");
      if (error) throw new Error(error.message);
      await evento(admin, c.id, "enviado", `Texto congelado. SHA-256 ${hash}`, userId);
    } else {
      await evento(admin, c.id, "reenviado", null, userId);
    }

    const brand = await marca(admin);
    const url = `${baseUrl(brand)}/contrato/${c.token}`;
    const empresa = brand.company_name || "Online Rastreamento";
    const texto = `Olá, ${c.signatario_nome}! A ${empresa} enviou o contrato nº ${c.numero} (${c.cliente_nome}) para sua assinatura eletrônica.\n\nAcesse: ${url}\n\nPara abrir, informe seu CPF. A assinatura é confirmada com um código enviado a você.`;
    const enviados: string[] = [];
    const erros: Record<string, string> = {};
    if (data.whatsapp) {
      try { await enviarWhatsapp(admin, brand, c.signatario_telefone, texto); enviados.push("whatsapp"); } catch (e: any) { erros.whatsapp = e?.message ?? "Falha no WhatsApp"; }
    }
    if (data.email) {
      try {
        await enviarEmail(admin, brand, c.signatario_email, `Contrato nº ${c.numero} para assinatura — ${empresa}`,
          `${escHtml(texto).replace(/\n/g, "<br/>").replace(escHtml(url), `<a href="${escHtml(url)}">${escHtml(url)}</a>`)}`);
        enviados.push("email");
      } catch (e: any) { erros.email = e?.message ?? "Falha no e-mail"; }
    }
    return { url, enviados, erros };
  });

export const cancelarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), motivo: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertContratos(supabase);
    const admin = await adminDb();
    const { error } = await admin.from("contratos").update({ status: "cancelado", cancelado_motivo: data.motivo }).eq("id", data.id).neq("status", "cancelado");
    if (error) throw new Error(error.message);
    await admin.from("contratos_codigos").delete().eq("contrato_id", data.id);
    await evento(admin, data.id, "cancelado", data.motivo, userId);
    return { ok: true };
  });

/** Assinatura de usuário interno: CONTRATADA (uma) ou testemunha (até duas, pessoas diferentes). */
export const assinarInterno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), papel: z.enum(["contratada", "testemunha"]), cpf: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertContratos(supabase);
    const admin = await adminDb();
    const { data: c } = await admin.from("contratos").select("id, status, contratada_assinado_por, testemunhas").eq("id", data.id).maybeSingle();
    if (!c || (c.status !== "enviado" && c.status !== "assinado")) throw new Error("Envie o contrato antes de assinar.");
    const { data: perfil } = await admin.from("profiles").select("name").eq("user_id", userId).maybeSingle();
    const nome = perfil?.name || "Usuário";
    const agora = new Date().toISOString();
    if (data.papel === "contratada") {
      if (c.contratada_assinado_por) throw new Error("A CONTRATADA já assinou.");
      await admin.from("contratos").update({ contratada_assinado_por: userId, contratada_assinado_nome: nome, contratada_assinado_em: agora, contratada_ip: ip() }).eq("id", c.id);
      await evento(admin, c.id, "assinado_contratada", nome, userId);
    } else {
      const ts: any[] = Array.isArray(c.testemunhas) ? c.testemunhas : [];
      if (ts.length >= 2) throw new Error("O contrato já tem duas testemunhas.");
      if (ts.some((t) => t.user_id === userId) || c.contratada_assinado_por === userId) throw new Error("A testemunha deve ser outra pessoa.");
      const cpf = soDigitos(data.cpf);
      if (!isValidCpf(cpf)) throw new Error("Informe o CPF da testemunha.");
      ts.push({ user_id: userId, nome, cpf, assinado_em: agora, ip: ip() });
      await admin.from("contratos").update({ testemunhas: ts }).eq("id", c.id);
      await evento(admin, c.id, "assinado_testemunha", `${nome} (CPF ${mascararCpf(cpf)})`, userId);
    }
    return { ok: true };
  });

// ------------------------------------------------------------------ funções públicas (/contrato/$token)
const tokenSchema = z.string().uuid();
const cpfSchema = z.string().trim().max(20).refine((v) => isValidCpf(v), "Informe um CPF válido.");

async function contratoPorToken(admin: Admin, token: string) {
  const { data } = await admin.from("contratos").select("*").eq("token", token).maybeSingle();
  return data as any;
}
function confereCpf(c: any, cpf: string) {
  if (!c || c.status === "rascunho") throw new Error("Contrato não encontrado.");
  if (soDigitos(cpf) !== soDigitos(c.signatario_cpf)) throw new Error("CPF não confere com o signatário deste contrato.");
}

/** Só o básico para a tela inicial (sem o texto). */
export const getContratoPublico = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminDb();
    const c = await contratoPorToken(admin, data.token);
    if (!c || c.status === "rascunho") return null;
    const { brandingFrom } = await import("./crm-proposal.functions");
    return { numero: c.numero as number, cliente: c.cliente_nome as string, status: c.status as string, branding: brandingFrom(await marca(admin)) };
  });

export const abrirContrato = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, cpf: cpfSchema }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminDb();
    const c = await contratoPorToken(admin, data.token);
    confereCpf(c, data.cpf);
    if (!c.visualizado_em) await admin.from("contratos").update({ visualizado_em: new Date().toISOString() }).eq("id", c.id);
    await evento(admin, c.id, "visualizado", `CPF ${mascararCpf(c.signatario_cpf)}`);
    return {
      numero: c.numero as number, status: c.status as string, html: c.conteudo_html as string, hash: c.hash_sha256 as string,
      signatario: c.signatario_nome as string, assinadoEm: c.assinado_em as string | null,
      destinos: {
        whatsapp: soDigitos(c.signatario_telefone) ? mascararDestino(c.signatario_telefone) : null,
        email: String(c.signatario_email || "").includes("@") ? mascararDestino(c.signatario_email) : null,
      },
    };
  });

export const enviarCodigoAssinatura = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, cpf: cpfSchema, canal: z.enum(["whatsapp", "email"]) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminDb();
    const c = await contratoPorToken(admin, data.token);
    confereCpf(c, data.cpf);
    if (c.status !== "enviado") throw new Error("Este contrato não está aguardando assinatura.");
    const destino = data.canal === "whatsapp" ? soDigitos(c.signatario_telefone) : String(c.signatario_email || "");
    if (!destino) throw new Error("Não há contato cadastrado para este canal.");
    const { data: atual } = await admin.from("contratos_codigos").select("*").eq("contrato_id", c.id).maybeSingle();
    const agora = Date.now();
    let enviados = 1;
    let janela = new Date().toISOString();
    if (atual && agora - Date.parse(atual.janela_inicio) < 3_600_000) {
      if (atual.enviados_ultima_hora >= 5) throw new Error("Muitos códigos pedidos. Aguarde alguns minutos e tente de novo.");
      enviados = atual.enviados_ultima_hora + 1;
      janela = atual.janela_inicio;
    }
    const codigo = gerarCodigo(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
    await admin.from("contratos_codigos").upsert({
      contrato_id: c.id, codigo_hash: await sha256(`${c.id}:${codigo}`), expira_em: new Date(agora + VALIDADE_CODIGO_MIN * 60_000).toISOString(),
      tentativas: 0, canal: data.canal, destino, enviados_ultima_hora: enviados, janela_inicio: janela,
    }, { onConflict: "contrato_id" });
    const brand = await marca(admin);
    const msg = `Seu código para assinar o contrato nº ${c.numero} da ${brand.company_name || "Online Rastreamento"} é ${codigo}. Válido por ${VALIDADE_CODIGO_MIN} minutos. Não compartilhe este código.`;
    if (data.canal === "whatsapp") await enviarWhatsapp(admin, brand, destino, msg);
    else await enviarEmail(admin, brand, destino, `Código de assinatura — contrato nº ${c.numero}`, escHtml(msg));
    await evento(admin, c.id, "codigo_enviado", `${data.canal === "whatsapp" ? "WhatsApp" : "E-mail"} ${mascararDestino(destino)}`);
    return { ok: true, destino: mascararDestino(destino) };
  });

export const assinarContrato = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: tokenSchema, cpf: cpfSchema, codigo: z.string().regex(/^\d{6}$/, "Código de 6 dígitos."),
    nome: z.string().trim().min(3).max(120), aceite: z.literal(true),
  }).parse(d))
  .handler(async ({ data }) => {
    const admin = await adminDb();
    const c = await contratoPorToken(admin, data.token);
    confereCpf(c, data.cpf);
    if (c.status !== "enviado") throw new Error("Este contrato não está aguardando assinatura.");
    const { data: cod } = await admin.from("contratos_codigos").select("*").eq("contrato_id", c.id).maybeSingle();
    if (!cod) throw new Error("Peça o código de verificação primeiro.");
    if (Date.parse(cod.expira_em) < Date.now()) throw new Error("O código expirou. Peça um novo.");
    if (cod.tentativas >= MAX_TENTATIVAS_CODIGO) throw new Error("Muitas tentativas. Peça um novo código.");
    if ((await sha256(`${c.id}:${data.codigo}`)) !== cod.codigo_hash) {
      await admin.from("contratos_codigos").update({ tentativas: cod.tentativas + 1 }).eq("contrato_id", c.id);
      await evento(admin, c.id, "codigo_invalido", null);
      throw new Error("Código incorreto.");
    }
    const agora = new Date().toISOString();
    const { data: ok, error } = await admin.from("contratos").update({
      status: "assinado", assinado_em: agora, assinatura_nome: data.nome, assinatura_ip: ip(), assinatura_user_agent: ua(),
      assinatura_canal: `${cod.canal}:${mascararDestino(cod.destino)}`,
    }).eq("id", c.id).eq("status", "enviado").select("id");
    if (error || !ok?.length) throw new Error("Não foi possível registrar a assinatura. Tente novamente.");
    await admin.from("contratos_codigos").delete().eq("contrato_id", c.id);
    await evento(admin, c.id, "assinado_contratante",
      `${data.nome} (CPF ${mascararCpf(c.signatario_cpf)}), código confirmado por ${cod.canal === "whatsapp" ? "WhatsApp" : "e-mail"} ${mascararDestino(cod.destino)}. SHA-256 ${c.hash_sha256}`);
    if (c.created_by) {
      await admin.from("notifications").insert({
        user_id: c.created_by, type: "contrato", title: "✍️ Contrato assinado",
        message: `${data.nome} assinou o contrato nº ${c.numero} (${c.cliente_nome}) em ${dataExtenso(agora.slice(0, 10))}.`,
        metadata: { contrato_id: c.id },
      });
    }
    return { ok: true, assinadoEm: agora, hash: c.hash_sha256 as string, documento: formatarDoc(c.cliente_documento) };
  });
