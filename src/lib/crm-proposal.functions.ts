import { createServerFn } from "@tanstack/react-start";
import { basePublica } from "@/lib/public-url";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildProposalUrl,
  buildTemplateVars,
  canRespond,
  computeTotals,
  computeValidUntil,
  hasPhoneDigits,
  isProposalExpired,
  isValidCpf,
  isValidEmail,
  maskCpf,
  onlyDigits,
  renderProposalTemplate,
  resolveDecisionStage,
  type ProposalItem,
  type ProposalSnapshot,
  type ProposalStatus,
} from "./crm-proposal";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Lê os parâmetros da proposta; cria a linha padrão na primeira vez. */
export async function loadSettings(admin: Admin) {
  const { data } = await admin.from("crm_proposal_settings").select("*").eq("id", "default").maybeSingle();
  if (data) return data;
  await admin.from("crm_proposal_settings").upsert({ id: "default" }, { onConflict: "id", ignoreDuplicates: true });
  const { data: created, error } = await admin.from("crm_proposal_settings").select("*").eq("id", "default").single();
  if (error) throw new Error(error.message);
  return created;
}

export async function loadSignature(admin: Admin, userId: string) {
  const { data: profile } = await admin.from("profiles")
    .select("name, signature_image_url").eq("user_id", userId).maybeSingle();
  const images: { name: string; contentType: string; base64: string; cid: string }[] = [];
  let html = `<p>Atenciosamente,<br/>${escapeHtml(profile?.name || "Equipe Comercial")}</p>`;
  if (profile?.signature_image_url) {
    const { data: blob } = await admin.storage.from("user-signatures").download(profile.signature_image_url);
    if (blob) {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      images.push({ name: "assinatura.png", contentType: blob.type || "image/png", base64: btoa(bin), cid: "assinatura" });
      html = `<p><img src="cid:assinatura" alt="Assinatura" style="max-width:600px"/></p>`;
    }
  }
  return { html, images };
}

function toItems(raw: unknown, categoryName: (id?: string | null) => string): ProposalItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((it: any) => ({
      name: String(it?.name || "").trim() || categoryName(it?.categoryId),
      description: String(it?.description || ""),
      unit: String(it?.unit || "Serviço"),
      quantity: Number(it?.quantity) || 1,
      activationValue: Number(it?.activationValue) || 0,
      monthlyValue: Number(it?.monthlyValue) || 0,
    }))
    .filter((it) => it.name || it.activationValue > 0 || it.monthlyValue > 0);
}

