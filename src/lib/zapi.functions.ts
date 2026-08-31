// Server functions for Z-API integration.
// IMPORTANT: kept API-compatible with the legacy gsystem functions so existing
// callers (central.tsx, floating-chat-window.tsx) work without code changes.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { loadZapiChannel, zapiFetch, zapiGetStatus, zapiSendText, zapiSendMedia, zapiDeleteMessage, zapiSetCallRejectAuto, zapiSetCallRejectMessage } from "./zapi.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ------------ Status / chats list ------------

export const getChannelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    try {
      const channel = await loadZapiChannel(supabaseAdmin, data.channelId);
      const r = await zapiGetStatus(channel);
      // Normalize to gsystem-shaped { status: "CONNECTED" | "DISCONNECTED" }
      const connected = r?.connected === true || r?.session === true;
      return { ...r, status: connected ? "CONNECTED" : "DISCONNECTED" };
    } catch (e: any) {
      return { status: "DISCONNECTED", error: String(e?.message || e) };
    }
  });

export const listAllOpenChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    try {
      const { data: activeRows, error } = await context.supabase
        .from("zapi_chats")
        .select("*")
        .eq("channel_id", data.channelId)
        .not("status", "in", "(finalizado,aguardando_retorno)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;

      const rows = [...(activeRows || [])]
        .sort((a: any, b: any) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 200);

      // Build a map chatId -> from_me of the most recent message, so the
      // chat list can show an up/down arrow indicating who sent the last
      // message. We do this in one batched query to avoid N round-trips.
      const chatIds = rows.map((r: any) => r.id).filter(Boolean);
      const lastFromMeByChat: Record<string, boolean> = {};
      if (chatIds.length > 0) {
        const { data: recentMsgs } = await context.supabase
          .from("zapi_messages")
          .select("chat_id, from_me, created_at")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false })
          .limit(1000);
        for (const m of recentMsgs || []) {
          if (!(m.chat_id in lastFromMeByChat)) {
            lastFromMeByChat[m.chat_id] = !!m.from_me;
          }
        }
      }

      // Resolve assigned operators (assigned_to → profiles)
      const assignedIds = Array.from(
        new Set(rows.map((r: any) => r.assigned_to).filter(Boolean))
      );
      const profilesById: Record<string, { id: string; name: string }> = {};
      if (assignedIds.length > 0) {
        const { data: profs } = await context.supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", assignedIds);
        for (const p of profs || []) {
          profilesById[p.user_id] = { id: p.user_id, name: p.name || p.user_id };
        }
      }

      // Also list all profiles (online operators) for the agent filter dropdown
      const { data: allProfs } = await context.supabase
        .from("profiles")
        .select("user_id, name, is_chat_available, last_seen_at")
        .order("name", { ascending: true });
      const users = (allProfs || []).map((p: any) => ({
        id: p.user_id,
        name: p.name || p.user_id,
        status: p.is_chat_available ? "ONLINE" : "OFFLINE",
      }));

      // Map to gsystem-like ChatItem shape so the UI continues to work
      const chats = rows.map((r: any) => {
        const assigned = r.assigned_to ? profilesById[r.assigned_to] : null;
        const statusMap: Record<string, number> = {
          bot: 0,
          aguardando: 1,
          em_atendimento: 2,
          finalizado: 3,
        };
        const lastIsMe = lastFromMeByChat[r.id];
        return {
          attendanceId: r.id,
          status: statusMap[r.status] ?? 1,
          description: r.contact_name || r.phone,
          linkImage: r.contact_avatar,
          countUnreadMessages: r.unread_count || 0,
          contact: {
            name: r.contact_name || undefined,
            number: r.phone,
            linkImage: r.contact_avatar || undefined,
            tags: Array.isArray(r.tags) ? r.tags : [],
          },
          channel: { id: r.channel_id },
          currentSector: r.sector_name ? { description: r.sector_name } : undefined,
          currentUser: assigned ? { id: assigned.id, name: assigned.name } : undefined,
          _agentName: assigned?.name,
          lastMessage: r.last_message_preview
            ? {
                text: r.last_message_preview,
                utcDhMessage: r.last_message_at,
                sender: { isMe: lastIsMe === true },
              }
            : undefined,
          utcDhStartChat: r.created_at,
          timeInWaiting: r.status === "aguardando" && r.last_message_at
            ? Math.max(0, Math.floor((Date.now() - new Date(r.last_message_at).getTime()) / 1000))
            : 0,
          timeInManual: r.status === "em_atendimento" && r.last_message_at
            ? Math.max(0, Math.floor((Date.now() - new Date(r.last_message_at).getTime()) / 1000))
            : 0,
          timeInAutomatic: 0,
          timeInOutOfHour: 0,
        };
      });

      return { chats, users, total: chats.length };
    } catch (err) {
      console.error("[listAllOpenChats] Error:", err);
      return { chats: [], users: [], total: 0, error: String(err) };
    }
  });

