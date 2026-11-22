/**
 * Envio de contrato pelo Autentique e leitura do retorno (webhook ou botão). Server-only.
 * O status só muda a partir da consulta à API do Autentique, nunca pelo corpo do webhook.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { montarDocumento, soDigitos, telefoneInternacional, type DadosContrato } from "@/lib/contratos";
import { gerarPdfContrato } from "@/lib/contrato-pdf.server";
import { consultarDocumentoAutentique, criarDocumentoAutentique, autentiqueSandbox } from "@/lib/autentique.server";

const db = supabaseAdmin as any;

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function evento(contratoId: string, tipo: string, descricao: string | null, userId: string | null = null, ip: string | null = null) {
  await db.from("contratos_eventos").insert({ contrato_id: contratoId, tipo, descricao, user_id: userId, ip });
}

export type Verificacao = "nenhuma" | "LIVE" | "PF_FACIAL" | "UPLOAD";

export async function enviarPeloAutentique(opts: {
  contratoId: string; userId: string; verificacao: Verificacao; canal: "email" | "whatsapp";
  modelos: { contrato: { conteudo: string; versao: number }; termo: { conteudo: string; versao: number } };
}) {
  const { data: c } = await db.from("contratos").select("*").eq("id", opts.contratoId).maybeSingle();
  if (!c) throw new Error("Contrato não encontrado.");
  if (c.status !== "rascunho") throw new Error("Só contratos em rascunho podem ser enviados pelo Autentique.");
  const email = String(c.signatario_email || "").trim();
  const fone = telefoneInternacional(c.signatario_telefone || "");
  if (opts.canal === "email" && !email.includes("@")) throw new Error("Informe o e-mail do signatário.");
  if (opts.canal === "whatsapp" && !fone) throw new Error("Informe o WhatsApp do signatário.");

  const { html, faltando } = montarDocumento(opts.modelos.contrato.conteudo, opts.modelos.termo.conteudo, c.dados as DadosContrato,
    { assinaturas: "Assinado eletronicamente pelas partes na plataforma Autentique, conforme certificado de assinaturas anexo." });
  if (faltando.length) throw new Error(`Preencha antes de enviar: ${faltando.join(", ")}.`);
  const hash = await sha256(html);
  const pdf = await gerarPdfContrato({ html, titulo: `Contrato nº ${c.numero}`, rodape: `Contrato nº ${c.numero} — ${c.cliente_nome} — SHA-256 do texto ${hash.slice(0, 16)}…` });

  // CONTRATADA: quem envia, pelo e-mail da conta.
  const { data: u } = await db.auth.admin.getUserById(opts.userId);
  const { data: perfil } = await db.from("profiles").select("name").eq("user_id", opts.userId).maybeSingle();
  const emailContratada = u?.user?.email;
  if (!emailContratada) throw new Error("Seu usuário não tem e-mail para assinar como CONTRATADA.");

  const doc = await criarDocumentoAutentique({
    nome: `Contrato nº ${c.numero} — ${c.cliente_nome}`,
    pdf,
    arquivo: `contrato-${c.numero}.pdf`,
    signatarios: [
      {
        nome: c.signatario_nome, acao: "SIGN", cpf: c.signatario_cpf ? soDigitos(c.signatario_cpf) : null,
        email: opts.canal === "email" ? email : null, telefone: opts.canal === "whatsapp" ? fone : null,
        verificacao: opts.verificacao === "nenhuma" ? null : opts.verificacao,
      },
      { nome: perfil?.name || "Online Rastreamento", email: emailContratada, acao: "SIGN" },
    ],
  });
  const sigs = doc.signatures || [];
  // A resposta traz as assinaturas na ordem dos signatários; o primeiro é o contratante.
  const contratante = sigs.find((s) => s.email && s.email.toLowerCase() === email.toLowerCase()) ?? sigs[0];
  const papeis = sigs.map((s) => ({
    public_id: s.public_id, nome: s.name,
    papel: s.public_id === contratante?.public_id ? "contratante" : s.email?.toLowerCase() === emailContratada.toLowerCase() ? "contratada" : "outro",
  }));
  const { error } = await db.from("contratos").update({
    status: "enviado", provedor: "autentique", provedor_documento_id: doc.id, provedor_link: contratante?.link?.short_link ?? null,
    provedor_signatarios: papeis, provedor_verificacao: opts.verificacao, provedor_sandbox: await autentiqueSandbox(),
    conteudo_html: html, hash_sha256: hash, enviado_em: new Date().toISOString(),
    modelos_versao: { licenciamento: opts.modelos.contrato.versao, termo_adesao: opts.modelos.termo.versao },
  }).eq("id", c.id).eq("status", "rascunho");
  if (error) throw new Error(error.message);
  await evento(c.id, "enviado", `Autentique${(await autentiqueSandbox()) ? " (teste)" : ""} — documento ${doc.id}, ${opts.canal === "email" ? "e-mail" : "WhatsApp"}, verificação ${opts.verificacao}. SHA-256 ${hash}`, opts.userId);
  return { documentoId: doc.id, link: contratante?.link?.short_link ?? null };
}

const quando = (ev: any) => (ev?.created_at ? new Date(ev.created_at).toISOString() : null);
const geo = (ev: any) => [ev?.geolocation?.city, ev?.geolocation?.state, ev?.geolocation?.country].filter(Boolean).join("/") || null;

/** Lê o documento no Autentique e grava assinaturas, recusas e o PDF assinado. */
export async function sincronizarAutentique(contratoId: string): Promise<{ status: string; mudou: boolean }> {
  const { data: c } = await db.from("contratos").select("*").eq("id", contratoId).maybeSingle();
  if (!c || c.provedor !== "autentique" || !c.provedor_documento_id) throw new Error("Contrato não está no Autentique.");
  const doc = await consultarDocumentoAutentique(c.provedor_documento_id);
  if (!doc) throw new Error("Documento não encontrado no Autentique.");
  const papeis: any[] = Array.isArray(c.provedor_signatarios) ? c.provedor_signatarios : [];
  const papelDe = (pid: string) => papeis.find((p) => p.public_id === pid)?.papel ?? "outro";
  const upd: Record<string, unknown> = {};
  const novosEventos: [string, string, string | null][] = [];

  for (const s of doc.signatures || []) {
    const papel = papelDe(s.public_id);
    const nome = s.user?.name || s.name || "";
    if (s.rejected && papel === "contratante" && c.status === "enviado" && !upd.status) {
      // Recusa encerra o contrato (antes só gerava evento e repetia a cada sincronização).
      Object.assign(upd, { status: "cancelado", cancelado_motivo: `Recusado no Autentique por ${nome}${s.rejected.reason ? `: ${s.rejected.reason}` : ""}` });
      novosEventos.push(["recusado", `${nome} recusou no Autentique${s.rejected.reason ? `: ${s.rejected.reason}` : ""}`, s.rejected.ip ?? null]);
    }
    if (s.viewed && papel === "contratante" && !c.visualizado_em) {
      upd.visualizado_em = quando(s.viewed);
      novosEventos.push(["visualizado", `Aberto no Autentique por ${nome}`, s.viewed.ip ?? null]);
    }
    if (!s.signed) continue;
    if (papel === "contratante" && !c.assinado_em && upd.status !== "cancelado") {
      Object.assign(upd, {
        status: "assinado", assinado_em: quando(s.signed), assinatura_nome: nome, assinatura_ip: s.signed.ip ?? null,
        assinatura_canal: `autentique${c.provedor_verificacao && c.provedor_verificacao !== "nenhuma" ? `:${c.provedor_verificacao}` : ""}`,
        assinatura_geo: geo(s.signed),
      });
      novosEventos.push(["assinado_contratante", `${nome} assinou no Autentique${geo(s.signed) ? ` (${geo(s.signed)})` : ""}`, s.signed.ip ?? null]);
    }
    if (papel === "contratada" && !c.contratada_assinado_em) {
      Object.assign(upd, { contratada_assinado_nome: nome, contratada_assinado_em: quando(s.signed), contratada_ip: s.signed.ip ?? null });
      novosEventos.push(["assinado_contratada", `${nome} assinou no Autentique`, s.signed.ip ?? null]);
    }
  }
  if (doc.files?.signed && doc.files.signed !== c.arquivo_assinado_url) upd.arquivo_assinado_url = doc.files.signed;
  if (Object.keys(upd).length) {
    const { error } = await db.from("contratos").update(upd).eq("id", c.id);
    if (error) throw new Error(error.message);
  }
  for (const [tipo, desc, ip] of novosEventos) await evento(c.id, tipo, desc, null, ip);
  if (upd.status === "assinado" && c.created_by) {
    await db.from("notifications").insert({
      user_id: c.created_by, type: "contrato", title: "✍️ Contrato assinado",
      message: `${upd.assinatura_nome} assinou o contrato nº ${c.numero} (${c.cliente_nome}) no Autentique.`, metadata: { contrato_id: c.id },
    });
  }
  return { status: (upd.status as string) ?? c.status, mudou: Object.keys(upd).length > 0 || novosEventos.length > 0 };
}