// ============== ENVIO (usuário logado) ==============
export const sendProposalToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    opportunityId: z.string().uuid(),
    quoteId: z.string().uuid().nullable().optional(),
    sendWhatsapp: z.boolean().default(false),
    sendEmail: z.boolean().default(false),
    phone: z.string().max(40).nullable().optional(),
    email: z.string().max(200).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    { const { data: ok } = await context.supabase.rpc("crm_tab_allowed", { _tab: "pipeline" }); if (ok !== true) throw new Error("Você não tem acesso à aba Pipeline do CRM."); }
    const { supabase, userId, claims } = context;
    if (data.sendWhatsapp && !hasPhoneDigits(data.phone)) throw new Error("Informe um WhatsApp válido com DDD.");
    if (data.sendEmail && !isValidEmail(data.email)) throw new Error("Informe um e-mail válido.");

    const { data: opp, error: oppErr } = await supabase.from("crm_opportunities").select("*").eq("id", data.opportunityId).single();
    if (oppErr || !opp) throw new Error("Oportunidade não encontrada.");

    const { data: cats } = await supabase.from("crm_categories").select("id, name");
    const categoryName = (id?: string | null) => (cats || []).find((c: any) => c.id === id)?.name || "Serviço";

    let quote: any = null;
    if (data.quoteId) {
      const { data: q } = await supabase.from("crm_opportunity_quotes").select("*").eq("id", data.quoteId).eq("opportunity_id", opp.id).single();
      if (!q) throw new Error("Versão da proposta não encontrada.");
      quote = q;
    }
    let items = toItems(quote ? quote.items : opp.contract_items, categoryName);
    if (!quote && items.length === 0) {
      const { data: latest } = await supabase.from("crm_opportunity_quotes").select("*")
        .eq("opportunity_id", opp.id).order("quote_number", { ascending: false }).limit(1).maybeSingle();
      if (latest) { quote = latest; items = toItems(latest.items, categoryName); }
    }
    if (items.length === 0) throw new Error("Adicione itens à proposta antes de enviar.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadSettings(supabaseAdmin);

    const ownerId = opp.owner_id || userId;
    const { data: owner } = await supabaseAdmin.from("profiles").select("name").eq("user_id", ownerId).maybeSingle();

    const issuedAt = new Date();
    const validUntil = computeValidUntil(issuedAt, settings.validity_days);
    const snapshot: ProposalSnapshot = {
      title: opp.title,
      quoteNumber: quote?.quote_number ?? null,
      client: {
        companyName: opp.company_name || null,
        contactName: opp.contact_name || null,
        phone: data.phone || opp.contact_phone || null,
        email: data.email || opp.contact_email || null,
        cnpj: opp.cnpj || null,
      },
      owner: { name: owner?.name || null, email: ownerId === userId ? ((claims as any)?.email ?? null) : null },
      items,
      totals: computeTotals(items),
      notes: opp.notes || null,
      introText: settings.intro_text,
      termsText: settings.terms_text,
      issuedAt: issuedAt.toISOString(),
      validUntil: validUntil.toISOString(),
    };

    const { data: link, error: linkErr } = await supabase.from("crm_proposal_links").insert({
      opportunity_id: opp.id,
      quote_id: quote?.id ?? null,
      snapshot: snapshot as any,
      expires_at: validUntil.toISOString(),
      created_by: userId,
    }).select("id, token").single();
    if (linkErr || !link) throw new Error(linkErr?.message || "Falha ao criar o link da proposta.");

    const base = basePublica(settings.public_base_url);
    const url = buildProposalUrl(base, link.token);
    const vars = buildTemplateVars(snapshot, settings.company_name, url);

    const results: { whatsapp?: { ok: boolean; error?: string }; email?: { ok: boolean; error?: string } } = {};
    const sentChannels: string[] = [];

    if (data.sendWhatsapp) {
      try {
        let channelId = settings.whatsapp_channel_id as string | null;
        if (!channelId) {
          const { data: ch } = await supabaseAdmin.from("channels").select("id")
            .eq("is_active", true).not("zapi_instance_id", "is", null).order("created_at").limit(1).maybeSingle();
          channelId = ch?.id ?? null;
        }
        if (!channelId) throw new Error("Nenhum canal de WhatsApp ativo. Defina um em Configurações > CRM.");
        const { loadZapiChannel, zapiSendText } = await import("./zapi.server");
        const channel = await loadZapiChannel(supabaseAdmin, channelId);
        await zapiSendText(channel, String(data.phone), renderProposalTemplate(settings.whatsapp_template, vars));
        results.whatsapp = { ok: true };
        sentChannels.push("whatsapp");
      } catch (e: any) {
        console.error("[proposta] WhatsApp falhou:", e?.message);
        results.whatsapp = { ok: false, error: e?.message || "Falha no envio por WhatsApp" };
      }
    }

    if (data.sendEmail) {
      try {
        let emailChannel: { email_address: string; connection_key: string } | null = null;
        const q = supabaseAdmin.from("email_channels").select("email_address, connection_key");
        if (settings.email_channel_id) {
          const { data: ch } = await q.eq("id", settings.email_channel_id).maybeSingle();
          emailChannel = ch as any;
        } else {
          const { data: ch } = await q.eq("is_active", true).order("created_at").limit(1).maybeSingle();
          emailChannel = ch as any;
        }
        if (!emailChannel) throw new Error("Nenhuma caixa de e-mail configurada. Defina uma em Configurações > CRM.");
        const { getOutlookProfile, sendNewMail, DEFAULT_CONNECTION_KEY } = await import("./outlook.server");
        const connectionKey = emailChannel.connection_key || DEFAULT_CONNECTION_KEY;
        const me = await getOutlookProfile(connectionKey);
        const ctx = { connectionKey, mailbox: emailChannel.email_address, connectedEmail: me.mail || me.userPrincipalName || null };
        const sig = await loadSignature(supabaseAdmin, userId);
        const color = /^#[0-9a-f]{6}$/i.test(settings.primary_color) ? settings.primary_color : "#6c0015";
        const bodyText = escapeHtml(renderProposalTemplate(settings.email_template, { ...vars, link: "{link}" }))
          .replace(/\n/g, "<br/>")
          .replace("{link}", `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
        const button = `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:${color};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Ver proposta e responder</a></p>`;
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">${bodyText}${button}${sig.html}</div>`;
        await sendNewMail(ctx, {
          to: [String(data.email).trim()],
          subject: renderProposalTemplate(settings.email_subject, vars),
          html,
          images: sig.images,
        });
        results.email = { ok: true };
        sentChannels.push("email");
      } catch (e: any) {
        console.error("[proposta] E-mail falhou:", e?.message);
        results.email = { ok: false, error: e?.message || "Falha no envio por e-mail" };
      }
    }

    const sendErrors: Record<string, string> = {};
    if (results.whatsapp?.error) sendErrors.whatsapp = results.whatsapp.error;
    if (results.email?.error) sendErrors.email = results.email.error;
    await supabase.from("crm_proposal_links").update({
      sent_channels: sentChannels,
      sent_to_phone: data.sendWhatsapp ? data.phone ?? null : null,
      sent_to_email: data.sendEmail ? data.email ?? null : null,
      send_errors: sendErrors,
    }).eq("id", link.id);

    // Ao enviar, a oportunidade em aberto vai para a etapa "Proposta": a configurada em
    // Configurações > CRM ou, se não houver, a etapa chamada "Proposta" (só avança, nunca volta).
    if (opp.status === "open" && sentChannels.length > 0) {
      const { data: allStages } = await supabase.from("crm_pipeline_stages")
        .select("id, name, position, is_won, is_lost, default_probability, is_active");
      const active = (allStages || []).filter((x: any) => x.is_active !== false);
      const current = active.find((x: any) => x.id === opp.stage_id);
      const target = settings.sent_stage_id
        ? active.find((x: any) => x.id === settings.sent_stage_id)
        : active.find((x: any) => /proposta/i.test(String(x.name)) && !x.is_won && !x.is_lost);
      const advances = !current || settings.sent_stage_id || Number(target?.position ?? 0) > Number(current.position ?? 0);
      if (target && target.id !== opp.stage_id && !target.is_won && !target.is_lost && advances) {
        await supabase.from("crm_opportunities")
          .update({ stage_id: target.id, probability: target.default_probability ?? opp.probability })
          .eq("id", opp.id);
      }
    }

    return { token: link.token as string, url, results };
  });