// Backward-compat alias
export const listChats = listAllOpenChats;

// ------------ Chat detail / messages ------------

// Helper: extract first name from a full name
function firstNameOf(full?: string | null): string | undefined {
  if (!full) return undefined;
  const trimmed = String(full).trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export const getChatDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase
      .from("zapi_chats")
      .select("*")
      .eq("id", data.chatId)
      .single();
    if (error || !r) return null;

    // Resolve responsible operator name (assigned_to → profiles.name)
    let assignedUserId: string | null = r.assigned_to || null;
    let assignedUserName: string | undefined;
    if (assignedUserId) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("name")
        .eq("user_id", assignedUserId)
        .maybeSingle();
      assignedUserName = prof?.name || undefined;
    }

    // Co-agents stored under bot_state.co_agents = [{ user_id, name, joined_at }]
    const botState = (r.bot_state as Record<string, unknown> | null) || {};
    const rawCoAgents = Array.isArray((botState as any).co_agents) ? (botState as any).co_agents : [];
    const coAgents = rawCoAgents.map((a: any) => ({
      userId: String(a?.user_id || ""),
      name: a?.name ? String(a.name) : undefined,
      firstName: firstNameOf(a?.name),
      joinedAt: a?.joined_at || null,
    })).filter((a: any) => a.userId);

    return {
      attendanceId: r.id,
      description: r.contact_name || r.phone,
      linkImage: r.contact_avatar,
      contact: {
        name: r.contact_name || undefined,
        number: r.phone,
        linkImage: r.contact_avatar || undefined,
      },
      currentSector: r.sector_name ? { description: r.sector_name } : undefined,
      assignedUserId,
      assignedUserName,
      assignedFirstName: firstNameOf(assignedUserName),
      coAgents,
      messages: [],
    };
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
      // When provided, fetch only messages STRICTLY BEFORE this ISO timestamp.
      // Used for "load older messages" pagination so no message is ever lost
      // — the user can keep loading back to the very first message.
      before: z.string().datetime({ offset: true }).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const lim = data.limit ?? 500;
    // Fetch the LATEST `lim` messages (descending) before `before` (if any),
    // then reverse to chronological order. Using ascending+limit returned the
    // OLDEST 500, hiding every new message in chats with >500 history.
    let q = context.supabase
      .from("zapi_messages")
      .select("*")
      .eq("chat_id", data.chatId)
      .order("created_at", { ascending: false })
      .limit(lim);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rowsDesc, error } = await q;
    if (error) return { data: [], messages: [], hasMore: false };
    const rows = (rowsDesc || []).slice().reverse();
    const hasMore = (rowsDesc?.length ?? 0) === lim;

    // Collect distinct author user_ids to resolve names in a single query
    const userIds = Array.from(
      new Set(
        (rows || [])
          .map((m: any) => m.sent_by_user_id || m.whisper_author)
          .filter((v: string | null): v is string => !!v)
      )
    );
    const namesById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      for (const p of profs || []) {
        if (p?.user_id && p?.name) namesById.set(p.user_id, p.name);
      }
    }

    // Resolve chat responsible to mark "via X" messages
    const { data: chatRow } = await context.supabase
      .from("zapi_chats")
      .select("assigned_to")
      .eq("id", data.chatId)
      .maybeSingle();
    const responsibleUserId = chatRow?.assigned_to || null;
    let responsibleName: string | undefined;
    if (responsibleUserId) {
      responsibleName = namesById.get(responsibleUserId);
      if (!responsibleName) {
        const { data: prof } = await context.supabase
          .from("profiles")
          .select("name")
          .eq("user_id", responsibleUserId)
          .maybeSingle();
        if (prof?.name) {
          responsibleName = prof.name;
          namesById.set(responsibleUserId, prof.name);
        }
      }
    }
    const responsibleFirstName = firstNameOf(responsibleName);

    const messages = (rows || []).map((m: any) => {
      const authorId: string | null = m.sent_by_user_id || m.whisper_author || null;
      const authorFull = authorId ? namesById.get(authorId) : undefined;
      const authorFirst = firstNameOf(authorFull);
      const isCoAgentMsg =
        !!m.from_me && !!authorId && !!responsibleUserId && authorId !== responsibleUserId;

      let senderName: string | undefined;
      if (m.is_whisper) senderName = authorFirst ? `🤫 Sussurro · ${authorFirst}` : "🤫 Sussurro";
      else if (m.from_me) senderName = authorFirst || "Você";
      // Incoming group message: show the participant (group member) who sent it
      else if (m.participant_name || m.participant_phone) senderName = m.participant_name || m.participant_phone;
      else senderName = undefined;

      return {
        IdMessage: m.id,
        zapiMessageId: m.zapi_message_id || null,
        senderName,
        senderUserId: authorId,
        senderFirstName: authorFirst,
        senderFullName: authorFull,
        responsibleFirstName: isCoAgentMsg ? responsibleFirstName : undefined,
        isCoAgent: isCoAgentMsg,
        utcDhMessage: m.created_at,
        text: m.text || "",
        mediaUrl: m.media_url || null,
        mediaType: m.media_type || null,
        isSentByMe: !!m.from_me,
        isPrivate: !!m.is_whisper,
        isSystemMessage: false,
        _status: m.status,
        replyTo: m.reply_to_message_id
          ? {
              id: m.reply_to_message_id as string,
              text: (m.reply_to_text as string | null) || "",
              author: (m.reply_to_author as string | null) || "",
            }
          : null,
      };
    });
    return { data: messages, messages, hasMore };
  });

