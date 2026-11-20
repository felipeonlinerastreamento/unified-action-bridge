import { useEffect } from "react";
import { useSidebarCounters } from "@/hooks/use-sidebar-counters";

const PREFIX_RE = /^\(\d+\+?\)\s*/;

/** Mostra "(N) " no título da aba com os atendimentos em aberto do operador logado. */
export function useOpenTicketsTitle() {
  // Mesmo resumo do menu lateral (uma consulta só, a cada 60s).
  const { my_open_tickets: count } = useSidebarCounters();

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
