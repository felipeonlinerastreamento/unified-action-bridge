import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOutlookProfile } from "./outlook.server";

export const listEmailChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("email_channels")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { channels: data ?? [] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  email_address: z.string().email(),
  is_active: z.boolean().default(true),
  polling_enabled: z.boolean().default(true),
  default_sector: z.string().max(255).nullable().optional(),
  default_priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  ignore_domains: z.array(z.string().min(1).max(255)).default([]),
  ignore_emails: z.array(z.string().email()).default([]),
  mark_as_read: z.boolean().default(true),
});

export const upsertEmailChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const payload = { ...data, created_by: userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { data: row, error } = await supabaseAdmin
        .from("email_channels").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return { channel: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("email_channels").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { channel: row };
  });

export const deleteEmailChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("email_channels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const checkOutlookConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const profile = await getOutlookProfile();
      return {
        connected: true,
        email: profile.mail || profile.userPrincipalName || null,
        name: profile.displayName || null,
      };
    } catch (e: any) {
      return { connected: false, error: e?.message || "Falha ao conectar" };
    }
  });
