// Regras puras da proposta enviada ao cliente (link de aceite/recusa).
// Sem dependências de servidor para poder ser testada e usada no navegador.

export type ProposalItem = {
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  activationValue: number;
  monthlyValue: number;
};

export type ProposalSnapshot = {
  title: string;
  quoteNumber: number | null;
  client: {
    companyName: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    cnpj: string | null;
  };
  owner: { name: string | null; email: string | null };
  items: ProposalItem[];
  totals: { activation: number; monthly: number };
  notes: string | null;
  introText: string;
  termsText: string;
  issuedAt: string;
  validUntil: string | null;
};

export type ProposalStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type StageLike = { id: string; is_won?: boolean | null; is_lost?: boolean | null; is_active?: boolean | null; position?: number | null };

export const PROPOSAL_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "{contato}", label: "Nome do contato" },
  { key: "{cliente}", label: "Empresa do cliente" },
  { key: "{numero}", label: "Número da proposta" },
  { key: "{titulo}", label: "Título da oportunidade" },
  { key: "{empresa}", label: "Nome da sua empresa" },
  { key: "{vendedor}", label: "Responsável pela proposta" },
  { key: "{validade}", label: "Data de validade" },
  { key: "{total_ativacao}", label: "Total de ativação" },
  { key: "{total_mensal}", label: "Total mensal" },
  { key: "{link}", label: "Link da proposta" },
];

export const brl = (value: number) =>
  (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Totais = soma de (quantidade × valor) por item; valores inválidos contam como zero. */
export function computeTotals(items: Pick<ProposalItem, "quantity" | "activationValue" | "monthlyValue">[]) {
  let activation = 0;
  let monthly = 0;
  for (const it of items) {
    const q = Number(it.quantity) || 0;
    activation += q * (Number(it.activationValue) || 0);
    monthly += q * (Number(it.monthlyValue) || 0);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { activation: round(activation), monthly: round(monthly) };
}

/** Data de validade = emissão + N dias (fim do dia não importa: compara instantes). */
export function computeValidUntil(issuedAt: Date, validityDays: number): Date {
  const days = Math.max(1, Math.min(365, Math.floor(Number(validityDays) || 15)));
  return new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isProposalExpired(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < now.getTime();
}

/** O cliente só pode responder enquanto a proposta estiver pendente e dentro da validade. */
export function canRespond(status: ProposalStatus, expiresAt: string | null | undefined, now: Date = new Date()) {
  return status === "pending" && !isProposalExpired(expiresAt, now);
}

/**
 * Etapa do pipeline para onde a oportunidade vai após a resposta do cliente.
 * Usa a etapa configurada (se ainda existir e estiver ativa); senão, a primeira
 * etapa ativa marcada como ganha (aceite) ou perdida (recusa).
 */
export function resolveDecisionStage(
  decision: "accept" | "reject",
  configuredStageId: string | null | undefined,
  stages: StageLike[],
): string | null {
  const active = stages.filter((s) => s.is_active !== false);
  if (configuredStageId && active.some((s) => s.id === configuredStageId)) return configuredStageId;
  const sorted = [...active].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const match = sorted.find((s) => (decision === "accept" ? s.is_won : s.is_lost));
  return match?.id ?? null;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function proposalNumberLabel(quoteNumber: number | null | undefined): string {
  return quoteNumber ? `#${quoteNumber}` : "";
}

/** Substitui os marcadores {chave} do modelo; marcadores desconhecidos ficam como estão. */
export function renderProposalTemplate(
  template: string,
  vars: {
    contato?: string | null;
    cliente?: string | null;
    numero?: string | null;
    titulo?: string | null;
    empresa?: string | null;
    vendedor?: string | null;
    validade?: string | null;
    total_ativacao?: string | null;
    total_mensal?: string | null;
    link?: string | null;
  },
): string {
  return String(template || "").replace(/\{([a-z_]+)\}/g, (whole, key: string) => {
    if (!(key in vars)) return whole;
    const v = (vars as Record<string, string | null | undefined>)[key];
    return (v ?? "").toString();
  })
    // Evita espaços duplos quando um marcador vazio fica no meio da frase.
    .replace(/[ \t]{2,}/g, " ");
}

export function buildTemplateVars(snapshot: ProposalSnapshot, companyName: string, link: string) {
  return {
    contato: snapshot.client.contactName || snapshot.client.companyName || "cliente",
    cliente: snapshot.client.companyName || snapshot.client.contactName || "",
    numero: proposalNumberLabel(snapshot.quoteNumber),
    titulo: snapshot.title,
    empresa: companyName,
    vendedor: snapshot.owner.name || "",
    validade: formatDateBR(snapshot.validUntil),
    total_ativacao: brl(snapshot.totals.activation),
    total_mensal: brl(snapshot.totals.monthly),
    link,
  };
}

export function buildProposalUrl(baseUrl: string, token: string): string {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  return `${base}/proposta/${token}`;
}

export function isValidEmail(email: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function hasPhoneDigits(phone: string | null | undefined): boolean {
  return String(phone || "").replace(/\D/g, "").length >= 10;
}
