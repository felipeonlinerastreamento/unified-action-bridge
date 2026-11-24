/**
 * "Toda conversa vira chance de venda": regras puras da IA que lê o chat finalizado,
 * decide se há oportunidade e monta a oportunidade do CRM. Testadas em ia-oportunidades.test.ts.
 */

export const TIPOS_OPORTUNIDADE = {
  novos_veiculos: "Ampliar frota rastreada",
  acessorio: "Acessório / câmera / telemetria",
  upgrade: "Upgrade de plano ou serviço",
  servico: "Serviço avulso",
  renovacao: "Renovação / retenção",
  indicacao: "Indicação de outra empresa",
  outro: "Outra oportunidade",
} as const;
export type TipoOportunidade = keyof typeof TIPOS_OPORTUNIDADE;

export type LeituraOportunidade = {
  oportunidade: boolean;
  tipo: TipoOportunidade;
  titulo: string;
  resumo: string;
  valor_mensal: number | null;
  quantidade: number | null;
  proposta: string;
  confianca: number;
  trecho: string;
};

export const INSTRUCOES_IA =
  "Você analisa conversas de WhatsApp de uma empresa de rastreamento veicular (Online Rastreamento) com seus clientes, " +
  "para achar oportunidades de venda que o atendente pode não ter percebido: cliente falando em comprar/colocar mais veículos, " +
  "pedir câmera, telemetria, bafômetro, bloqueio, sensor, trocar de plano, contratar serviço avulso, renovar contrato, ou indicar outra empresa. " +
  "Reclamação, suporte técnico, segunda via de boleto ou dúvida comum NÃO são oportunidade. Não invente nada que não esteja na conversa. " +
  "Responda SOMENTE com um JSON: " +
  '{"oportunidade": true|false, "tipo": "novos_veiculos|acessorio|upgrade|servico|renovacao|indicacao|outro", ' +
  '"titulo": "até 60 caracteres", "resumo": "1 a 2 frases do que o cliente disse", "valor_mensal": número em reais ou null, ' +
  '"quantidade": número de veículos/itens ou null, "proposta": "mensagem curta e cordial, pronta para o vendedor enviar ao cliente no WhatsApp, sem preços inventados", ' +
  '"confianca": 0 a 1, "trecho": "frase do cliente que mostra o interesse"}';

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Lê a resposta da IA (aceita texto em volta ou bloco ```json). Devolve null se não houver JSON. */
export function lerRespostaOportunidade(texto: string): LeituraOportunidade | null {
  const m = String(texto ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j: any;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const tipo = (Object.keys(TIPOS_OPORTUNIDADE) as TipoOportunidade[]).includes(j?.tipo) ? j.tipo as TipoOportunidade : "outro";
  const conf = Number(j?.confianca);
  return {
    oportunidade: j?.oportunidade === true || j?.oportunidade === "true",
    tipo,
    titulo: String(j?.titulo ?? "").trim().slice(0, 80) || TIPOS_OPORTUNIDADE[tipo],
    resumo: String(j?.resumo ?? "").trim().slice(0, 600),
    valor_mensal: num(j?.valor_mensal),
    quantidade: num(j?.quantidade),
    proposta: String(j?.proposta ?? "").trim().slice(0, 1200),
    confianca: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0,
    trecho: String(j?.trecho ?? "").trim().slice(0, 300),
  };
}

/** Só vira oportunidade com confiança mínima e algum conteúdo. */
export function deveCriar(l: LeituraOportunidade | null, confiancaMinima: number): l is LeituraOportunidade {
  return !!l && l.oportunidade && l.confianca >= confiancaMinima && (l.resumo.length > 0 || l.trecho.length > 0);
}

/** Texto das observações da oportunidade criada. */
export function notasOportunidade(l: LeituraOportunidade, protocolo: string | null): string {
  return [
    `💡 Oportunidade identificada pela IA na conversa${protocolo ? ` do protocolo ${protocolo}` : ""} (confiança ${Math.round(l.confianca * 100)}%).`,
    `Tipo: ${TIPOS_OPORTUNIDADE[l.tipo]}`,
    l.resumo ? `Resumo: ${l.resumo}` : "",
    l.trecho ? `Cliente disse: "${l.trecho}"` : "",
    l.quantidade ? `Quantidade citada: ${l.quantidade}` : "",
    " ",
    "Proposta sugerida (revise antes de enviar):",
    l.proposta || "—",
  ].filter((x): x is string => typeof x === "string").join("\n");
}