// Add the current operator to the chat as a co-agent (collaborative attendance).
// Stored inside `zapi_chats.bot_state.co_agents` so we don't need a new table.
export const joinChatAsCoAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ chatId: z.string().min(1).max(255) }).parse)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    if (!userId) throw new Error("Usuário não autenticado");

    const { data: chat, error } = await context.supabase
      .from("zapi_chats")
      .select("id, assigned_to, bot_state")
      .eq("id", data.chatId)
      .single();
    if (error || !chat) throw new Error("Conversa não encontrada");

    if (chat.assigned_to === userId) {
      return { success: true, alreadyResponsible: true };
    }

    const { data: prof } = await context.supabase
      .from("profiles")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();
    const name = prof?.name || "Operador";

    const botState = (chat.bot_state as Record<string, unknown> | null) || {};
    const list = Array.isArray((botState as any).co_agents) ? [...(botState as any).co_agents] : [];
    if (list.some((a: any) => a?.user_id === userId)) {
      return { success: true, alreadyJoined: true };
    }
    list.push({ user_id: userId, name, joined_at: new Date().toISOString() });

    const newState = { ...botState, co_agents: list };
    const { error: upErr } = await context.supabase
      .from("zapi_chats")
      .update({ bot_state: newState })
      .eq("id", data.chatId);
    if (upErr) throw new Error(upErr.message);

    return { success: true, name };
  });

// Remove the current operator from the co-agent list.
export const leaveChatAsCoAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ chatId: z.string().min(1).max(255) }).parse)
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    if (!userId) throw new Error("Usuário não autenticado");

    const { data: chat, error } = await context.supabase
      .from("zapi_chats")
      .select("bot_state")
      .eq("id", data.chatId)
      .single();
    if (error || !chat) throw new Error("Conversa não encontrada");

    const botState = (chat.bot_state as Record<string, unknown> | null) || {};
    const list = Array.isArray((botState as any).co_agents) ? (botState as any).co_agents : [];
    const filtered = list.filter((a: any) => a?.user_id !== userId);
    const newState = { ...botState, co_agents: filtered };

    const { error: upErr } = await context.supabase
      .from("zapi_chats")
      .update({ bot_state: newState })
      .eq("id", data.chatId);
    if (upErr) throw new Error(upErr.message);
    return { success: true };
  });

// ------------ Send / actions ------------

