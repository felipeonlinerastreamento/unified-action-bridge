/**
 * Risco de cancelamento e margem real por cliente (server-only, service role).
 * - atualizarRiscoCancelamento: calcula a nota de cada cliente da carteira do Pós-venda,
 *   grava na carteira e abre uma tarefa de plano de retenção para quem passa a risco alto.
 * - dadosMargem: base da aba Financeiro › Margem por cliente (chamada só depois de assertFinance).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chaveEmpresa } from "@/lib/reconnect";
import { riscoCancelamento, descricaoPlano, LIMIAR_ALTO, type ClienteRisco } from "@/lib/risco-cancelamento";
import { margemCliente, clienteDoEquipamento, valorAquisicao, CONFIG_MARGEM_PADRAO, type ConfigMargem, type EquipCliente } from "@/lib/margem-cliente";
import { hojeSP } from "@/lib/finance";

const db = supabaseAdmin as any;
const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const FECHADOS = new Set(["finalizado", "cancelado", "fechado", "concluido"]);

async function lerTudo(table: string, cols: string, filtro?: (q: any) => any, ordem = "id"): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).order(ordem).range(from, from + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Contagem = { chamados: number; atrasados: number; visitas: number };

/** Chamados dos últimos 90 dias por cliente da carteira (empresa do chamado → CNPJ, senão nome). */
async function chamadosPorCliente(carteira: any[]): Promise<Map<string, Contagem>> {
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const seteDias = Date.now() - 7 * 86_400_000;
  const [companies, tickets] = await Promise.all([
    lerTudo("companies", "id, name, cnpj"),
    lerTudo("service_tickets", "id, company_id, status, created_at, closed_at, tech_stage", (q) => q.not("company_id", "is", null).gte("created_at", desde)),
  ]);
  const porDoc = new Map<string, string>(carteira.map((c) => [soDigitos(c.documento), c.id]));
  const porNome = new Map<string, string>();
  for (const c of carteira) { const k = chaveEmpresa(c.nome || ""); if (k && !porNome.has(k)) porNome.set(k, c.id); }
  const empresaCliente = new Map<string, string>();
  for (const co of companies) {
    const id = porDoc.get(soDigitos(co.cnpj)) ?? porNome.get(chaveEmpresa(co.name || ""));
    if (id) empresaCliente.set(co.id, id);
  }
  const out = new Map<string, Contagem>();
  for (const t of tickets) {
    const cli = empresaCliente.get(t.company_id);
    if (!cli) continue;
    const c = out.get(cli) ?? { chamados: 0, atrasados: 0, visitas: 0 };
    c.chamados++;
    if (!FECHADOS.has(String(t.status || "").toLowerCase()) && Date.parse(t.created_at) < seteDias) c.atrasados++;
    if (t.tech_stage === "concluido") c.visitas++;
    out.set(cli, c);
  }
  return out;
}

