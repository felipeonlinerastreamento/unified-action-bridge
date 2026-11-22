/**
 * Reconnect × Pós-venda × Financeiro (server-only, service role).
 * - sincronizarRiscoReconnect: grava na carteira do Pós-venda quantas placas de cada cliente
 *   estão sem comunicação (entra na saúde / risco de cancelamento).
 * - dadosResultadoReconnect: base do painel de resultado (recuperados, avisos, placas paradas
 *   e receita mensal da carteira por cliente do Reconnect).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { riscoPorCarteira, sessaoAtual, vincularCarteira, type VehicleRow } from "@/lib/reconnect";

const db = supabaseAdmin as any;
const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

async function lerTudo(table: string, cols: string, filtro?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function baseVinculo() {
  const [rcClients, vehicles, companies, carteira] = await Promise.all([
    lerTudo("rc_clients", "id, name, company_id"),
    lerTudo("rc_vehicles", "id, plate, client_id, client_name, days_offline, notifications, import_date"),
    lerTudo("companies", "id, cnpj"),
    lerTudo("crm_posvenda_carteira", "id, documento, nome, receita_mensal, rc_placas_paradas, rc_dias_max, rc_notificadas", (q) => q.eq("ativo", true)),
  ]);
  const cnpj = new Map<string, string>(companies.filter((c) => soDigitos(c.cnpj).length >= 11).map((c) => [c.id, soDigitos(c.cnpj)]));
  const vinculo = vincularCarteira(rcClients, cnpj, carteira);
  const atuais = sessaoAtual(vehicles as VehicleRow[]);
  return { rcClients, atuais, carteira, vinculo };
}

export async function sincronizarRiscoReconnect(): Promise<{ ok: boolean; vinculados: number; comPlacas: number; error?: string }> {
  try {
    const { carteira, vinculo, atuais } = await baseVinculo();
    const risco = riscoPorCarteira(atuais, vinculo);
    const agora = new Date().toISOString();
    let alterados = 0;
    for (const c of carteira) {
      const novo = risco.get(c.id) ?? { rc_placas_paradas: 0, rc_dias_max: 0, rc_notificadas: 0 };
      if (novo.rc_placas_paradas === (c.rc_placas_paradas ?? 0) && novo.rc_dias_max === (c.rc_dias_max ?? 0) && novo.rc_notificadas === (c.rc_notificadas ?? 0)) continue;
      const { error } = await db.from("crm_posvenda_carteira").update({ ...novo, rc_atualizado_em: agora }).eq("id", c.id);
      if (error) throw new Error(error.message);
      alterados++;
    }
    return { ok: true, vinculados: new Set(vinculo.values()).size, comPlacas: risco.size };
  } catch (e: any) {
    return { ok: false, vinculados: 0, comPlacas: 0, error: e?.message ?? String(e) };
  }
}

export async function dadosResultadoReconnect(de: string, ate: string, comReceita: boolean) {
  const { atuais, carteira, vinculo } = await baseVinculo();
  // Avisos de até 30 dias antes do período, para ligar com recuperações do começo do período.
  const deAviso = new Date(Date.parse(`${de}T00:00:00-03:00`) - 30 * 86_400_000).toISOString();
  const ateFim = new Date(Date.parse(`${ate}T23:59:59-03:00`)).toISOString();
  const [recovered, notifications] = await Promise.all([
    lerTudo("rc_recovered_vehicles", "plate, client_id, client_name, last_days_offline, recovered_at", (q) => q.gte("recovered_at", deAviso).lte("recovered_at", new Date(Date.parse(ateFim) + 30 * 86_400_000).toISOString())),
    lerTudo("rc_notification_logs", "client_id, sent_at, plates", (q) => q.gte("sent_at", deAviso).lte("sent_at", ateFim)),
  ]);
  let receitaPorCliente: Map<string, number> | undefined;
  if (comReceita) {
    const receita = new Map<string, number>(carteira.map((c) => [c.id, Number(c.receita_mensal) || 0]));
    receitaPorCliente = new Map();
    for (const [rcId, cartId] of vinculo) receitaPorCliente.set(rcId, receita.get(cartId) ?? 0);
  }
  return { recovered, notifications, atuais, receitaPorCliente, vinculados: vinculo.size };
}
