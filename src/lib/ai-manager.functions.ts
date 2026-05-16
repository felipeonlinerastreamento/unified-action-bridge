import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScopeSchema = z.enum(["customers", "operators"]);
const PeriodSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCanAccess(userId: string) {
  const supabase = getServiceSupabase();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roleSet = new Set((roles || []).map((r) => r.role));
  if (roleSet.has("admin")) return;
  if (roleSet.has("gestor")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("can_access_ai_manager")
      .eq("user_id", userId)
      .maybeSingle();
    if (profile && profile.can_access_ai_manager !== false) return;
  }
  throw new Error("Sem permissão para acessar o Relatório IA.");
}

// ============================================================
// Coleta de agregados a partir do banco
// ============================================================

type CustomersAggregate = {
  topCustomers: Array<{
    name: string;
    phone: string;
    ticketsLast30: number;
    ticketsLast60: number;
    ticketsLast90: number;
    reopened: number;
    avgCsat: number | null;
    lastInteraction: string | null;
    topCategory: string | null;
  }>;
  recurringCategories: Array<{ category: string; count: number }>;
  totalChats: number;
  totalTickets: number;
};

async function collectCustomersAggregate(periodDays: number): Promise<CustomersAggregate> {
  const supabase = getServiceSupabase();
  const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000).toISOString();
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const since60 = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();

  // Tickets do período
  const { data: tickets } = await supabase
    .from("service_tickets")
    .select("id, contact_phone, contact_name, category, created_at, reopened_at, closed_at")
    .gte("created_at", since)
    .limit(5000);

  const ticketsList = tickets || [];

  // Agrupa por telefone
  const byPhone = new Map<
    string,
    {
      name: string;
      phone: string;
      ticketsLast30: number;
      ticketsLast60: number;
      ticketsLast90: number;
      reopened: number;
      categories: Map<string, number>;
      lastInteraction: string | null;
    }
  >();
  for (const t of ticketsList) {
    const phone = t.contact_phone || "(sem telefone)";
    const name = t.contact_name || phone;
    const entry =
      byPhone.get(phone) ||
      {
        name,
        phone,
        ticketsLast30: 0,
        ticketsLast60: 0,
        ticketsLast90: 0,
        reopened: 0,
        categories: new Map<string, number>(),
        lastInteraction: null as string | null,
      };
    if (t.created_at >= since30) entry.ticketsLast30++;
    if (t.created_at >= since60) entry.ticketsLast60++;
    entry.ticketsLast90++;
    if (t.reopened_at) entry.reopened++;
    if (t.category) entry.categories.set(t.category, (entry.categories.get(t.category) || 0) + 1);
    if (!entry.lastInteraction || (t.created_at && t.created_at > entry.lastInteraction)) {
      entry.lastInteraction = t.created_at;
    }
    byPhone.set(phone, entry);
  }

  // Recorrência de categorias (top)
  const categoryCount = new Map<string, number>();
  for (const t of ticketsList) {
    if (t.category) {
      categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1);
    }
  }

  // CSAT por telefone
  const { data: csat } = await supabase
    .from("csat_responses")
    .select("phone, score, created_at")
    .gte("created_at", since)
    .limit(5000);
  const csatByPhone = new Map<string, number[]>();
  for (const c of csat || []) {
    if (!c.phone) continue;
    const arr = csatByPhone.get(c.phone) || [];
    arr.push(c.score);
    csatByPhone.set(c.phone, arr);
  }

  const top = Array.from(byPhone.values())
    .map((e) => {
      const csatArr = csatByPhone.get(e.phone) || [];
      const avgCsat =
        csatArr.length > 0 ? csatArr.reduce((a, b) => a + b, 0) / csatArr.length : null;
      const topCategory =
        Array.from(e.categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return {
        name: e.name,
        phone: e.phone,
        ticketsLast30: e.ticketsLast30,
        ticketsLast60: e.ticketsLast60,
        ticketsLast90: e.ticketsLast90,
        reopened: e.reopened,
        avgCsat,
        lastInteraction: e.lastInteraction,
        topCategory,
      };
    })
    .sort((a, b) => b.ticketsLast30 - a.ticketsLast30 || b.reopened - a.reopened)
    .slice(0, 20);

  const { count: totalChats } = await supabase
    .from("zapi_chats")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  return {
    topCustomers: top,
    recurringCategories: Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count })),
    totalChats: totalChats || 0,
    totalTickets: ticketsList.length,
  };
}

type OperatorsAggregate = {
  operators: Array<{
    id: string;
    name: string;
    sector: string | null;
    attendances: number;
    avgHandlingMinutes: number;
    csat: number | null;
    reopenedTickets: number;
  }>;
  sectors: Array<{
    sector: string;
    attendances: number;
    avgHandlingMinutes: number;
    csat: number | null;
    resolutionRate: number;
  }>;
  weeklyVolume: Array<{ label: string; actual: number }>;
};