/** Do webhook: acha o contrato pelo id do documento e sincroniza. */
export async function sincronizarPorDocumento(documentoId: string) {
  const { data: c } = await db.from("contratos").select("id").eq("provedor_documento_id", documentoId).maybeSingle();
  if (!c) return null;
  return sincronizarAutentique(c.id);
}

/**
 * Traz para o painel os documentos que já existem na conta do Autentique (contratos antigos).
 * Cada documento vira um contrato "importado" (sem texto congelado; o PDF fica no Autentique).
 * Não repete: documentos já ligados a um contrato são pulados.
 * Roda em etapas de ~20 s (o servidor corta requisições longas): devolve `proximaPagina`
 * enquanto houver mais, e a tela chama de novo a partir dela.
 */
export async function importarDocumentosAutentique(userId: string, paginaInicial = 1) {
  const { contaAutentique, listarDocumentosAutentique } = await import("@/lib/autentique.server");
  const inicio = Date.now();
  const conta = await contaAutentique();
  const emailConta = String(conta?.email || "").toLowerCase();
  const POR_PAGINA = 30;
  let novos = 0, existentes = 0, total = 0;
  let page = paginaInicial;
  let proximaPagina: number | null = null;
  for (; page <= 200; page++) {
    const r = await listarDocumentosAutentique(page, POR_PAGINA);
    total = r.total ?? total;
    const docs = r.data || [];
    if (!docs.length) break;
    const ids = docs.map((d: any) => String(d.id));
    const { data: ja, error: eJa } = await db.from("contratos").select("provedor_documento_id").in("provedor_documento_id", ids);
    if (eJa) throw new Error(eJa.message);
    const jaSet = new Set((ja || []).map((x: any) => x.provedor_documento_id));
    const linhas: Record<string, unknown>[] = [];
    for (const d of docs) {
      if (jaSet.has(String(d.id))) { existentes++; continue; }
      linhas.push(linhaImportada(d, emailConta, userId));
    }
    if (linhas.length) {
      const { data: ins, error } = await db.from("contratos").insert(linhas).select("id, provedor_documento_id, enviado_em");
      if (error) throw new Error(`Falha ao gravar contratos importados: ${error.message}`);
      const eventos = (ins || []).map((x: any) => ({
        contrato_id: x.id, tipo: "importado", user_id: userId,
        descricao: `Importado do Autentique (documento ${x.provedor_documento_id}, criado em ${x.enviado_em ?? "—"})`,
      }));
      if (eventos.length) await db.from("contratos_eventos").insert(eventos);
      novos += ins?.length ?? 0;
    }
    if (page * POR_PAGINA >= (r.total ?? 0)) break;
    if (Date.now() - inicio > 20_000) { proximaPagina = page + 1; break; }
  }
  return { novos, existentes, total, proximaPagina };
}

