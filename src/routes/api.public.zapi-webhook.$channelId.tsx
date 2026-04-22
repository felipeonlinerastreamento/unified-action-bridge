import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processIncomingForBot } from "@/lib/zapi-bot.server";

// Z-API webhook payload (loose schema — Z-API sends many event shapes)
const PayloadSchema = z.object({
  type: z.string().optional(),
  phone: z.string().optional(),
  fromMe: z.boolean().optional(),
  messageId: z.string().optional(),
  senderName: z.string().optional(),
  senderPhoto: z.string().optional(),
  text: z.object({ message: z.string().optional() }).optional(),
  image: z.object({ imageUrl: z.string().optional(), caption: z.string().optional() }).optional(),
  audio: z.object({ audioUrl: z.string().optional() }).optional(),
  video: z.object({ videoUrl: z.string().optional() }).optional(),
  document: z.object({ documentUrl: z.string().optional() }).optional(),
  status: z.string().optional(),
  ids: z.array(z.string()).optional(),
}).passthrough();

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

        // Presence: typing
        if (p.type === "PresenceChatCallback" && p.phone) {
          const isTyping = String(p.status || "").toLowerCase().includes("typ");
          await supabaseAdmin
            .from("zapi_chats")
            .update({ bot_state: { is_typing: isTyping } as any })
            .eq("channel_id", channelId)
            .eq("phone", String(p.phone).replace(/\D/g, ""));
          return new Response("ok");
        }

        // Incoming/outgoing message
        if (p.phone) {
          const rawPhone = String(p.phone);
          // WhatsApp groups: raw phone contains "@g.us" or "<creator>-<timestamp>" pattern
          const isGroupMessage = /@g\.us/i.test(rawPhone) || /-\d{8,}/.test(rawPhone);
          const phone = rawPhone.replace(/\D/g, "");
          const text =
            p.text?.message ||
            p.image?.caption ||
            (p.image ? "[imagem]" : null) ||
            (p.audio ? "[áudio]" : null) ||
            (p.video ? "[vídeo]" : null) ||
            (p.document ? "[documento]" : null) ||
            "";

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
                contact_name: p.senderName || null,
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
            await supabaseAdmin
              .from("zapi_chats")
              .update({
                contact_name: existing.contact_name || p.senderName || null,
                contact_avatar: p.senderPhoto || undefined,
                last_message_at: new Date().toISOString(),
                last_message_preview: text.slice(0, 120),
                unread_count: p.fromMe ? (existing.unread_count || 0) : ((existing.unread_count || 0) + 1),
              })
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
