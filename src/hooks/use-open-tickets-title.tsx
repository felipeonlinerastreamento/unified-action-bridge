import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const PREFIX_RE = /^\(\d+\+?\)\s*/;

/** Mostra "(N) " no título da aba com os atendimentos em aberto do operador logado. */
export function useOpenTicketsTitle() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: count = 0 } = useQuery({
    queryKey: ["my-open-tickets-count", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("service_tickets")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId!)
        .in("status", ["aberto", "em_andamento", "reaberto"]);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const apply = () => {
      const base = document.title.replace(PREFIX_RE, "");
      const next = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };
    apply();
    // Cada página troca o título ao navegar; reaplica o contador em seguida.
    const titleEl = document.querySelector("title");
    const obs = new MutationObserver(apply);
    if (titleEl) obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      obs.disconnect();
      document.title = document.title.replace(PREFIX_RE, "");
    };
  }, [count]);
}
