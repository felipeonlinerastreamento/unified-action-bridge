import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAuditLog, supabaseAdmin } from "@/lib/audit.server";
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

// writeAuditLog is re-exported from audit.server below

/** Authenticated event log — resolves user from middleware.
 *  Fire-and-forget: never throws to the caller; failures are swallowed and
 *  logged server-side so the UI doesn't blank-screen on audit-write issues. */
export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(logEventSchema.parse)
  .handler(async ({ data, context }) => {
    try {
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
    } catch (err) {
      console.error("[logAuditEvent] failed:", err);
      return { success: false };
    }
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

    const items: any[] = (rows ?? []).map((r: any) => ({
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

    // Synthesize chat finalization events from zapi_chats history so the
    // Auditoria also finds chats finalized before audit logging was wired
    // (or whose audit insert failed).
    const wantsCentral =
      !data.categories?.length || data.categories.includes("central_atendimento");
    if (wantsCentral && !data.event_types?.length) {
      let zq = supabaseAdmin
        .from("zapi_chats")
        .select(
          "id, phone, contact_name, sector_name, closed_at, closed_by_user_id, created_at",
        )
        .eq("status", "finalizado")
        .not("closed_at", "is", null)
        .not("closed_by_user_id", "is", null)
        .order("closed_at", { ascending: false })
        .limit(limit);

      if (data.user_ids?.length) zq = zq.in("closed_by_user_id", data.user_ids);
      if (data.date_from) zq = zq.gte("closed_at", data.date_from);
      if (data.date_to) zq = zq.lte("closed_at", data.date_to);
      if (data.cursor) zq = zq.lt("closed_at", data.cursor);
      if (data.search) {
        const s = `%${data.search}%`;
        zq = zq.or(`contact_name.ilike.${s},phone.ilike.${s}`);
      }

      const { data: zrows } = await zq;
      if (zrows?.length) {
        const userIds = Array.from(
          new Set(zrows.map((z: any) => z.closed_by_user_id).filter(Boolean)),
        ) as string[];
        const nameMap = new Map<string, string>();
        if (userIds.length) {
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("user_id, name")
            .in("user_id", userIds);
          for (const p of profs ?? []) nameMap.set((p as any).user_id, (p as any).name);
        }

        const existingIds = new Set(
          items
            .filter(
              (i) =>
                i.event_type === "chat.finalizado" || i.event_type === "grupo.finalizado",
            )
            .map((i) => i.target_id),
        );

        for (const z of zrows as any[]) {
          if (existingIds.has(z.id)) continue;
          const phone = z.phone ?? "";
          const isGroup = /@g\.us$/.test(phone) || /-\d{8,}/.test(phone);
          const createdAt = z.created_at ? new Date(z.created_at) : null;
          const closedAt = z.closed_at ? new Date(z.closed_at) : null;
          const durationMin =
            createdAt && closedAt
              ? Math.max(
                  0,
                  Math.round((closedAt.getTime() - createdAt.getTime()) / 60000),
                )
              : null;
          items.push({
            id: `zchat:${z.id}`,
            created_at: z.closed_at,
            user_id: z.closed_by_user_id,
            user_name: nameMap.get(z.closed_by_user_id) ?? null,
            event_category: "central_atendimento",
            event_type: isGroup ? "grupo.finalizado" : "chat.finalizado",
            target_type: isGroup ? "grupo" : "chat",
            target_id: z.id,
            target_label: z.contact_name || phone || z.id,
            metadata: {
              phone,
              is_group: isGroup,
              sector_name: z.sector_name ?? null,
              started_at: z.created_at ?? null,
              closed_at: z.closed_at ?? null,
              duration_minutes: durationMin,
              source: "zapi_chats_history",
            },
            ip_address: null,
            user_agent: null,
          });
        }

        items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        if (items.length > limit) items.length = limit;
      }
    }

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
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `target_label.ilike.${s},user_name.ilike.${s},event_type.ilike.${s},target_id.ilike.${s}`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const merged: any[] = (rows ?? []).map((r: any) => ({ ...r }));

    // Add virtual zapi_chats finalization rows so CSV matches the UI search.
    const wantsCentral =
      !data.categories?.length || data.categories.includes("central_atendimento");
    if (wantsCentral && !data.event_types?.length) {
      let zq = supabaseAdmin
        .from("zapi_chats")
        .select(
          "id, phone, contact_name, sector_name, closed_at, closed_by_user_id, created_at",
        )
        .eq("status", "finalizado")
        .not("closed_at", "is", null)
        .not("closed_by_user_id", "is", null)
        .order("closed_at", { ascending: false })
        .limit(10000);
      if (data.user_ids?.length) zq = zq.in("closed_by_user_id", data.user_ids);
      if (data.date_from) zq = zq.gte("closed_at", data.date_from);
      if (data.date_to) zq = zq.lte("closed_at", data.date_to);
      if (data.search) {
        const s = `%${data.search}%`;
        zq = zq.or(`contact_name.ilike.${s},phone.ilike.${s}`);
      }
      const { data: zrows } = await zq;
      if (zrows?.length) {
        const userIds = Array.from(
          new Set(zrows.map((z: any) => z.closed_by_user_id).filter(Boolean)),
        ) as string[];
        const nameMap = new Map<string, string>();
        if (userIds.length) {
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("user_id, name")
            .in("user_id", userIds);
          for (const p of profs ?? []) nameMap.set((p as any).user_id, (p as any).name);
        }
        for (const z of zrows as any[]) {
          const phone = z.phone ?? "";
          const isGroup = /@g\.us$/.test(phone) || /-\d{8,}/.test(phone);
          merged.push({
            created_at: z.closed_at,
            user_name: nameMap.get(z.closed_by_user_id) ?? "",
            event_category: "central_atendimento",
            event_type: isGroup ? "grupo.finalizado" : "chat.finalizado",
            target_type: isGroup ? "grupo" : "chat",
            target_id: z.id,
            target_label: z.contact_name || phone || z.id,
            ip_address: "",
            metadata: {
              phone,
              sector_name: z.sector_name ?? null,
              started_at: z.created_at ?? null,
              closed_at: z.closed_at ?? null,
              source: "zapi_chats_history",
            },
          });
        }
        merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      }
    }


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
