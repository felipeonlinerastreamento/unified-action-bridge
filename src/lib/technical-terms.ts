import { formatProtocol } from "./protocol-format";
// Regras puras do termo de serviço técnico (aceite do responsável da frota
// antes de abrir solicitação na Agenda). Sem dependências de servidor.

/** Chave do tipo de termo (catálogo technical_term_types). Ex.: "instalacao". */
export type TechnicalServiceType = string;
export type TechnicalTermStatus = "pendente" | "aceito" | "recusado" | "enviada" | "cancelado";
/** O que a categoria do chamado exige: "none", a chave de um tipo, ou "escolher" (o atendente escolhe). */
export type CategoryTermRequirement = string;

export type ChecklistItem = { label: string; checked: boolean };

/** Tipo de termo cadastrado em Configurações > CRM. */
export type TermType = {
  id: string;
  key: string;
  label: string;
  title: string;
  body: string;
  checklist: string[];
  requires_equipment_id: boolean;
  whatsapp_template: string;
  email_subject: string;
  email_template: string;
  is_active: boolean;
  position: number;
  /** Tipo de serviço para o qual este termo vem pré-selecionado (ou null). */
  default_service_type?: FixedServiceType | null;
};

/** Tipos de serviço do formulário: sempre e somente estes três, nesta ordem. */
export const FIXED_SERVICE_TYPES = [
  { key: "instalacao", label: "Instalação" },
  { key: "retirada", label: "Retirada" },
  { key: "manutencao", label: "Manutenção" },
] as const;
export type FixedServiceType = (typeof FIXED_SERVICE_TYPES)[number]["key"];

export function isFixedServiceType(v: unknown): v is FixedServiceType {
  return FIXED_SERVICE_TYPES.some((t) => t.key === v);
}

export function fixedServiceLabel(key: string | null | undefined): string {
  return FIXED_SERVICE_TYPES.find((t) => t.key === key)?.label ?? "";
}

/**
 * Termo de aceite que já vem marcado: o exigido pela categoria (se ativo) ou o
 * termo ativo marcado como padrão para o tipo de serviço; senão nenhum.
 */
export function defaultTermFor(
  serviceType: string | null | undefined,
  terms: Pick<TermType, "key" | "is_active" | "default_service_type">[],
  requiredTermKey?: string | null,
): string {
  const active = terms.filter((t) => t.is_active);
  if (requiredTermKey && active.some((t) => t.key === requiredTermKey)) return requiredTermKey;
  if (!isFixedServiceType(serviceType)) return "";
  return active.find((t) => t.default_service_type === serviceType)?.key ?? "";
}

/** Tipos originais (usados como nome de reserva quando o catálogo não carregou). */
export const BUILTIN_SERVICE_TYPES = ["instalacao", "manutencao", "retirada"] as const;

export const SERVICE_TYPE_LABELS: Record<string, string> = {
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

/** @deprecated use categoryRequirementOptions(tipos) */
export const CATEGORY_REQUIREMENT_LABELS: Record<string, string> = {
  none: "Não exige termo",
  instalacao: "Instalação",
  manutencao: "Manutenção",
  retirada: "Retirada",
  escolher: "Serviço técnico (escolher tipo)",
};

export const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  instalacao: [],
  manutencao: [
    "Solicitou reset chip",
    "Enviou reset SMS (com ignição ligada)",
    "Reconfigurar equipamento",
    "Conferir pacote de dados",
  ],
  retirada: ["Conferir localização com agendamento", "Conferir ID equipamento"],
};

/** Nome do serviço: catálogo → nome congelado no termo → nome original → a própria chave. */
export function serviceTypeLabel(key: string | null | undefined, types?: Pick<TermType, "key" | "label">[] | null, frozen?: string | null): string {
  if (frozen) return frozen;
  const k = String(key || "");
  const found = types?.find((t) => t.key === k);
  return found?.label || SERVICE_TYPE_LABELS[k] || k;
}

/** Opções de "Exige termo" das categorias: não exige, cada tipo ativo, escolher. */
export function categoryRequirementOptions(types: Pick<TermType, "key" | "label" | "is_active">[]): { value: string; label: string }[] {
  return [
    { value: "none", label: "Não exige termo" },
    ...types.filter((t) => t.is_active).map((t) => ({ value: t.key, label: t.label })),
    { value: "escolher", label: "Serviço técnico (escolher tipo)" },
  ];
}

