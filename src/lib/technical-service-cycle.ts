/** Regras puras do ciclo do serviço técnico (protocolo, testes, solicitação). */

export type TechStage = "a_resolver" | "aguardando_agendamento" | "agendado" | "concluido" | "encerrado_recusa";

export const TECH_STAGE_LABELS: Record<TechStage, string> = {
  a_resolver: "A resolver",
  aguardando_agendamento: "Aguardando agendamento",
  agendado: "Agendado",
  concluido: "Serviço concluído",
  encerrado_recusa: "Encerrado por recusa",
};

export function techStageLabel(stage?: string | null): string | null {
  if (!stage) return null;
  return TECH_STAGE_LABELS[stage as TechStage] ?? stage;
}

/** Linha fixa que abre a descrição da solicitação ao Seu Instalador. */
export function protocolPrefix(p: { protocol?: string | null; serviceLabel?: string | null; plate?: string | null }): string {
  const num = (p.protocol || "").trim().replace(/^#/, "");
  const parts = [`Protocolo #${num || "-"}`];
  if (p.serviceLabel?.trim()) parts.push(p.serviceLabel.trim());
  if (p.plate?.trim()) parts.push(`Placa ${p.plate.trim().toUpperCase()}`);
  return parts.join(" – ");
}

/** Garante o prefixo no início da descrição, mesmo se o usuário o apagou ou editou. */
export function ensureProtocolPrefix(description: string | null | undefined, prefix: string): string {
  const lines = (description || "").split("\n");
  const rest = lines[0]?.startsWith("Protocolo #") ? lines.slice(1) : lines;
  const body = rest.join("\n").trim();
  return body ? `${prefix}\n${body}` : prefix;
}

/** Ações possíveis no termo mais recente de um protocolo. */
export function termActions(status: string | null | undefined, protocolOpen: boolean) {
  const s = status || "";
  return {
    send: protocolOpen && (s === "" || s === "cancelado"),
    resend: protocolOpen && s === "pendente",
    reissue: protocolOpen && s === "recusado",
    newTerm: protocolOpen && s === "recusado",
    closeByRefusal: protocolOpen && s === "recusado",
    sendRequest: protocolOpen && s === "aceito",
  };
}

/** Sem resposta há 8 horas? */
export const NO_RESPONSE_HOURS = 8;
export function isNoResponseDue(sentAt: string | null | undefined, status: string, now = new Date()): boolean {
  if (status !== "pendente" || !sentAt) return false;
  return now.getTime() - new Date(sentAt).getTime() >= NO_RESPONSE_HOURS * 3600_000;
}

/** Protocolo pode receber teste de equipamento? */
export function protocolAcceptsTest(p: { status?: string | null; tech_stage?: string | null } | null | undefined): string | null {
  if (!p) return "Protocolo de serviço técnico não encontrado.";
  if (!p.tech_stage) return "O protocolo informado não é de serviço técnico.";
  if (p.status === "finalizado") return "O protocolo de serviço técnico informado já está finalizado.";
  return null;
}

export type TestResult = "parcial" | "concluido";
/** Efeito do resultado do teste no protocolo original. */
export function protocolAfterTest(result: TestResult): { finalize: boolean; stage: TechStage | null } {
  return result === "concluido" ? { finalize: true, stage: "concluido" } : { finalize: false, stage: null };
}

/** Atendente só finaliza protocolo técnico pelo fluxo; gestor com justificativa. */
export function canFinalizeProtocol(o: { isManager: boolean; reason?: string | null; viaFlow?: boolean }): boolean {
  if (o.viaFlow) return true;
  return o.isManager && (o.reason || "").trim().length >= 10;
}
