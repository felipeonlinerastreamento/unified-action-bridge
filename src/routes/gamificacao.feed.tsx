import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Gift, Swords, Target } from "lucide-react";
import { fmtDateTime } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/feed")({
  head: () => ({ meta: [{ title: "Feed da Gamificação | GS Hub" }, { name: "description", content: "Conquistas, missões concluídas, resgates e duelos vencidos pela equipe." }, { property: "og:title", content: "Feed da Gamificação | GS Hub" }, { property: "og:description", content: "O que a equipe conquistou recentemente." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: FeedPage,
});

const KIND = {
  conquista: { icon: Award, label: "Conquista", verb: "ganhou a conquista" },
  missao: { icon: Target, label: "Missão", verb: "concluiu a missão" },
  resgate: { icon: Gift, label: "Resgate", verb: "resgatou" },
  duelo: { icon: Swords, label: "Duelo", verb: "venceu o duelo" },
} as const;

function FeedPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["gamif-feed"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gamif_feed", { _limit: 80 });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (data.length === 0) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Ainda não há conquistas da equipe para mostrar.</CardContent></Card>;
  return (
    <div className="space-y-2">
      {data.map((f, i) => {
        const k = KIND[f.kind as keyof typeof KIND] ?? KIND.conquista;
        const Icon = k.icon;
        return (
          <Card key={`${f.kind}-${f.at}-${i}`}>
            <CardContent className="flex items-center gap-3 py-3">
              <Icon className="h-6 w-6 shrink-0 text-primary" />
              <div className="flex-1 text-sm">
                <span className="font-medium">{f.user_name}</span> {k.verb} <span className="font-medium">{f.title}</span>
                {f.coins > 0 && <span className="text-muted-foreground"> · {f.coins} moedas</span>}
                <div className="text-xs text-muted-foreground">{fmtDateTime(f.at)}</div>
              </div>
              <Badge variant="outline">{k.label}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