/** Gera a chave de um novo tipo a partir do nome, sem repetir as existentes. */
export function slugifyTermKey(label: string, existing: string[] = []): string {
  let base = String(label || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 34);
  if (base.length < 2 || base === "none" || base === "escolher") base = `termo_${base}`.replace(/_+$/, "");
  if (base.length < 2) base = "termo";
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const k = `${base}_${i}`;
    if (!taken.has(k)) return k;
  }
  return `${base}_${Date.now()}`;
}

/** Variáveis disponíveis nas mensagens de envio. */
export const TERM_MESSAGE_VARS: { key: string; label: string; sample: string }[] = [
  { key: "responsavel", label: "Nome do responsável pela frota", sample: "João Silva" },
  { key: "cliente", label: "Nome do cliente (empresa)", sample: "Transportes Exemplo Ltda" },
  { key: "placa", label: "Placa do veículo", sample: "ABC1D23" },
  { key: "servico", label: "Tipo de serviço", sample: "Instalação" },
  { key: "link", label: "Link do aceite", sample: "https://exemplo.com/termo-servico/…" },
  { key: "numero", label: "Número do termo", sample: "#11150" },
  { key: "empresa", label: "Nome da nossa empresa", sample: "Online Rastreamento" },
];

/** Valores de exemplo para a pré-visualização das mensagens. */
export function sampleTermVars(overrides: Record<string, string> = {}): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const v of TERM_MESSAGE_VARS) vars[v.key] = v.sample;
  return { ...vars, ...overrides };
}

/** Validação do cadastro de um tipo de termo; devolve a primeira mensagem de erro ou null. */
export function validateTermType(t: Pick<TermType, "label" | "title" | "body" | "whatsapp_template" | "email_subject" | "email_template">): string | null {
  if (!String(t.label || "").trim()) return "Informe o nome do termo.";
  if (!String(t.title || "").trim()) return "Informe o título do termo.";
  if (!String(t.body || "").trim()) return "Informe o texto do termo.";
  if (!String(t.whatsapp_template || "").includes("{link}")) return "A mensagem de WhatsApp precisa ter a variável {link}.";
  if (!String(t.email_subject || "").trim()) return "Informe o assunto do e-mail.";
  if (!String(t.email_template || "").includes("{link}")) return "O texto do e-mail precisa ter a variável {link}.";
  return null;
}

/** O que acontece ao excluir um tipo: bloqueia (categoria exige), inativa (já usado) ou exclui. */
export function termDeletionAction(opts: { usedInTerms: boolean; requiredByCategories: string[] }): "block" | "inactivate" | "delete" {
  if (opts.requiredByCategories.length > 0) return "block";
  return opts.usedInTerms ? "inactivate" : "delete";
}

/** Converte o texto do checklist (um item por linha) em lista. */
export function parseChecklistText(text: string): string[] {
  return String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
}

export function isServiceType(v: unknown): v is TechnicalServiceType {
  return typeof v === "string" && v !== "" && v !== "none" && v !== "escolher";
}

/** Itens obrigatórios configurados; vazio/ inválido cai no padrão do tipo. */
export function normalizeChecklistConfig(raw: unknown, type: TechnicalServiceType): string[] {
  if (!Array.isArray(raw)) return [...(DEFAULT_CHECKLISTS[type] ?? [])];
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

/**
 * Tipos permitidos ao gerar o termo para uma categoria: o tipo exigido, ou
 * (em "escolher") todos os tipos ativos do catálogo.
 */
export function allowedServiceTypes(
  req: string | null | undefined,
  activeKeys: readonly string[] = BUILTIN_SERVICE_TYPES,
): TechnicalServiceType[] {
  if (isServiceType(req)) return [req];
  return [...activeKeys];
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

/**
 * Número exibido do termo: o protocolo do atendimento no padrão do sistema (#11150).
 * Só usa a sequência própria (TST-00005) quando o termo não está ligado a um atendimento.
 */
export function termNumberLabel(seq: number | null | undefined, protocolNumber?: number | string | null): string {
  if (protocolNumber !== null && protocolNumber !== undefined && String(protocolNumber).trim() !== "") {
    return `#${formatProtocol(protocolNumber)}`;
  }
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
  protocol_number?: number | string | null;
  service_type: TechnicalServiceType;
  service_label?: string | null;
  description?: string | null;
  checklist?: ChecklistItem[] | null;
  responder_name?: string | null;
  responded_at?: string | null;
  equipment_id?: string | null;
}): string {
  const lines = [`${serviceTypeLabel(term.service_type, null, term.service_label)} — termo ${termNumberLabel(term.seq, term.protocol_number)} aceito`];
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
