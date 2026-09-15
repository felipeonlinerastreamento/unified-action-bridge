import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OperatorChatDialog } from "./operator-chat-dialog";

/**
 * Watches for operator chats where the current user is the recipient AND
 * the chat is still locked (lock_until_reply was true and they haven't
 * replied yet). Renders a fullscreen non-dismissible dialog forcing them
 * to send a reply. Trigger unlocks automatically after they send a message.
 */
export function OperatorChatLockOverlay() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: locked = [] } = useQuery({
    queryKey: ["operator-chat-locked", userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("operator_chats")
        .select("id, subject")
        .eq("recipient_user_id", userId)
        .eq("is_locked", true)
        .is("closed_at", null)
        .order("created_at", { ascending: true });

      // Conversas em grupo: trava individual por participante
      const { data: parts } = await supabase
        .from("operator_chat_participants")
        .select("chat_id")
        .eq("user_id", userId)
        .eq("is_locked", true);
      const groupIds = (parts || []).map((p: any) => p.chat_id);
      let groupChats: any[] = [];
      if (groupIds.length > 0) {
        const { data: gc } = await supabase
          .from("operator_chats")
          .select("id, subject")
          .in("id", groupIds)
          .is("closed_at", null)
          .order("created_at", { ascending: true });
        groupChats = gc || [];
      }
      const all = [...(data || []), ...groupChats];
      return all.filter((c, i) => all.findIndex((o) => o.id === c.id) === i);
    },
  });

  // Realtime watch
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`op-chat-lock-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_chats", filter: `recipient_user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["operator-chat-locked", userId] });
          qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const current = locked[0];
  if (!current) return null;

  return (
    <OperatorChatDialog
      chatId={current.id}
      open={true}
      onOpenChange={() => {}}
      locked
    />
  );
}