export const cancelProposalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    { const { data: ok } = await context.supabase.rpc("crm_tab_allowed", { _tab: "pipeline" }); if (ok !== true) throw new Error("Você não tem acesso à aba Pipeline do CRM."); }
    const { error } = await context.supabase.from("crm_proposal_links")
      .update({ status: "cancelled" }).eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== PÁGINA PÚBLICA (cliente, sem login) ==============
// O token (UUID aleatório) do link é a credencial; só dados da própria
// proposta são devolvidos. Os itens e valores só são liberados depois que
// o visitante informa um CPF válido (registrado no link).
const tokenInput = (d: unknown) => z.object({ token: z.string().uuid() }).parse(d);

export function brandingFrom(s: Awaited<ReturnType<typeof loadSettings>>) {
  return {
    companyName: s.company_name,
    cnpj: s.company_cnpj,
    phone: s.company_phone,
    email: s.company_email,
    website: s.company_website,
    address: s.company_address,
    logoUrl: s.logo_url,
    primaryColor: /^#[0-9a-f]{6}$/i.test(s.primary_color) ? s.primary_color : "#6c0015",
    footer: s.footer_text,
  };
}

/** Dados da tela de entrada (antes do CPF): sem itens, valores ou dados do cliente. */
export const getPublicProposal = createServerFn({ method: "GET" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin.from("crm_proposal_links")
      .select("status, snapshot").eq("token", data.token).maybeSingle();
    if (!link) return null;
    const s = await loadSettings(supabaseAdmin);
    const snap = link.snapshot as unknown as ProposalSnapshot;
    return {
      status: link.status as ProposalStatus,
      quoteNumber: snap?.quoteNumber ?? null,
      branding: brandingFrom(s),
    };
  });

const cpfField = z.string().trim().max(20).refine(isValidCpf, "Informe um CPF válido.");

/** Libera a proposta completa após o CPF; registra o CPF e conta a visualização. */
export const unlockPublicProposal = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid(), cpf: cpfField }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin.from("crm_proposal_links")
      .select("id, status, snapshot, expires_at, responded_at, responder_name, responder_note, view_count, first_viewed_at")
      .eq("token", data.token).maybeSingle();
    if (!link) throw new Error("Proposta não encontrada.");
    const status = link.status as ProposalStatus;
    if (status === "cancelled") throw new Error("Esta proposta foi cancelada pela empresa.");

    const now = new Date().toISOString();
    await supabaseAdmin.from("crm_proposal_links").update({
      viewer_cpf: onlyDigits(data.cpf),
      cpf_verified_at: now,
      view_count: (link.view_count || 0) + 1,
      first_viewed_at: link.first_viewed_at || now,
      last_viewed_at: now,
    }).eq("id", link.id);

    const s = await loadSettings(supabaseAdmin);
    return {
      status,
      expired: status === "pending" && isProposalExpired(link.expires_at),
      canRespond: canRespond(status, link.expires_at),
      expiresAt: link.expires_at as string | null,
      respondedAt: link.responded_at as string | null,
      responderName: link.responder_name as string | null,
      responderNote: link.responder_note as string | null,
      snapshot: link.snapshot as unknown as ProposalSnapshot,
      requireRejectReason: !!s.require_reject_reason,
      branding: brandingFrom(s),
    };
  });

