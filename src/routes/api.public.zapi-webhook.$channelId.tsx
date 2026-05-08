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
        const hasContent = !!(p.text?.message || p.image || p.audio || p.video || p.document || hasContact);
        const isMessageEvent = MESSAGE_EVENT_TYPES.has(eventType) || (!eventType && hasContent);

        if (p.phone && isMessageEvent) {
          const rawPhone = String(p.phone);
          // WhatsApp groups: raw phone may contain "@g.us", "<creator>-<timestamp>",
          // or arrive already normalized as a long numeric group id.
          const isGroupMessage = isGroupPhoneIdentifier(rawPhone);
          // Mirror DB function `normalize_zapi_phone`: BR phones get DDI 55,
          // LIDs (15+ digits) keep raw digits but the DB index treats them
          // separately. We use the digits-only form to lookup; the unique
          // index on `phone_normalized` (generated column) is the safety net.
          const digitsOnly = rawPhone.replace(/\D/g, "");
          const phone = isGroupMessage
            ? digitsOnly
            : (digitsOnly.length >= 15
                ? digitsOnly
                : (/^55\d{10,11}$/.test(digitsOnly)
                    ? digitsOnly
                    : (digitsOnly.length >= 10 && digitsOnly.length <= 11
                        ? `55${digitsOnly}`
                        : digitsOnly)));

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
          const effectiveFromMe = isReceivedEvent ? false : (isSentEvent ? true : !!p.fromMe);
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

          const text =
            p.text?.message ||
            p.image?.caption ||
            (p.image ? "[imagem]" : null) ||
            (p.audio ? "[áudio]" : null) ||
            (p.video ? "[vídeo]" : null) ||
            (p.document ? "[documento]" : null) ||
            (contactCard ? `[contato] ${contactCard.name}` : null) ||
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
          const mediaType = p.image ? "image" : p.audio ? "audio" : p.video ? "video" : p.document ? "document" : contactCard ? "contact" : null;

          // Z-API media URLs (Backblaze "temp-file-download/...") expire in
          // a few minutes. Rehost into our public storage bucket so audio/
          // video/image/document bubbles keep working over time.
          let mediaUrl: string | null = rawMediaUrl;
          if (rawMediaUrl && mediaType && mediaType !== "contact") {
            try {
              mediaUrl = await rehostMediaToStorage(rawMediaUrl, mediaType, channelId, phone);
            } catch (err) {
              console.warn("[zapi-webhook] media rehost failed, keeping original url:", err);
            }
          }
          if (!mediaUrl && contactCard) {
            mediaUrl = `data:text/vcard;charset=utf-8,${encodeURIComponent(contactCard.vcard)}`;
          }

          // Upsert chat
          let { data: existing } = await supabaseAdmin
            .from("zapi_chats")
            .select("id, contact_name, status, unread_count")
            .eq("channel_id", channelId)
            .eq("phone", phone)
            .maybeSingle();

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
                .select("id, contact_name, status, unread_count")
                .eq("channel_id", channelId)
                .eq("contact_name", candidateName)
                .order("last_message_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (byName?.id) {
                existing = byName;
              }
            }
            if (!existing) {
              console.log("[zapi-webhook] dropping LID-only event (no real-phone chat to merge into)", {
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
            const { data: created, error: insertError } = await supabaseAdmin
              .from("zapi_chats")
              .insert({
                channel_id: channelId,
                phone,
                contact_name: incomingContactName,
                contact_avatar: p.senderPhoto || null,
                status: "bot",
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
                const { data: raced } = await supabaseAdmin
                  .from("zapi_chats")
                  .select("id, contact_name, status, unread_count")
                  .eq("channel_id", channelId)
                  .eq("phone", phone)
                  .maybeSingle();
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
            // Reopen finalized chats when the customer sends a NEW message.
            // Without this, all incoming messages were silently swallowed by
            // the bot's "if status === 'finalizado' return false" guard,
            // making it look like new conversations were not appearing.
            const shouldReopen =
              !p.fromMe && existing.status === "finalizado";
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
              assigned_to?: null;
              sector_name?: null;
            } = {
              contact_name: nameToStore,
              contact_avatar: p.senderPhoto || undefined,
              last_message_at: new Date().toISOString(),
              last_message_preview: text.slice(0, 120),
              unread_count: p.fromMe
                ? (existing.unread_count || 0)
                : ((existing.unread_count || 0) + 1),
            };
            if (shouldReopen) {
              console.log(`[zapi-webhook] reopening finalized chat for ${phone} → silently to queue (no bot)`);
              // Reabre silenciosamente para a fila — NÃO dispara o bot/menu novamente
              // para evitar que o cliente receba boas-vindas após uma finalização recente.
              baseUpdate.status = "aguardando";
              baseUpdate.bot_state = {};
              justReopenedSilently = true;
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
): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  if (url.includes("/storage/v1/object/public/chat-media/")) return url;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const contentType = res.headers.get("content-type") || MEDIA_MIME[mediaType] || "application/octet-stream";
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
  }

  const key = `${channelId}/${phone}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("chat-media")
    .upload(key, arrBuf, { contentType, upsert: false, cacheControl: "31536000" });
  if (upErr) throw upErr;

  const { data: pub } = supabaseAdmin.storage.from("chat-media").getPublicUrl(key);
  return pub.publicUrl;
}

