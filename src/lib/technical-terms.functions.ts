import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { brandingFrom, escapeHtml, loadSettings as loadBrandSettings, loadSignature } from "./crm-proposal.functions";
import { hasPhoneDigits, isValidCpf, isValidEmail, maskCpf, onlyDigits } from "./crm-proposal";
import {
  FIXED_SERVICE_TYPES,
  fixedServiceLabel,
  isServiceType,
  serviceTypeLabel,
  buildTermUrl,
  canRespondTerm,
  missingChecklistItems,
  renderTermTemplate,
  schedulingGate,
  statusAfterDecision,
  termNumberLabel,
  type ChecklistItem,
  type TechnicalServiceType,
  type TechnicalTermStatus,
} from "./technical-terms";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function loadTermSettings(admin: Admin) {
  const { data } = await admin.from("technical_term_settings").select("*").eq("id", "default").maybeSingle();
  if (data) return data;
  await admin.from("technical_term_settings").upsert({ id: "default" }, { onConflict: "id", ignoreDuplicates: true });
  const { data: created, error } = await admin.from("technical_term_settings").select("*").eq("id", "default").single();
  if (error) throw new Error(error.message);
  return created;
}

/** Tipo de termo do catálogo (Configurações > CRM). */
async function loadTermType(admin: Admin, key: string) {
  const { data } = await admin.from("technical_term_types").select("*").eq("key", key).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    checklist: (Array.isArray(data.checklist) ? data.checklist : []).map((x: unknown) => String(x ?? "").trim()).filter(Boolean) as string[],
  };
}

export async function isManager(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  const roles = ((data as any[]) || []).map((r) => r.role);
  return roles.includes("admin") || roles.includes("gestor");
}

function publicBase(brand: { public_base_url?: string | null }) {
  let base = (brand.public_base_url || "").trim();
  if (!base) {
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    base = host ? `https://${host}` : "";
  }
  return base;
}

/** Envia o link do termo por WhatsApp e/ou e-mail; devolve canais enviados e erros. */
async function deliverTerm(
  admin: Admin,
  userId: string,
  term: any,
  opts: { sendWhatsapp: boolean; sendEmail: boolean; phone?: string | null; email?: string | null },
) {
  const brand = await loadBrandSettings(admin);
  // Mensagens do próprio tipo de termo; reserva: mensagens antigas gerais.
  const type = await loadTermType(admin, term.term_type || term.service_type);
  const legacy = type ? null : await loadTermSettings(admin);
  const templates = {
    whatsapp: (type?.whatsapp_template || legacy?.whatsapp_template || "") as string,
    emailSubject: (type?.email_subject || legacy?.email_subject || "") as string,
    email: (type?.email_template || legacy?.email_template || "") as string,
  };
  const url = buildTermUrl(publicBase(brand), term.token);
  const vars: Record<string, string> = {
    responsavel: term.responsible_name || "",
    cliente: term.client_name || "",
    placa: term.plate || "—",
    servico: serviceTypeLabel(term.service_type, null, term.service_label || type?.label),
    numero: termNumberLabel(term.seq),
    empresa: brand.company_name,
    link: url,
  };
  const sent: string[] = [];
  const errors: Record<string, string> = {};

  if (opts.sendWhatsapp) {
    try {
      let channelId = brand.whatsapp_channel_id as string | null;
      if (!channelId) {
        const { data: ch } = await admin.from("channels").select("id")
          .eq("is_active", true).not("zapi_instance_id", "is", null).order("created_at").limit(1).maybeSingle();
        channelId = ch?.id ?? null;
      }
      if (!channelId) throw new Error("Nenhum canal de WhatsApp ativo. Defina um em Configurações > CRM.");
      const { loadZapiChannel, zapiSendText } = await import("./zapi.server");
      const channel = await loadZapiChannel(admin, channelId);
      await zapiSendText(channel, String(opts.phone), renderTermTemplate(templates.whatsapp, vars));
      sent.push("whatsapp");
    } catch (e: any) {
      console.error("[termo-tecnico] WhatsApp falhou:", e?.message);
      errors.whatsapp = e?.message || "Falha no envio por WhatsApp";
    }
  }

  if (opts.sendEmail) {
    try {
      const q = admin.from("email_channels").select("email_address, connection_key");
      const { data: ch } = brand.email_channel_id
        ? await q.eq("id", brand.email_channel_id).maybeSingle()
        : await q.eq("is_active", true).order("created_at").limit(1).maybeSingle();
      const emailChannel = ch as { email_address: string; connection_key: string } | null;
      if (!emailChannel) throw new Error("Nenhuma caixa de e-mail configurada. Defina uma em Configurações > CRM.");
      const { getOutlookProfile, sendNewMail, DEFAULT_CONNECTION_KEY } = await import("./outlook.server");
      const connectionKey = emailChannel.connection_key || DEFAULT_CONNECTION_KEY;
      const me = await getOutlookProfile(connectionKey);
      const ctx = { connectionKey, mailbox: emailChannel.email_address, connectedEmail: me.mail || me.userPrincipalName || null };
      const sig = await loadSignature(admin, userId);
      const color = /^#[0-9a-f]{6}$/i.test(brand.primary_color) ? brand.primary_color : "#6c0015";
      const bodyText = escapeHtml(renderTermTemplate(templates.email, { ...vars, link: "{link}" }))
        .replace(/\n/g, "<br/>")
        .replace("{link}", `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
      const button = `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:${color};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Ver termo e responder</a></p>`;
      await sendNewMail(ctx, {
        to: [String(opts.email).trim()],
        subject: renderTermTemplate(templates.emailSubject, vars),
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">${bodyText}${button}${sig.html}</div>`,
        images: sig.images,
      });
      sent.push("email");
    } catch (e: any) {
      console.error("[termo-tecnico] E-mail falhou:", e?.message);
      errors.email = e?.message || "Falha no envio por e-mail";
    }
  }

  const merged = Array.from(new Set([...(term.sent_channels || []), ...sent]));
  await admin.from("technical_service_terms").update({
    sent_channels: merged,
    send_errors: errors,
    sent_at: sent.length ? new Date().toISOString() : term.sent_at ?? null,
  }).eq("id", term.id);

  return { url, sent, errors };
}