export const sendText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
      message: z.string().min(1).max(5000).optional(),
      text: z.string().min(1).max(5000).optional(),
      whisper: z.boolean().optional(),
      replyToMessageId: z.string().uuid().optional(),
      includeOperatorName: z.boolean().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const text = (data.message ?? data.text ?? "").trim();
    if (!text) throw new Error("Mensagem não pode estar vazia");

    // Resolve dados da mensagem citada (se houver)
    let replyToZapiMessageId: string | null = null;
    let replyToText: string | null = null;
    let replyToAuthor: string | null = null;
    if (data.replyToMessageId) {
      const { data: orig } = await context.supabase
        .from("zapi_messages")
        .select("id, chat_id, zapi_message_id, text, from_me, sent_by_user_id, participant_name, media_type")
        .eq("id", data.replyToMessageId)
        .maybeSingle();
      if (!orig) {
        console.warn("[sendText reply] mensagem original não encontrada", {
          replyToMessageId: data.replyToMessageId,
          chatId: data.chatId,
        });
      } else if ((orig as any).chat_id !== data.chatId) {
        console.warn("[sendText reply] mensagem original pertence a outro chat — citação ignorada", {
          replyToMessageId: data.replyToMessageId,
          origChatId: (orig as any).chat_id,
          chatId: data.chatId,
        });
      } else {
        replyToZapiMessageId = (orig as any).zapi_message_id || null;
        const rawText = (orig as any).text || "";
        const mediaType = (orig as any).media_type as string | null;
        replyToText = rawText
          ? rawText.slice(0, 200)
          : mediaType
            ? `[${mediaType}]`
            : "[mídia]";
        if ((orig as any).from_me) {
          if ((orig as any).sent_by_user_id) {
            const { data: prof } = await context.supabase
              .from("profiles")
              .select("name")
              .eq("user_id", (orig as any).sent_by_user_id)
              .maybeSingle();
            replyToAuthor = prof?.name || "Você";
          } else {
            replyToAuthor = "Você";
          }
        } else {
          replyToAuthor = (orig as any).participant_name || null;
        }
        if (!replyToZapiMessageId) {
          console.warn("[sendText reply] mensagem original sem zapi_message_id — Z-API não citará", {
            replyToMessageId: data.replyToMessageId,
            chatId: data.chatId,
          });
        }
      }
    }

    // Whisper: persist only, do NOT call Z-API
    if (data.whisper) {
      const { error: insErr } = await context.supabase.from("zapi_messages").insert({
        chat_id: data.chatId,
        from_me: true,
        is_whisper: true,
        whisper_author: context.userId,
        sent_by_user_id: context.userId,
        text,
        status: "sent",
        reply_to_message_id: data.replyToMessageId || null,
        reply_to_text: replyToText,
        reply_to_author: replyToAuthor,
      });
      if (insErr) throw new Error(insErr.message);
      return { success: true, whisper: true };
    }

    // Look up phone for outgoing
    const { data: chat, error: chatErr } = await context.supabase
      .from("zapi_chats")
      .select("phone, channel_id")
      .eq("id", data.chatId)
      .single();
    if (chatErr || !chat) throw new Error("Conversa não encontrada");

    const channel = await loadZapiChannel(supabaseAdmin, chat.channel_id);

    // Prefixa a mensagem com o nome do operador no padrão WhatsApp: _*Nome*_
    // (negrito + itálico) numa linha acima do conteúdo da mensagem.
    let outgoingText = text;
    let operatorFirstName: string | undefined;
    const includeName = data.includeOperatorName !== false;
    if (includeName && context.userId) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("name")
        .eq("user_id", context.userId)
        .maybeSingle();
      operatorFirstName = firstNameOf(prof?.name);
      if (operatorFirstName) {
        const esc = operatorFirstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Detecta qualquer prefixo de nome já existente (formato atual, antigo
        // do cliente `*Nome:*`, ou simplesmente `Nome:` no início).
        const alreadyPrefixed = new RegExp(
          `^(_\\*${esc}\\*_\\n|\\*${esc}:\\*\\s+|${esc}:\\s+)`,
          "i"
        ).test(text);
        if (!alreadyPrefixed) {
          outgoingText = `_*${operatorFirstName}*_\n${text}`;
        }
      }
    }

    if (data.replyToMessageId) {
      console.log("[sendText reply] enviando ao Z-API com citação", {
        chatId: data.chatId,
        phone: chat.phone,
        replyToMessageId: data.replyToMessageId,
        zapiMessageIdQuoted: replyToZapiMessageId,
      });
    }
    const result = await zapiSendText(channel, chat.phone, outgoingText, {
      messageId: replyToZapiMessageId || undefined,
    });
    if (data.replyToMessageId) {
      console.log("[sendText reply] resposta Z-API", {
        replyToMessageId: data.replyToMessageId,
        zapiMessageIdQuoted: replyToZapiMessageId,
        result: result ? { messageId: (result as any).messageId, id: (result as any).id } : null,
      });
    }

    // Race-safe insert: se o webhook do Z-API chegar antes deste insert,
    // ele terá criado uma linha com o mesmo zapi_message_id (from_me=true).
    // Nesse caso, apenas atualizamos os campos do operador em vez de duplicar.
    const outgoingMessageId = result?.messageId || result?.id || null;
    const outgoingRow = {
      chat_id: data.chatId,
      zapi_message_id: outgoingMessageId,
      from_me: true,
      sent_by_user_id: context.userId,
      text: outgoingText,
      status: "sent",
      reply_to_message_id: data.replyToMessageId || null,
      reply_to_text: replyToText,
      reply_to_author: replyToAuthor,
    };
    let inserted = false;
    if (outgoingMessageId) {
      const { data: existing } = await context.supabase
        .from("zapi_messages")
        .select("id")
        .eq("chat_id", data.chatId)
        .eq("zapi_message_id", outgoingMessageId)
        .maybeSingle();
      if ((existing as any)?.id) {
        await context.supabase
          .from("zapi_messages")
          .update({
            sent_by_user_id: context.userId,
            text: outgoingText,
            reply_to_message_id: data.replyToMessageId || null,
            reply_to_text: replyToText,
            reply_to_author: replyToAuthor,
            status: "sent",
          })
          .eq("id", (existing as any).id);
        inserted = true;
      }
    }
    if (!inserted) {
      const { error: insErr } = await context.supabase.from("zapi_messages").insert(outgoingRow);
      // 23505 = unique violation: webhook inseriu no meio do caminho, ignoramos.
      if (insErr && (insErr as any).code !== "23505") {
        console.error("[sendText] insert falhou:", insErr);
      }
    }

    // Operator interaction cancels the bot flow: assume chat and clear bot state
    // so the automatic sector-routing menu is not re-sent.
    const { data: currentChat } = await context.supabase
      .from("zapi_chats")
      .select("status, assigned_to")
      .eq("id", data.chatId)
      .maybeSingle();
    const chatUpdate: {
      last_message_at: string;
      last_message_preview: string;
      status?: string;
      bot_state?: Record<string, never>;
      assigned_to?: string;
    } = {
      last_message_at: new Date().toISOString(),
      last_message_preview: outgoingText.slice(0, 120),
    };
    if (currentChat && currentChat.status !== "em_atendimento" && currentChat.status !== "finalizado") {
      chatUpdate.status = "em_atendimento";
      chatUpdate.bot_state = {};
      if (!currentChat.assigned_to && context.userId) {
        chatUpdate.assigned_to = context.userId;
      }
    }
    await context.supabase
      .from("zapi_chats")
      .update(chatUpdate)
      .eq("id", data.chatId);

    return { success: true, ...result };
  });