export const respondToProposal = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().uuid(),
    cpf: cpfField,
    decision: z.enum(["accept", "reject"]),
    name: z.string().trim().max(120).optional().default(""),
    note: z.string().trim().max(1000).optional().default(""),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin.from("crm_proposal_links")
      .select("id, status, expires_at, opportunity_id, created_by, snapshot").eq("token", data.token).maybeSingle();
    if (!link) throw new Error("Proposta não encontrada.");
    if (!canRespond(link.status as ProposalStatus, link.expires_at)) {
      throw new Error(link.status === "pending" ? "Esta proposta está vencida." : "Esta proposta já foi respondida ou cancelada.");
    }
    const settings = await loadSettings(supabaseAdmin);
    if (data.decision === "reject") {
      if (data.name.length < 2) throw new Error("Informe seu nome completo.");
      if (settings.require_reject_reason && !data.note) throw new Error("Conte o motivo da recusa.");
    }

    const snap = link.snapshot as any;
    const cpf = onlyDigits(data.cpf);
    // No aceite o cliente só confirma (e opcionalmente comenta); o nome vem da proposta.
    const responderName = (data.name
      || snap?.client?.contactName || snap?.client?.companyName || "Cliente").slice(0, 120);

    const now = new Date().toISOString();
    const status = data.decision === "accept" ? "accepted" : "rejected";
    const { data: updated, error } = await supabaseAdmin.from("crm_proposal_links").update({
      status,
      responded_at: now,
      responder_name: responderName,
      responder_note: data.note || null,
      responder_cpf: cpf,
      responder_ip: getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || null,
      responder_user_agent: (getRequestHeader("user-agent") || "").slice(0, 300) || null,
    }).eq("id", link.id).eq("status", "pending").select("id");
    if (error) throw new Error("Não foi possível registrar sua resposta. Tente novamente.");
    if (!updated?.length) throw new Error("Esta proposta já foi respondida.");

    // Atualiza a oportunidade no CRM.
    const { data: stages } = await supabaseAdmin.from("crm_pipeline_stages").select("id, is_won, is_lost, is_active, position");
    const stageId = resolveDecisionStage(
      data.decision,
      data.decision === "accept" ? settings.accepted_stage_id : settings.rejected_stage_id,
      stages || [],
    );
    const oppUpdate: { status: string; probability: number; closed_at: string; loss_reason?: string; stage_id?: string } = data.decision === "accept"
      ? { status: "won", probability: 100, closed_at: now }
      : { status: "lost", probability: 0, closed_at: now, loss_reason: `Recusada pelo cliente (${responderName}) pelo link: ${data.note || "sem motivo informado"}`.slice(0, 500) };
    if (stageId) oppUpdate.stage_id = stageId;
    const { data: opp, error: oppErr } = await supabaseAdmin.from("crm_opportunities")
      .update(oppUpdate).eq("id", link.opportunity_id).select("owner_id, title").single();
    if (oppErr) console.error("[proposta] falha ao atualizar oportunidade:", oppErr.message);

    // Contratos: a proposta aceita vira rascunho de contrato (Configurações › Contratos).
    if (data.decision === "accept") {
      const { criarRascunhoDaProposta } = await import("@/lib/contratos-automacao.server");
      await criarRascunhoDaProposta(link.id, snap, opp?.owner_id || link.created_by || null);
    }

    if (settings.notify_owner) {
      const target = opp?.owner_id || link.created_by;
      if (target) {
        const client = snap?.client?.companyName || snap?.client?.contactName || "Cliente";
        await supabaseAdmin.from("notifications").insert({
          user_id: target,
          type: "crm_proposal",
          title: data.decision === "accept" ? "✅ Proposta aceita" : "❌ Proposta recusada",
          message: `${client} ${data.decision === "accept" ? "aceitou" : "recusou"} a proposta "${opp?.title || snap?.title || ""}" (${responderName}, CPF ${maskCpf(cpf)}).${data.note ? ` Obs.: ${data.note}` : ""}`,
          metadata: { opportunity_id: link.opportunity_id, proposal_link_id: link.id },
        });
      }
    }
    return { ok: true, status };
  });