const sendFields = {
  sendWhatsapp: z.boolean().default(false),
  sendEmail: z.boolean().default(false),
};

// ============== EQUIPE (logado) ==============
export const createTechnicalTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    serviceType: z.enum(FIXED_SERVICE_TYPES.map((t) => t.key) as [string, ...string[]], { message: "Escolha Instalação, Retirada ou Manutenção." }),
    termType: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Escolha o termo de aceite."),
    ticketId: z.string().uuid().nullable().optional(),
    companyId: z.string().uuid().nullable().optional(),
    clientName: z.string().trim().max(200).optional().default(""),
    plate: z.string().trim().max(20).optional().default(""),
    equipmentId: z.string().trim().max(100).optional().default(""),
    address: z.string().trim().max(500).optional().default(""),
    responsibleName: z.string().trim().min(2, "Informe o nome do responsável pela frota.").max(200),
    responsiblePhone: z.string().trim().max(40).optional().default(""),
    responsibleEmail: z.string().trim().max(200).optional().default(""),
    description: z.string().trim().max(3000).optional().default(""),
    checklist: z.array(z.object({ label: z.string().max(300), checked: z.boolean() })).max(30).default([]),
    ...sendFields,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.sendWhatsapp && !data.sendEmail) throw new Error("Escolha WhatsApp e/ou e-mail para enviar o termo.");
    if (data.sendWhatsapp && !hasPhoneDigits(data.responsiblePhone)) throw new Error("Informe um WhatsApp válido com DDD.");
    if (data.sendEmail && !isValidEmail(data.responsibleEmail)) throw new Error("Informe um e-mail válido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const serviceLabel = fixedServiceLabel(data.serviceType);
    const cfg = await loadTermType(supabaseAdmin, data.termType);
    if (!cfg || !cfg.is_active) throw new Error("Este termo de aceite não existe ou está inativo.");
    if (cfg.requires_equipment_id && !data.equipmentId) throw new Error(`Informe o ID do equipamento para o termo ${cfg.label}.`);

    if (data.ticketId) {
      const { data: ticket } = await supabase.from("service_tickets").select("id, category").eq("id", data.ticketId).maybeSingle();
      if (!ticket) throw new Error("Chamado não encontrado.");
      if (ticket.category) {
        const { data: cat } = await supabase.from("ticket_categories")
          .select("technical_term_type").ilike("label", ticket.category).limit(1).maybeSingle();
        // Categoria que exige um termo específico: só esse termo pode ser enviado.
        if (cat && isServiceType(cat.technical_term_type) && cat.technical_term_type !== data.termType) {
          const { data: req } = await supabaseAdmin.from("technical_term_types").select("label").eq("key", cat.technical_term_type).maybeSingle();
          throw new Error(`A categoria "${ticket.category}" exige termo de ${req?.label ?? serviceTypeLabel(cat.technical_term_type)}.`);
        }
      }
    }

    const missing = missingChecklistItems(cfg.checklist, data.checklist);
    if (missing.length) throw new Error(`Marque o checklist antes de enviar: ${missing.join(", ")}.`);
    // Grava exatamente o que o atendente marcou (auditoria do checklist).
    const checklist: ChecklistItem[] = cfg.checklist.map((label) => ({
      label,
      checked: data.checklist.some((i) => i.label.trim() === label.trim() && i.checked),
    }));

    const { data: term, error } = await supabaseAdmin.from("technical_service_terms").insert({
      service_type: data.serviceType,
      term_type: data.termType,
      ticket_id: data.ticketId || null,
      company_id: data.companyId || null,
      client_name: data.clientName || null,
      plate: data.plate ? data.plate.toUpperCase() : null,
      equipment_id: data.equipmentId || null,
      address: data.address || null,
      responsible_name: data.responsibleName,
      responsible_phone: data.responsiblePhone || null,
      responsible_email: data.responsibleEmail || null,
      description: data.description || null,
      checklist: checklist as any,
      // Cópia congelada: editar o tipo depois não altera este termo.
      service_label: serviceLabel,
      term_label: cfg.label,
      term_title: cfg.title,
      term_text: cfg.body,
      created_by: userId,
    }).select("*").single();
    if (error || !term) throw new Error(error?.message || "Falha ao criar o termo.");

    const res = await deliverTerm(supabaseAdmin, userId, term, {
      sendWhatsapp: data.sendWhatsapp,
      sendEmail: data.sendEmail,
      phone: data.responsiblePhone,
      email: data.responsibleEmail,
    });

    if (data.ticketId) {
      await supabaseAdmin.from("ticket_comments").insert({
        ticket_id: data.ticketId,
        user_id: userId,
        comment_type: "status_change",
        content: `Termo de ${serviceLabel} ${termNumberLabel(term.seq)} (${cfg.label}) enviado para aceite de ${data.responsibleName}${res.sent.length ? ` (${res.sent.join(" e ")})` : ""}.`,
      });
    }
    return { id: term.id as string, url: res.url, sent: res.sent, errors: res.errors };
  });

