import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Audit event categories.
 * - auth: login/logout
 * - presence: online/offline (chat availability)
 * - contact_link: company-phone links and sub-clients
 * - crm: CRM contact CRUD
 * - ticket: service ticket lifecycle
 * - task: task lifecycle
 * - okr: OKR module events
 * - system: misc / legacy
 */
export type AuditCategory =
  | "auth"
  | "presence"
  | "contact_link"
  | "crm"
  | "ticket"
  | "task"
  | "okr"
  | "system";

const logEventSchema = z.object({
  event_category: z.string().min(1).max(64),
  event_type: z.string().min(1).max(96),
  target_type: z.string().max(64).optional(),
  target_id: z.string().max(128).optional(),
  target_label: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function clientInfo() {
  try {
    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      null;
    const ua = getRequestHeader("user-agent") || null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

/** Internal helper: insert directly with admin client. Never throws. */
export async function writeAuditLog(params: {
  user_id?: string | null;
  user_name?: string | null;
  event_category: string;
  event_type: string;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.user_id ?? null,
      user_name: params.user_name ?? null,
      event_category: params.event_category,
      event_type: params.event_type,
      action: params.event_type, // legacy column kept for backward compat
      entity_type: params.target_type ?? null,
      entity_id: params.target_id ?? null,
      target_type: params.target_type ?? null,
      target_id: params.target_id ?? null,
      target_label: params.target_label ?? null,
      details: (params.metadata ?? {}) as any,
      metadata: (params.metadata ?? {}) as any,
      ip_address: params.ip_address ?? null,
      user_agent: params.user_agent ?? null,
    } as any);
  } catch (err) {
    // never let audit logging break the main operation
    console.error("[audit] failed to write log", err);
  }
}

/** Authenticated event log — resolves user from middleware. */
export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(logEventSchema.parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    let userName: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      userName = prof?.name ?? null;
    } catch {}
    const { ip, ua } = clientInfo();
    await writeAuditLog({
      user_id: userId,
      user_name: userName,
      event_category: data.event_category,
      event_type: data.event_type,
      target_type: data.target_type,
      target_id: data.target_id,
      target_label: data.target_label,
      metadata: data.metadata as any,
      ip_address: ip,
      user_agent: ua,
    });
    return { success: true };
  });

const listSchema = z.object({
  categories: z.array(z.string()).optional(),
  event_types: z.array(z.string()).optional(),
  user_ids: z.array(z.string().uuid()).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().optional(), // ISO timestamp of last item
  limit: z.number().min(1).max(200).optional(),
});

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listSchema.parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    // Auth check: admin or gestor
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("gestor")) {
      throw new Error("Sem permissão para visualizar a auditoria.");
    }

    const limit = data.limit ?? 50;
    let q = supabaseAdmin
      .from("audit_logs")
      .select(
        "id, created_at, user_id, user_name, event_category, event_type, action, target_type, target_id, target_label, entity_type, entity_id, metadata, details, ip_address, user_agent",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data.categories?.length) q = q.in("event_category", data.categories);
    if (data.event_types?.length) q = q.in("event_type", data.event_types);
    if (data.user_ids?.length) q = q.in("user_id", data.user_ids);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `target_label.ilike.${s},user_name.ilike.${s},event_type.ilike.${s},target_id.ilike.${s}`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const items = (rows ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      user_id: r.user_id,
      user_name: r.user_name,
      event_category: r.event_category ?? "system",
      event_type: r.event_type ?? r.action ?? "unknown",
      target_type: r.target_type ?? r.entity_type ?? null,
      target_id: r.target_id ?? r.entity_id ?? null,
      target_label: r.target_label ?? null,
      metadata: r.metadata ?? r.details ?? {},
      ip_address: r.ip_address ?? null,
      user_agent: r.user_agent ?? null,
    }));

    const nextCursor = items.length === limit ? items[items.length - 1].created_at : null;
    return { items, nextCursor };
  });

export const exportAuditLogsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listSchema.omit({ cursor: true, limit: true }).parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("gestor")) {
      throw new Error("Sem permissão.");
    }

    let q = supabaseAdmin
      .from("audit_logs")
      .select(
        "created_at, user_name, event_category, event_type, action, target_type, target_id, target_label, entity_type, entity_id, metadata, details, ip_address",
      )
      .order("created_at", { ascending: false })
      .limit(10000);

    if (data.categories?.length) q = q.in("event_category", data.categories);
    if (data.event_types?.length) q = q.in("event_type", data.event_types);
    if (data.user_ids?.length) q = q.in("user_id", data.user_ids);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const header = [
      "data",
      "operador",
      "categoria",
      "evento",
      "alvo_tipo",
      "alvo_id",
      "alvo_rotulo",
      "ip",
      "detalhes",
    ];
    const escape = (v: any) => {
      const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      lines.push(
        [
          (r as any).created_at,
          (r as any).user_name ?? "",
          (r as any).event_category ?? "system",
          (r as any).event_type ?? (r as any).action ?? "",
          (r as any).target_type ?? (r as any).entity_type ?? "",
          (r as any).target_id ?? (r as any).entity_id ?? "",
          (r as any).target_label ?? "",
          (r as any).ip_address ?? "",
          (r as any).metadata ?? (r as any).details ?? {},
        ]
          .map(escape)
          .join(","),
      );
    }
    return { csv: lines.join("\n"), count: rows?.length ?? 0 };
  });
