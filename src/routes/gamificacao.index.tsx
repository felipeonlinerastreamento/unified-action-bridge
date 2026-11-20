import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Coins, Sparkles, Trophy, Target } from "lucide-react";
import { levelFromXp } from "@/lib/gamif-rules";
import { useMyUserId, useRanking, useGamifSettings, fmtDate } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/")({
  head: () => ({ meta: [{ title: "Dashboard da Gamificação | Gestão Online" }, { name: "description", content: "Seu saldo de AtentaCoins, XP, nível e últimos lançamentos." }, { property: "og:title", content: "Dashboard da Gamificação | Gestão Online" }, { property: "og:description", content: "Saldo, XP e lançamentos recentes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: GamifDashboard,
});

function GamifDashboard() {
  const { data: me } = useMyUserId();
  const { data: ranking = [] } = useRanking();
  const mine = ranking.find((r) => r.user_id === me);
  const pos = ranking.findIndex((r) => r.user_id === me) + 1;
  const { data: settings } = useGamifSettings();
  const { level, progress } = levelFromXp(mine?.xp ?? 0, settings?.xp_per_level);
  const { data: entries = [] } = useQuery({
    queryKey: ["gamif-my-entries", me, 10],
    enabled: !!me,
    queryFn: async () => (await supabase.from("gamif_entries").select("*").eq("user_id", me!).order("entry_date", { ascending: false }).limit(10)).data ?? [],
  });
  const { data: missions = [] } = useQuery({
    queryKey: ["gamif-active-missions"],
    queryFn: async () => (await supabase.from("gamif_missions").select("*").eq("status", "ativa").order("expires_at").limit(5)).data ?? [],
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={Coins} label={settings?.coin_name ?? "AtentaCoins"} value={mine?.coins ?? 0} />
        <Stat icon={Sparkles} label="XP" value={mine?.xp ?? 0} />
        <Stat icon={Trophy} label="Posição no ranking" value={pos > 0 ? `${pos}º` : "—"} />
        <Card><CardContent className="pt-6 space-y-2"><div className="text-sm text-muted-foreground">Nível {level}</div><Progress value={progress * 100} /></CardContent></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos lançamentos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {entries.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>}
            {entries.map((e) => (
              <div key={e.id} className="flex justify-between text-sm border-b pb-1">
                <span>{fmtDate(e.entry_date)} · {e.metric_name ?? "Lançamento"}</span>
                <span className="font-medium">{e.coins} moedas · {e.xp} XP</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Missões ativas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {missions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma missão ativa.</p>}
            {missions.map((m) => (
              <div key={m.id} className="text-sm border-b pb-1">
                <div className="font-medium">{m.title}</div>
                <div className="text-muted-foreground">{m.reward_coins} moedas · {m.reward_xp} XP · até {fmtDate(m.expires_at)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: number | string }) {
  return (
    <Card><CardContent className="pt-6 flex items-center gap-3"><Icon className="h-8 w-8 text-primary" /><div><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value}</div></div></CardContent></Card>
  );
}
