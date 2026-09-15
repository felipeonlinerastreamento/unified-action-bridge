import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OperatorChatDialog } from "./operator-chat-dialog";
import { playForKind } from "@/lib/notification-sounds";

/**
 * Watches for operator chats where the current user must reply before
 * continuing: individual chats where they are the recipient and the chat is
 * locked, and group chats where their participant row is locked.
 * Renders a fullscreen non-dismissible dialog forcing them to send a reply.
 * The message trigger unlocks automatically after they send a message.
 */
export function OperatorChatLockOverlay() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: locked = [], refetch } = useQuery({
    queryKey: ["operator-chat-locked", userId],
    enabled: !!userId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
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

  // Som ao receber um novo bloqueio
  useEffect(() => {
    if (locked.length > prevCount.current) {
      try {
        playForKind("forward");
      } catch {
        /* ignore */
      }
    }
    prevCount.current = locked.length;
  }, [locked.length]);

  // Realtime watch (chat individual + participação em grupo)
  useEffect(() => {
    if (!userId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["operator-chat-locked", userId] });
      qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
    };
    const ch = supabase
      .channel(`op-chat-lock-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_chats", filter: `recipient_user_id=eq.${userId}` },
        invalidate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_chat_participants", filter: `user_id=eq.${userId}` },
        invalidate
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  // Reverificar ao voltar para a aba
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, refetch]);

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