// ------------ Send media (audio / image / video / document) ------------

export const sendMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      chatId: z.string().min(1).max(255),
      kind: z.enum(["audio", "image", "video", "document"]),
      // base64 data URL — capped at ~15MB encoded to stay safe with Worker payload limits
      dataUrl: z.string().min(1).max(21_000_000),
      fileName: z.string().min(1).max(255).optional(),
      caption: z.string().max(2000).optional(),
      extension: z.string().min(1).max(10).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { data: chat, error: chatErr } = await context.supabase
      .from("zapi_chats")
      .select("phone, channel_id")
      .eq("id", data.chatId)
      .single();
    if (chatErr || !chat) throw new Error("Conversa não encontrada");

    const channel = await loadZapiChannel(supabaseAdmin, chat.channel_id);

    const result = await zapiSendMedia(channel, chat.phone, data.kind, data.dataUrl, {
      fileName: data.fileName,
      caption: data.caption,
      extension: data.extension,
    });

    // Persist message — store the Z-API hosted URL when returned, otherwise keep the data URL
    // so the bubble can play/preview it locally until the webhook updates with the public URL.
    const hostedUrl =
      result?.audioUrl || result?.imageUrl || result?.videoUrl || result?.documentUrl || null;

    const labels: Record<string, string> = {
      audio: "[áudio]",
      image: "[imagem]",
      video: "[vídeo]",
      document: "[documento]",
    };

    const outgoingMessageId = result?.messageId || result?.id || null;
    const mediaRow = {
      chat_id: data.chatId,
      zapi_message_id: outgoingMessageId,
      from_me: true,
      sent_by_user_id: context.userId,
      text: data.caption || labels[data.kind],
      media_url: hostedUrl || data.dataUrl,
      media_type: data.kind,
      status: "sent",
    };
    let mediaInserted = false;
    if (outgoingMessageId) {
      const { data: existing } = await context.supabase
        .from("zapi_messages")
        .select("id")
        .eq("chat_id", data.chatId)
        .eq("zapi_message_id", outgoingMessageId)
        .maybeSingle();
      if ((existing as any)?.id) {
        await context.supabase
          .from("zapi_messages")
          .update({
            sent_by_user_id: context.userId,
            text: mediaRow.text,
            media_url: mediaRow.media_url,
            media_type: mediaRow.media_type,
            status: "sent",
          })
          .eq("id", (existing as any).id);
        mediaInserted = true;
      }
    }
    if (!mediaInserted) {
      const { error: insErr } = await context.supabase.from("zapi_messages").insert(mediaRow);
      if (insErr && (insErr as any).code !== "23505") {
        console.error("[sendMedia] insert falhou:", insErr);
      }
    }


    await context.supabase
      .from("zapi_chats")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (data.caption || labels[data.kind]).slice(0, 120),
      })
      .eq("id", data.chatId);

    return { success: true, ...result };
  });