export async function atualizarRiscoCancelamento(): Promise<{ ok: boolean; clientes: number; altos: number; planos: number; error?: string }> {
  try {
    const hoje = hojeSP();
    const carteira = await lerTudo("crm_posvenda_carteira", "*", (q) => q.eq("ativo", true));
    const chamados = await chamadosPorCliente(carteira);
    const agora = new Date().toISOString();

    // Tarefas de retenção ainda abertas (não duplica).
    const abertas = await lerTudo("crm_tasks", "id, source_id", (q) => q.eq("source_type", "risco_cancelamento").eq("status", "pending"));
    const comTarefa = new Set(abertas.map((t) => t.source_id));

    let altos = 0, planos = 0;
    for (const c of carteira) {
      const ch = chamados.get(c.id) ?? { chamados: 0, atrasados: 0, visitas: 0 };
      const cli: ClienteRisco = { ...c, chamados_90d: ch.chamados, chamados_atrasados: ch.atrasados };
      const r = riscoCancelamento(cli, hoje);
      await db.from("crm_posvenda_carteira").update({
        risco_nota: r.nota, risco_nivel: r.nivel, risco_motivos: r.motivos, risco_em: agora,
        chamados_90d: ch.chamados, chamados_atrasados: ch.atrasados,
      }).eq("id", c.id);
      if (r.nota < LIMIAR_ALTO) continue;
      altos++;
      if (comTarefa.has(c.id)) continue;
      const vence = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      const { error } = await db.from("crm_tasks").insert({
        title: `🛟 Plano de retenção — ${c.nome} (risco ${r.nota})`,
        description: descricaoPlano(c.nome, r),
        task_type: "retencao",
        priority: "alta",
        status: "pending",
        due_date: vence,
        assigned_to: c.responsavel_id ?? null,
        source_type: "risco_cancelamento",
        source_id: c.id,
        metadata: { risco: r.nota, motivos: r.motivos, documento: c.documento },
      });
      if (error) continue;
      planos++;
      if (c.responsavel_id) {
        await db.from("notifications").insert({
          user_id: c.responsavel_id,
          title: "Cliente em risco de cancelamento",
          message: `${c.nome}: risco ${r.nota}/100. Plano de retenção criado em CRM › Tarefas.`,
          type: "risco_cancelamento",
          show_as_popup: true,
          metadata: { carteira_id: c.id, risco: r.nota },
        });
      }
    }
    return { ok: true, clientes: carteira.length, altos, planos };
  } catch (e: any) {
    return { ok: false, clientes: 0, altos: 0, planos: 0, error: String(e?.message ?? e).slice(0, 500) };
  }
}

export type LinhaMargem = ReturnType<typeof margemCliente> & {
  id: string; nome: string; documento: string; classe: string; risco_nota: number | null;
  visitas_90d: number; chamados_90d: number;
};

export async function dadosMargem(): Promise<{ config: ConfigMargem; linhas: LinhaMargem[]; semVinculo: number }> {
  const { data: cfgRow } = await db.from("margem_config").select("*").eq("id", 1).maybeSingle();
  const config: ConfigMargem = { ...CONFIG_MARGEM_PADRAO };
  for (const k of Object.keys(CONFIG_MARGEM_PADRAO) as (keyof ConfigMargem)[]) {
    if (cfgRow?.[k] != null) config[k] = Number(cfgRow[k]);
  }
  const carteira = await lerTudo("crm_posvenda_carteira", "id, nome, documento, classe, classe_manual, receita_mensal, risco_nota", (q) => q.eq("ativo", true));
  const [chamados, equips] = await Promise.all([
    chamadosPorCliente(carteira),
    lerTudo("gsystem_equipamentos", "codigo, parametros, raw", undefined, "codigo").catch(() => [] as any[]),
  ]);
  const porNome = new Map<string, string>();
  for (const c of carteira) { const k = chaveEmpresa(c.nome || ""); if (k && !porNome.has(k)) porNome.set(k, c.id); }
  const equipPorCliente = new Map<string, EquipCliente[]>();
  let semVinculo = 0;
  for (const e of equips) {
    const k = clienteDoEquipamento(e.raw);
    if (!k) continue;
    const id = porNome.get(k);
    if (!id) { semVinculo++; continue; }
    const lista = equipPorCliente.get(id) ?? [];
    lista.push({ valor_aquisicao: valorAquisicao(e.parametros ?? e.raw?.Parametros), com_chip: !!e.raw?.Chip });
    equipPorCliente.set(id, lista);
  }
  const linhas: LinhaMargem[] = carteira
    .filter((c) => Number(c.receita_mensal) > 0 || equipPorCliente.has(c.id))
    .map((c) => {
      const ch = chamados.get(c.id) ?? { chamados: 0, atrasados: 0, visitas: 0 };
      const m = margemCliente({
        receita_mensal: Number(c.receita_mensal) || 0,
        equipamentos: equipPorCliente.get(c.id) ?? [],
        visitas_90d: ch.visitas,
        chamados_90d: ch.chamados,
      }, config);
      return { ...m, id: c.id, nome: c.nome, documento: c.documento, classe: c.classe_manual ?? c.classe, risco_nota: c.risco_nota ?? null, visitas_90d: ch.visitas, chamados_90d: ch.chamados };
    })
    .sort((a, b) => a.margem - b.margem);
  return { config, linhas, semVinculo };
}
