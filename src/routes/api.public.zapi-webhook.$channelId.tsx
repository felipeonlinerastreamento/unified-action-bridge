import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isGroupPhoneIdentifier } from "@/lib/chat-utils";
import { processIncomingForBot } from "@/lib/zapi-bot.server";
import { loadZapiChannel, zapiGetGroupName, zapiSendText } from "@/lib/zapi.server";
import {
  loadBusinessHoursSettings,
  isWithinBusinessHours,
  shouldSendOutOfHoursMessage,
  logOutOfHoursMessage,
} from "@/lib/business-hours.server";
import { evaluateMessageTriggers } from "@/lib/message-triggers.server";
import { processNoCommAutomation } from "@/lib/no-comm-automation.server";

// Z-API webhook payload (loose schema — Z-API sends many event shapes)
const PayloadSchema = z.object({
  type: z.string().optional(),
  phone: z.string().optional(),
  fromMe: z.boolean().optional(),
  messageId: z.string().optional(),
  senderName: z.string().nullable().optional(),
  senderPhoto: z.string().nullable().optional(),
  chatName: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  participantPhone: z.string().nullable().optional(),
  text: z.object({ message: z.string().optional() }).optional(),
  image: z.object({ imageUrl: z.string().optional(), caption: z.string().optional() }).optional(),
  audio: z.object({ audioUrl: z.string().optional() }).optional(),
  video: z.object({ videoUrl: z.string().optional() }).optional(),
  document: z.object({ documentUrl: z.string().optional() }).optional(),
  contact: z.object({
    displayName: z.string().optional(),
    vCard: z.string().optional(),
    phones: z.array(z.any()).optional(),
  }).passthrough().optional(),
  contacts: z.array(z.any()).optional(),
  status: z.string().optional(),
  ids: z.array(z.string()).optional(),
}).passthrough();

