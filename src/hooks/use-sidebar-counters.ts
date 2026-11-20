import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { POLL } from "@/lib/polling";

export type SidebarCounters = {
  assigned_chats: number;
  open_tickets: number;
  unread_operator_msgs: number;
  my_open_tickets: number;
};

const EMPTY: SidebarCounters = {
  assigned_chats: 0,
  open_tickets: 0,
  unread_operator_msgs: 0,
  my_open_tickets: 0,
};

export const SIDEBAR_COUNTERS_KEY = ["sidebar-counters"] as const;

/**
 * Resumo único dos contadores do menu (chats atribuídos, atendimentos em
 * aberto, mensagens internas não lidas e o número da aba). Uma só consulta,
 * compartilhada entre o menu e o título da aba.
 */
export function useSidebarCounters(): SidebarCounters {
  const { user } = useAuth();
  const userId = user?.id;
  const { data } = useQuery({
    queryKey: [...SIDEBAR_COUNTERS_KEY, userId],
    enabled: !!userId,
    refetchInterval: POLL.sidebarCounters,
    staleTime: 10_000,
    queryFn: async (): Promise<SidebarCounters> => {
      const { data, error } = await supabase.rpc("sidebar_counters" as any);
      if (error) throw error;
      const d = (data || {}) as Partial<SidebarCounters>;
      return {
        assigned_chats: Number(d.assigned_chats) || 0,
        open_tickets: Number(d.open_tickets) || 0,
        unread_operator_msgs: Number(d.unread_operator_msgs) || 0,
        my_open_tickets: Number(d.my_open_tickets) || 0,
      };
    },
  });
  return data ?? EMPTY;
}
