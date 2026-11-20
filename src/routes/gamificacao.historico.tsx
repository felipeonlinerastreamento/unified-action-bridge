import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useMyUserId, fmtDate } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/historico")({
  head: () => ({ meta: [{ title: "Histórico de desempenho | Gamificação" }, { name: "description", content: "Todos os seus lançamentos de AtentaCoins e XP." }, { property: "og:title", content: "Histórico de desempenho | Gamificação" }, { property: "og:description", content: "Seus lançamentos de moedas e XP." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { data: me } = useMyUserId();
  const { data = [] } = useQuery({ queryKey: ["gamif-my-entries", me, 500], enabled: !!me, queryFn: async () => (await supabase.from("gamif_entries").select("*").eq("user_id", me!).order("entry_date", { ascending: false }).limit(500)).data ?? [] });
  return (
    <Card><CardContent className="pt-4 divide-y text-sm">
      {data.length === 0 && <p className="text-muted-foreground">Nenhum lançamento.</p>}
      {data.map((e) => (
        <div key={e.id} className="flex justify-between gap-4 py-2">
          <span>{fmtDate(e.entry_date)} · {e.metric_name ?? "Lançamento"}{e.notes ? <span className="text-muted-foreground"> — {e.notes}</span> : null}</span>
          <span className={e.coins < 0 ? "text-destructive" : ""}>{e.coins} moedas · {e.xp} XP</span>
        </div>
      ))}
    </CardContent></Card>
  );
}
