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

async function callGSystem(endpoint: string, token: string, channelId: string, method = "GET", body?: unknown): Promise<Record<string, any>> {
  const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
  if (method === "POST") {
    return GSystemGateway.post<Record<string, any>>(endpoint, body, token, channelId);
  }
  if (method === "PUT") {
    return GSystemGateway.put<Record<string, any>>(endpoint, body, token, channelId);
  }
  return GSystemGateway.get<Record<string, any>>(endpoint, token, channelId);
}

export const listChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      status: z.string().optional(),
      page: z.number().min(1).max(1000).optional(),
      limit: z.number().min(1).max(100).optional(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem("/chats/list", channel.token, channel.id, "POST", {
      status: data.status, page: data.page || 1, limit: data.limit || 20,
    });
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem(`/chats/messages/${data.chatId}`, channel.token, channel.id);
  });

export const sendText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255), message: z.string().min(1).max(5000) }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem("/chats/send-text", channel.token, channel.id, "POST", { chatId: data.chatId, message: data.message });
  });

export const createChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), contactPhone: z.string().min(10).max(20), message: z.string().min(1).max(5000).optional(), sectorId: z.string().optional() }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem("/chats/create-new", channel.token, channel.id, "POST", { contactPhone: data.contactPhone, message: data.message, sectorId: data.sectorId });
  });

export const transferChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255), sectorId: z.string().optional(), userId: z.string().optional() }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem(`/chats/${data.chatId}/transfer`, channel.token, channel.id, "POST", { sectorId: data.sectorId, userId: data.userId });
  });

export const finalizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), chatId: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem(`/chats/${data.chatId}/finalize`, channel.token, channel.id, "POST", {});
  });

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid(), page: z.number().min(1).max(1000).optional(), search: z.string().max(255).optional() }).parse
  )
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    const query = new URLSearchParams();
    if (data.page) query.set("page", String(data.page));
    if (data.search) query.set("search", data.search);
    const qs = query.toString();
    return callGSystem(`/contacts/list${qs ? `?${qs}` : ""}`, channel.token, channel.id);
  });

export const getChannelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem("/channel/status", channel.token, channel.id);
  });

export const listSectors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem("/sectors", channel.token, channel.id);
  });

export const listGSystemUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ channelId: z.string().uuid() }).parse)
  .handler(async ({ data, context }): Promise<Record<string, any>> => {
    const channel = await getChannelToken(context.supabase, data.channelId);
    return callGSystem("/users", channel.token, channel.id);
  });
