// Lógica de polling de e-mails Office 365 e criação automática de atendimentos
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listUnreadMessages, markMessageAsRead, htmlToPlainText, type OutlookMessage } from "./outlook.server";

interface PollResult {
  channel_id: string;
  email: string;
  fetched: number;
  created_tickets: number;
  skipped: number;
  errors: string[];
}

function generateAttendanceId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EM-${ts}-${rand}`;
}

function shouldIgnore(msg: OutlookMessage, ignoreDomains: string[], ignoreEmails: string[]) {
  const addr = msg.from?.emailAddress?.address?.toLowerCase() || "";
  if (!addr) return true;
  if (ignoreEmails.map((e) => e.toLowerCase()).includes(addr)) return true;
  const domain = addr.split("@")[1] || "";
  if (ignoreDomains.map((d) => d.toLowerCase().replace(/^@/, "")).includes(domain)) return true;
  return false;
}

export async function pollEmailChannel(channelId: string): Promise<PollResult> {
  const { data: channel, error: chErr } = await supabaseAdmin
    .from("email_channels").select("*").eq("id", channelId).single();
  if (chErr || !channel) throw new Error(`Canal de e-mail não encontrado: ${channelId}`);

  const result: PollResult = {
    channel_id: channelId,
    email: channel.email_address,
    fetched: 0,
    created_tickets: 0,
    skipped: 0,
    errors: [],
  };

  if (!channel.is_active || !channel.polling_enabled) {
    result.errors.push("Canal inativo ou polling desabilitado");
    return result;
  }

  let messages: OutlookMessage[] = [];
  try {
    messages = await listUnreadMessages(25);
    result.fetched = messages.length;
  } catch (e: any) {
    const errMsg = e?.message || String(e);
    result.errors.push(errMsg);
    await supabaseAdmin.from("email_channels")
      .update({ last_polled_at: new Date().toISOString(), last_poll_status: "error", last_poll_error: errMsg })
      .eq("id", channelId);
    return result;
  }

  for (const msg of messages) {
    try {
      // Filtros
      if (shouldIgnore(msg, channel.ignore_domains || [], channel.ignore_emails || [])) {
        result.skipped++;
        if (channel.mark_as_read) await markMessageAsRead(msg.id).catch(() => {});
        continue;
      }

      // Já processado?
      const { data: exist } = await supabaseAdmin
        .from("email_processed").select("id")
        .eq("email_channel_id", channelId).eq("message_id", msg.id).maybeSingle();
      if (exist) {
        result.skipped++;
        if (channel.mark_as_read) await markMessageAsRead(msg.id).catch(() => {});
        continue;
      }

      const fromAddr = msg.from?.emailAddress?.address || "(desconhecido)";
      const fromName = msg.from?.emailAddress?.name || fromAddr;
      const subject = (msg.subject || "(sem assunto)").trim();
      const bodyContent = msg.body?.content || msg.bodyPreview || "";
      const bodyText = msg.body?.contentType?.toLowerCase() === "html"
        ? htmlToPlainText(bodyContent) : bodyContent;

      // Tenta encontrar contato/empresa por e-mail
      let companyId: string | null = null;
      try {
        const { data: contact } = await supabaseAdmin
          .from("contacts").select("company_id").eq("email", fromAddr).maybeSingle();
        if (contact?.company_id) companyId = contact.company_id;
      } catch {}

      // Cria ticket
      const attendanceId = generateAttendanceId();
      const notes = `📧 E-mail recebido de ${fromName} <${fromAddr}>\nAssunto: ${subject}\n\n${bodyText}`.slice(0, 8000);
      const { data: ticket, error: tErr } = await supabaseAdmin
        .from("service_tickets").insert({
          attendance_id: attendanceId,
          contact_phone: fromAddr, // reutiliza campo p/ identificação
          contact_name: fromName,
          status: "aberto",
          priority: channel.default_priority || "media",
          category: subject,
          sector: channel.default_sector || null,
          company_id: companyId,
          notes,
        }).select().single();
      if (tErr) throw new Error(`Falha ao criar ticket: ${tErr.message}`);

      // Registra como processado
      await supabaseAdmin.from("email_processed").insert({
        email_channel_id: channelId,
        message_id: msg.id,
        internet_message_id: msg.internetMessageId || null,
        ticket_id: ticket.id,
        from_address: fromAddr,
        subject,
        received_at: msg.receivedDateTime || null,
      });

      // Marca como lido no Outlook
      if (channel.mark_as_read) {
        await markMessageAsRead(msg.id).catch((e) => {
          result.errors.push(`Marcar lido (${msg.id}): ${e?.message || e}`);
        });
      }

      result.created_tickets++;
    } catch (e: any) {
      result.errors.push(`Msg ${msg.id}: ${e?.message || e}`);
    }
  }

  await supabaseAdmin.from("email_channels").update({
    last_polled_at: new Date().toISOString(),
    last_poll_status: result.errors.length ? "partial" : "ok",
    last_poll_error: result.errors.length ? result.errors.slice(0, 3).join(" | ") : null,
  }).eq("id", channelId);

  return result;
}

export async function pollAllActiveEmailChannels(): Promise<PollResult[]> {
  const { data: channels } = await supabaseAdmin
    .from("email_channels").select("id")
    .eq("is_active", true).eq("polling_enabled", true);
  const results: PollResult[] = [];
  for (const ch of channels || []) {
    try {
      results.push(await pollEmailChannel(ch.id));
    } catch (e: any) {
      results.push({
        channel_id: ch.id, email: "", fetched: 0, created_tickets: 0, skipped: 0,
        errors: [e?.message || String(e)],
      });
    }
  }
  return results;
}
