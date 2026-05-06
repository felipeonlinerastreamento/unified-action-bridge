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
        return;
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
          const phone = rawPhone.replace(/\D/g, "");

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
          if (!p.fromMe && !isGroupMessage && text) {
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
                const m = String(text).trim().match(/[123]/);
                const score = m ? Number(m[0]) : null;
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
                    await zapiSendText(creds, phone, thanks);
                    if ((pending as any).chat_id) {
                      await supabaseAdmin.from("zapi_messages").insert({
                        chat_id: (pending as any).chat_id,
                        from_me: true,
                        text: thanks,
                        status: "sent",
                      });
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

          const mediaUrl =
            p.image?.imageUrl || p.audio?.audioUrl || p.video?.videoUrl || p.document?.documentUrl
            || (contactCard
              ? `data:text/vcard;charset=utf-8,${encodeURIComponent(contactCard.vcard)}`
              : null);
          const mediaType = p.image ? "image" : p.audio ? "audio" : p.video ? "video" : p.document ? "document" : contactCard ? "contact" : null;

          // Upsert chat
          const { data: existing } = await supabaseAdmin
            .from("zapi_chats")
            .select("id, contact_name, status, unread_count")
            .eq("channel_id", channelId)
            .eq("phone", phone)
            .maybeSingle();

          let chatId = existing?.id as string | undefined;
          let justReopenedSilently = false;
          if (!chatId) {
            const { data: created } = await supabaseAdmin
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
            chatId = created?.id;
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

            // Upsert by (chat_id, zapi_message_id) — Z-API occasionally
            // delivers the same messageId in multiple callbacks within seconds,
            // which previously caused duplicated messages in the chat panel.
            if (p.messageId) {
              await supabaseAdmin
                .from("zapi_messages")
                .upsert(
                  {
                    chat_id: chatId,
                    zapi_message_id: p.messageId,
                    from_me: !!p.fromMe,
                    text,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    status: p.fromMe ? "sent" : "delivered",
                    participant_name: participantName,
                    participant_phone: participantPhone,
                  } as any,
                  { onConflict: "chat_id,zapi_message_id", ignoreDuplicates: true },
                );
            } else {
              await supabaseAdmin.from("zapi_messages").insert({
                chat_id: chatId,
                zapi_message_id: null,
                from_me: !!p.fromMe,
                text,
                media_url: mediaUrl,
                media_type: mediaType,
                status: p.fromMe ? "sent" : "delivered",
                participant_name: participantName,
                participant_phone: participantPhone,
              } as any);
            }

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
            if (!p.fromMe && text && !isGroupMessage) {
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

