import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Fonte única das notificações do sino (topo e balão flutuante).
 * Mesma queryKey → o React Query faz uma consulta só para os dois; a
 * atualização instantânea vem do realtime montado no sino do topo.
 */
export function useNotifications() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = ["notifications", userId] as const;

  const { data: notifications = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });

  const unread = notifications.filter((n) => !n.is_read).length;
  const chatUnread = useChatUnread();
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    refresh();
  };
  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", userId).eq("is_read", false);
    refresh();
  };
  /** "Fechar": tira a notificação da lista. */
  const dismiss = async (id: string) => {
    qc.setQueryData(key, (old: any[] | undefined) => (old || []).filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
    refresh();
  };

  return { userId, notifications, unread, chatUnread, totalUnread: unread + chatUnread, markRead, markAllRead, dismiss };
}

// Não lidas do chat entre operadores (calculado pela lista de conversas do sino).
let chatUnreadValue = 0;
const listeners = new Set<() => void>();
export function setChatUnread(n: number) {
  if (n === chatUnreadValue) return;
  chatUnreadValue = n;
  listeners.forEach((l) => l());
}
function useChatUnread() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => chatUnreadValue,
    () => 0,
  );
}
