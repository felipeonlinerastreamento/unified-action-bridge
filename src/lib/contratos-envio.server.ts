/**
 * Envio de links e avisos de Contratos pelo WhatsApp da Central e pela caixa de e-mail do Gestão Online.
 * Server-only e sem depender da requisição (serve para as telas e para a rotina diária).
 */
import { soDigitos } from "@/lib/contratos";
import type { ModoEnvio } from "@/lib/contratos-automacao";

type Admin = any;
export const HOST_PUBLICO = "https://gestao.onlinerastreamento.com.br";

export async function marcaContratos(admin: Admin) {
  const { loadSettings } = await import("./crm-proposal.functions");
  return loadSettings(admin);
}

/** Endereço público dos links: o configurado no CRM, senão o domínio de produção. */
export function basePublica(brand: any): string {
  const base = String(brand?.public_base_url || "").trim() || HOST_PUBLICO;
  return base.replace(/\/$/, "");
}

export async function eventoContrato(admin: Admin, contratoId: string, tipo: string, descricao: string | null, userId: string | null = null) {
  await admin.from("contratos_eventos").insert({ contrato_id: contratoId, tipo, descricao, user_id: userId });
}

export async function whatsappContrato(admin: Admin, brand: any, telefone: string, texto: string) {
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

export async function emailContrato(admin: Admin, brand: any, para: string, assunto: string, html: string) {
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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const textoParaHtml = (texto: string, url?: string) => {
  let h = esc(texto).replace(/\n/g, "<br/>");
  if (url) h = h.replace(esc(url), `<a href="${esc(url)}">${esc(url)}</a>`);
  return h;
};

/** Manda um texto ao signatário pelos canais pedidos; devolve o que saiu e o que falhou. */
export async function mandarAoSignatario(admin: Admin, brand: any, c: any, canais: { whatsapp: boolean; email: boolean }, assunto: string, texto: string, url?: string) {
  const enviados: string[] = [];
  const erros: Record<string, string> = {};
  if (canais.whatsapp) {
    try {
      if (!soDigitos(c.signatario_telefone)) throw new Error("sem WhatsApp do signatário");
      await whatsappContrato(admin, brand, c.signatario_telefone, texto); enviados.push("whatsapp");
    } catch (e: any) { erros.whatsapp = e?.message ?? "Falha no WhatsApp"; }
  }
  if (canais.email) {
    try {
      if (!String(c.signatario_email || "").includes("@")) throw new Error("sem e-mail do signatário");
      await emailContrato(admin, brand, c.signatario_email, assunto, textoParaHtml(texto, url)); enviados.push("email");
    } catch (e: any) { erros.email = e?.message ?? "Falha no e-mail"; }
  }
  return { enviados, erros };
}

const canaisDoModo = (modo: ModoEnvio) => ({ whatsapp: modo === "whatsapp" || modo === "whatsapp_email", email: modo === "email" || modo === "whatsapp_email" });

/**
 * Reenvia um contrato pendente para assinatura. Modo "autentique": o Autentique reenvia o convite
 * (contrato próprio cai para WhatsApp); demais modos: o link sai pelos canais do Gestão Online.
 */
export async function reenviarUmContrato(admin: Admin, brand: any, c: any, modo: ModoEnvio, userId: string | null, lembrete = true): Promise<{ ok: boolean; detalhe: string }> {
  if (c.status !== "enviado") throw new Error(c.status === "rascunho" ? "ainda é rascunho (envie pela tela do contrato)" : `está ${c.status}`);
  const empresa = brand.company_name || "Online Rastreamento";
  const assunto = `${lembrete ? "Lembrete: " : ""}Contrato nº ${c.numero} para assinatura — ${empresa}`;
  const montar = (url: string, rodape: string) => lembrete
    ? `Olá, ${c.signatario_nome || ""}! Lembrete: o contrato nº ${c.numero} (${c.cliente_nome}) da ${empresa} ainda aguarda sua assinatura eletrônica.\n\nAcesse: ${url}\n\n${rodape}`
    : `Olá, ${c.signatario_nome}! A ${empresa} enviou o contrato nº ${c.numero} (${c.cliente_nome}) para sua assinatura eletrônica.\n\nAcesse: ${url}\n\n${rodape}`;
  const quem = userId ? null : " (automático)";

  if (c.provedor === "autentique") {
    const { reenviarAssinaturasAutentique, linkAssinaturaAutentique } = await import("@/lib/autentique.server");
    const papeis: any[] = Array.isArray(c.provedor_signatarios) ? c.provedor_signatarios : [];
    const contratante = papeis.find((p) => p.papel === "contratante");
    if (!contratante?.public_id) throw new Error("signatário do Autentique não identificado");
    if (modo === "autentique") {
      await reenviarAssinaturasAutentique([contratante.public_id]);
      await eventoContrato(admin, c.id, "reenviado", `Convite reenviado pelo Autentique${quem ?? ""}`, userId);
      return { ok: true, detalhe: "reenviado pelo Autentique" };
    }
    const link = (await linkAssinaturaAutentique(contratante.public_id)) || c.provedor_link;
    if (!link) throw new Error("o Autentique não devolveu o link de assinatura");
    const r = await mandarAoSignatario(admin, brand, c, canaisDoModo(modo), assunto, montar(link, "A assinatura é feita na plataforma Autentique."), link);
    if (!r.enviados.length) throw new Error(Object.values(r.erros).join("; "));
    await eventoContrato(admin, c.id, "reenviado", `Link do Autentique reenviado por ${r.enviados.join(" e ")}${quem ?? ""}`, userId);
    return { ok: true, detalhe: `link do Autentique por ${r.enviados.join(" e ")}${Object.keys(r.erros).length ? ` (falhou: ${Object.values(r.erros).join("; ")})` : ""}` };
  }
  const efetivo: ModoEnvio = modo === "autentique" ? "whatsapp" : modo;
  const url = `${basePublica(brand)}/contrato/${c.token}`;
  const r = await mandarAoSignatario(admin, brand, c, canaisDoModo(efetivo), assunto, montar(url, "Para abrir, informe seu CPF. A assinatura é confirmada com um código enviado a você."), url);
  if (!r.enviados.length) throw new Error(Object.values(r.erros).join("; "));
  await eventoContrato(admin, c.id, "reenviado", `Reenviado por ${r.enviados.join(" e ")}${quem ?? ""}`, userId);
  return { ok: true, detalhe: `por ${r.enviados.join(" e ")}${Object.keys(r.erros).length ? ` (falhou: ${Object.values(r.erros).join("; ")})` : ""}` };
}