export const resendTechnicalTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), ...sendFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: term } = await context.supabase.from("technical_service_terms").select("*").eq("id", data.id).maybeSingle();
    if (!term) throw new Error("Termo não encontrado.");
    if (term.status !== "pendente") throw new Error("Só é possível reenviar termos pendentes.");
    if (data.sendWhatsapp && !hasPhoneDigits(term.responsible_phone)) throw new Error("O termo não tem WhatsApp válido.");
    if (data.sendEmail && !isValidEmail(term.responsible_email)) throw new Error("O termo não tem e-mail válido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await deliverTerm(supabaseAdmin, context.userId, term, {
      sendWhatsapp: data.sendWhatsapp,
      sendEmail: data.sendEmail,
      phone: term.responsible_phone,
      email: term.responsible_email,
    });
  });

export const cancelTechnicalTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: term } = await context.supabase.from("technical_service_terms")
      .select("id, status, created_by").eq("id", data.id).maybeSingle();
    if (!term) throw new Error("Termo não encontrado.");
    if (term.created_by !== context.userId && !(await isManager(context))) {
      throw new Error("Só quem criou o termo ou um gestor pode cancelar.");
    }
    if (term.status === "enviada") throw new Error("Termo já enviado para agendamento não pode ser cancelado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("technical_service_terms").update({
      status: "cancelado", cancelled_at: new Date().toISOString(), cancelled_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== AGENDA (usado por seu-instalador.functions) ==============
/** Verifica se o usuário pode abrir solicitação/agendamento; devolve o termo quando informado. */
export async function assertSchedulingAllowed(context: { supabase: any; userId: string }, termId?: string | null) {
  const manager = await isManager(context);
  let status: TechnicalTermStatus | null = null;
  if (termId) {
    const { data: term } = await context.supabase.from("technical_service_terms").select("status").eq("id", termId).maybeSingle();
    if (!term) throw new Error("Termo de serviço técnico não encontrado.");
    status = term.status as TechnicalTermStatus;
  }
  const gate = schedulingGate({ isManager: manager, termStatus: termId ? status : undefined });
  if (!gate.allowed) throw new Error(gate.reason);
}

/** Marca o termo como enviado para agendamento (filtro "Enviadas"). */
export async function markTermScheduled(termId: string, userId: string, kind: string, result: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ref = result?.data?.id ?? result?.id ?? result?.data?.requestId ?? null;
  const { data: term } = await supabaseAdmin.from("technical_service_terms").update({
    status: "enviada",
    scheduled_at: new Date().toISOString(),
    scheduled_by: userId,
    schedule_kind: kind,
    schedule_reference: ref ? String(ref) : null,
  }).eq("id", termId).eq("status", "aceito").select("ticket_id, seq").maybeSingle();
  if (term?.ticket_id) {
    await supabaseAdmin.from("ticket_comments").insert({
      ticket_id: term.ticket_id,
      user_id: userId,
      comment_type: "status_change",
      content: `Termo ${termNumberLabel(term.seq)} enviado para agendamento no Seu Instalador${ref ? ` (ref. ${ref})` : ""}.`,
    });
  }
}

// ============== PÁGINA PÚBLICA (responsável da frota, sem login) ==============
// O token aleatório do link é a credencial; só os dados do próprio termo são
// devolvidos e apenas depois do CPF.
const tokenInput = (d: unknown) => z.object({ token: z.string().uuid() }).parse(d);
const cpfField = z.string().trim().max(20).refine(isValidCpf, "Informe um CPF válido.");

export const getPublicTerm = createServerFn({ method: "GET" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: term } = await supabaseAdmin.from("technical_service_terms")
      .select("status, service_type, service_label, seq").eq("token", data.token).maybeSingle();
    if (!term) return null;
    const brand = await loadBrandSettings(supabaseAdmin);
    return {
      status: term.status as TechnicalTermStatus,
      serviceType: term.service_type as TechnicalServiceType,
      serviceLabel: serviceTypeLabel(term.service_type, null, term.service_label),
      number: termNumberLabel(term.seq),
      branding: brandingFrom(brand),
    };
  });

