// Variáveis dinâmicas suportadas em respostas rápidas.
// Aceita formatos: {nome_operador}, {Nome Operador}, {nomeOperador} (case/space insensitive).

export interface QuickReplyVarContext {
  operatorName?: string | null;
  operatorFirstName?: string | null;
  contactName?: string | null;
  protocol?: string | null;
}

export const QUICK_REPLY_VARIABLES: Array<{ token: string; label: string; description: string }> = [
  { token: "{nome_operador}", label: "Nome do operador", description: "Nome completo do atendente logado" },
  { token: "{primeiro_nome_operador}", label: "Primeiro nome do operador", description: "Primeiro nome do atendente logado" },
  { token: "{nome_contato}", label: "Nome do contato", description: "Nome do cliente em atendimento" },
  { token: "{protocolo}", label: "Protocolo", description: "Número do protocolo da conversa" },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s_]+/g, "");

export function applyQuickReplyVars(text: string, ctx: QuickReplyVarContext): string {
  if (!text) return text;
  const map: Record<string, string> = {
    [norm("nome_operador")]: ctx.operatorName || "",
    [norm("nomeoperador")]: ctx.operatorName || "",
    [norm("primeiro_nome_operador")]: ctx.operatorFirstName || (ctx.operatorName?.split(" ")[0] ?? ""),
    [norm("nome_contato")]: ctx.contactName || "",
    [norm("nomecontato")]: ctx.contactName || "",
    [norm("protocolo")]: ctx.protocol || "",
  };
  return text.replace(/\{([^{}]+)\}/g, (full, key) => {
    const v = map[norm(String(key))];
    return v !== undefined && v !== "" ? v : full;
  });
}