async function collectOperatorsAggregate(periodDays: number): Promise<OperatorsAggregate> {
  const supabase = getServiceSupabase();
  const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000).toISOString();

  const { data: chats } = await supabase
    .from("zapi_chats")
    .select("id, assigned_to, closed_by_user_id, sector_name, created_at, closed_at, status")
    .gte("created_at", since)
    .limit(10000);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, name");
  const nameById = new Map((profiles || []).map((p) => [p.user_id, p.name as string]));

  const { data: csat } = await supabase
    .from("csat_responses")
    .select("operator_user_id, score, created_at")
    .gte("created_at", since)
    .limit(10000);

  const { data: tickets } = await supabase
    .from("service_tickets")
    .select("assigned_to, sector, reopened_at, status, created_at")
    .gte("created_at", since)
    .limit(10000);

  const opMap = new Map<
    string,
    { sector: string | null; attendances: number; handlingMins: number[]; csats: number[]; reopened: number }
  >();

  for (const c of chats || []) {
    const userId = c.closed_by_user_id || c.assigned_to;
    if (!userId) continue;
    const entry =
      opMap.get(userId) ||
      { sector: c.sector_name || null, attendances: 0, handlingMins: [] as number[], csats: [] as number[], reopened: 0 };
    if (c.status === "finalizado") {
      entry.attendances++;
      if (c.closed_at && c.created_at) {
        const mins = (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000;
        if (mins > 0 && mins < 7 * 24 * 60) entry.handlingMins.push(mins);
      }
    }
    if (!entry.sector && c.sector_name) entry.sector = c.sector_name;
    opMap.set(userId, entry);
  }

  for (const c of csat || []) {
    if (!c.operator_user_id) continue;
    const entry = opMap.get(c.operator_user_id) || { sector: null, attendances: 0, handlingMins: [], csats: [], reopened: 0 };
    entry.csats.push(c.score);
    opMap.set(c.operator_user_id, entry);
  }

  for (const t of tickets || []) {
    if (!t.assigned_to) continue;
    const entry = opMap.get(t.assigned_to) || { sector: t.sector || null, attendances: 0, handlingMins: [], csats: [], reopened: 0 };
    if (t.reopened_at) entry.reopened++;
    if (!entry.sector && t.sector) entry.sector = t.sector;
    opMap.set(t.assigned_to, entry);
  }

  const operators = Array.from(opMap.entries())
    .map(([id, e]) => {
      const avgHandlingMinutes =
        e.handlingMins.length > 0
          ? Math.round(e.handlingMins.reduce((a, b) => a + b, 0) / e.handlingMins.length)
          : 0;
      const csatAvg =
        e.csats.length > 0 ? Number((e.csats.reduce((a, b) => a + b, 0) / e.csats.length).toFixed(2)) : null;
      return {
        id,
        name: nameById.get(id) || "—",
        sector: e.sector,
        attendances: e.attendances,
        avgHandlingMinutes,
        csat: csatAvg,
        reopenedTickets: e.reopened,
      };
    })
    .filter((o) => o.attendances > 0 || o.reopenedTickets > 0)
    .sort((a, b) => b.attendances - a.attendances);

  // Setores
  const sectorMap = new Map<
    string,
    { attendances: number; handlingMins: number[]; csats: number[]; resolved: number; total: number }
  >();
  for (const o of operators) {
    if (!o.sector) continue;
    const s = sectorMap.get(o.sector) || { attendances: 0, handlingMins: [] as number[], csats: [] as number[], resolved: 0, total: 0 };
    s.attendances += o.attendances;
    if (o.avgHandlingMinutes > 0) s.handlingMins.push(o.avgHandlingMinutes);
    if (o.csat) s.csats.push(o.csat);
    sectorMap.set(o.sector, s);
  }
  for (const t of tickets || []) {
    if (!t.sector) continue;
    const s = sectorMap.get(t.sector) || { attendances: 0, handlingMins: [], csats: [], resolved: 0, total: 0 };
    s.total++;
    if (t.status === "fechado") s.resolved++;
    sectorMap.set(t.sector, s);
  }
  const sectors = Array.from(sectorMap.entries()).map(([sector, s]) => ({
    sector,
    attendances: s.attendances,
    avgHandlingMinutes:
      s.handlingMins.length > 0 ? Math.round(s.handlingMins.reduce((a, b) => a + b, 0) / s.handlingMins.length) : 0,
    csat: s.csats.length > 0 ? Number((s.csats.reduce((a, b) => a + b, 0) / s.csats.length).toFixed(2)) : null,
    resolutionRate: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0,
  }));

  // Volume semanal (últimas 4 semanas)
  const weeklyVolume: Array<{ label: string; actual: number }> = [];
  const allChats = chats || [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date(Date.now() - (w + 1) * 7 * 24 * 3600 * 1000).toISOString();
    const end = new Date(Date.now() - w * 7 * 24 * 3600 * 1000).toISOString();
    const count = allChats.filter((c) => c.created_at >= start && c.created_at < end).length;
    weeklyVolume.push({ label: w === 0 ? "Atual" : `Sem -${w}`, actual: count });
  }

  return { operators, sectors, weeklyVolume };
}