export const unlockPublicTerm = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid(), cpf: cpfField }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("technical_service_terms").select("*").eq("token", data.token).maybeSingle();
    if (!t) throw new Error("Termo não encontrado.");
    if (t.status === "cancelado") throw new Error("Este termo foi cancelado pela empresa.");
    const now = new Date().toISOString();
    await supabaseAdmin.from("technical_service_terms").update({
      viewer_cpf: onlyDigits(data.cpf),
      cpf_verified_at: now,
      view_count: (t.view_count || 0) + 1,
      first_viewed_at: t.first_viewed_at || now,
      last_viewed_at: now,
    }).eq("id", t.id);
    const settings = await loadTermSettings(supabaseAdmin);
    const brand = await loadBrandSettings(supabaseAdmin);
    return {
      status: t.status as TechnicalTermStatus,
      canRespond: canRespondTerm(t.status as TechnicalTermStatus),
      number: termNumberLabel(t.seq),
      serviceType: t.service_type as TechnicalServiceType,
      serviceLabel: serviceTypeLabel(t.service_type, null, t.service_label),
      title: t.term_title as string,
      text: t.term_text as string,
      clientName: t.client_name as string | null,
      plate: t.plate as string | null,
      equipmentId: t.equipment_id as string | null,
      address: t.address as string | null,
      responsibleName: t.responsible_name as string,
      description: t.description as string | null,
      checklist: (Array.isArray(t.checklist) ? t.checklist : []) as ChecklistItem[],
      createdAt: t.created_at as string,
      respondedAt: t.responded_at as string | null,
      responderName: t.responder_name as string | null,
      responderNote: t.responder_note as string | null,
      requireRejectReason: !!settings.require_reject_reason,
      branding: brandingFrom(brand),
    };
  });

