/** Regras da Mensagem de Inatividade (Configurações > Z-API & Bot). */
export const DEFAULT_INACTIVITY_MESSAGE =
  "Estou finalizando outro atendimento e já te atualizo por aqui, tudo bem?";

export interface InactivityInput {
  enabled: boolean;
  message: string | null | undefined;
  isGroup: boolean;
  fromMe: boolean;
  /** Quando a conversa recebeu a mensagem (null = nunca, ou reaberta depois de finalizada). */
  sentAt: string | null | undefined;
  /** Quando a chave foi ligada pela última vez. */
  enabledAt: string | null | undefined;
  /** Fora do horário de atendimento (o aviso de ausência já foi enviado). */
  outOfHours: boolean;
}

/** Envia uma única vez por conversa (inclusive já abertas) desde que a chave foi ligada; nunca em grupos. */
export function shouldSendInactivityMessage(i: InactivityInput): boolean {
  if (!i.enabled || !(i.message || "").trim()) return false;
  if (i.isGroup || i.fromMe) return false;
  if (i.sentAt) {
    if (!i.enabledAt) return false;
    if (new Date(i.sentAt).getTime() >= new Date(i.enabledAt).getTime()) return false;
  }
  if (i.outOfHours) return false;
  return true;
}