export const finalizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }) => {
    // Snapshot chat before finalize for audit
    const { data: before } = await context.supabase
      .from("zapi_chats")
      .select("id, phone, contact_name, assigned_to, created_at, sector_name")
      .eq("id", data.chatId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("zapi_chats")
      .update({ status: "finalizado", assigned_to: null })
      .eq("id", data.chatId);
    if (error) throw new Error(error.message);

    // Audit log (fire-and-forget)
    try {
      const { writeAuditLog } = await import("@/lib/audit.server");
      const userId = (context as any).userId as string;
      let userName: string | null = null;
      try {
        const { data: prof } = await context.supabase
          .from("profiles")
          .select("name")
          .eq("user_id", userId)
          .maybeSingle();
        userName = prof?.name ?? null;
      } catch {}
      const phone = before?.phone ?? "";
      const isGroup = /@g\.us$/.test(phone) || /-\d{8,}/.test(phone);
      const closedAt = new Date();
      const createdAt = before?.created_at ? new Date(before.created_at) : null;
      const durationMs = createdAt ? closedAt.getTime() - createdAt.getTime() : null;
      const durationMin =
        durationMs !== null ? Math.max(0, Math.round(durationMs / 60000)) : null;
      const label = before?.contact_name || phone || data.chatId;
      await writeAuditLog({
        user_id: userId,
        user_name: userName,
        event_category: "central_atendimento",
        event_type: isGroup ? "grupo.finalizado" : "chat.finalizado",
        target_type: isGroup ? "grupo" : "chat",
        target_id: data.chatId,
        target_label: label,
        metadata: {
          channel_id: data.channelId,
          phone,
          is_group: isGroup,
          sector_name: before?.sector_name ?? null,
          previous_assigned_to: before?.assigned_to ?? null,
          started_at: before?.created_at ?? null,
          closed_at: closedAt.toISOString(),
          duration_minutes: durationMin,
        },
      });
    } catch (err) {
      console.error("[finalizeChat] audit failed", err);
    }

    return { success: true };
  });

export const transferChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
      sectorId: z.string().max(255).optional(),
      sectorName: z.string().max(255).optional(),
      userId: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const update: any = {};
    if (data.sectorName) update.sector_name = data.sectorName;
    else if (data.sectorId) {
      const { data: s } = await context.supabase
        .from("sectors")
        .select("name")
        .eq("id", data.sectorId)
        .maybeSingle();
      if (s?.name) update.sector_name = s.name;
    }
    if (data.userId && /^[0-9a-f-]{36}$/i.test(data.userId)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: targetProfile, error: targetError } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("user_id", data.userId)
        .eq("is_active", true)
        .maybeSingle();
      if (targetError || !targetProfile) {
        throw new Error("O operador selecionado está inativo e não pode receber conversas");
      }
      update.assigned_to = data.userId;
    }
    update.status = "em_atendimento";

    // Snapshot previous assignee for the productivity report
    const { data: prevChat } = await context.supabase
      .from("zapi_chats")
      .select("assigned_to, contact_name, phone")
      .eq("id", data.chatId)
      .maybeSingle();

    const { error } = await context.supabase
      .from("zapi_chats")
      .update(update)
      .eq("id", data.chatId);
    if (error) throw new Error(error.message);

    // Audit: distinguish self-assignment ("assumido") from transfer to
    // another operator ("transferido"), feeding the journey/productivity report.
    try {
      const { writeAuditLog } = await import("@/lib/audit.server");
      const toUserId = (update.assigned_to as string | undefined) || null;
      const selfAssigned = !!toUserId && toUserId === context.userId;
      await writeAuditLog({
        user_id: context.userId,
        event_category: "central_atendimento",
        event_type: selfAssigned ? "chat.assumido" : "chat.transferido",
        target_type: "zapi_chat",
        target_id: data.chatId,
        target_label: (prevChat as any)?.contact_name || (prevChat as any)?.phone || null,
        metadata: {
          chat_id: data.chatId,
          from_user_id: (prevChat as any)?.assigned_to || null,
          to_user_id: toUserId,
          sector_name: update.sector_name || null,
          self_assigned: selfAssigned,
        },
      });
    } catch (err) {
      console.error("[transferChat] audit failed", err);
    }

    return { success: true };
  });


// ------------ Compatibility stubs for legacy UI ------------