export const respondToTerm = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().uuid(),
    cpf: cpfField,
    decision: z.enum(["accept", "reject"]),
    name: z.string().trim().max(120).optional().default(""),
    note: z.string().trim().max(1000).optional().default(""),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("technical_service_terms")
      .select("id, status, responsible_name, created_by, ticket_id, seq, service_type, service_label, plate, client_name")
      .eq("token", data.token).maybeSingle();
    if (!t) throw new Error("Termo não encontrado.");
    if (!canRespondTerm(t.status as TechnicalTermStatus)) throw new Error("Este termo já foi respondido ou cancelado.");
    const settings = await loadTermSettings(supabaseAdmin);
    if (data.decision === "reject") {
      if (data.name.length < 2) throw new Error("Informe seu nome completo.");
      if (settings.require_reject_reason && !data.note) throw new Error("Conte o motivo da recusa.");
    }
    const cpf = onlyDigits(data.cpf);
    const responderName = (data.name || t.responsible_name || "Responsável").slice(0, 120);
    const status = statusAfterDecision(data.decision);
    const { data: updated, error } = await supabaseAdmin.from("technical_service_terms").update({
      status,
      responded_at: new Date().toISOString(),
      responder_name: responderName,
      responder_cpf: cpf,
      responder_note: data.note || null,
      responder_ip: getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || null,
      responder_user_agent: (getRequestHeader("user-agent") || "").slice(0, 300) || null,
    }).eq("id", t.id).eq("status", "pendente").select("id");
    if (error) throw new Error("Não foi possível registrar sua resposta. Tente novamente.");
    if (!updated?.length) throw new Error("Este termo já foi respondido.");

    const label = serviceTypeLabel(t.service_type, null, t.service_label);
    const summary = `${responderName} (CPF ${maskCpf(cpf)}) ${data.decision === "accept" ? "aceitou" : "recusou"} o termo ${termNumberLabel(t.seq)} de ${label}${t.plate ? ` — ${t.plate}` : ""}.${data.note ? ` Obs.: ${data.note}` : ""}`;
    if (t.ticket_id) {
      await supabaseAdmin.from("ticket_comments").insert({
        ticket_id: t.ticket_id, user_id: null, comment_type: "status_change", content: summary,
      });
    }
    if (settings.notify_creator && t.created_by) {
      await supabaseAdmin.from("notifications").insert({
        user_id: t.created_by,
        type: "technical_term",
        title: data.decision === "accept" ? "✅ Termo técnico aceito" : "❌ Termo técnico recusado",
        message: summary,
        metadata: { technical_term_id: t.id, ticket_id: t.ticket_id },
      });
    }
    return { ok: true, status };
  });

// ============== CATÁLOGO DE CATEGORIAS ==============
const SYNC_INTERVAL_MS = 30 * 60_000;

