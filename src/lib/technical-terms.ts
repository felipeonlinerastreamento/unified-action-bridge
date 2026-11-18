// Regras puras do termo de serviço técnico (aceite do responsável da frota
// antes de abrir solicitação na Agenda). Sem dependências de servidor.

export type TechnicalServiceType = "instalacao" | "manutencao" | "retirada";
export type TechnicalTermStatus = "pendente" | "aceito" | "recusado" | "enviada" | "cancelado";
/** O que a categoria do chamado exige. "escolher" = o atendente escolhe o tipo ao gerar o termo. */
export type CategoryTermRequirement = "none" | TechnicalServiceType | "escolher";

export type ChecklistItem = { label: string; checked: boolean };

export const SERVICE_TYPE_LABELS: Record<TechnicalServiceType, string> = {
  instalacao: "Instalação",
  manutencao: "Manutenção",
  retirada: "Retirada",
};

export const TERM_STATUS_LABELS: Record<TechnicalTermStatus, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  recusado: "Recusado",
  enviada: "Enviada",
  cancelado: "Cancelado",
};

export const CATEGORY_REQUIREMENT_LABELS: Record<CategoryTermRequirement, string> = {
  none: "Não exige termo",
  instalacao: "Instalação",
  manutencao: "Manutenção",
  retirada: "Retirada",
  escolher: "Serviço técnico (escolher tipo)",
};

export const DEFAULT_CHECKLISTS: Record<TechnicalServiceType, string[]> = {
  instalacao: [],
  manutencao: [
    "Solicitou reset chip",
    "Enviou reset SMS (com ignição ligada)",
    "Reconfigurar equipamento",
    "Conferir pacote de dados",
  ],
  retirada: ["Conferir localização com agendamento", "Conferir ID equipamento"],
};

export function isServiceType(v: unknown): v is TechnicalServiceType {
  return v === "instalacao" || v === "manutencao" || v === "retirada";
}

/** Itens obrigatórios configurados; vazio/ inválido cai no padrão do tipo. */
export function normalizeChecklistConfig(raw: unknown, type: TechnicalServiceType): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CHECKLISTS[type]];
  return raw.map((s) => String(s ?? "").trim()).filter(Boolean);
}

/** Itens obrigatórios ainda não marcados pelo atendente. */
export function missingChecklistItems(required: string[], filled: ChecklistItem[]): string[] {
  const done = new Set(filled.filter((i) => i.checked).map((i) => i.label.trim().toLowerCase()));
  return required.filter((label) => !done.has(label.trim().toLowerCase()));
}

/** A categoria do chamado exige termo técnico? */
export function categoryRequiresTerm(req: string | null | undefined): boolean {
  return !!req && req !== "none";
}

/** Tipos permitidos ao gerar o termo para uma categoria. */
export function allowedServiceTypes(req: string | null | undefined): TechnicalServiceType[] {
  if (isServiceType(req)) return [req];
  return ["instalacao", "manutencao", "retirada"];
}

/** O responsável só responde enquanto o termo está pendente. */
export function canRespondTerm(status: TechnicalTermStatus): boolean {
  return status === "pendente";
}

/** Só termos aceitos podem ser enviados para agendamento. */
export function canSendToScheduling(status: TechnicalTermStatus | null | undefined): boolean {
  return status === "aceito";
}

/**
 * Abrir solicitação/agendamento na Agenda: atendentes precisam de um termo
 * aceito; administradores e gestores podem abrir sem termo (contingência).
 */
export function schedulingGate(opts: { isManager: boolean; termStatus?: TechnicalTermStatus | null }): { allowed: boolean; reason?: string } {
  if (opts.termStatus !== undefined && opts.termStatus !== null) {
    if (opts.termStatus === "aceito") return { allowed: true };
    if (opts.termStatus === "enviada") return { allowed: false, reason: "Este termo já foi enviado para agendamento." };
    return { allowed: false, reason: "O termo ainda não foi aceito pelo responsável da frota." };
  }
  if (opts.isManager) return { allowed: true };
  return { allowed: false, reason: "Abra pelo CRM > Serviços Técnicos: a solicitação só é liberada após o aceite do termo." };
}

/** Status do termo depois da resposta do responsável. */
export function statusAfterDecision(decision: "accept" | "reject"): TechnicalTermStatus {
  return decision === "accept" ? "aceito" : "recusado";
}

export function termNumberLabel(seq: number | null | undefined): string {
  return seq ? `TST-${String(seq).padStart(5, "0")}` : "";
}

export function renderTermTemplate(template: string, vars: Record<string, string>): string {
  return (template || "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function buildTermUrl(baseUrl: string, token: string): string {
  return `${(baseUrl || "").replace(/\/+$/, "")}/termo-servico/${token}`;
}

/** Descrição enviada ao Seu Instalador com o checklist e o aceite. */
export function buildSchedulingDescription(term: {
  seq?: number | null;
  service_type: TechnicalServiceType;
  description?: string | null;
  checklist?: ChecklistItem[] | null;
  responder_name?: string | null;
  responded_at?: string | null;
  equipment_id?: string | null;
}): string {
  const lines = [`${SERVICE_TYPE_LABELS[term.service_type]} — termo ${termNumberLabel(term.seq)} aceito`];
  if (term.responder_name) {
    const when = term.responded_at ? new Date(term.responded_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
    lines.push(`Aceite: ${term.responder_name}${when ? ` em ${when}` : ""}`);
  }
  if (term.equipment_id) lines.push(`ID equipamento: ${term.equipment_id}`);
  const done = (term.checklist || []).filter((i) => i.checked).map((i) => `✔ ${i.label}`);
  if (done.length) lines.push("Checklist:", ...done);
  if (term.description) lines.push("", term.description);
  return lines.join("\n");
}
