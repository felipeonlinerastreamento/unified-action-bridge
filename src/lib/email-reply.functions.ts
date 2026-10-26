import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Carrega a última mensagem do chamado, o canal e o contexto da caixa. */
async function loadTicketEmail(ticketId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getOutlookProfile, DEFAULT_CONNECTION_KEY } = await import("./outlook.server");
  const { data: rows } = await supabaseAdmin.from("email_processed")
    .select("message_id, email_channel_id, from_address")
    .eq("ticket_id", ticketId)
    .order("received_at", { ascending: false }).limit(1);
  const last = rows?.[0];
  if (!last) return null;
  const { data: channel } = await supabaseAdmin.from("email_channels")
    .select("email_address, connection_key").eq("id", last.email_channel_id).single();
  if (!channel) throw new Error("Canal de e-mail não encontrado.");
  const connectionKey = channel.connection_key || DEFAULT_CONNECTION_KEY;
  const me = await getOutlookProfile(connectionKey);
  const connectedEmail = me.mail || me.userPrincipalName || null;
  const ctx = { connectionKey, mailbox: channel.email_address, connectedEmail };
  const own = new Set([channel.email_address, connectedEmail].filter(Boolean).map((e) => String(e).toLowerCase()));
  return { last, ctx, own };
}

async function otherRecipients(info: NonNullable<Awaited<ReturnType<typeof loadTicketEmail>>>) {
  const { getMessageRecipients } = await import("./outlook.server");
  const sender = (info.last.from_address || "").toLowerCase();
  const all = await getMessageRecipients(info.ctx, info.last.message_id);
  const seen = new Set<string>();
  return all.filter((r) => {
    if (info.own.has(r.address) || r.address === sender || seen.has(r.address)) return false;
    seen.add(r.address);
    return true;
  });
}

/** Informa se o chamado veio de e-mail e quem mais está na conversa. */
export const getTicketEmailInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const info = await loadTicketEmail(data.ticketId);
    if (!info) return { isEmail: false, to: null as string | null, others: [] as { address: string; kind: "to" | "cc" }[] };
    let others: { address: string; kind: "to" | "cc" }[] = [];
    try {
      others = (await otherRecipients(info)).map((r) => ({ address: r.address, kind: r.kind }));
    } catch (e) {
      console.error("Falha ao ler destinatários:", e);
    }
    return { isEmail: true, to: info.last.from_address as string | null, others };
  });

export const sendTicketEmailReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    ticketId: z.string().uuid(),
    text: z.string().trim().min(1).max(10000),
    replyAll: z.boolean().optional().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { replyToMessage } = await import("./outlook.server");

    const info = await loadTicketEmail(data.ticketId);
    if (!info) throw new Error("Este chamado não foi aberto por e-mail.");
    const { last, ctx } = info;

    const { data: profile } = await supabaseAdmin.from("profiles")
      .select("name, signature_image_url").eq("user_id", context.userId).maybeSingle();

    const images: { name: string; contentType: string; base64: string; cid: string }[] = [];
    let sigHtml = `<p>Atenciosamente,<br/>${escapeHtml(profile?.name || "Equipe de Suporte")}</p>`;
    if (profile?.signature_image_url) {
      const { data: blob } = await supabaseAdmin.storage.from("user-signatures").download(profile.signature_image_url);
      if (blob) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        images.push({ name: "assinatura.png", contentType: blob.type || "image/png", base64: btoa(bin), cid: "assinatura" });
        sigHtml = `<p><img src="cid:assinatura" alt="Assinatura" style="max-width:600px"/></p>`;
      }
    }

    let others: { address: string; kind: "to" | "cc" }[] = [];
    if (data.replyAll) others = await otherRecipients(info).catch(() => []);

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(data.text).replace(/\n/g, "<br/>")}${sigHtml}</div>`;
    await replyToMessage(ctx, last.message_id, html, images, data.replyAll);

    const toList = [last.from_address, ...others.filter((o) => o.kind === "to").map((o) => o.address)].filter(Boolean);
    const ccList = others.filter((o) => o.kind === "cc").map((o) => o.address);
    const dest = `para ${toList.join(", ")}${ccList.length ? `, com cópia para ${ccList.join(", ")}` : ""}`;

    await supabaseAdmin.from("ticket_comments").insert({
      ticket_id: data.ticketId,
      user_id: context.userId,
      comment_type: "email_sent",
      content: `📤 Resposta enviada por e-mail ${dest}\n\n${data.text}`,
    });
    return { ok: true, to: dest };
  });