async function syncFromGSystem(admin: Admin) {
  const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
  const cadastros = await gsystemApiFetch("/cadastros");
  if (!Array.isArray(cadastros)) return { synced: 0, added: 0 };
  const tipos = cadastros
    .filter((c: any) => {
      const tipo = (c.Tipo || "").replace(/_/g, " ").toLowerCase();
      return tipo === "tipos de pendência" || tipo === "tipos de pendencia";
    })
    .filter((c: any) => c.Ativado !== false)
    .map((c: any) => ({ key: String(c.Codigo || c.DisplayName), label: String(c.DisplayName || c.Texto || c.Codigo) }));
  if (tipos.length === 0) return { synced: 0, added: 0 };

  const { data: existing } = await admin.from("ticket_categories").select("key, source");
  const known = new Map((existing || []).map((r: any) => [r.key, r.source]));
  const now = new Date().toISOString();
  const fresh = tipos.filter((t) => !known.has(t.key));
  if (fresh.length) {
    await admin.from("ticket_categories").insert(
      fresh.map((t) => ({ key: t.key, label: t.label, source: "gsystem", gsystem_key: t.key, last_synced_at: now })),
    );
  }
  // Atualiza o nome vindo do GSystem; ativo/termo/ordem continuam sendo decisão nossa.
  for (const t of tipos.filter((x) => known.has(x.key))) {
    await admin.from("ticket_categories").update({ label: t.label, gsystem_key: t.key, source: "gsystem", last_synced_at: now }).eq("key", t.key);
  }
  // Categoria removida do GSystem não pode mais ser usada lá.
  const keys = new Set(tipos.map((t) => t.key));
  const removed = (existing || []).filter((r: any) => r.source === "gsystem" && !keys.has(r.key)).map((r: any) => r.key);
  if (removed.length) await admin.from("ticket_categories").update({ is_active: false, last_synced_at: now }).in("key", removed);
  return { synced: tipos.length, added: fresh.length, removed: removed.length };
}

/** Lista as categorias do nosso catálogo, sincronizando com o GSystem a cada 30 min. */
export const listTicketCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ includeInactive: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await supabaseAdmin.from("ticket_categories")
      .select("last_synced_at").eq("source", "gsystem").order("last_synced_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    const stale = !last?.last_synced_at || Date.now() - new Date(last.last_synced_at).getTime() > SYNC_INTERVAL_MS;
    if (stale) {
      try { await syncFromGSystem(supabaseAdmin); } catch (e: any) { console.warn("[categorias] sync GSystem falhou:", e?.message); }
    }
    let q = context.supabase.from("ticket_categories").select("*").order("position").order("label");
    if (!data.includeInactive) q = q.eq("is_active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows || [];
  });

export const syncTicketCategoriesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isManager(context))) throw new Error("Apenas administradores e gestores podem sincronizar.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await syncFromGSystem(supabaseAdmin);
  });

// ============== CICLO DO SERVIÇO TÉCNICO ==============
/** Linha fixa "Protocolo #N – Tipo – Placa" do termo, usada na descrição da solicitação. */
export async function protocolPrefixForTerm(termId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { protocolPrefix } = await import("./technical-service-cycle");
  const { data: term } = await supabaseAdmin.from("technical_service_terms")
    .select("ticket_id, client_name").eq("id", termId).maybeSingle();
  if (!term) return null;
  let protocol: string | null = null;
  let clientName = (term.client_name as string | null) ?? null;
  if (term.ticket_id) {
    const { data: t } = await supabaseAdmin.from("service_tickets").select("protocol_number, company_id").eq("id", term.ticket_id).maybeSingle();
    protocol = t?.protocol_number != null ? String(t.protocol_number).padStart(5, "0") : null;
    if (t?.company_id) {
      const { data: c } = await supabaseAdmin.from("companies").select("name").eq("id", t.company_id).maybeSingle();
      clientName = (c?.name as string | null) || clientName;
    }
  }
  return protocolPrefix({ protocol, clientName });
}

