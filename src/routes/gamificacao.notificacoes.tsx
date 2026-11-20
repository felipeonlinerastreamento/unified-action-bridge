import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMyUserId, fmtDateTime } from "@/components/gamificacao/gamif-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gamificacao/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações da Gamificação | GS Hub" }, { name: "description", content: "Avisos da gestão, novas missões, resgates e duelos." }, { property: "og:title", content: "Notificações da Gamificação | GS Hub" }, { property: "og:description", content: "Seus avisos da gamificação." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data = [] } = useQuery({
    queryKey: ["gamif-my-notifications", me],
    enabled: !!me,
    queryFn: async () => (await supabase.from("gamif_user_notifications").select("*").eq("user_id", me!).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gamif-my-notifications"] }); qc.invalidateQueries({ queryKey: ["gamif-unread"] }); };
  const markRead = async (id: string) => {
    const { error } = await supabase.from("gamif_user_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };
  const markAll = async () => {
    const { error } = await supabase.from("gamif_user_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me!).is("read_at", null);
    if (error) return toast.error(error.message);
    refresh();
  };
  const unread = data.filter((n) => !n.read_at).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread} não lida(s)</p>
        <Button size="sm" variant="outline" onClick={markAll} disabled={unread === 0}>Marcar todas como lidas</Button>
      </div>
      {data.length === 0 && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Nenhuma notificação.</CardContent></Card>}
      {data.map((n) => (
        <Card key={n.id} className={cn(!n.read_at && "border-primary/50")}>
          <CardContent className="flex items-start justify-between gap-3 py-3">
            <div className="text-sm">
              <div className={cn(!n.read_at && "font-semibold")}>{n.title ?? "Aviso"}</div>
              {n.body && <p className="whitespace-pre-wrap text-muted-foreground">{n.body}</p>}
              <div className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</div>
            </div>
            {!n.read_at && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Marcar como lida</Button>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
