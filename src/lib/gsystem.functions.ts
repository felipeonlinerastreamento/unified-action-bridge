import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Helper to get channel token from DB
async function getChannelToken(supabase: any, channelId: string) {
  const { data, error } = await supabase
    .from("channels")
    .select("token, id")
    .eq("id", channelId)
    .eq("is_active", true)
    .single();
  if (error || !data) throw new Error("Canal não encontrado ou inativo");
  return data as { token: string; id: string };
}

const GSYSTEM_BASE_URL = "https://api.gsystem.chat/core/v2/api";

// Direct fetch helper that skips the gateway logging (which fails due to RLS)
async function gsystemFetch(endpoint: string, token: string, method = "GET", body?: unknown): Promise<any> {
  const url = `${GSYSTEM_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access-token": token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { success: true };
  }

  const text = await res.text();
  if (!text) return { success: true };

  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      const errorCode = data?.errorCode || `http_${res.status}`;
      const errorMsg = data?.msg || data?.message || res.statusText;
      throw new Error(`GSystem error [${errorCode}]: ${errorMsg}`);
    }
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`GSystem returned invalid JSON (status ${res.status})`);
    }
    throw err;
  }
}

// List all open chats using combined approach: /chats/list + agent attendances
export const listAllOpenChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    try {
      const chatMap = new Map<string, any>();

      // Helper to fetch all pages of a given status
      async function fetchAllPages(status: string) {
        let page = 1;
        const maxPages = 10;
        while (page <= maxPages) {
          try {
            const result = await gsystemFetch("/chats/list", channel.token, "POST", {
              data: { status, page, pageSize: 200 },
            });
            const items = Array.isArray(result) ? result : result?.data || [];
            for (const chat of items) {
              if (chat.attendanceId) {
                chatMap.set(chat.attendanceId, chat);
              }
            }
            // If fewer items than page size, no more pages
            if (items.length < 200) break;
            page++;
          } catch (e) {
            console.warn(`[listAllOpenChats] Failed fetching ${status} page ${page}:`, e);
            break;
          }
        }
      }

      // 1) Fetch all pages for all active statuses
      await Promise.allSettled([
        fetchAllPages("OPEN"),
        fetchAllPages("PENDING"),
        fetchAllPages("IN_PROGRESS"),
        fetchAllPages("MANUAL"),
        fetchAllPages("WAITING"),
        fetchAllPages("AUTOMATIC"),
      ]);

      // 2) Also get agent-assigned chats via /users
      const users = await gsystemFetch("/users", channel.token);
      const userList = Array.isArray(users) ? users : [];
      const agentAttendanceIds: string[] = [];
      const userMap: Record<string, { name: string; status: string }> = {};

      for (const u of userList) {
        if (u.currentAttendanceId && !chatMap.has(u.currentAttendanceId)) {
          agentAttendanceIds.push(u.currentAttendanceId);
          userMap[u.currentAttendanceId] = { name: u.name || "", status: u.status || "" };
        }
      }

      // Fetch details for agent chats not already in chatMap
      if (agentAttendanceIds.length > 0) {
        const agentResults = await Promise.allSettled(
          agentAttendanceIds.map(async (id) => {
            const detail = await gsystemFetch(`/chats/${id}`, channel.token);
            return { ...detail, _agentName: userMap[id]?.name };
          })
        );
        for (const r of agentResults) {
          if (r.status === "fulfilled" && r.value?.attendanceId) {
            chatMap.set(r.value.attendanceId, r.value);
          }
        }
      }

      // Enrich chats with agent names from user list
      for (const u of userList) {
        if (u.currentAttendanceId && chatMap.has(u.currentAttendanceId)) {
          const chat = chatMap.get(u.currentAttendanceId);
          if (!chat._agentName) chat._agentName = u.name;
        }
      }

      // Keep all non-finalized chats (don't filter by numeric status since API may return different formats)
      const chats = Array.from(chatMap.values()).filter(
        (c) => c && c.attendanceId && c.status !== 3 && c.status !== "CLOSED" && c.status !== "FINISHED"
      );

      console.log(`[listAllOpenChats] Found ${chatMap.size} total, ${chats.length} after filter`);
      return { chats, users: userList, total: chats.length };
    } catch (err) {
      console.error("[listAllOpenChats] Error:", err);
      return { chats: [], users: [], total: 0, error: String(err) };
    }
  });

// List chats — tries list endpoint, falls back to empty
export const listChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      status: z.string().max(50).optional(),
      page: z.number().min(1).max(1000).optional(),
      limit: z.number().min(1).max(100).optional(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    try {
      const result = await gsystemFetch("/chats/list", channel.token, "POST", {
        data: { status: data.status || "OPEN", page: data.page || 1, pageSize: data.limit || 20 },
      });
      return result;
    } catch (err) {
      console.error("[listChats] Error:", err);
      return { data: [], total: 0, error: String(err) };
    }
  });

// Get a single chat by ID
export const getChatDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch(`/chats/${data.chatId}`, channel.token);
  });

// Get messages - uses message ID endpoint
export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    try {
      return await gsystemFetch(`/chats/messages/${data.chatId}`, channel.token);
    } catch {
      return { data: [], messages: [] };
    }
  });

// Send text message
export const sendText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
      message: z.string().min(1).max(5000),
    }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch("/chats/send-text", channel.token, "POST", {
      attendanceId: data.chatId,
      text: data.message,
    });
  });

// Create new chat
export const createChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      contactPhone: z.string().min(10).max(20),
      message: z.string().min(1).max(5000).optional(),
      sectorId: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch("/chats/create-new", channel.token, "POST", {
      data: { contactPhone: data.contactPhone, message: data.message, sectorId: data.sectorId },
    });
  });

// Transfer chat
export const transferChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
      sectorId: z.string().max(255).optional(),
      userId: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch(`/chats/${data.chatId}/transfer`, channel.token, "POST", {
      sectorId: data.sectorId,
      userId: data.userId,
    });
  });

// Finalize chat
export const finalizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch(`/chats/${data.chatId}/finalize`, channel.token, "POST", {});
  });

// List contacts
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
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    const params = new URLSearchParams();
    params.set("page", String(data.page || 1));
    params.set("pageSize", String(data.pageSize || 20));
    if (data.search) params.set("search", data.search);
    return gsystemFetch(`/contacts/list?${params}`, channel.token);
  });

// Get channel status
export const getChannelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch("/channel/status", channel.token);
  });

// List sectors
export const listSectors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch("/sectors", channel.token);
  });

// List GSystem users/agents
export const listGSystemUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return gsystemFetch("/users", channel.token);
  });
