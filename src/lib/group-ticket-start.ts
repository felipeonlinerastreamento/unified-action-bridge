import { supabase } from "@/integrations/supabase/client";

/**
 * For group chats, the ticket is only created at finalize time, so
 * `created_at = closed_at` (≈0 minutes), which destroys the "tempo de
 * atendimento" metric. This helper returns the timestamp of the first
 * operator message in the CURRENT attendance window (after the previous
 * ticket's closed_at, if any), so callers can override the ticket's
 * `created_at` to reflect actual handling time.
 *
 * Returns null when no operator message can be found — the caller should
 * fallback to its default value (typically `now()`).
 */
export async function resolveGroupTicketStart(
  chatId: string,
  attendanceId: string,
): Promise<string | null> {
  // Last finalized ticket for this attendance, to scope the window.
  const { data: prev } = await supabase
    .from("service_tickets")
    .select("closed_at")
    .eq("attendance_id", attendanceId)
    .eq("status", "finalizado")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(1);

  const since = prev && prev.length > 0 ? (prev[0] as any).closed_at as string : null;

  let q = supabase
    .from("zapi_messages")
    .select("created_at")
    .eq("chat_id", chatId)
    .eq("from_me", true)
    .order("created_at", { ascending: true })
    .limit(1);
  if (since) q = q.gt("created_at", since);

  const { data } = await q;
  return data && data.length > 0 ? (data[0] as any).created_at as string : null;
}
