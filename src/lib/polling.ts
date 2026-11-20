/**
 * Intervalos das atualizações automáticas globais (montadas em todas as telas).
 * Avisos instantâneos ao atendente continuam chegando por realtime; estes
 * intervalos são só a rede de segurança. Nenhum deles roda com a aba em
 * segundo plano (ver QUERY_DEFAULTS) e tudo é atualizado ao voltar para a aba.
 */
export const POLL = {
  /** Contadores do menu lateral + número na aba do navegador (uma consulta só). */
  sidebarCounters: 60_000,
  /** Trava do chat entre operadores (realtime já avisa na hora). */
  operatorChatLock: 30_000,
  /** Gatilhos de mensagem (realtime já avisa na hora). */
  messageTriggers: 60_000,
  /** Avisos de chamado atribuído (realtime já avisa na hora). */
  ticketAssignmentAlerts: 30_000,
  /** Configurações que quase nunca mudam. */
  settings: 5 * 60_000,
} as const;

/** Padrões do QueryClient: pausa polling em segundo plano e atualiza ao voltar. */
export const QUERY_DEFAULTS = {
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

/** true quando a aba está visível (no servidor, considera visível). */
export function isTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}
