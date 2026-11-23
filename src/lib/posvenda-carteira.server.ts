/**
 * Monta a carteira do Pós-venda (crm_posvenda_carteira):
 * - todos os clientes PJ do GSystem (para o primeiro contato/diagnóstico) e os PF que têm faturamento;
 * - receita mensal = média das faturas do GSystem (Financeiro) dos últimos 3 meses fechados;
 * - faturas vencidas, primeira fatura e curva ABC pela receita.
 * Campos do trabalho do pós-venda (contatos, classe manual, diagnóstico, responsável) não são tocados,
 * exceto o responsável vazio, que recebe o pós-venda padrão (usuário cujo nome começa com "Allan").
 * Server-only (service role).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listGSystemClientes } from "@/lib/gsystem-api.server";
import { clienteDoGsystem } from "@/lib/finance-gsystem";
import { hojeSP } from "@/lib/finance";
import { classificarABC } from "@/lib/posvenda";

const db = supabaseAdmin as any;
const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

/** Primeiro dia do mês, `meses` meses antes do mês de `hoje`. */
function inicioMes(hoje: string, meses: number): string {
  const [y, m] = hoje.split("-").map(Number);
  const t = y * 12 + (m - 1) - meses;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

export async function atualizarCarteiraPosVenda(): Promise<{ ok: boolean; clientes: number; pj: number; comReceita: number; error?: string }> {
  try {
    const hoje = hojeSP();
    const de = inicioMes(hoje, 3);   // 3 meses fechados: de .. ate (exclusivo)
    const ate = inicioMes(hoje, 0);

    // Faturas do GSystem no Financeiro (paginado).
    const fats: any[] = [];
    for (let i = 0; i < 100_000; i += 1000) {
      const { data, error } = await db.from("fin_lancamentos")
        .select("documento_contraparte, contraparte, valor, vencimento, data_emissao, status, gsystem_cliente_key")
        .eq("origem", "gsystem").eq("tipo", "receber").order("id").range(i, i + 999);
      if (error) throw error;
      fats.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    type Acc = { nome: string; key: string | null; receita3m: number; vencVal: number; vencQtd: number; vencAntigo: string | null; primeira: string | null };
    const porDoc = new Map<string, Acc>();
    const acc = (doc: string, nome: string, key: string | null) => {
      let a = porDoc.get(doc);
      if (!a) { a = { nome, key, receita3m: 0, vencVal: 0, vencQtd: 0, vencAntigo: null, primeira: null }; porDoc.set(doc, a); }
      return a;
    };
    for (const f of fats) {
      const doc = soDigitos(f.documento_contraparte);
      if (!doc) continue;
      const a = acc(doc, f.contraparte || doc, f.gsystem_cliente_key ?? null);
      if (f.status === "cancelado") continue;
      const ref = f.vencimento || f.data_emissao;
      if (ref && ref >= de && ref < ate) a.receita3m += Number(f.valor || 0);
      if (f.status === "aberto" && f.vencimento && f.vencimento < hoje) {
        a.vencVal += Number(f.valor || 0); a.vencQtd++;
        if (!a.vencAntigo || f.vencimento < a.vencAntigo) a.vencAntigo = f.vencimento;
      }
      if (ref && (!a.primeira || ref < a.primeira)) a.primeira = ref;
    }

    // Base do GSystem: todo PJ entra, mesmo sem faturamento recente.
    let pj = 0;
    const brutosGsystem = await listGSystemClientes();
    for (const raw of brutosGsystem) {
      const c = clienteDoGsystem(raw);
      if (!c) continue;
      if (c.documento.length === 14) { pj++; acc(c.documento, c.nome, c.key); }
      else if (porDoc.has(c.documento)) { const a = porDoc.get(c.documento)!; a.nome = c.nome; a.key = a.key ?? c.key; }
    }

    const linhas = [...porDoc.entries()]
      .filter(([doc, a]) => doc.length === 14 || a.receita3m > 0 || a.vencQtd > 0)
      .map(([doc, a]) => ({ documento: doc, nome: a.nome, key: a.key, receita: Math.round((a.receita3m / 3) * 100) / 100, a }));
    const abc = classificarABC(linhas.map((l) => ({ documento: l.documento, receita_mensal: l.receita })));
    // Situação e contatos dos clientes no Financeiro (aba Inadimplência); falha aqui não derruba a carteira.
    try {
      const { atualizarClientesFinanceiro } = await import("@/lib/finance-inadimplencia.server");
      await atualizarClientesFinanceiro(brutosGsystem);
    } catch { /* migração 0070 ainda não aplicada */ }
    // A coluna vencidas_dias vem da migração 0070; sem ela, grava como antes.
    const comDias = !(await db.from("crm_posvenda_carteira").select("vencidas_dias").limit(1)).error;
    const agora = new Date().toISOString();
    const rows = linhas.map((l) => ({
      documento: l.documento,
      nome: l.nome,
      gsystem_cliente_key: l.key,
      receita_mensal: l.receita,
      vencidas_valor: Math.round(l.a.vencVal * 100) / 100,
      vencidas_qtd: l.a.vencQtd,
      ...(comDias ? { vencidas_dias: l.a.vencAntigo ? Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${l.a.vencAntigo}T00:00:00Z`)) / 86_400_000) : null } : {}),
      primeira_fatura_em: l.a.primeira,
      classe: abc.get(l.documento) ?? "C",
      atualizado_em: agora,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("crm_posvenda_carteira").upsert(rows.slice(i, i + 500), { onConflict: "documento" });
      if (error) throw error;
    }

    // Responsável padrão: o pós-venda (Allan), só onde estiver vazio.
    const { data: perfis } = await db.from("profiles").select("user_id, name").ilike("name", "allan%");
    if (perfis && perfis.length === 1) {
      await db.from("crm_posvenda_carteira").update({ responsavel_id: perfis[0].user_id }).is("responsavel_id", null);
    }
    // Placas sem comunicação do Reconnect entram no risco (falha aqui não derruba a carteira).
    try {
      const { sincronizarRiscoReconnect } = await import("@/lib/reconnect-risco.server");
      await sincronizarRiscoReconnect();
    } catch { /* Reconnect ainda sem tabelas */ }
    return { ok: true, clientes: rows.length, pj, comReceita: linhas.filter((l) => l.receita > 0).length };
  } catch (e: any) {
    return { ok: false, clientes: 0, pj: 0, comReceita: 0, error: String(e?.message ?? e).slice(0, 500) };
  }
}