function linhaImportada(d: any, emailConta: string, userId: string): Record<string, unknown> {
  const sigs: any[] = d.signatures || [];
  const assinantes = sigs.filter((s) => (s.action?.name ?? "SIGN") !== "APPROVE");
  const daConta = (s: any) => String(s.email || s.user?.email || "").toLowerCase() === emailConta;
  const contratante = assinantes.find((s) => !daConta(s)) ?? assinantes[0] ?? null;
  const contratada = assinantes.find((s) => daConta(s)) ?? null;
  const recusado = sigs.find((s) => s.rejected);
  const todosAssinaram = assinantes.length > 0 && assinantes.every((s) => s.signed);
  const status = recusado ? "cancelado" : todosAssinaram ? "assinado" : "enviado";
  const nomeContratante = contratante?.user?.name || contratante?.name || null;
  const iso = (v: any) => (v ? new Date(v).toISOString() : null);
  const row: Record<string, unknown> = {
    status, cliente_nome: d.name || "Documento do Autentique", cliente_documento: "",
    dados: { importado: true, origem: "autentique" }, provedor: "autentique", provedor_documento_id: String(d.id),
    provedor_link: contratante?.link?.short_link ?? null,
    provedor_signatarios: sigs.map((s) => ({ public_id: s.public_id, nome: s.user?.name || s.name, papel: s === contratante ? "contratante" : s === contratada ? "contratada" : "outro" })),
    signatario_nome: nomeContratante, signatario_email: contratante?.email || contratante?.user?.email || null,
    enviado_em: iso(d.created_at),
    visualizado_em: iso(contratante?.viewed?.created_at),
    arquivo_assinado_url: d.files?.signed ?? null,
    created_by: userId,
  };
  if (contratante?.signed) Object.assign(row, { assinado_em: iso(contratante.signed.created_at), assinatura_nome: nomeContratante, assinatura_ip: contratante.signed.ip ?? null, assinatura_canal: "autentique" });
  if (contratada?.signed) Object.assign(row, { contratada_assinado_nome: contratada.user?.name || contratada.name, contratada_assinado_em: iso(contratada.signed.created_at), contratada_ip: contratada.signed.ip ?? null });
  if (recusado) row.cancelado_motivo = `Recusado no Autentique${recusado.rejected?.reason ? `: ${recusado.rejected.reason}` : ""}`;
  return row;
}

