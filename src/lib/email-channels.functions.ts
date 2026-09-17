import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOutlookProfile, listOutlookConnectionKeys, DEFAULT_CONNECTION_KEY } from "./outlook.server";
import { pollEmailChannel, pollAllActiveEmailChannels } from "./email-poll.server";

async function assertAdminOrGestor(context: any): Promise<void> {
  const { data: roleRow, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["admin", "gestor"])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!roleRow) throw new Error("Acesso restrito a admin ou gestor");
}

export const listEmailChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrGestor(context);
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
  connection_key: z.string().min(1).max(100).default("MICROSOFT_OUTLOOK_API_KEY"),
});

export const upsertEmailChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrGestor(context);
    const { userId } = context;
    if (data.id) {
      const { id, ...rest } = data;
      const { data: row, error } = await supabaseAdmin
        .from("email_channels").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return { channel: row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("email_channels").insert({ ...data, created_by: userId }).select().single();
    if (error) throw new Error(error.message);
    return { channel: row };
  });

export const deleteEmailChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdminOrGestor(context);
    const { error } = await supabaseAdmin.from("email_channels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const checkOutlookConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const keys = listOutlookConnectionKeys();
    if (!keys.length) {
      return {
        connected: false,
        accounts: [] as Array<{ key: string; email: string | null; name: string | null; error?: string }>,
        error: "Nenhuma conta Microsoft vinculada a este projeto.",
      };
    }
    const accounts = await Promise.all(
      keys.map(async (key) => {
        try {
          const profile = await getOutlookProfile(key);
          return {
            key,
            email: profile.mail || profile.userPrincipalName || null,
            name: profile.displayName || null,
          };
        } catch (e: any) {
          return { key, email: null, name: null, error: e?.message || "Falha ao conectar" };
        }
      }),
    );
    const ok = accounts.filter((a) => !("error" in a && a.error));
    const first = ok[0];
    return {
      connected: ok.length > 0,
      accounts,
      email: first?.email ?? null,
      name: first?.name ?? null,
      error: ok.length ? undefined : accounts[0]?.error,
      defaultKey: DEFAULT_CONNECTION_KEY,
    };
  });

export const triggerEmailPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ channelId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrGestor(context);
    const results = data.channelId
      ? [await pollEmailChannel(data.channelId)]
      : await pollAllActiveEmailChannels();
    return { success: true, results };
  });
