import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiGuidelines } from "@/lib/ai-guidelines";
import { aggregateEntries } from "@/lib/gamif-rules";

/**
 * Análise da equipe na Gamificação, gerada pelo Assistente IA do GS Hub
 * (mesmas diretrizes de tom/temas/fallback de Configurações > Assistente IA).
 * Só admin/gestor. Cada análise fica registrada na auditoria da Gamificação.
 */
export const gerarAnaliseGamificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number; focus?: string }) => ({
    days: Math.min(180, Math.max(7, Math.floor(Number(input?.days) || 30))),
    focus: String(input?.focus ?? "").slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isManager } = await supabase.rpc("gamif_is_manager");
    if (!isManager) throw new Error("Somente admin e gestor.");

    const { data: cfg } = await supabase
      .from("ai_assistant_config")
      .select("is_enabled, tone, response_format, temperature, forbidden_topics, fallback_message")
      .limit(1)
      .maybeSingle();
    if (cfg && cfg.is_enabled === false) throw new Error("O Assistente IA está desligado em Configurações > Assistente IA.");

    const since = new Date(Date.now() - data.days * 86400000).toISOString().slice(0, 10);
    const [rankingRes, entriesRes, missionsRes, redemptionsRes, suggestionsRes, duelsRes] = await Promise.all([
      supabase.rpc("gamif_ranking"),
      supabase.from("gamif_entries").select("user_id, metric_name, coins, xp, entry_date, source").gte("entry_date", since).not("user_id", "is", null).limit(5000),
      supabase.from("gamif_missions").select("title, status, reward_coins, expires_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("gamif_redemptions").select("item_name, status, cost_coins").gte("created_at", since).limit(500),
      supabase.from("gamif_suggestions").select("title, status").gte("created_at", since).limit(100),
      supabase.from("gamif_pvp_challenges").select("status, stake_coins").gte("created_at", since).limit(500),
    ]);
    const ranking = rankingRes.data ?? [];
    const nameOf = new Map(ranking.map((r) => [r.user_id, r.name ?? "Sem nome"]));
    const sectorOf = new Map(ranking.map((r) => [r.user_id, r.sector_name ?? "Sem setor"]));
    const entries = entriesRes.data ?? [];

    const byUser = aggregateEntries(entries.map((e) => ({ key: nameOf.get(e.user_id!) ?? "Desconhecido", coins: e.coins, xp: e.xp })));
    const bySector = aggregateEntries(entries.map((e) => ({ key: sectorOf.get(e.user_id!) ?? "Sem setor", coins: e.coins, xp: e.xp })));
    const byMetric = aggregateEntries(entries.map((e) => ({ key: e.metric_name ?? "Sem métrica", coins: e.coins, xp: e.xp })));
    const active = new Set(entries.map((e) => e.user_id));
    const withoutEntries = ranking.filter((r) => !active.has(r.user_id)).map((r) => r.name).slice(0, 40);
    const count = <T extends { status: string }>(rows: T[]) => rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});

    const ctx = [
      `Período: últimos ${data.days} dias (desde ${since}). Lançamentos: ${entries.length}. Colaboradores ativos no ranking: ${ranking.length}.`,
      `Por colaborador (nome: XP, moedas, lançamentos):\n${byUser.slice(0, 40).map((r) => `- ${r.key}: ${r.xp} XP, ${r.coins} moedas, ${r.count}`).join("\n") || "- nenhum"}`,
      `Sem nenhum lançamento no período: ${withoutEntries.join(", ") || "ninguém"}`,
      `Por setor:\n${bySector.map((r) => `- ${r.key}: ${r.xp} XP, ${r.coins} moedas, ${r.count} lançamentos`).join("\n") || "- nenhum"}`,
      `Por métrica:\n${byMetric.slice(0, 25).map((r) => `- ${r.key}: ${r.count}x, ${r.xp} XP`).join("\n") || "- nenhuma"}`,
      `Missões recentes: ${JSON.stringify(count(missionsRes.data ?? []))}`,
      `Resgates no período: ${JSON.stringify(count(redemptionsRes.data ?? []))}`,
      `Sugestões no período: ${JSON.stringify(count(suggestionsRes.data ?? []))}`,
      `Duelos no período: ${JSON.stringify(count(duelsRes.data ?? []))}`,
    ].join("\n\n");

    let content = "";
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const resp = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Você é o Assistente IA do GS Hub analisando a gamificação da equipe de uma empresa de rastreamento veicular. " +
          "Com base apenas nos dados fornecidos, escreva em português, em Markdown: 1) Resumo geral; 2) Destaques (pessoas e setores); " +
          "3) Pontos de atenção (baixo engajamento, quem está sem lançamentos, métricas negativas); 4) Recomendações práticas para os gestores (missões, reconhecimento, ajustes de métricas). " +
          "Não invente números que não estejam nos dados.\n\n" +
          buildAiGuidelines({ ...(cfg ?? {}), response_format: "detalhado" }),
        input: `${data.focus ? `Foco pedido pelo gestor: ${data.focus}\n\n` : ""}Dados:\n${ctx}`,
      });
      for (const item of resp.output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content) if (c.type === "output_text") content += c.text;
      }
      content = content.trim();
    } catch (err) {
      console.error("[gamif-ai] gateway error", err instanceof Error ? err.message : err);
      throw new Error("Não foi possível gerar a análise agora. Tente novamente em instantes.");
    }
    if (!content) throw new Error("O Assistente IA não retornou conteúdo.");

    await supabase.from("gamif_audit_logs").insert({
      actor_id: userId,
      action: "analise_ia",
      entity: "gamificacao",
      entity_id: null,
      details: { days: data.days, focus: data.focus || null, content } as never,
    });
    return { content, days: data.days };
  });