function buildVCardFromContact(c: any): { vcard: string; name: string } | null {
  if (!c) return null;
  if (typeof c.vCard === "string" && c.vCard.trim()) {
    const nameMatch = /FN(?:;[^:]*)?:(.+)/i.exec(c.vCard);
    return { vcard: c.vCard, name: c.displayName || nameMatch?.[1]?.trim() || "Contato" };
  }
  const name = c.displayName || c.name || "Contato";
  const phones: string[] = [];
  if (Array.isArray(c.phones)) {
    for (const p of c.phones) {
      if (typeof p === "string") phones.push(p);
      else if (p?.phone) phones.push(String(p.phone));
      else if (p?.number) phones.push(String(p.number));
    }
  }
  if (!phones.length && !name) return null;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`];
  for (const ph of phones) lines.push(`TEL;TYPE=CELL:${ph}`);
  lines.push("END:VCARD");
  return { vcard: lines.join("\n"), name };
}

// Z-API event types that carry actual message content
const MESSAGE_EVENT_TYPES = new Set([
  "ReceivedCallback",
  "SentCallback",
  "MessageReceivedCallback",
  "MessageSentCallback",
]);

function normalizeIncomingPhone(rawPhone: string, isGroup: boolean): string {
  if (isGroup) return rawPhone.replace(/\D/g, "");

  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 15) return digits;
  if (digits.length >= 10 && digits.length <= 11) digits = `55${digits}`;

  // BR mobile: canonical 55 + DDD + 9 + 8 digits.
  if (/^55[1-9][0-9][6-9][0-9]{7}$/.test(digits)) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

/**
 * Picks the least-loaded online operator for a sector. Falls back to
 * "Atendimento" when sector is empty/unknown. Returns null if nobody is
 * available — caller keeps the chat unassigned (chat goes to the queue).
 */
async function pickLeastLoadedAgent(sector: string | null | undefined): Promise<string | null> {
  const sec = (sector || "").trim() || "Atendimento";
  try {
    const { data } = await supabaseAdmin.rpc("pick_least_loaded_agent", { _sector: sec });
    return (data as string | null) || null;
  } catch (err) {
    console.warn("[zapi-webhook] pick_least_loaded_agent failed", err);
    return null;
  }
}

/**
 * Fallback: ignores online status. Used for group chats and own-channel
 * messages where we never want the chat to sit unassigned in the queue.
 */
async function pickLeastLoadedAgentAny(sector: string | null | undefined): Promise<string | null> {
  const sec = (sector || "").trim() || "Atendimento";
  try {
    const { data } = await supabaseAdmin.rpc("pick_least_loaded_agent_any", { _sector: sec });
    return (data as string | null) || null;
  } catch (err) {
    console.warn("[zapi-webhook] pick_least_loaded_agent_any failed", err);
    return null;
  }
}

// (Removido) ensureOpenTicketForChat: antes criava um novo service_ticket na
// reabertura de chat finalizado sem CSAT. A regra atual é não abrir novo
// chamado nesse caso — apenas reabrir o chat.


export const Route = createFileRoute("/api/public/zapi-webhook/$channelId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        return new Response(JSON.stringify({ ok: true, channelId: params.channelId }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      POST: async ({ request, params }) => {
        const channelId = params.channelId;
        const url = new URL(request.url);
        const querySecret = url.searchParams.get("secret");
        const headerSecret = request.headers.get("x-channel-secret");
        const providedSecret = headerSecret || querySecret;

        // Validate webhook secret
        const { data: channel, error: chErr } = await supabaseAdmin
          .from("channels")
          .select("id, webhook_secret, is_active")
          .eq("id", channelId)
          .single();
        if (chErr || !channel) return new Response("Channel not found", { status: 404 });
        if (!channel.webhook_secret || providedSecret !== channel.webhook_secret) {
          return new Response("Invalid secret", { status: 401 });
        }

        let body: any;
        try {
          const raw = await request.text();
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = PayloadSchema.safeParse(body);
        if (!parsed.success) {
          // Don't fail Z-API — log and accept
          console.warn("[zapi-webhook] schema warn:", parsed.error.message);
        }
        const p: any = parsed.success ? parsed.data : body;

        // Cap absoluto: jamais segurar a resposta do webhook por mais de 10s.
        // Se a Z-API demora a responder (group-metadata, send-text, etc.), o
        // worker pode ficar pendurado e a Z-API marca o endpoint como caído,
        // parando de entregar eventos. Respondemos 200 cedo e descartamos o
        // restante do trabalho silenciosamente em vez de bloquear o webhook.
        const PROCESS_BUDGET_MS = 10_000;
        const processing = (async () => {
          await processWebhookPayload({ channelId, p });
        })().catch((err) => {
          console.error("[zapi-webhook] processing error:", err);
        });
        const timeout = new Promise<void>((resolve) =>
          setTimeout(() => {
            console.warn("[zapi-webhook] processing exceeded budget — returning 200 early", {
              channelId,
              type: p?.type,
              phone: p?.phone,
            });
            resolve();
          }, PROCESS_BUDGET_MS),
        );
        await Promise.race([processing, timeout]);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

async function processWebhookPayload({ channelId, p }: { channelId: string; p: any }) {

        // DeliveryCallback (variação Z-API para grupos): apenas confirmação
        // de entrega ao destinatário. Sem ids/status úteis aqui — silenciamos
        // para parar o ruído de "unknown event" sem afetar nada.
        if (p.type === "DeliveryCallback") {
          return;
        }

        // Status events: update message status
        if (p.type === "MessageStatusCallback" && p.status && p.ids) {
          const status = String(p.status).toLowerCase();
          const newStatus = ["read", "delivered", "sent"].includes(status) ? status : "sent";
          for (const mid of p.ids) {
            await supabaseAdmin
              .from("zapi_messages")
              .update({ status: newStatus })
              .eq("zapi_message_id", mid);
          }
          return;
        }

        // Presence: typing — IGNORED on purpose.
        // Persisting is_typing into bot_state used to overwrite `current_node` due to
        // race conditions between the bot writing state and presence events arriving
        // concurrently, which broke multi-step flows. Typing indicators are ephemeral
        // UI signals only and should not touch the bot state.
        if (p.type === "PresenceChatCallback") {
          return;
        }

        // Incoming/outgoing message — only process actual message events
        const eventType = String(p.type || "");
        const firstContact = p.contact || (Array.isArray(p.contacts) ? p.contacts[0] : null);
        const hasContact = !!firstContact;
        const hasLocation = !!(p.location && (p.location.latitude != null || p.location.longitude != null));
        const notification = String(p.notification || "").toUpperCase();
        const hasContent = !!(p.text?.message || p.image || p.audio || p.video || p.document || hasContact || hasLocation);
        const hasCallId = !!(p.callId || p.callid);
        // IMPORTANTE: NÃO usar /call/i pois "Callback" contém "call" e
        // marcaria todo SentCallback / ReceivedCallback / MessageStatusCallback
        // como chamada — sequestrando mensagens normais.
        const isCallEvent =
          notification.startsWith("CALL_") ||
          eventType === "CallReceivedCallback" ||
          eventType === "CallReceivedNotificationCallback" ||
          (eventType === "NotificationCallback" &&
            typeof p.notification === "string" &&
            p.notification.toUpperCase().startsWith("CALL_")) ||
          // Payload sem type reconhecido como mensagem/status, sem conteúdo,
          // mas com callId — variação rara da Z-API.
          (hasCallId &&
            !hasContent &&
            !MESSAGE_EVENT_TYPES.has(eventType) &&
            eventType !== "MessageStatusCallback" &&
            eventType !== "PresenceChatCallback");
        const isMessageEvent = !isCallEvent && (MESSAGE_EVENT_TYPES.has(eventType) || (!eventType && hasContent));

        // Log diagnóstico: qualquer evento que não seja status/presence/mensagem
        // reconhecida nem chamada, registramos para descobrir o formato real.
        if (!isCallEvent && !isMessageEvent && p.type !== "MessageStatusCallback" && p.type !== "PresenceChatCallback") {
          console.warn("[zapi-webhook] unknown event", {
            type: p.type,
            notification: p.notification,
            hasCallId,
            phone: p.phone,
            fromMe: p.fromMe,
            keys: Object.keys(p || {}).slice(0, 25),
          });
        }
        if (isCallEvent) {
          console.log("[zapi-webhook] call event detected", {
            type: p.type,
            notification: p.notification,
            callId: p.callId,
            phone: p.phone,
            senderName: p.senderName,
            allKeys: Object.keys(p || {}),
            payloadSample: JSON.stringify(p).slice(0, 1200),
          });
        }

        // Call events: persist as a system-like message (📞) so the operator sees missed/received calls in the chat
        if (isCallEvent && p.phone) {
          try {
            const rawPhone = String(p.phone);
            const isGroup = isGroupPhoneIdentifier(rawPhone);
            const phoneN = normalizeIncomingPhone(rawPhone, isGroup);
            if (!phoneN) return;

            // Z-API real payload: notification = CALL_VOICE | CALL_MISSED_VOICE | CALL_VIDEO | CALL_MISSED_VIDEO
            const callStatus = String(p.callStatus || p.status || p.callType || "").toLowerCase();
            const isVideo = !!(p.isVideoCall || p.isVideo) || /VIDEO/.test(notification);
            const isMissed =
              notification.includes("MISSED") ||
              callStatus.includes("miss") ||
              callStatus.includes("timeout") ||
              callStatus === "no_answer" ||
              callStatus === "unanswered";
            const isRejected = callStatus.includes("reject") || callStatus.includes("declin");
            const label = isVideo ? "Videochamada" : "Chamada";
            let callText = `📞 ${label} recebida`;
            if (isMissed) callText = `📞 ${label} perdida`;
            else if (isRejected) callText = `📞 ${label} recusada`;
            else if (p.callDuration || p.duration) {
              const secs = Number(p.callDuration || p.duration) || 0;
              if (secs > 0) {
                const mm = Math.floor(secs / 60);
                const ss = secs % 60;
                callText = `📞 ${label} atendida (${mm}:${String(ss).padStart(2, "0")})`;
              }
            }

            let existingChat: any = null;
            const isLidIdentifier = !isGroup && phoneN.length >= 15;
            const candidateName = String(p.senderName || "").trim();
            // 1) Lookup by stored LID mapping or any captured alias
            //    (LIDs for call events sometimes differ from message LIDs).
            if (isLidIdentifier) {
              const { data: byLid } = await supabaseAdmin
                .from("zapi_chats")
                .select("id, phone, unread_count, status, closed_at")
                .eq("channel_id", channelId)
                .or(`lid.eq.${phoneN},lid_aliases.cs.{${phoneN}}`)
                .not("phone_normalized", "like", "lid:%")
                .order("last_message_at", { ascending: false })
                .limit(1);
              existingChat = byLid?.[0] || null;
            }
            // 2) Fallback: by sender name (only when present)
            if (isLidIdentifier && !existingChat && candidateName) {
              const { data: byRealName } = await supabaseAdmin
                .from("zapi_chats")
                .select("id, phone, unread_count, status, closed_at")
                .eq("channel_id", channelId)
                .eq("contact_name", candidateName)
                .not("phone_normalized", "like", "lid:%")
                .order("last_message_at", { ascending: false })
                .limit(5);
              existingChat = byRealName?.find((chat: any) => chat.status !== "finalizado") || null;
            }
            if (isLidIdentifier && !existingChat) {
              console.log("[zapi-webhook] LID-only call event without real-phone chat; replying directly to @lid", {
                phone: phoneN,
                senderName: p.senderName,
                type: eventType,
              });
            }
            const replyPhone = isLidIdentifier && !existingChat ? `${phoneN}@lid` : phoneN;
            if (!existingChat) {
              let query = supabaseAdmin
                .from("zapi_chats")
                .select("id, phone, unread_count, status, closed_at")
                .eq("channel_id", channelId)
                .order("last_message_at", { ascending: false })
                .limit(1);
              query = isGroup ? query.eq("phone", phoneN) : query.eq("phone_normalized", phoneN);
              const { data: byPhone } = await query;
              existingChat = byPhone?.[0] || null;
            }
            if (isLidIdentifier && !existingChat) {
              const { data: byLidPhone } = await supabaseAdmin
                .from("zapi_chats")
                .select("id, phone, unread_count, status, closed_at")
                .eq("channel_id", channelId)
                .eq("phone", replyPhone)
                .order("last_message_at", { ascending: false })
                .limit(1);
              existingChat = byLidPhone?.[0] || null;
            }

            let chatRowId: string | null = (existingChat as any)?.id || null;
            if (!chatRowId) {
              const { data: created } = await supabaseAdmin
                .from("zapi_chats")
                .insert({
                  channel_id: channelId,
                  phone: replyPhone,
                  contact_name: p.senderName || replyPhone,
                  status: "aguardando",
                  unread_count: 1,
                  last_message_at: new Date().toISOString(),
                  last_message_preview: callText,
                } as any)
                .select("id")
                .maybeSingle();
              chatRowId = (created as any)?.id || null;
            } else {
              await supabaseAdmin
                .from("zapi_chats")
                .update({
                  last_message_at: new Date().toISOString(),
                  last_message_preview: callText,
                  unread_count: ((existingChat as any).unread_count || 0) + 1,
                } as any)
                .eq("id", chatRowId);
            }

            if (chatRowId) {
              await persistZapiMessage({
                chatId: chatRowId,
                messageId: p.callId || p.messageId || null,
                fromMe: false,
                text: callText,
                mediaUrl: null,
                mediaType: isMissed ? "call_missed" : "call",
                participantName: null,
                participantPhone: null,
              });
            }

            // Enviar mensagem automática (fallback caso /update-call-reject-message
            // não esteja ativo na instância Z-API).
            try {
              const { data: chRow } = await supabaseAdmin
                .from("channels")
                .select("call_reject_enabled, call_reject_message")
                .eq("id", channelId)
                .maybeSingle();
              const enabled = (chRow as any)?.call_reject_enabled;
              const msg = (chRow as any)?.call_reject_message;
              if ((enabled === undefined || enabled === true) && typeof msg === "string" && msg.trim()) {
                const creds = await loadZapiChannel(supabaseAdmin, channelId);
                if (creds) {
                  let alreadyReplied = false;
                  if (chatRowId) {
                    const { data: recentAutoReply } = await supabaseAdmin
                      .from("zapi_messages")
                      .select("id")
                      .eq("chat_id", chatRowId)
                      .eq("from_me", true)
                      .eq("text", msg)
                      .gte("created_at", new Date(Date.now() - 3 * 60_000).toISOString())
                      .limit(1)
                      .maybeSingle();
                    alreadyReplied = !!recentAutoReply;
                  }
                  if (alreadyReplied) return;

                  const sendRes: any = await zapiSendText(creds, (existingChat as any)?.phone || replyPhone, msg);
                  // Persistir a mensagem automática no chat para que apareça na UI
                  if (chatRowId) {
                    await persistZapiMessage({
                      chatId: chatRowId,
                      messageId: sendRes?.messageId || sendRes?.id || null,
                      fromMe: true,
                      text: msg,
                      mediaUrl: null,
                      mediaType: null,
                      participantName: null,
                      participantPhone: null,
                    });
                    await supabaseAdmin
                      .from("zapi_chats")
                      .update({
                        last_message_at: new Date().toISOString(),
                        last_message_preview: msg,
                      } as any)
                      .eq("id", chatRowId);
                  }
                }
              }
            } catch (sendErr) {
              console.warn("[zapi-webhook] auto-reject send failed:", sendErr);
            }
          } catch (callErr) {
            console.warn("[zapi-webhook] call event handling failed:", callErr);
          }
          return;
        }

        if (p.phone && isMessageEvent) {
          const rawPhone = String(p.phone);
          // WhatsApp groups: raw phone may contain "@g.us", "<creator>-<timestamp>",
          // or arrive already normalized as a long numeric group id.
          const isGroupMessage = isGroupPhoneIdentifier(rawPhone);
          // Mirror DB function `normalize_zapi_phone`: BR phones get DDI 55,
          // LIDs (15+ digits) keep raw digits but the DB index treats them
          // separately. We use the digits-only form to lookup; the unique
          // index on `phone_normalized` (generated column) is the safety net.
          const phone = normalizeIncomingPhone(rawPhone, isGroupMessage);

          // Guard: events without a usable phone (e.g. malformed payloads or
          // pure-LID without digits) used to create orphan chats with empty
          // `phone`, which then could not be linked to WhatsApp nor replied
          // to. Drop the event silently — there's nothing actionable.
          if (!phone) {
            console.log("[zapi-webhook] dropping event with empty phone", {
              type: eventType,
              rawPhone,
              senderName: p.senderName,
            });
            return;
          }

          // Determine whether this is truly an outbound message from the operator.
          // Some Z-API events (notably when the customer uses a number associated
          // with the connected account, or in certain device sync scenarios) arrive
          // as ReceivedCallback but with `fromMe=true`. We must trust the event
          // TYPE — `*ReceivedCallback` events are ALWAYS inbound regardless of the
          // `fromMe` flag. Only `*SentCallback` events should be treated as outbound.
          const isReceivedEvent =
            eventType === "ReceivedCallback" || eventType === "MessageReceivedCallback";
          const isSentEvent =
            eventType === "SentCallback" || eventType === "MessageSentCallback";
          // Preserve original payload flag — used to detect operator echoes
          // (ReceivedCallback with fromMe=true) so we don't consume CSAT pending
          // from our own outbound messages reflected by Z-API.
          const originalFromMe = !!p.fromMe;
          // ReceivedCallback com fromMe=true ocorre quando o operador envia
          // pela mesma conta WhatsApp via outro dispositivo (Web/celular/outra
          // instância). Devemos respeitar a flag para que a mensagem apareça
          // no balão da direita. Apenas quando fromMe=false em ReceivedCallback
          // tratamos como mensagem real do cliente.
          const effectiveFromMe = isSentEvent ? true : !!p.fromMe;
          // Override the payload flag for the rest of the pipeline so all
          // downstream branches (CSAT, reopen, queue, bot, after-hours) behave
          // correctly regardless of what Z-API reported.
          p.fromMe = effectiveFromMe;

          // For groups, prefer the group name (chatName/groupName) over the sender's name.
          // For direct chats, use senderName.
          let groupDisplayName = p.chatName || p.groupName || p.name || p.subject || null;
          if (isGroupMessage && !groupDisplayName) {
            try {
              const creds = await loadZapiChannel(supabaseAdmin, channelId);
              groupDisplayName = await zapiGetGroupName(creds, rawPhone);
            } catch (error) {
              console.warn("[zapi-webhook] cannot resolve group name", { phone, error });
            }
          }
          const incomingContactName = isGroupMessage
            ? (groupDisplayName || p.senderName || null)
            : (p.senderName || null);

          const contactCard = hasContact ? buildVCardFromContact(firstContact) : null;

          const locationLabel = hasLocation
            ? (() => {
                const name = p.location?.name ? String(p.location.name).trim() : "";
                const addr = p.location?.address ? String(p.location.address).trim() : "";
                const extra = [name, addr].filter(Boolean).join(" · ");
                return extra ? `📍 Localização — ${extra}` : "📍 Localização";
              })()
            : null;
          const text =
            p.text?.message ||
            p.image?.caption ||
            (p.image ? "[imagem]" : null) ||
            (p.audio ? "[áudio]" : null) ||
            (p.video ? "[vídeo]" : null) ||
            (p.document ? "[documento]" : null) ||
            (contactCard ? `[contato] ${contactCard.name}` : null) ||
            locationLabel ||
            "";

          // Skip empty events that have no content (status callbacks, presence echoes, etc.)
          if (!hasContent) {
            console.log("[zapi-webhook] skipping empty event", { type: eventType, phone });
            return;
          }

          // CSAT capture: if there is a pending satisfaction survey for this
          // phone+channel and the customer just replied, record the rating
          // (1/2/3) and DO NOT reopen the chat or run the bot.
          if (!p.fromMe && !originalFromMe && !isGroupMessage && text) {
            // Guard: Z-API may deliver the same incoming "1/2/3" via multiple
            // callbacks within seconds. The first one consumes csat_pending;
            // without this guard the duplicate falls through, reopens the
            // finalized chat and re-triggers the bot menu. If we already
            // recorded a CSAT response for this phone in the last 60s and the
            // incoming text is just a single digit 1/2/3, ignore it.
            const trimmed = String(text).trim();
            if (/^[123]$/.test(trimmed)) {
              const { data: recent } = await supabaseAdmin
                .from("csat_responses" as any)
                .select("id")
                .eq("phone", phone)
                .gte("created_at", new Date(Date.now() - 60_000).toISOString())
                .limit(1)
                .maybeSingle();
              if (recent) {
                console.log("[zapi-webhook] duplicate CSAT response ignored", { phone, text: trimmed });
                return;
              }
            }
            try {
              const { data: pending } = await supabaseAdmin
                .from("csat_pending" as any)
                .select("*")
                .eq("channel_id", channelId)
                .eq("phone", phone)
                .gte("expires_at", new Date().toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (pending) {
                // Strict score extraction: only accept the digit as the start of a
                // short reply (e.g. "3", "3 ", "3 obrigada") or "Nota 3" forms.
                // Avoids matching the digits embedded in the CSAT prompt itself
                // (which contains "[ 1 ] - Ruim", "[ 2 ] - Bom", "[ 3 ] - Ótimo").
                const m = trimmed.match(/^([123])(?:\s|$)/) || trimmed.match(/^nota\s*([123])/i);
                const score = m ? Number(m[1]) : null;
                if (score) {
                  const labelMap: Record<number, string> = { 1: "Ruim", 2: "Bom", 3: "Ótimo" };
                  await supabaseAdmin.from("csat_responses" as any).insert({
                    channel_id: (pending as any).channel_id,
                    chat_id: (pending as any).chat_id,
                    phone: (pending as any).phone,
                    contact_name: (pending as any).contact_name,
                    ticket_id: (pending as any).ticket_id,
                    protocol: (pending as any).protocol,
                    operator_user_id: (pending as any).operator_user_id,
                    operator_name: (pending as any).operator_name,
                    score,
                    score_label: labelMap[score],
                    raw_response: String(text).slice(0, 500),
                  });
                  await supabaseAdmin.from("csat_pending" as any).delete().eq("id", (pending as any).id);

                  // Persist incoming message in the (already finalized) chat for history
                  if ((pending as any).chat_id) {
                    await supabaseAdmin.from("zapi_messages").insert({
                      chat_id: (pending as any).chat_id,
                      zapi_message_id: p.messageId || null,
                      from_me: false,
                      text,
                      status: "delivered",
                    } as any);
                  }

                  // Send thanks
                  try {
                    const { data: cset } = await supabaseAdmin
                      .from("csat_settings" as any)
                      .select("thanks_message")
                      .maybeSingle();
                    const thanks = (cset as any)?.thanks_message || "Obrigado pela sua avaliação!";
                    const creds = await loadZapiChannel(supabaseAdmin, channelId);
                    const sendRes: any = await zapiSendText(creds, phone, thanks);
                    const sentId =
                      sendRes?.messageId || sendRes?.id || sendRes?.zaapId || null;
                    if ((pending as any).chat_id) {
                      await supabaseAdmin.from("zapi_messages").insert({
                        chat_id: (pending as any).chat_id,
                        zapi_message_id: sentId,
                        from_me: true,
                        text: thanks,
                        status: "sent",
                      } as any);
                    }
                  } catch (thanksErr) {
                    console.warn("[zapi-webhook] csat thanks send failed:", thanksErr);
                  }
                  return;
                }
                // Resposta não é 1/2/3 → trata como nova conversa.
                // Descarta o CSAT pendente e SEGUE o fluxo normal (reabre chat,
                // executa bot ou envia mensagem fora-de-hora).
                await supabaseAdmin.from("csat_pending" as any).delete().eq("id", (pending as any).id);
                console.log("[zapi-webhook] csat pending discarded — continuing normal flow", { phone });
              }
            } catch (csatErr) {
              console.warn("[zapi-webhook] csat capture failed:", csatErr);
            }
          }

          const rawMediaUrl =
            p.image?.imageUrl || p.audio?.audioUrl || p.video?.videoUrl || p.document?.documentUrl
            || null;
          const mediaType = p.image
            ? "image"
            : p.audio
              ? "audio"
              : p.video
                ? "video"
                : p.document
                  ? "document"
                  : contactCard
                    ? "contact"
                    : hasLocation
                      ? "location"
                      : null;

          // Z-API media URLs (Backblaze "temp-file-download/...") expire in
          // a few minutes. Rehost into our public storage bucket so audio/
          // video/image/document bubbles keep working over time.
          let mediaUrl: string | null = rawMediaUrl;
          if (rawMediaUrl && mediaType && mediaType !== "contact" && mediaType !== "location") {
            try {
              const hintMime = p.document?.mimeType || p.image?.mimeType || p.audio?.mimeType || p.video?.mimeType || null;
              const hintName = p.document?.fileName || null;
              mediaUrl = await rehostMediaToStorage(rawMediaUrl, mediaType, channelId, phone, { hintMime, hintName });
            } catch (err) {
              console.warn("[zapi-webhook] media rehost failed, keeping original url:", err);
            }
          }
          if (!mediaUrl && contactCard) {
            mediaUrl = `data:text/vcard;charset=utf-8,${encodeURIComponent(contactCard.vcard)}`;
          }
          if (!mediaUrl && hasLocation) {
            const lat = p.location?.latitude;
            const lng = p.location?.longitude;
            mediaUrl = p.location?.url
              || (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null);
          }

          // Upsert chat. Para grupos o identificador estável é `phone`
          // (a função SQL normalize_zapi_phone adiciona prefixo "lid:" para
          // qualquer ID 15+ dígitos sem marcador @g.us / -timestamp, então
          // o lookup por phone_normalized falharia para grupos modernos).
          let existing: any = null;
          if (isGroupMessage) {
            const { data: byPhone } = await supabaseAdmin
              .from("zapi_chats")
              .select("id, contact_name, status, unread_count, closed_at")
              .eq("channel_id", channelId)
              .eq("phone", phone)
              .maybeSingle();
            existing = byPhone || null;
          }
          if (!existing) {
            const { data: byNorm } = await supabaseAdmin
              .from("zapi_chats")
              .select("id, contact_name, status, unread_count, closed_at")
              .eq("channel_id", channelId)
              .eq("phone_normalized", phone)
              .maybeSingle();
            existing = byNorm || null;
          }

          // LID guard: WhatsApp sometimes sends a 15-digit "linked id" in
          // `phone` instead of the real number (especially on SentCallback for
          // own-account devices). That creates a duplicate chat for the same
          // contact. If `phone` looks like a LID (15+ digits, not a group)
          // and we don't already have a chat for it, try to resolve to an
          // existing chat by sender name; if none, drop the event.
          const isLidIdentifier =
            !isGroupMessage && !existing && phone.length >= 15;
          if (isLidIdentifier) {
            const candidateName = (incomingContactName || "").trim();
            if (candidateName) {
              const { data: byName } = await supabaseAdmin
                .from("zapi_chats")
                .select("id, contact_name, status, unread_count, closed_at")
                .eq("channel_id", channelId)
                .eq("contact_name", candidateName)
                .not("phone_normalized", "like", "lid:%")
                .order("last_message_at", { ascending: false })
                .limit(5);
              existing = byName?.find((chat: any) => chat.status !== "finalizado") || null;
            }
            if (!existing) {
              console.log("[zapi-webhook] dropping LID-only event (no active real-phone chat to merge into)", {
                phone,
                senderName: incomingContactName,
                type: eventType,
              });
              return;
            }
          }

          let chatId = existing?.id as string | undefined;
          let justReopenedSilently = false;
          if (!chatId) {
            // Groups never go through the bot, and inbound own-channel
            // messages also bypass the bot — in both cases pre-assign the
            // chat to the least-loaded operator so it does not sit
            // unattended in the queue. Individual chats from real customers
            // start in "bot" status so the welcome flow can run.
            const preAssignForNew = isGroupMessage || !!p.fromMe;
            let initialAssigned: string | null = null;
            let initialSector: string | null = null;
            let initialStatus: "bot" | "em_atendimento" | "aguardando" = "bot";
            if (preAssignForNew) {
              initialSector = "Atendimento";
              initialAssigned = await pickLeastLoadedAgent(initialSector);
              if (!initialAssigned) {
                // Garante que grupos / fromMe sempre sejam atribuídos mesmo
                // quando nenhum operador está marcado como online.
                initialAssigned = await pickLeastLoadedAgentAny(initialSector);
              }
              initialStatus = initialAssigned ? "em_atendimento" : "aguardando";
            }
            const { data: created, error: insertError } = await supabaseAdmin
              .from("zapi_chats")
              .insert({
                channel_id: channelId,
                phone,
                contact_name: incomingContactName,
                contact_avatar: p.senderPhoto || null,
                status: initialStatus,
                assigned_to: initialAssigned,
                sector_name: initialSector,
                last_message_at: new Date().toISOString(),
                last_message_preview: text.slice(0, 120),
                unread_count: p.fromMe ? 0 : 1,
              })
              .select("id, contact_name")
              .single();
            if (insertError) {
              // Unique index `uniq_zapi_chats_channel_phone_norm` collided —
              // another concurrent webhook just created the chat. Re-fetch by
              // normalized phone and continue as if it already existed.
              if ((insertError as { code?: string }).code === "23505") {
                // Tenta primeiro pelo índice (channel_id, phone) — que é o
                // que estoura para grupos (phone_normalized fica como
                // "lid:..." no DB mas o webhook calcula só dígitos).
                let { data: raced } = await supabaseAdmin
                  .from("zapi_chats")
                  .select("id, contact_name, status, unread_count, closed_at")
                  .eq("channel_id", channelId)
                  .eq("phone", phone)
                  .maybeSingle();
                if (!raced?.id) {
                  const { data: byNorm } = await supabaseAdmin
                    .from("zapi_chats")
                    .select("id, contact_name, status, unread_count, closed_at")
                    .eq("channel_id", channelId)
                    .eq("phone_normalized", phone)
                    .maybeSingle();
                  raced = byNorm || null;
                }
                if (raced?.id) {
                  existing = raced;
                  chatId = raced.id;
                } else {
                  console.warn("[zapi-webhook] 23505 on insert but no row found by phone", { phone });
                  return;
                }
              } else {
                console.error("[zapi-webhook] failed to insert chat", insertError);
                return;
              }
            } else {
              chatId = created?.id;
            }
          } else if (existing) {
            // ECHO GUARD (early): se a Z-API entrega como ReceivedCallback o eco
            // de uma mensagem que NÓS acabamos de enviar (ex.: prompt de CSAT
            // logo após finalizar), precisamos descartá-lo ANTES de qualquer
            // update — caso contrário o bloco de reopen abaixo reabriria o
            // chat finalizado para "aguardando" sem motivo real.
            if (!p.fromMe && !isGroupMessage && text) {
              const trimmed = text.trim();
              if (trimmed.length > 0) {
                const since = new Date(Date.now() - 60_000).toISOString();
                const { data: recentEcho } = await supabaseAdmin
                  .from("zapi_messages")
                  .select("id")
                  .eq("chat_id", existing.id)
                  .eq("from_me", true)
                  .eq("text", trimmed)
                  .gte("created_at", since)
                  .limit(1)
                  .maybeSingle();
                if (recentEcho) {
                  console.log("[zapi-webhook] dropping echo of own outbound message (early)", {
                    chatId: existing.id,
                    preview: trimmed.slice(0, 60),
                  });
                  return;
                }
              }
            }

            // Reopen finalized chats when the customer sends a NEW message.
            // Without this, all incoming messages were silently swallowed by
            // the bot's "if status === 'finalizado' return false" guard,
            // making it look like new conversations were not appearing.
            //
            // Reabre tanto chats individuais quanto de grupo quando chega uma
            // nova mensagem de cliente/participante (não do operador). Sem isto
            // grupos finalizados desaparecem da Central mesmo recebendo novas
            // mensagens. Para evitar reabertura por eco da própria mensagem de
            // despedida, exigimos que tenha passado um intervalo mínimo desde
            // o fechamento quando se trata de grupo.
            const closedAtMs = existing.closed_at ? new Date(existing.closed_at).getTime() : 0;
            const sinceCloseMs = closedAtMs ? Date.now() - closedAtMs : Number.POSITIVE_INFINITY;
            const groupReopenGuard = isGroupMessage ? sinceCloseMs > 60_000 : true;
            const isPendingResolve = (existing as any).status === "aguardando_retorno";
            const shouldReopen =
              !p.fromMe && (existing.status === "finalizado" || isPendingResolve) && groupReopenGuard;
            // For groups, ALWAYS prefer the latest group name (it can change),
            // overriding any previously stored sender name.
            const nameToStore = isGroupMessage
              ? (groupDisplayName || existing.contact_name || p.senderName || null)
              : (existing.contact_name || p.senderName || null);
            const baseUpdate: {
              contact_name: string | null;
              contact_avatar?: string;
              last_message_at: string;
              last_message_preview: string;
              unread_count: number;
              status?: string;
              bot_state?: Record<string, never>;
              assigned_to?: string | null;
              sector_name?: string | null;
              pending_resolve_user_id?: string | null;
              pending_resolve_ticket_id?: string | null;
              pending_resolve_at?: string | null;
              lid?: string;
              lid_aliases?: string[];
            } = {
              contact_name: nameToStore,
              contact_avatar: p.senderPhoto || undefined,
              last_message_at: new Date().toISOString(),
              last_message_preview: text.slice(0, 120),
              unread_count: p.fromMe
                ? (existing.unread_count || 0)
                : ((existing.unread_count || 0) + 1),
            };
            // Capture LID mapping when payload includes both real phone and LID,
            // so future LID-only events (e.g. call notifications) can resolve.
            // Z-API sometimes uses different LIDs for messages vs calls, so we
            // scan the entire payload for ANY 15+ digit token and store them
            // all as aliases.
            if (!isGroupMessage && phone.length < 15) {
              const aliases = new Set<string>();
              const payloadStr = JSON.stringify(p || {});
              const matches = payloadStr.match(/\b\d{15,}\b/g) || [];
              for (const m of matches) {
                if (m !== phone) aliases.add(m);
              }
              const primaryLidRaw = p.senderLid || p.participantLid || p.chatLid || p.lid || null;
              if (primaryLidRaw) {
                const lidDigits = String(primaryLidRaw).replace(/\D/g, "");
                if (lidDigits.length >= 15) {
                  baseUpdate.lid = lidDigits;
                  aliases.add(lidDigits);
                }
              }
              if (aliases.size > 0) {
                baseUpdate.lid_aliases = Array.from(aliases);
              }
            }
            if (shouldReopen) {
              // Regra: toda nova mensagem em chat reaberto (finalizado ou
              // pending_resolve) volta a passar pelo bot desde o início.
              // O roteamento por setor acontece DENTRO do fluxo do bot
              // (nó route_to_least_loaded com target_sector "Atendimento"),
              // nunca aqui — assim o setor antigo nunca "gruda" no chat.
              console.log(`[zapi-webhook] reopening chat for ${phone} → reset to bot (was: ${(existing as any).sector_name || "n/a"}, pending=${isPendingResolve})`);
              baseUpdate.bot_state = {};
              baseUpdate.status = "bot";
              baseUpdate.assigned_to = null;
              baseUpdate.sector_name = null;
              if (isPendingResolve) {
                baseUpdate.pending_resolve_user_id = null;
                baseUpdate.pending_resolve_ticket_id = null;
                baseUpdate.pending_resolve_at = null;
              }
              // NÃO setamos justReopenedSilently — o bot deve rodar normalmente
              // e reapresentar o menu de boas-vindas.
            }

            await supabaseAdmin
              .from("zapi_chats")
              .update(baseUpdate)
              .eq("id", chatId!);
          }

          if (chatId) {
            // For groups, persist the actual participant (sender) so the UI can
            // show "who in the group sent this message" — without this the chat
            // shows incoming group messages with no author label.
            const participantPhoneRaw = p.participantPhone ? String(p.participantPhone) : null;
            const participantPhone = isGroupMessage && participantPhoneRaw
              ? participantPhoneRaw.replace(/\D/g, "") || null
              : null;
            const participantName = isGroupMessage && !p.fromMe
              ? (p.senderName || null)
              : null;

            // ECHO GUARD: Z-API às vezes entrega como ReceivedCallback (fromMe=false)
            // o eco da própria mensagem que ACABAMOS de enviar — especialmente quando
            // a operadora está conectada a múltiplos dispositivos. Sem este filtro o
            // bot reprocessa o próprio prompt como se fosse resposta do cliente
            // (e o regex de "primeiro número" casa "[ 1 ] - …" dentro do menu,
            // disparando rota incorreta).
            if (!p.fromMe && !isGroupMessage && text) {
              const trimmed = text.trim();
              if (trimmed.length > 0) {
                const since = new Date(Date.now() - 60_000).toISOString();
                const { data: recentEcho } = await supabaseAdmin
                  .from("zapi_messages")
                  .select("id")
                  .eq("chat_id", chatId)
                  .eq("from_me", true)
                  .eq("text", trimmed)
                  .gte("created_at", since)
                  .limit(1)
                  .maybeSingle();
                if (recentEcho) {
                  console.log("[zapi-webhook] dropping echo of own outbound message", {
                    chatId,
                    preview: trimmed.slice(0, 60),
                  });
                  return;
                }
              }
            }

            // Persist without PostgREST upsert: the DB has a partial unique
            // index for messageId dedupe, and `onConflict` cannot target that
            // partial index reliably. A failing upsert was silently updating
            // chat previews while dropping the actual message row.
            await persistZapiMessage({
              chatId,
              messageId: p.messageId || null,
              fromMe: !!p.fromMe,
              text,
              mediaUrl,
              mediaType,
              participantName,
              participantPhone,
            });

            // Evaluate keyword-trigger rules on inbound messages (inclui grupos)
            if (!p.fromMe && text) {
              try {
                const { data: chatRow } = await supabaseAdmin
                  .from("zapi_chats")
                  .select("assigned_to")
                  .eq("id", chatId)
                  .maybeSingle();
                await evaluateMessageTriggers(supabaseAdmin, {
                  channelId,
                  chatId,
                  phone,
                  contactName: incomingContactName,
                  text,
                  assignedTo: (chatRow as any)?.assigned_to ?? null,
                  messageId: p.messageId || null,
                });
              } catch (trigErr) {
                console.warn("[zapi-webhook] message-triggers error:", trigErr);
              }
            }

            // Automação "Sem comunicação" — inbound + outbound
            if (text) {
              try {
                const { data: chatRow2 } = await supabaseAdmin
                  .from("zapi_chats")
                  .select("assigned_to")
                  .eq("id", chatId)
                  .maybeSingle();
                await processNoCommAutomation(supabaseAdmin, {
                  chatId,
                  channelId,
                  messageId: p.messageId || null,
                  direction: p.fromMe ? "outbound" : "inbound",
                  text,
                  contactPhone: phone,
                  contactName: incomingContactName,
                  assignedTo: (chatRow2 as any)?.assigned_to ?? null,
                });
              } catch (ncErr) {
                console.warn("[zapi-webhook] no-comm automation error:", ncErr);
              }
            }

            // Run bot only on incoming customer messages — skip for groups
            // and skip when we just reopened a finalized chat silently (avoids
            // re-sending welcome menu right after a finalization).
            if (!p.fromMe && text && !isGroupMessage && !justReopenedSilently) {
              try {
                // Checa horário de funcionamento ANTES do bot
                const bh = await loadBusinessHoursSettings(supabaseAdmin);
                const withinHours = bh ? isWithinBusinessHours(bh) : true;

                if (bh && bh.is_enabled && !withinHours) {
                  // Fora do horário: envia mensagem de ausência (com cooldown) e NÃO executa bot.
                  // Também reseta qualquer bot_state pendente para evitar que, na próxima
                  // mensagem do cliente, o bot retome um fluxo antigo (ex.: pedir CPF/CNPJ).
                  await supabaseAdmin
                    .from("zapi_chats")
                    .update({ bot_state: {}, status: "aguardando" })
                    .eq("id", chatId);

                  const canSend = await shouldSendOutOfHoursMessage(
                    supabaseAdmin,
                    phone,
                    bh.cooldown_minutes,
                  );
                  if (canSend && bh.out_of_hours_message?.trim()) {
                    try {
                      const creds = await loadZapiChannel(supabaseAdmin, channelId);
                      await zapiSendText(creds, phone, bh.out_of_hours_message);
                      await supabaseAdmin.from("zapi_messages").insert({
                        chat_id: chatId,
                        from_me: true,
                        text: bh.out_of_hours_message,
                        status: "sent",
                      });
                      await logOutOfHoursMessage(
                        supabaseAdmin,
                        phone,
                        chatId ?? null,
                        bh.out_of_hours_message,
                      );
                    } catch (err) {
                      console.error("[zapi-webhook] failed to send out-of-hours message:", err);
                    }
                  }
                } else {
                  // Dentro do horário (ou checagem desabilitada): segue para o fluxo do bot
                  await processIncomingForBot({
                    channelId,
                    chatId,
                    phone,
                    contactName: p.senderName || existing?.contact_name || null,
                    incomingText: text,
                  });
                }
              } catch (e) {
                console.error("[zapi-webhook] bot/business-hours error:", e);
              }
            }
          }
        }

}

async function persistZapiMessage(args: {
  chatId: string;
  messageId: string | null;
  fromMe: boolean;
  text: string;
  mediaUrl: string | null;
  mediaType: string | null;
  participantName: string | null;
  participantPhone: string | null;
}) {
  const row = {
    chat_id: args.chatId,
    zapi_message_id: args.messageId,
    from_me: args.fromMe,
    text: args.text,
    media_url: args.mediaUrl,
    media_type: args.mediaType,
    status: args.fromMe ? "sent" : "delivered",
    participant_name: args.participantName,
    participant_phone: args.participantPhone,
  } as any;

  if (!args.messageId) {
    const { error } = await supabaseAdmin.from("zapi_messages").insert(row);
    if (error) console.error("[zapi-webhook] message insert failed:", error);
    return;
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("zapi_messages")
    .select("id, from_me, sent_by_user_id")
    .eq("chat_id", args.chatId)
    .eq("zapi_message_id", args.messageId)
    .maybeSingle();
  if (lookupError) console.warn("[zapi-webhook] message lookup failed:", lookupError);

  if ((existing as any)?.id) {
    // Se a linha já existe e foi gravada como envio do operador (from_me=true
    // ou sent_by_user_id setado pelo sendText), o webhook NÃO pode rebaixar
    // a direção — apenas confirma entrega/atualiza metadados de mídia.
    const wasOperatorSend =
      (existing as any).from_me === true || (existing as any).sent_by_user_id != null;
    const safeRow: any = wasOperatorSend
      ? {
          media_url: row.media_url,
          media_type: row.media_type,
          participant_name: row.participant_name,
          participant_phone: row.participant_phone,
        }
      : row;
    const { error } = await supabaseAdmin
      .from("zapi_messages")
      .update(safeRow)
      .eq("id", (existing as any).id);
    if (error) console.error("[zapi-webhook] message update failed:", error);
    return;
  }

  const { error } = await supabaseAdmin.from("zapi_messages").insert(row);
  if (error && error.code !== "23505") console.error("[zapi-webhook] message insert failed:", error);
}

const MEDIA_EXT: Record<string, string> = {
  audio: "ogg",
  video: "mp4",
  image: "jpg",
  document: "bin",
};
const MEDIA_MIME: Record<string, string> = {
  audio: "audio/ogg",
  video: "video/mp4",
  image: "image/jpeg",
  document: "application/octet-stream",
};

async function rehostMediaToStorage(
  url: string,
  mediaType: string,
  channelId: string,
  phone: string,
  opts?: { hintMime?: string | null; hintName?: string | null },
): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  if (url.includes("/storage/v1/object/public/chat-media/")) return url;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const httpCt = res.headers.get("content-type") || "";
  // Prefer explicit hints from Z-API payload (mimeType / fileName) over
  // upstream Content-Type — Backblaze frequently serves "application/octet-stream".
  const hintMime = (opts?.hintMime || "").toLowerCase();
  const hintExt = (opts?.hintName?.split(".").pop() || "").toLowerCase();
  const contentType = hintMime || httpCt || MEDIA_MIME[mediaType] || "application/octet-stream";
  const arrBuf = await res.arrayBuffer();

  let ext = MEDIA_EXT[mediaType] || "bin";
  const ctMatch = /\/([a-z0-9.+-]+)/i.exec(contentType);
  if (ctMatch?.[1]) {
    const sub = ctMatch[1].toLowerCase().replace("x-", "").split(";")[0];
    if (sub === "mpeg") ext = "mp3";
    else if (sub === "ogg" || sub === "opus") ext = "ogg";
    else if (sub === "mp4") ext = mediaType === "audio" ? "m4a" : "mp4";
    else if (sub === "webm") ext = "webm";
    else if (sub === "jpeg" || sub === "jpg") ext = "jpg";
    else if (sub === "png") ext = "png";
    else if (sub === "pdf") ext = "pdf";
    else if (sub === "msword") ext = "doc";
    else if (sub.includes("wordprocessingml")) ext = "docx";
    else if (sub.includes("spreadsheetml")) ext = "xlsx";
    else if (sub === "vnd.ms-excel") ext = "xls";
    else if (sub.includes("presentationml")) ext = "pptx";
    else if (sub === "vnd.ms-powerpoint") ext = "ppt";
    else if (sub === "zip") ext = "zip";
    else if (sub === "plain") ext = "txt";
    else if (sub === "csv") ext = "csv";
  }
  // If we still don't have a useful ext for a document, fall back to filename hint.
  if (mediaType === "document" && (ext === "bin" || ext === "octet-stream") && hintExt && /^[a-z0-9]{1,8}$/i.test(hintExt)) {
    ext = hintExt;
  }

  const key = `${channelId}/${phone}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("chat-media")
    .upload(key, arrBuf, { contentType, upsert: false, cacheControl: "31536000" });
  if (upErr) throw upErr;

  const { data: pub } = supabaseAdmin.storage.from("chat-media").getPublicUrl(key);
  return pub.publicUrl;
}


