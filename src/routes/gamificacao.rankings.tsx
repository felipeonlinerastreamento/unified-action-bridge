import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRanking } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/rankings")({
  head: () => ({ meta: [{ title: "Rankings | Gamificação" }, { name: "description", content: "Ranking individual e por squad (setor) de XP e AtentaCoins." }, { property: "og:title", content: "Rankings | Gamificação" }, { property: "og:description", content: "Ranking individual e por squad." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RankingsPage,
});

function RankingsPage() {
  const { data = [] } = useRanking();
  const [mode, setMode] = useState("individual");
  const squads = useMemo(() => {
    const m = new Map<string, { name: string; xp: number; coins: number; members: number }>();
    for (const r of data) {
      const k = r.sector_name ?? "Sem setor";
      const cur = m.get(k) ?? { name: k, xp: 0, coins: 0, members: 0 };
      cur.xp += r.xp; cur.coins += r.coins; cur.members += 1;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.xp - a.xp);
  }, [data]);
  return (
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="individual">Individual</TabsTrigger><TabsTrigger value="squads">Squads (setores)</TabsTrigger></TabsList></Tabs>
      <Card><CardContent className="pt-4 divide-y">
        {mode === "individual"
          ? data.map((r, i) => (
              <div key={r.user_id} className="flex items-center justify-between py-2 text-sm">
                <span><b className="inline-block w-8">{i + 1}º</b>{r.name} <span className="text-muted-foreground">· {r.sector_name ?? "Sem setor"}</span></span>
                <span>{r.xp} XP · {r.coins} moedas</span>
              </div>
            ))
          : squads.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between py-2 text-sm">
                <span><b className="inline-block w-8">{i + 1}º</b>{s.name} <span className="text-muted-foreground">· {s.members} pessoas</span></span>
                <span>{s.xp} XP · {s.coins} moedas</span>
              </div>
            ))}
      </CardContent></Card>
    </div>
  );
}