// ============================================================
// IA — Lovable AI Gateway
// ============================================================

async function callLovableAi(systemPrompt: string, userPrompt: string): Promise<unknown | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("AI call failed", err);
    return null;
  }
}

// ============================================================
// Server Functions expostas
// ============================================================

async function loadManagerInstructions(): Promise<string> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("ai_manager_settings")
    .select("instructions")
    .eq("singleton", true)
    .maybeSingle();
  return (data?.instructions || "").trim();
}

export const getAiManagerInstructions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanAccess(context.userId);
    const instructions = await loadManagerInstructions();
    return { instructions };
  });

export const updateAiManagerInstructions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ instructions: z.string().max(4000) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.userId);
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("ai_manager_settings")
      .update({ instructions: data.instructions, updated_by: context.userId })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getLatestAiManagerReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ scope: ScopeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.userId);
    const supabase = getServiceSupabase();
    const { data: row } = await supabase
      .from("ai_manager_reports")
      .select("id, scope, period_days, payload, generated_at, generated_by")
      .eq("scope", data.scope)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { report: row };
  });

export const generateAiManagerReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ scope: ScopeSchema, period_days: PeriodSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.userId);
    const supabase = getServiceSupabase();

    let payload: Record<string, unknown>;

    if (data.scope === "customers") {
      const agg = await collectCustomersAggregate(data.period_days);
      const ai = (await callLovableAi(
        "Você é um gerente de atendimento sênior. Analise dados agregados de chamados e retorne JSON com insights claros em português brasileiro. Seja específico e acionável.",
        `Dados dos últimos ${data.period_days} dias:\n\n${JSON.stringify(agg, null, 2)}\n\nRetorne JSON com este formato exato:\n{\n  "alerts": [{"severity":"info|warning|critical","title":"...","detail":"..."}],\n  "opportunities": [{"customer":"...","description":"...","potentialValue":"...","confidence":0-100}],\n  "insightsMarkdown": "## Insights...\\n- bullet\\n- bullet",\n  "executiveSummaryMarkdown": "## Resumo executivo...\\n- bullet",\n  "commercialMapMarkdown": "## Mapa de oportunidades...\\n- bullet",\n  "customerRisks": [{"name":"...","insatisfactionScore":0-100,"churnRisk":"baixo|medio|alto","reason":"..."}]\n}`
      )) as Record<string, unknown> | null;

      payload = {
        aggregate: agg,
        ai: ai || {
          alerts: [],
          opportunities: [],
          insightsMarkdown:
            "_A IA não conseguiu gerar insights agora (sem créditos ou erro temporário). Os dados agregados acima ainda são confiáveis._",
          executiveSummaryMarkdown: "",
          commercialMapMarkdown: "",
          customerRisks: [],
        },
      };
    } else {
      const agg = await collectOperatorsAggregate(data.period_days);
      const ai = (await callLovableAi(
        "Você é um gerente de atendimento sênior. Analise performance de operadores e setores e retorne JSON com sugestões acionáveis em português brasileiro.",
        `Dados dos últimos ${data.period_days} dias:\n\n${JSON.stringify(agg, null, 2)}\n\nRetorne JSON com este formato exato:\n{\n  "improvementsMarkdown": "## Sugestões de Melhoria...\\n### Operador X\\n- ponto\\n\\n## Setores\\n### Setor Y\\n- ponto",\n  "trainingRecommendations": [{"target":"Nome","scope":"operador|setor","topic":"...","reason":"..."}],\n  "communicationScores": [{"operatorId":"uuid","score":0-100,"note":"..."}],\n  "forecast": [{"label":"Sem +1","predicted":123}]\n}`
      )) as Record<string, unknown> | null;

      payload = {
        aggregate: agg,
        ai: ai || {
          improvementsMarkdown:
            "_A IA não conseguiu gerar sugestões agora (sem créditos ou erro temporário). Os dados agregados acima ainda são confiáveis._",
          trainingRecommendations: [],
          communicationScores: [],
          forecast: [],
        },
      };
    }

    const { data: inserted, error } = await supabase
      .from("ai_manager_reports")
      .insert({
        scope: data.scope,
        period_days: data.period_days,
        payload,
        generated_by: context.userId,
      })
      .select("id, scope, period_days, payload, generated_at, generated_by")
      .single();
    if (error) throw new Error(error.message);

    return { report: inserted };
  });
