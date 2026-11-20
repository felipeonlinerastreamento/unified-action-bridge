import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canAfford } from "@/lib/gamif-rules";
import { useMyUserId, useRanking, fmtDate } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/loja")({
  head: () => ({ meta: [{ title: "Loja | Gamificação" }, { name: "description", content: "Troque AtentaCoins por recompensas e acompanhe seus resgates." }, { property: "og:title", content: "Loja | Gamificação" }, { property: "og:description", content: "Recompensas e resgates." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: LojaPage,
});

function LojaPage() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: ranking = [] } = useRanking();
  const balance = ranking.find((r) => r.user_id === me)?.coins ?? 0;
  const { data: items = [] } = useQuery({ queryKey: ["gamif-store"], queryFn: async () => (await supabase.from("gamif_store_items").select("*").eq("is_active", true).order("cost_coins")).data ?? [] });
  const { data: reds = [] } = useQuery({ queryKey: ["gamif-my-redemptions", me], enabled: !!me, queryFn: async () => (await supabase.from("gamif_redemptions").select("*").eq("user_id", me!).order("created_at", { ascending: false })).data ?? [] });

  const redeem = async (id: string, name: string) => {
    if (!confirm(`Resgatar "${name}"?`)) return;
    const { error } = await supabase.rpc("gamif_redeem", { _item_id: id });
    if (error) return toast.error(error.message);
    toast.success("Resgate solicitado!");
    qc.invalidateQueries({ queryKey: ["gamif-ranking"] });
    qc.invalidateQueries({ queryKey: ["gamif-store"] });
    qc.invalidateQueries({ queryKey: ["gamif-my-redemptions"] });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">Seu saldo: <b>{balance} AtentaCoins</b></p>
      <div className="grid gap-3 md:grid-cols-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item na loja.</p>}
        {items.map((it) => (
          <Card key={it.id}>
            {it.image_url && <img src={it.image_url} alt={it.name} className="h-32 w-full object-cover rounded-t-lg" />}
            <CardHeader className="pb-2"><CardTitle className="text-base">{it.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {it.description && <p className="text-muted-foreground">{it.description}</p>}
              <p><b>{it.cost_coins}</b> moedas{it.stock !== null ? ` · estoque ${it.stock}` : ""}</p>
              <Button size="sm" disabled={!canAfford(balance, it.cost_coins, it.stock)} onClick={() => redeem(it.id, it.name)}>Resgatar</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Meus resgates</CardTitle></CardHeader>
        <CardContent className="divide-y text-sm">
          {reds.length === 0 && <p className="text-muted-foreground">Nenhum resgate.</p>}
          {reds.map((r) => (
            <div key={r.id} className="flex justify-between py-2"><span>{fmtDate(r.created_at)} · {r.item_name}</span><span>{r.cost_coins} moedas <Badge variant="outline">{r.status}</Badge></span></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
