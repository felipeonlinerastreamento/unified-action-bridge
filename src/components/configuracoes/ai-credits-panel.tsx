import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, Zap } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface UsageRow {
  id: string;
  user_id: string | null;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
}

const FEATURE_LABELS: Record<string, string> = {
  analyze: "Chat configuração",
  chat: "Chat supervisor",
  whisper: "Sussurro IA",
  daily_quote: "Frase do dia",
};

export function AiCreditsPanel() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<UsageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    load();
  }, [period]);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("ai_usage_logs" as any)
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    const rows = (data || []) as UsageRow[];
    setLogs(rows);

    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.user_id] = p.name || "Sem nome"));
      setProfiles(map);
    }
    setLoading(false);
  }

  const totals = useMemo(() => {
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let totalCost = 0;
    let totalTokens = 0;
    let monthCost = 0;
    let todayCost = 0;
    let totalCalls = 0;
    const now = Date.now();
    logs.forEach((l) => {
      totalCost += Number(l.estimated_cost_usd) || 0;
      totalTokens += Number(l.total_tokens) || 0;
      totalCalls += 1;
      const t = new Date(l.created_at).getTime();
      if (now - t <= monthMs) monthCost += Number(l.estimated_cost_usd) || 0;
      if (t >= todayStart.getTime()) todayCost += Number(l.estimated_cost_usd) || 0;
    });
    return { totalCost, totalTokens, totalCalls, monthCost, todayCost };
  }, [logs]);

  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; cost: number; tokens: number }>();
    logs.forEach((l) => {
      const day = new Date(l.created_at).toISOString().slice(0, 10);
      const item = map.get(day) || { day, cost: 0, tokens: 0 };
      item.cost += Number(l.estimated_cost_usd) || 0;
      item.tokens += Number(l.total_tokens) || 0;
      map.set(day, item);
    });
    return Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ ...d, label: d.day.slice(5) }));
  }, [logs]);

  const byUser = useMemo(() => {
    const map = new Map<string, { user: string; cost: number; calls: number }>();
    logs.forEach((l) => {
      const key = l.user_id || "system";
      const name = l.user_id ? profiles[l.user_id] || "Carregando..." : "Sistema";
      const item = map.get(key) || { user: name, cost: 0, calls: 0 };
      item.user = name;
      item.cost += Number(l.estimated_cost_usd) || 0;
      item.calls += 1;
      map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [logs, profiles]);

  const byFeature = useMemo(() => {
    const map = new Map<string, { feature: string; cost: number; calls: number }>();
    logs.forEach((l) => {
      const label = FEATURE_LABELS[l.feature] || l.feature;
      const item = map.get(label) || { feature: label, cost: 0, calls: 0 };
      item.cost += Number(l.estimated_cost_usd) || 0;
      item.calls += 1;
      map.set(label, item);
    });
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [logs]);

  function fmtUsd(v: number) {
    return `$${v.toFixed(4)}`;
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Créditos da IA</span>
            <Badge variant="outline">Lovable AI Gateway</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O saldo real de créditos é gerenciado na sua conta Lovable. Aqui mostramos o consumo estimado registrado por este aplicativo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href="https://lovable.dev/settings/workspace" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Recarregar créditos
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="https://docs.lovable.dev/integrations/cloud" target="_blank" rel="noreferrer">
                Ver detalhes de cobrança
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Hoje" value={fmtUsd(totals.todayCost)} sub="custo estimado" />
        <KpiCard label="Últimos 30d" value={fmtUsd(totals.monthCost)} sub="custo estimado" />
        <KpiCard label="Tokens (período)" value={totals.totalTokens.toLocaleString("pt-BR")} sub={`${totals.totalCalls} chamadas`} />
        <KpiCard label="Total (período)" value={fmtUsd(totals.totalCost)} sub={`últimos ${period}d`} />
      </div>

      <div className="flex gap-2">
        {[7, 30, 90].map((p) => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p as 7 | 30 | 90)}
          >
            {p} dias
          </Button>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin self-center" />}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Consumo por dia</CardTitle></CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período.</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip
                    formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Custo"]}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Por usuário</CardTitle></CardHeader>
          <CardContent>
            {byUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {byUser.slice(0, 10).map((u) => (
                  <div key={u.user} className="flex items-center justify-between text-sm">
                    <span className="truncate">{u.user}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {fmtUsd(u.cost)} <span className="opacity-60">· {u.calls}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Por funcionalidade</CardTitle></CardHeader>
          <CardContent>
            {byFeature.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {byFeature.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between text-sm">
                    <span className="truncate">{f.feature}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {fmtUsd(f.cost)} <span className="opacity-60">· {f.calls}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