export const createChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      contactPhone: z.string().min(8).max(20),
      message: z.string().min(1).max(5000).optional(),
      sectorId: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const phone = data.contactPhone.replace(/\D/g, "");
    if (!phone) throw new Error("Telefone inválido");

    // Compute normalized phone (matches public.normalize_zapi_phone)
    const normalizePhoneFallback = (raw: string): string => {
      let d = raw.replace(/\D/g, "");
      if (!d) return raw;
      if (d.length >= 15) return `lid:${d}`;
      if (d.length >= 10 && d.length <= 11) d = `55${d}`;
      // Add missing leading 9 for BR mobile (legacy 10-digit numbers)
      if (/^55[1-9][0-9][6-9][0-9]{7}$/.test(d)) {
        d = d.slice(0, 4) + "9" + d.slice(4);
      }
      return d;
    };
    let phoneNormalized: string | null = null;
    try {
      const { data: normData } = await (context.supabase as any).rpc("normalize_zapi_phone", { raw: phone });
      if (typeof normData === "string" && normData) phoneNormalized = normData;
    } catch {
      /* fallback below */
    }
    if (!phoneNormalized) phoneNormalized = normalizePhoneFallback(phone);

    // Lookup existing chat by normalized phone (matches unique index)
    const findExisting = async () => {
      const { data: row } = await context.supabase
        .from("zapi_chats")
        .select("id")
        .eq("channel_id", data.channelId)
        .eq("phone_normalized", phoneNormalized!)
        .maybeSingle();
      return row?.id as string | undefined;
    };

    let chatId = await findExisting();
    if (!chatId) {
      const { data: created, error } = await context.supabase
        .from("zapi_chats")
        .insert({
          channel_id: data.channelId,
          phone,
          status: "em_atendimento",
          assigned_to: context.userId,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) {
        // Race with webhook or pre-existing row with differently-formatted phone
        if ((error as any).code === "23505") {
          chatId = await findExisting();
        }
        if (!chatId) throw new Error(error.message || "Erro ao criar conversa");
      } else if (created) {
        chatId = created.id;
      }
    }

    if (chatId) {
      await context.supabase
        .from("zapi_chats")
        .update({
          status: "em_atendimento",
          assigned_to: context.userId,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", chatId);
    }

    if (!chatId) throw new Error("Erro ao criar conversa");

    if (data.message) {
      const channel = await loadZapiChannel(supabaseAdmin, data.channelId);
      await zapiSendText(channel, phone, data.message);
      await context.supabase.from("zapi_messages").insert({
        chat_id: chatId,
        from_me: true,
        text: data.message,
        status: "sent",
      });
    }

    return { success: true, attendanceId: chatId };
  });

export const listSectors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("sectors")
      .select("id, name, description")
      .eq("is_active", true);
    return (data || []).map((s) => ({ id: s.id, description: s.name, name: s.name }));
  });

export const listGSystemUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async () => {
    // Usa o admin client para bypassar a RLS de profiles (atendentes só veem o
    // próprio perfil), permitindo que qualquer operador transfira para qualquer outro.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, is_chat_available, last_seen_at")
      .eq("is_active", true)
      .order("name", { ascending: true });
    const now = Date.now();
    return (data || [])
      .filter((p: any) => p.user_id && p.name)
      .map((p: any) => {
        const seenAt = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
        const online = !!p.is_chat_available && now - seenAt < 2 * 60 * 1000;
        return { id: p.user_id, name: p.name, status: online ? "ONLINE" : "OFFLINE" };
      });
  });

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      page: z.number().min(1).max(1000).optional(),
      pageSize: z.number().min(1).max(500).optional(),
      search: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("zapi_chats")
      .select("phone, contact_name, contact_avatar")
      .eq("channel_id", data.channelId);
    if (data.search) q = q.ilike("contact_name", `%${data.search}%`);
    const { data: rows } = await q.limit(data.pageSize || 50);
    return {
      data: (rows || []).map((r) => ({
        name: r.contact_name,
        number: r.phone,
        linkImage: r.contact_avatar,
      })),
    };
  });

// ------------ Delete message (for everyone, via Z-API) ------------
//
// Removes a previously sent message from WhatsApp on both sides. Marks the
// local row as deleted (soft delete via text replacement) so the bubble
// disappears from the UI. Only the operator who sent it (or an admin) can
// trigger this from the chat — enforced in the handler.
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      messageId: z.string().uuid(), // local zapi_messages.id
    }).parse
  )
  .handler(async ({ data, context }) => {
    // Load the message + chat to get phone, channel and ownership info
    const { data: msg, error: msgErr } = await context.supabase
      .from("zapi_messages")
      .select("id, chat_id, zapi_message_id, from_me, sent_by_user_id")
      .eq("id", data.messageId)
      .single();
    if (msgErr || !msg) throw new Error("Mensagem não encontrada");
    if (!msg.zapi_message_id) {
      throw new Error("Não é possível excluir: mensagem ainda sem ID do WhatsApp");
    }

    const { data: chat, error: chatErr } = await context.supabase
      .from("zapi_chats")
      .select("phone, channel_id")
      .eq("id", msg.chat_id)
      .single();
    if (chatErr || !chat) throw new Error("Conversa não encontrada");

    // Permission check: must be the author OR an admin
    const isAuthor = !!context.userId && msg.sent_by_user_id === context.userId;
    let isAdmin = false;
    if (!isAuthor && context.userId) {
      const { data: roleRow } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!roleRow;
    }
    if (!isAuthor && !isAdmin) {
      throw new Error("Você só pode excluir mensagens enviadas por você");
    }

    const channel = await loadZapiChannel(supabaseAdmin, chat.channel_id);

    await zapiDeleteMessage(channel, {
      messageId: msg.zapi_message_id,
      phone: chat.phone,
      owner: !!msg.from_me,
    });

    // Soft-delete locally so the UI hides it (renderer skips msg.isDeleted via text marker)
    await context.supabase
      .from("zapi_messages")
      .update({
        text: "🚫 Mensagem apagada",
        media_url: null,
        media_type: null,
      })
      .eq("id", data.messageId);

    return { success: true };
  });

