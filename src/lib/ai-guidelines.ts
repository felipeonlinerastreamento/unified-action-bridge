// Regras de comportamento do Assistente IA configuradas pela gestão.
// Arquivo sem dependências: a função de borda ai-assistant mantém uma cópia
// idêntica de buildAiGuidelines (Deno não importa de src/). Mantenha ambos iguais.

// >>> guidelines
export type AiTone = "formal" | "consultivo" | "direto" | "tecnico";
export type AiResponseFormat = "topicos" | "detalhado";

export interface AiAssistantSettings {
  tone?: string | null;
  response_format?: string | null;
  temperature?: number | string | null;
  forbidden_topics?: string | null;
  fallback_message?: string | null;
}

export const AI_TONE_OPTIONS: { value: AiTone; label: string; instruction: string }[] = [
  { value: "formal", label: "Formal / Corporativo", instruction: "Use linguagem formal e corporativa, sem gírias." },
  { value: "consultivo", label: "Consultivo e Empático", instruction: "Use tom consultivo e empático, reconhecendo a necessidade do cliente." },
  { value: "direto", label: "Direto e Objetivo", instruction: "Seja extremamente direto e objetivo, sem rodeios." },
  { value: "tecnico", label: "Técnico", instruction: "Use linguagem técnica e precisa, citando termos e procedimentos corretos." },
];

export const AI_FORMAT_OPTIONS: { value: AiResponseFormat; label: string; instruction: string }[] = [
  { value: "topicos", label: "Curto, em tópicos (WhatsApp/chat)", instruction: "Responda de forma curta, em no máximo 5 tópicos (ideal para chat/WhatsApp)." },
  { value: "detalhado", label: "Explicativo, passo a passo", instruction: "Responda de forma explicativa, com passo a passo numerado quando houver procedimento." },
];

export const DEFAULT_TEMPERATURE = 0.4;
export const STRICT_TEMPERATURE_MAX = 0.25;

/** Limita a 0..1 (faixa da tela de configuração); valor inválido -> padrão 0,4. */
export function normalizeTemperature(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_TEMPERATURE;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

/** Separa a lista livre (uma por linha ou separada por ;) em itens limpos. */
export function parseTopicList(raw: string | null | undefined): string[] {
  return String(raw || "")
    .split(/[\n;]+/)
    .map((s) => s.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);
}

export function creativityLabel(t: number): string {
  if (t <= STRICT_TEMPERATURE_MAX) return "Estrito — somente base de conhecimento";
  if (t <= 0.6) return "Equilibrado";
  return "Amplo / flexível";
}

/** Bloco extra de instruções de sistema que aplica o comportamento configurado. */
export function buildAiGuidelines(settings: AiAssistantSettings | null | undefined): string {
  const s = settings || {};
  const lines: string[] = [];
  const tone = AI_TONE_OPTIONS.find((o) => o.value === s.tone) || AI_TONE_OPTIONS[1];
  const format = AI_FORMAT_OPTIONS.find((o) => o.value === s.response_format) || AI_FORMAT_OPTIONS[0];
  lines.push(`- Tom de comunicação: ${tone.instruction}`);
  lines.push(`- Formato: ${format.instruction}`);

  if (normalizeTemperature(s.temperature) <= STRICT_TEMPERATURE_MAX) {
    lines.push("- Atenha-se ESTRITAMENTE à base de conhecimento e aos dados fornecidos. Não faça suposições nem invente informações.");
  }

  const forbidden = parseTopicList(s.forbidden_topics);
  if (forbidden.length > 0) {
    lines.push("- PROIBIDO responder, prometer ou orientar sobre os temas abaixo (mesmo se solicitado):");
    for (const t of forbidden) lines.push(`  • ${t}`);
  }

  const fallback = String(s.fallback_message || "").trim();
  if (fallback) {
    lines.push(`- Quando a informação não estiver na base de conhecimento ou você não tiver certeza, NÃO invente: siga esta conduta — ${fallback}`);
  }

  return `## DIRETRIZES CONFIGURADAS PELA GESTÃO (prioridade máxima):\n${lines.join("\n")}`;
}
// <<< guidelines
