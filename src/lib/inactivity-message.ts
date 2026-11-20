/** Regras da Mensagem de Inatividade (Configurações > Z-API & Bot). */
export const DEFAULT_INACTIVITY_MESSAGE =
  "Estou finalizando outro atendimento e já te atualizo por aqui, tudo bem?";

export interface InactivityInput {
  enabled: boolean;
  message: string | null | undefined;
  isGroup: boolean;
  fromMe: boolean;
  /** Conversa recém-criada ou reaberta depois de finalizada. */
  isNewConversation: boolean;
  /** A conversa atual já recebeu a mensagem. */
  alreadySent: boolean;
  /** Fora do horário de atendimento (o aviso de ausência já foi enviado). */
  outOfHours: boolean;
}

/** Envia uma única vez, na primeira mensagem do cliente numa conversa nova, nunca em grupos. */
export function shouldSendInactivityMessage(i: InactivityInput): boolean {
  if (!i.enabled || !(i.message || "").trim()) return false;
  if (i.isGroup || i.fromMe) return false;
  if (!i.isNewConversation || i.alreadySent) return false;
  if (i.outOfHours) return false;
  return true;
}
