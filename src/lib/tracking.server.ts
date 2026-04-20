// Server-only helpers for SeuRastreio (https://seurastreio.com.br) integration
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API_BASE = "https://seurastreio.com.br/api/public";

export interface TrackingEvent {
  codigo?: string;
  descricao?: string;
  detalhe?: string | null;
  data?: string;
  local?: string | null;
  destino?: string | null;
}

export interface TrackingResult {
  codigo: string;
  status: string;
  success: boolean;
  eventoMaisRecente?: TrackingEvent;
  historico?: TrackingEvent[];
  previsaoEntrega?: string | null;
  linkDetalhesCompletos?: string;
  message?: string;
}

const DELIVERED_KEYWORDS = ["entregue", "entrega realizada", "delivered"];
const EXCEPTION_KEYWORDS = ["devolvido", "devolução", "ausente", "não localizado", "endereço incorreto", "recusado"];

export function isDeliveredStatus(desc?: string | null): boolean {
  if (!desc) return false;
  const t = desc.toLowerCase();
  return DELIVERED_KEYWORDS.some((k) => t.includes(k));
}

export function isExceptionStatus(desc?: string | null): boolean {
  if (!desc) return false;
  const t = desc.toLowerCase();
  return EXCEPTION_KEYWORDS.some((k) => t.includes(k));
}

async function getSettings() {
  const { data } = await supabaseAdmin
    .from("tracking_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function fetchTracking(code: string): Promise<TrackingResult> {
  const apiKey = process.env.SEURASTREIO_API_KEY;
  if (!apiKey) throw new Error("SEURASTREIO_API_KEY não configurado");
  const cleanCode = code.trim().toUpperCase();

  const res = await fetch(`${API_BASE}/rastreio/${encodeURIComponent(cleanCode)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { message: text }; }
  if (!res.ok) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return json as TrackingResult;
}

async function logIntegration(endpoint: string, method: string, status: number, error?: string) {
  try {
    await supabaseAdmin.from("integration_logs").insert({
      endpoint,
      method,
      status_code: status,
      error_message: error ?? null,
    });
  } catch { /* ignore */ }
}

export async function refreshOneTracking(row: {
  id: string;
  ticket_id: string;
  tracking_code: string;
  is_delivered: boolean;
}): Promise<{ ok: boolean; deliveredJustNow: boolean }> {
  const settings = await getSettings();
  try {
    const result = await fetchTracking(row.tracking_code);
    const latest = result.eventoMaisRecente;
    const events = (result.historico && result.historico.length > 0)
      ? result.historico
      : (latest ? [latest] : []);
    const delivered = isDeliveredStatus(latest?.descricao) ||
      (events.length > 0 && isDeliveredStatus(events[0]?.descricao));
    const exception = isExceptionStatus(latest?.descricao);
    const wasDelivered = row.is_delivered;
    const justDelivered = !wasDelivered && delivered;

    await supabaseAdmin
      .from("ticket_tracking")
      .update({
        last_status: latest?.descricao ?? null,
        last_status_date: latest?.data ?? null,
        last_location: latest?.local ?? null,
        is_delivered: delivered,
        events: events as any,
        last_checked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id);

    await logIntegration(`/rastreio/${row.tracking_code}`, "GET", 200);

    // Auto-close ticket on delivery
    if (justDelivered && settings?.auto_close_ticket_on_delivery) {
      await supabaseAdmin
        .from("service_tickets")
        .update({ status: "finalizado", closed_at: new Date().toISOString() })
        .eq("id", row.ticket_id);
    }

    // Notifications
    if (justDelivered && settings?.notify_on_delivered !== false) {
      await notifyTicketSector(row.ticket_id, row.tracking_code, "delivered", settings);
    } else if (exception && settings?.notify_on_exception) {
      await notifyTicketSector(row.ticket_id, row.tracking_code, "exception", settings, latest?.descricao);
    }
    return { ok: true, deliveredJustNow: justDelivered };
  } catch (e: any) {
    const msg = e?.message || "Erro desconhecido";
    await supabaseAdmin
      .from("ticket_tracking")
      .update({ last_error: msg, last_checked_at: new Date().toISOString() })
      .eq("id", row.id);
    await logIntegration(`/rastreio/${row.tracking_code}`, "GET", 500, msg);
    return { ok: false, deliveredJustNow: false };
  }
}

async function notifyTicketSector(
  ticketId: string,
  code: string,
  kind: "delivered" | "exception",
  settings: any,
  customDesc?: string,
) {
  const { data: ticket } = await supabaseAdmin
    .from("service_tickets")
    .select("id, sector, contact_name, attendance_id, assigned_to, opened_by")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return;

  const targetUserIds = new Set<string>();

  // Notify sector members
  if (settings?.notify_sector_members !== false && ticket.sector) {
    const { data: sector } = await supabaseAdmin
      .from("sectors")
      .select("id")
      .eq("name", ticket.sector)
      .maybeSingle();
    if (sector) {
      const { data: members } = await supabaseAdmin
        .from("user_sector_assignments")
        .select("user_id")
        .eq("sector_id", sector.id);
      members?.forEach((m) => targetUserIds.add(m.user_id));
    }
  }

  // Always include assigned + opener (or only them if notify_assigned_only)
  if (settings?.notify_assigned_only) {
    targetUserIds.clear();
  }
  if (ticket.assigned_to) targetUserIds.add(ticket.assigned_to);
  if (ticket.opened_by) targetUserIds.add(ticket.opened_by);

  if (targetUserIds.size === 0) return;

  const ref = ticket.contact_name || ticket.attendance_id || "ticket";
  const title = kind === "delivered" ? "📦 Encomenda entregue" : "⚠️ Exceção no envio";
  const message = kind === "delivered"
    ? `Sedex ${code} entregue (${ref}).`
    : `Sedex ${code}: ${customDesc || "exceção registrada"} (${ref}).`;

  const rows = Array.from(targetUserIds).map((uid) => ({
    user_id: uid,
    ticket_id: ticketId,
    type: kind === "delivered" ? "tracking_delivered" : "tracking_exception",
    title,
    message,
    metadata: { tracking_code: code } as any,
  }));
  await supabaseAdmin.from("notifications").insert(rows);
}

export async function refreshAllPending(): Promise<{ checked: number; delivered: number; skipped?: boolean }> {
  const settings = await getSettings();
  if (settings && settings.auto_refresh_enabled === false) {
    return { checked: 0, delivered: 0, skipped: true };
  }

  const { data: rows } = await supabaseAdmin
    .from("ticket_tracking")
    .select("id, ticket_id, tracking_code, is_delivered")
    .eq("is_delivered", false)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(100);
  if (!rows || rows.length === 0) return { checked: 0, delivered: 0 };

  let delivered = 0;
  for (const r of rows) {
    const res = await refreshOneTracking(r);
    if (res.deliveredJustNow) delivered++;
    await new Promise((rs) => setTimeout(rs, 250));
  }
  return { checked: rows.length, delivered };
}