/**
 * Consulta no Autentique todos os contratos ainda "enviados" (para quando o webhook não chegou).
 * Etapas de ~20 s; devolve quantos faltam.
 */
export async function sincronizarPendentesAutentique() {
  const inicio = Date.now();
  const { data: pend, error } = await db.from("contratos").select("id").eq("provedor", "autentique").eq("status", "enviado")
    .not("provedor_documento_id", "is", null).order("enviado_em", { ascending: true }).limit(500);
  if (error) throw new Error(error.message);
  let verificados = 0, assinados = 0, cancelados = 0, erros = 0;
  let ultimoErro: string | null = null;
  for (const c of pend || []) {
    if (Date.now() - inicio > 20_000) break;
    try {
      const r = await sincronizarAutentique(c.id);
      verificados++;
      if (r.status === "assinado") assinados++;
      if (r.status === "cancelado") cancelados++;
    } catch (e: any) { erros++; ultimoErro = String(e?.message ?? e); }
  }
  return { pendentes: pend?.length ?? 0, verificados, assinados, cancelados, erros, ultimoErro, faltam: (pend?.length ?? 0) - verificados - erros };
}

/** Contratos importados não têm os dados do sistema: permite completar cliente e vigência. */
export async function ajustarImportado(id: string, campos: { cliente_nome: string; cliente_documento: string; vigencia_inicio: string | null; vigencia_meses: number; renovacao_automatica: boolean }, userId: string) {
  const { data: c } = await db.from("contratos").select("id, dados").eq("id", id).maybeSingle();
  if (!c?.dados?.importado) throw new Error("Só contratos importados podem ser ajustados assim.");
  const { error } = await db.from("contratos").update(campos).eq("id", id);
  if (error) throw new Error(error.message);
  await evento(id, "ajustado", `Dados completados: ${campos.cliente_nome}, vigência ${campos.vigencia_inicio ?? "—"} (${campos.vigencia_meses} meses)`, userId);
}
