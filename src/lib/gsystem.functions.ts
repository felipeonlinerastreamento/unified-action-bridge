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
  return data;
}

// List chats
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
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.post("/chats/list", {
      status: data.status,
      page: data.page || 1,
      limit: data.limit || 20,
    }, channel.token, channel.id);
  });

// Get chat messages
export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.get(`/chats/messages/${data.chatId}`, channel.token, channel.id);
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
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.post("/chats/send-text", {
      chatId: data.chatId,
      message: data.message,
    }, channel.token, channel.id);
  });

// Create new chat
export const createChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      contactPhone: z.string().min(10).max(20),
      message: z.string().min(1).max(5000).optional(),
      sectorId: z.string().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.post("/chats/create-new", {
      contactPhone: data.contactPhone,
      message: data.message,
      sectorId: data.sectorId,
    }, channel.token, channel.id);
  });

// Transfer chat
export const transferChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
      sectorId: z.string().optional(),
      userId: z.string().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.post(`/chats/${data.chatId}/transfer`, {
      sectorId: data.sectorId,
      userId: data.userId,
    }, channel.token, channel.id);
  });

// Finalize chat
export const finalizeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      chatId: z.string().min(1).max(255),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.post(`/chats/${data.chatId}/finalize`, {}, channel.token, channel.id);
  });

// List contacts
export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
      page: z.number().min(1).max(1000).optional(),
      search: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    const query = new URLSearchParams();
    if (data.page) query.set("page", String(data.page));
    if (data.search) query.set("search", data.search);
    const qs = query.toString();
    return GSystemGateway.get(`/contacts/list${qs ? `?${qs}` : ""}`, channel.token, channel.id);
  });

// Get channel status
export const getChannelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      channelId: z.string().uuid(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.get("/channel/status", channel.token, channel.id);
  });

// List sectors
export const listSectors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid() }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.get("/sectors", channel.token, channel.id);
  });

// List GSystem users
export const listGSystemUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ channelId: z.string().uuid() }).parse
  )
  .handler(async ({ data, context }) => {
    const { GSystemGateway } = await import("@/lib/gsystem-gateway.server");
    const channel = await getChannelToken(context.supabase, data.channelId);
    return GSystemGateway.get("/users", channel.token, channel.id);
  });