/** Recusado → reenvia o mesmo conteúdo congelado como novo termo pendente. */
export const reissueRefusedTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), ...sendFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: old } = await context.supabase.from("technical_service_terms").select("*").eq("id", data.id).maybeSingle();
    if (!old) throw new Error("Termo não encontrado.");
    if (old.status !== "recusado") throw new Error("Só termos recusados podem ser reenviados como novo termo.");
    if (old.superseded_by) throw new Error("Este termo já foi substituído.");
    if (!data.sendWhatsapp && !data.sendEmail) throw new Error("Escolha WhatsApp e/ou e-mail.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: term, error } = await supabaseAdmin.from("technical_service_terms").insert({
      service_type: old.service_type, service_label: old.service_label, term_type: old.term_type, term_label: old.term_label, ticket_id: old.ticket_id, company_id: old.company_id,
      client_name: old.client_name, plate: old.plate, equipment_id: old.equipment_id, address: old.address,
      responsible_name: old.responsible_name, responsible_phone: old.responsible_phone, responsible_email: old.responsible_email,
      description: old.description, checklist: old.checklist, term_title: old.term_title, term_text: old.term_text,
      created_by: context.userId,
    }).select("*").single();
    if (error || !term) throw new Error(error?.message || "Falha ao reenviar.");
    await supabaseAdmin.from("technical_service_terms").update({ superseded_by: term.id }).eq("id", old.id);
    const res = await deliverTerm(supabaseAdmin, context.userId, term, {
      sendWhatsapp: data.sendWhatsapp, sendEmail: data.sendEmail, phone: term.responsible_phone, email: term.responsible_email,
    });
    if (term.ticket_id) {
      await supabaseAdmin.from("ticket_comments").insert({
        ticket_id: term.ticket_id, user_id: context.userId, comment_type: "status_change",
        content: `Termo recusado ${termNumberLabel(old.seq)} reenviado como ${termNumberLabel(term.seq)}.`,
      });
    }
    return { id: term.id as string, sent: res.sent, errors: res.errors };
  });

/** Recusado → encerra o protocolo registrando o motivo. */
export const closeProtocolByRefusal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid(), reason: z.string().trim().min(5, "Informe o motivo.").max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("service_tickets").update({
      status: "finalizado", tech_stage: "encerrado_recusa", technical_term_override_reason: data.reason,
      closed_at: new Date().toISOString(), closed_by: context.userId,
    } as any).eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    await context.supabase.from("ticket_comments").insert({
      ticket_id: data.ticketId, user_id: context.userId, comment_type: "status_change",
      content: `Protocolo encerrado por recusa do termo. Motivo: ${data.reason}`,
    });
    return { ok: true };
  });

/** Busca protocolos técnicos abertos por número, placa ou cliente. */
export const searchTechProtocols = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(80).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("service_tickets")
      .select("id, protocol_number, plate, contact_name, category, tech_stage, status, companies(name)")
      .not("tech_stage", "is", null).neq("status", "finalizado").order("created_at", { ascending: false }).limit(20);
    const s = data.q.replace(/[%,()]/g, "");
    if (s) q = q.or(`protocol_number.ilike.%${s}%,plate.ilike.%${s}%,contact_name.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows || []) as any[];
  });

/** Registra o resultado do teste e, se "Serviço concluído", finaliza o protocolo original. */
export const recordTechTestResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    testTicketId: z.string().uuid(), protocolId: z.string().uuid(), result: z.enum(["parcial", "concluido"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { protocolAcceptsTest, protocolAfterTest } = await import("./technical-service-cycle");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("service_tickets").select("id, status, tech_stage, protocol_number").eq("id", data.protocolId).maybeSingle();
    const err = protocolAcceptsTest(p as any);
    if (err) throw new Error(err);
    const { error } = await context.supabase.from("service_tickets")
      .update({ tech_protocol_id: data.protocolId, test_result: data.result } as any).eq("id", data.testTicketId);
    if (error) throw new Error(error.message);
    const eff = protocolAfterTest(data.result);
    if (eff.finalize) {
      const { error: e2 } = await context.supabase.from("service_tickets").update({
        status: "finalizado", tech_stage: eff.stage, closed_at: new Date().toISOString(), closed_by: context.userId,
      } as any).eq("id", data.protocolId);
      if (e2) throw new Error(e2.message);
    }
    await supabaseAdmin.from("ticket_comments").insert({
      ticket_id: data.protocolId, user_id: context.userId, comment_type: "status_change",
      content: data.result === "concluido" ? "Teste de equipamento: serviço concluído — protocolo finalizado." : "Teste de equipamento parcial registrado.",
    });
    return { ok: true, finalized: eff.finalize };
  });
