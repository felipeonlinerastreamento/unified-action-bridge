/**
 * Margem real por cliente (mensal): receita menos chips, equipamentos (depreciação),
 * visitas técnicas, atendimento (chamados) e impostos sobre o faturamento.
 * Regras puras, testadas em margem-cliente.test.ts.
 */
import { chaveEmpresa } from "@/lib/reconnect";

export type ConfigMargem = {
  custo_chip_mensal: number;
  vida_util_meses: number;
  custo_equipamento_padrao: number;
  custo_visita: number;
  custo_chamado: number;
  imposto_pct: number;
};

export const CONFIG_MARGEM_PADRAO: ConfigMargem = {
  custo_chip_mensal: 10,
  vida_util_meses: 36,
  custo_equipamento_padrao: 250,
  custo_visita: 120,
  custo_chamado: 12,
  imposto_pct: 0,
};

export type EquipCliente = { valor_aquisicao: number | null; com_chip: boolean };

export type EntradaMargem = {
  receita_mensal: number;
  equipamentos: EquipCliente[];
  /** Visitas técnicas (serviço técnico concluído) nos últimos 90 dias. */
  visitas_90d: number;
  /** Chamados de atendimento nos últimos 90 dias (inclui os técnicos). */
  chamados_90d: number;
};

export type Margem = {
  receita: number;
  chips: number;
  equipamentos: number;
  visitas: number;
  atendimento: number;
  impostos: number;
  custo_total: number;
  margem: number;
  /** Margem sobre a receita, em %; null quando não há receita. */
  margem_pct: number | null;
  veiculos: number;
  chips_qtd: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function margemCliente(e: EntradaMargem, cfg: ConfigMargem): Margem {
  const vida = Math.max(1, cfg.vida_util_meses || 1);
  const chipsQtd = e.equipamentos.filter((q) => q.com_chip).length;
  const chips = chipsQtd * cfg.custo_chip_mensal;
  const equipamentos = e.equipamentos.reduce(
    (s, q) => s + ((q.valor_aquisicao && q.valor_aquisicao > 0 ? q.valor_aquisicao : cfg.custo_equipamento_padrao) / vida), 0);
  const visitas = (e.visitas_90d * cfg.custo_visita) / 3;
  const atendimento = (e.chamados_90d * cfg.custo_chamado) / 3;
  const impostos = e.receita_mensal * (cfg.imposto_pct / 100);
  const custo = chips + equipamentos + visitas + atendimento + impostos;
  const margem = e.receita_mensal - custo;
  return {
    receita: r2(e.receita_mensal),
    chips: r2(chips),
    equipamentos: r2(equipamentos),
    visitas: r2(visitas),
    atendimento: r2(atendimento),
    impostos: r2(impostos),
    custo_total: r2(custo),
    margem: r2(margem),
    margem_pct: e.receita_mensal > 0 ? Math.round((margem / e.receita_mensal) * 1000) / 10 : null,
    veiculos: e.equipamentos.length,
    chips_qtd: chipsQtd,
  };
}

/** Cliente do equipamento no espelho do GSystem (texto ou objeto), como chave de nome. */
export function clienteDoEquipamento(raw: any): string {
  const c = raw?.Cliente;
  const nome = c && typeof c === "object" ? (c.Nome ?? c.DisplayName ?? c.RazaoSocial ?? "") : (c ?? "");
  return chaveEmpresa(String(nome || ""));
}

/** Valor de aquisição do equipamento nos parâmetros do GSystem ("Valor Aquisição"). */
export function valorAquisicao(parametros: any): number | null {
  if (!parametros || typeof parametros !== "object") return null;
  for (const [k, v] of Object.entries(parametros)) {
    const kk = k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (kk.includes("valor") && kk.includes("aquisi")) {
      const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  return null;
}

/** Faixa da margem para colorir: prejuízo, apertada (< 20%) ou saudável. */
export function faixaMargem(m: Pick<Margem, "margem" | "margem_pct">): "prejuizo" | "apertada" | "saudavel" {
  if (m.margem < 0) return "prejuizo";
  if (m.margem_pct != null && m.margem_pct < 20) return "apertada";
  return "saudavel";
}
