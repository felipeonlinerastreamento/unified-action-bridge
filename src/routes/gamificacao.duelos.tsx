import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validDuelStake } from "@/lib/gamif-rules";
import { useMyUserId, useRanking, useGamifSettings, fmtDate, DUEL_STATUS } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/duelos")({
  head: () => ({ meta: [{ title: "Duelos da Gamificação | Gestão Online" }, { name: "description", content: "Desafie colegas apostando moedas; o vencedor leva a aposta." }, { property: "og:title", content: "Duelos da Gamificação | Gestão Online" }, { property: "og:description", content: "Desafios entre colegas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DuelosPage,
});


function DuelosPage() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: users = [] } = useRanking();
  const { data: settings } = useGamifSettings();
  const [tab, setTab] = useState("abertos");
  const [f, setF] = useState({ opponent: "", title: "", description: "", stake: "50", ends: "" });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const myCoins = users.find((u) => u.user_id === me)?.coins ?? 0;
  const name = (id: string | null) => users.find((u) => u.user_id === id)?.name ?? "—";

  const { data: duels = [] } = useQuery({
    queryKey: ["gamif-duels", me],
    enabled: !!me,
    queryFn: async () => (await supabase.from("gamif_pvp_challenges").select("*").or(`challenger_id.eq.${me},opponent_id.eq.${me}`).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gamif-duels"] }); qc.invalidateQueries({ queryKey: ["gamif-ranking"] }); };
  const rpc = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await fn();
    if (error) return toast.error(error.message);
    toast.success(ok); refresh();
  };

  const create = async () => {
    const stake = Number(f.stake);
    const err = !f.opponent ? "Escolha o colega" : !f.title.trim() ? "Dê um título ao duelo" : validDuelStake(stake, myCoins, settings?.max_duel_stake ?? 500);
    if (err) return toast.error(err);
    const { error } = await supabase.from("gamif_pvp_challenges").insert({
      challenger_id: me, opponent_id: f.opponent, title: f.title.trim(), description: f.description.trim() || null,
      stake_coins: stake, status: "pendente", ends_at: f.ends ? new Date(`${f.ends}T23:59:00`).toISOString() : null,
    });
    if (error) return toast.error(error.message);
    setF({ opponent: "", title: "", description: "", stake: "50", ends: "" }); toast.success("Desafio enviado"); refresh();
  };

  const open = duels.filter((d) => ["pendente", "ativo", "disputa"].includes(d.status));
  const closed = duels.filter((d) => !["pendente", "ativo", "disputa"].includes(d.status));
  const list = tab === "abertos" ? open : closed;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">Novo desafio</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Select value={f.opponent} onValueChange={(v) => setF({ ...f, opponent: v })}>
            <SelectTrigger><SelectValue placeholder="Desafiar quem?" /></SelectTrigger>
            <SelectContent>{users.filter((u) => u.user_id !== me).map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Ex.: Quem fecha mais chamados na semana?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea placeholder="Regras do desafio (opcional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Aposta (máx. {settings?.max_duel_stake ?? 500})</label><Input type="number" min={1} value={f.stake} onChange={(e) => setF({ ...f, stake: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Termina em</label><Input type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Seu saldo: {myCoins}. O perdedor passa a aposta para o vencedor.</p>
          <Button className="w-full" onClick={create}>Enviar desafio</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="abertos">Em aberto ({open.length})</TabsTrigger><TabsTrigger value="encerrados">Encerrados ({closed.length})</TabsTrigger></TabsList></Tabs>
        {list.length === 0 && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Nenhum duelo aqui.</CardContent></Card>}
        {list.map((d) => {
          const st = DUEL_STATUS[d.status] ?? { label: d.status, variant: "outline" as const };
          const iAmChallenger = d.challenger_id === me;
          const myVote = iAmChallenger ? d.challenger_vote : d.opponent_vote;
          return (
            <Card key={d.id}>
              <CardContent className="space-y-2 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{d.title ?? "Duelo"}</div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
                <div className="text-muted-foreground">{name(d.challenger_id)} x {name(d.opponent_id)} · {d.stake_coins} moedas{d.ends_at ? ` · até ${fmtDate(d.ends_at)}` : ""}</div>
                {d.description && <p className="whitespace-pre-wrap">{d.description}</p>}
                {d.status === "concluido" && <p>Vencedor: <span className="font-medium">{name(d.winner_id)}</span></p>}
                {d.status === "pendente" && !iAmChallenger && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => rpc(() => supabase.rpc("gamif_respond_duel", { _id: d.id, _accept: true }), "Desafio aceito")}>Aceitar</Button>
                    <Button size="sm" variant="outline" onClick={() => rpc(() => supabase.rpc("gamif_respond_duel", { _id: d.id, _accept: false }), "Desafio recusado")}>Recusar</Button>
                  </div>
                )}
                {d.status === "pendente" && iAmChallenger && (
                  <Button size="sm" variant="outline" onClick={() => rpc(() => supabase.rpc("gamif_cancel_duel", { _id: d.id }), "Desafio cancelado")}>Cancelar desafio</Button>
                )}
                {d.status === "ativo" && !myVote && (
                  <div className="space-y-2">
                    <Input placeholder="Observação (opcional)" value={notes[d.id] ?? ""} onChange={(e) => setNotes({ ...notes, [d.id]: e.target.value })} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => rpc(() => supabase.rpc("gamif_vote_duel", { _id: d.id, _claim: "venci", _note: notes[d.id] || undefined }), "Resultado registrado")}>Eu venci</Button>
                      <Button size="sm" variant="outline" onClick={() => rpc(() => supabase.rpc("gamif_vote_duel", { _id: d.id, _claim: "perdi", _note: notes[d.id] || undefined }), "Resultado registrado")}>Eu perdi</Button>
                    </div>
                  </div>
                )}
                {d.status === "ativo" && myVote && <p className="text-muted-foreground">Você declarou "{myVote}". Aguardando o outro participante.</p>}
                {d.status === "disputa" && <p className="text-muted-foreground">Os dois declararam vitória. A gestão vai decidir.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
