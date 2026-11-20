import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { aggregateEntries } from "@/lib/gamif-rules";
import { useMetrics, useMyUserId } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/metricas")({
  head: () => ({ meta: [{ title: "Métricas da Gamificação | Gestão Online" }, { name: "description", content: "Como ganhar moedas e XP e seu desempenho por métrica." }, { property: "og:title", content: "Métricas da Gamificação | Gestão Online" }, { property: "og:description", content: "Métricas, valores e seu desempenho." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MetricasPage,
});

function MetricasPage() {
  const { data: me } = useMyUserId();
  const { data: metrics = [] } = useMetrics();
  const { data: categories = [] } = useQuery({
    queryKey: ["gamif-metric-categories"],
    queryFn: async () => (await supabase.from("gamif_metric_categories").select("*").order("position")).data ?? [],
  });
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: mine = [] } = useQuery({
    queryKey: ["gamif-my-entries-30", me],
    enabled: !!me,
    queryFn: async () => (await supabase.from("gamif_entries").select("metric_name, coins, xp").eq("user_id", me!).gte("entry_date", since).limit(2000)).data ?? [],
  });
  const perf = aggregateEntries(mine.map((e) => ({ key: e.metric_name ?? "Sem métrica", coins: e.coins, xp: e.xp })));
  const active = metrics.filter((m) => m.is_active);
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: active.filter((m) => m.category_id === c.id) })),
    { id: "none", name: categories.length ? "Outras" : "Métricas", items: active.filter((m) => !m.category_id || !categories.some((c) => c.id === m.category_id)) },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {groups.length === 0 && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Nenhuma métrica ativa.</CardContent></Card>}
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader><CardTitle className="text-base">{g.name}</CardTitle></CardHeader>
            <CardContent className="divide-y text-sm">
              {g.items.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <div><div className="font-medium">{m.name}</div>{m.description && <div className="text-muted-foreground">{m.description}</div>}</div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Badge variant={m.metric_type === "negativo" ? "destructive" : "secondary"}>{m.metric_type === "negativo" ? "Negativa" : "Positiva"}</Badge>
                    {m.coins} moedas · {m.xp} XP
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Meu desempenho (últimos 30 dias)</CardTitle></CardHeader>
        <CardContent className="divide-y text-sm">
          {perf.length === 0 && <p className="text-muted-foreground">Sem lançamentos nos últimos 30 dias.</p>}
          {perf.map((r) => (
            <div key={r.key} className="flex justify-between py-2"><span>{r.key} <span className="text-muted-foreground">({r.count}x)</span></span><span className="font-medium">{r.coins} moedas · {r.xp} XP</span></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
