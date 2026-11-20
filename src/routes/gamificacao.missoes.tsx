import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMyUserId, fmtDate } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/missoes")({
  head: () => ({ meta: [{ title: "Missões | Gamificação" }, { name: "description", content: "Missões ativas, recompensas e seu progresso." }, { property: "og:title", content: "Missões | Gamificação" }, { property: "og:description", content: "Missões e recompensas da equipe." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MissoesPage,
});

function MissoesPage() {
  const { data: me } = useMyUserId();
  const { data: missions = [] } = useQuery({ queryKey: ["gamif-missions-all"], queryFn: async () => (await supabase.from("gamif_missions").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: mine = [] } = useQuery({ queryKey: ["gamif-my-missions", me], enabled: !!me, queryFn: async () => (await supabase.from("gamif_user_missions").select("*").eq("user_id", me!)).data ?? [] });
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {missions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma missão cadastrada.</p>}
      {missions.map((m) => {
        const um = mine.find((x) => x.mission_id === m.id);
        return (
          <Card key={m.id}>
            <CardHeader className="pb-2"><CardTitle className="text-base flex justify-between gap-2">{m.title}<Badge variant={m.status === "ativa" ? "default" : "secondary"}>{m.status}</Badge></CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {m.description && <p className="text-muted-foreground">{m.description}</p>}
              <p>{m.reward_coins} moedas · {m.reward_xp} XP{m.target ? ` · meta ${m.target}` : ""}</p>
              <p className="text-muted-foreground">Até {fmtDate(m.expires_at)}</p>
              {um && <p>Seu progresso: {um.progress}{m.target ? `/${m.target}` : ""} ({um.status})</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
