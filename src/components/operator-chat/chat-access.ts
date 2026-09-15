import { supabase } from "@/integrations/supabase/client";

/** Chat ids where the user is listed as a group participant. */
export async function fetchMyGroupChatIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("operator_chat_participants")
    .select("chat_id")
    .eq("user_id", userId);
  return Array.from(new Set((data || []).map((r: any) => r.chat_id)));
}

/** PostgREST `or` filter matching every chat the user takes part in. */
export function myChatsOrFilter(userId: string, groupChatIds: string[]): string {
  const base = `created_by.eq.${userId},recipient_user_id.eq.${userId}`;
  if (groupChatIds.length === 0) return base;
  return `${base},id.in.(${groupChatIds.join(",")})`;
}
