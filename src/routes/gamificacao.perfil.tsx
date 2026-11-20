import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Flame, Award } from "lucide-react";
import { computeStreak, levelFromXp } from "@/lib/gamif-rules";
import { useMyUserId, useRanking, useGamifSettings, fmtDate } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil na Gamificação | GS Hub" }, { name: "description", content: "Nível, sequência de dias, conquistas e estatísticas pessoais." }, { property: "og:title", content: "Meu perfil na Gamificação | GS Hub" }, { property: "og:description", content: "Nível, sequência e conquistas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { data: me } = useMyUserId();
  const { data: ranking = [] } = useRanking();
  const { data: settings } = useGamifSettings();
  const mine = ranking.find((r) => r.user_id === me);
  const pos = ranking.findIndex((r) => r.user_id === me) + 1;
  const { level, progress } = levelFromXp(mine?.xp ?? 0, settings?.xp_per_level);

  const { data: stats } = useQuery({
    queryKey: ["gamif-profile-stats", me],
    enabled: !!me,
    queryFn: async () => {
      const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
      const [entries, badges, missions, duelsWon, duelsAll, redemptions] = await Promise.all([
        supabase.from("gamif_entries").select("entry_date, coins, xp").eq("user_id", me!).gte("entry_date", since).limit(5000),
        supabase.from("gamif_user_badges").select("id, awarded_at, gamif_badges(name, icon, description)").eq("user_id", me!).order("awarded_at", { ascending: false }),
        supabase.from("gamif_user_missions").select("id", { count: "exact", head: true }).eq("user_id", me!).eq("status", "concluida"),
        supabase.from("gamif_pvp_challenges").select("id", { count: "exact", head: true }).eq("winner_id", me!),
        supabase.from("gamif_pvp_challenges").select("id", { count: "exact", head: true }).eq("status", "concluido").or(`challenger_id.eq.${me},opponent_id.eq.${me}`),
        supabase.from("gamif_redemptions").select("id", { count: "exact", head: true }).eq("user_id", me!),
      ]);
      const positive = (entries.data ?? []).filter((e) => e.coins > 0 || e.xp > 0).map((e) => e.entry_date);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      return {
        streak: computeStreak(positive, today),
        entries: entries.data?.length ?? 0,
        badges: badges.data ?? [],
        missions: missions.count ?? 0,
        duelsWon: duelsWon.count ?? 0,
        duels: duelsAll.count ?? 0,
        redemptions: redemptions.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <Avatar className="h-16 w-16"><AvatarImage src={mine?.avatar_url ?? undefined} /><AvatarFallback>{(mine?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-48">
            <div className="text-xl font-semibold">{mine?.name ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{mine?.sector_name ?? "Sem setor"} · {pos > 0 ? `${pos}º no ranking` : "fora do ranking"}</div>
            <div className="mt-2 space-y-1"><div className="text-sm">Nível {level} · {mine?.xp ?? 0} XP</div><Progress value={progress * 100} /></div>
          </div>
          <div className="text-right"><div className="text-sm text-muted-foreground">{settings?.coin_name ?? "AtentaCoins"}</div><div className="text-2xl font-bold">{mine?.coins ?? 0}</div></div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 pt-6"><Flame className="h-8 w-8 text-primary" /><div><div className="text-sm text-muted-foreground">Sequência atual</div><div className="text-2xl font-bold">{stats?.streak.current ?? 0} dia(s)</div><div className="text-xs text-muted-foreground">Melhor: {stats?.streak.best ?? 0}</div></div></CardContent></Card>
        <Mini label="Missões concluídas" value={stats?.missions ?? 0} />
        <Mini label="Duelos vencidos" value={`${stats?.duelsWon ?? 0} de ${stats?.duels ?? 0}`} />
        <Mini label="Resgates" value={stats?.redemptions ?? 0} />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4" />Conquistas</CardTitle></CardHeader>
        <CardContent>
          {(stats?.badges.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nenhuma conquista ainda.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats?.badges.map((b) => {
              const badge = b.gamif_badges as { name: string; icon: string | null; description: string | null } | null;
              return (
                <div key={b.id} className="flex items-center gap-3 rounded-md border p-3">
                  <span className="text-2xl">{badge?.icon ?? "🏅"}</span>
                  <div className="text-sm"><div className="font-medium">{badge?.name}</div><div className="text-xs text-muted-foreground">{badge?.description ?? ""} · {fmtDate(b.awarded_at)}</div></div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value}</div></CardContent></Card>;
}