// ------------ Webhooks setup (notifySentByMe + URLs) ------------
//
// Z-API só dispara o evento de "mensagem enviada pelo dono do número"
// (celular/WhatsApp Web fora do nosso sistema) se a flag
// "receive-all-notifications" estiver ATIVA na instância. Esta server fn
// configura todos os webhooks essenciais de uma vez para o canal:
//   - on-message-received (entrada)
//   - on-send             (saída via API)
//   - message-status      (entregue/lido)
//   - receive-all-notifications = true (espelha mensagens enviadas pelo celular)
//
// Webhook secret já existe no canal — apenas reanexamos a URL.

export const setupZapiWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const channel = await loadZapiChannel(supabaseAdmin, data.channelId);

    // Buscar webhook_secret e montar URL pública estável
    const { data: row } = await context.supabase
      .from("channels")
      .select("webhook_secret, call_reject_enabled, call_reject_message")
      .eq("id", data.channelId)
      .single();
    const secret = (row as any)?.webhook_secret;
    if (!secret) throw new Error("Canal sem webhook_secret configurado");

    const projectId = "40ab25b5-cec0-4fe2-8de9-27bfd1074392";
    const url = `https://project--${projectId}.lovable.app/api/public/zapi-webhook/${data.channelId}?secret=${secret}`;

    const results: Record<string, { ok: boolean; error?: string }> = {};

    const tryPut = async (path: string, body: unknown, label: string) => {
      try {
        await zapiFetch(channel, path, "PUT", body);
        results[label] = { ok: true };
      } catch (e: any) {
        results[label] = { ok: false, error: String(e?.message || e) };
      }
    };

    // Aponta TODOS os webhooks (received, send, status, delivery, presence,
    // disconnected, connected) para a mesma URL com uma única chamada.
    await tryPut("/update-every-webhooks", { value: url }, "all_webhooks");

    // Liga "notifySentByMe" para que mensagens enviadas pelo celular/WhatsApp
    // Web do dono do número também disparem o webhook on-send.
    await tryPut("/update-notify-sent-by-me", { notifySentByMe: true }, "notify_sent_by_me");

    // Reaplica rejeição automática de chamadas conforme configurado no canal,
    // garantindo idempotência caso a Z-API perca o estado.
    const rejectEnabled = !!(row as any)?.call_reject_enabled;
    const rejectMessage = (row as any)?.call_reject_message as string | null;
    try {
      await zapiSetCallRejectAuto(channel, rejectEnabled);
      results.call_reject_auto = { ok: true };
    } catch (e: any) {
      results.call_reject_auto = { ok: false, error: String(e?.message || e) };
    }
    if (rejectEnabled && rejectMessage && rejectMessage.trim().length > 0) {
      try {
        await zapiSetCallRejectMessage(channel, rejectMessage);
        results.call_reject_message = { ok: true };
      } catch (e: any) {
        results.call_reject_message = { ok: false, error: String(e?.message || e) };
      }
    }

    return { url, results };
  });

// ------------ Rejeição automática de chamadas ------------

export const updateCallRejectionConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      enabled: z.boolean(),
      message: z.string().max(1000).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const channel = await loadZapiChannel(supabaseAdmin, data.channelId);
    const results: Record<string, { ok: boolean; error?: string }> = {};

    try {
      await zapiSetCallRejectAuto(channel, data.enabled);
      results.auto = { ok: true };
    } catch (e: any) {
      results.auto = { ok: false, error: String(e?.message || e) };
    }

    if (data.enabled && data.message && data.message.trim().length > 0) {
      try {
        await zapiSetCallRejectMessage(channel, data.message);
        results.message = { ok: true };
      } catch (e: any) {
        results.message = { ok: false, error: String(e?.message || e) };
      }
    }

    // Persist locally so we can reapply on setupZapiWebhooks and remember
    // operator preference across sessions.
    try {
      await context.supabase
        .from("channels")
        .update({
          call_reject_enabled: data.enabled,
          ...(data.message ? { call_reject_message: data.message } : {}),
        } as any)
        .eq("id", data.channelId);
      results.persisted = { ok: true };
    } catch (e: any) {
      results.persisted = { ok: false, error: String(e?.message || e) };
    }

    return { results };
  });
