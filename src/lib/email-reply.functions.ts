import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Informa se o chamado veio de e-mail (para exibir a opção de responder por e-mail). */
export const getTicketEmailInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("email_processed")
      .select("from_address, received_at")
      .eq("ticket_id", data.ticketId)
      .order("received_at", { ascending: false }).limit(1);
    const row = rows?.[0];
    return { isEmail: !!row, to: row?.from_address ?? null };
  });

export const sendTicketEmailReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ticketId: z.string().uuid(), text: z.string().trim().min(1).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { replyToMessage, getOutlookProfile, DEFAULT_CONNECTION_KEY } = await import("./outlook.server");

    const { data: rows } = await supabaseAdmin.from("email_processed")
      .select("message_id, email_channel_id, from_address")
      .eq("ticket_id", data.ticketId)
      .order("received_at", { ascending: false }).limit(1);
    const last = rows?.[0];
    if (!last) throw new Error("Este chamado não foi aberto por e-mail.");

    const { data: channel } = await supabaseAdmin.from("email_channels")
      .select("email_address, connection_key").eq("id", last.email_channel_id).single();
    if (!channel) throw new Error("Canal de e-mail não encontrado.");

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

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(data.text).replace(/\n/g, "<br/>")}${sigHtml}</div>`;
    const connectionKey = channel.connection_key || DEFAULT_CONNECTION_KEY;
    const me = await getOutlookProfile(connectionKey);
    await replyToMessage(
      { connectionKey, mailbox: channel.email_address, connectedEmail: me.mail || me.userPrincipalName || null },
      last.message_id, html, images,
    );

    await supabaseAdmin.from("ticket_comments").insert({
      ticket_id: data.ticketId,
      user_id: context.userId,
      comment_type: "email_sent",
      content: `📤 Resposta enviada por e-mail para ${last.from_address}\n\n${data.text}`,
    });
    return { ok: true, to: last.from_address };
  });
