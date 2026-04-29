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
  status: z.string().optional(),
  ids: z.array(z.string()).optional(),
}).passthrough();

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
          return new Response("ok");
        }

        // Presence: typing — IGNORED on purpose.
        // Persisting is_typing into bot_state used to overwrite `current_node` due to
        // race conditions between the bot writing state and presence events arriving
        // concurrently, which broke multi-step flows. Typing indicators are ephemeral
        // UI signals only and should not touch the bot state.
        if (p.type === "PresenceChatCallback") {
          return new Response("ok");
        }

        // Incoming/outgoing message — only process actual message events
        const eventType = String(p.type || "");
        const hasContent = !!(p.text?.message || p.image || p.audio || p.video || p.document);
        const isMessageEvent = MESSAGE_EVENT_TYPES.has(eventType) || (!eventType && hasContent);

        if (p.phone && isMessageEvent) {
          const rawPhone = String(p.phone);
          // WhatsApp groups: raw phone may contain "@g.us", "<creator>-<timestamp>",
          // or arrive already normalized as a long numeric group id.
          const isGroupMessage = isGroupPhoneIdentifier(rawPhone);
          const phone = rawPhone.replace(/\D/g, "");

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

          const text =
            p.text?.message ||
            p.image?.caption ||
            (p.image ? "[imagem]" : null) ||
            (p.audio ? "[áudio]" : null) ||
            (p.video ? "[vídeo]" : null) ||
            (p.document ? "[documento]" : null) ||
            "";

          // Skip empty events that have no content (status callbacks, presence echoes, etc.)
          if (!hasContent) {
            console.log("[zapi-webhook] skipping empty event", { type: eventType, phone });
            return new Response("ok");
          }

          const mediaUrl =
            p.image?.imageUrl || p.audio?.audioUrl || p.video?.videoUrl || p.document?.documentUrl || null;
          const mediaType = p.image ? "image" : p.audio ? "audio" : p.video ? "video" : p.document ? "document" : null;

          // Upsert chat
          const { data: existing } = await supabaseAdmin
            .from("zapi_chats")
            .select("id, contact_name, status, unread_count")
            .eq("channel_id", channelId)
            .eq("phone", phone)
            .maybeSingle();

          let chatId = existing?.id as string | undefined;
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
              console.log(`[zapi-webhook] reopening finalized chat for ${phone} → restarting bot flow`);
              baseUpdate.status = "bot";
              baseUpdate.bot_state = {};
              baseUpdate.assigned_to = null;
              baseUpdate.sector_name = null;
            }
            await supabaseAdmin
              .from("zapi_chats")
              .update(baseUpdate)
              .eq("id", chatId!);
          }

          if (chatId) {
            await supabaseAdmin.from("zapi_messages").insert({
              chat_id: chatId,
              zapi_message_id: p.messageId || null,
              from_me: !!p.fromMe,
              text,
              media_url: mediaUrl,
              media_type: mediaType,
              status: p.fromMe ? "sent" : "delivered",
            });

            // Run bot only on incoming customer messages — skip for groups
            if (!p.fromMe && text && !isGroupMessage) {
              try {
                await processIncomingForBot({
                  channelId,
                  chatId,
                  phone,
                  contactName: p.senderName || existing?.contact_name || null,
                  incomingText: text,
                });
              } catch (e) {
                console.error("[zapi-webhook] bot error:", e);
              }
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
