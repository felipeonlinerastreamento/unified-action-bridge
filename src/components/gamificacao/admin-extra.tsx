import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregateEntries, DEFAULT_GAMIF_SETTINGS, type GamifSettings } from "@/lib/gamif-rules";
import { gerarAnaliseGamificacao } from "@/lib/gamif-ai.functions";
import { useGamifSettings, useMyUserId, useRanking, useSectors, fmtDate, fmtDateTime, DUEL_STATUS, MD_CLASS } from "./gamif-data";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function audit(actor: string | null | undefined, action: string, entity: string, entity_id: string | null, details: Record<string, unknown> = {}) {
  return supabase.from("gamif_audit_logs").insert({ actor_id: actor ?? null, action, entity, entity_id, details: details as never });
}

// ---------------- Relatórios ----------------
export function Relatorios() {
  const { data: users = [] } = useRanking();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [group, setGroup] = useState<"pessoa" | "setor" | "metrica" | "origem">("pessoa");
  const { data: entries = [], isFetching } = useQuery({
    queryKey: ["gamif-report-entries", from, to],
    queryFn: async () => (await supabase.from("gamif_entries").select("user_id, metric_name, coins, xp, source, entry_date").gte("entry_date", from).lte("entry_date", to).not("user_id", "is", null).limit(20000)).data ?? [],
  });
  const { data: redemptions = [] } = useQuery({
    queryKey: ["gamif-report-redemptions", from, to],
    queryFn: async () => (await supabase.from("gamif_redemptions").select("status, cost_coins").gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`).limit(5000)).data ?? [],
  });
  const byId = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);
  const rows = useMemo(() => aggregateEntries(entries.map((e) => ({
    key: group === "pessoa" ? byId.get(e.user_id!)?.name ?? "Desconhecido"
      : group === "setor" ? byId.get(e.user_id!)?.sector_name ?? "Sem setor"
      : group === "metrica" ? e.metric_name ?? "Sem métrica" : e.source,
    coins: e.coins, xp: e.xp,
  }))), [entries, group, byId]);
  const total = rows.reduce((a, r) => ({ coins: a.coins + r.coins, xp: a.xp + r.xp, count: a.count + r.count }), { coins: 0, xp: 0, count: 0 });
  const redeemed = redemptions.filter((r) => r.status !== "recusado").reduce((a, r) => a + r.cost_coins, 0);
  const header = { pessoa: "Colaborador", setor: "Setor", metrica: "Métrica", origem: "Origem" }[group];

  const exportXlsx = async () => {
    if (!rows.length) return toast.error("Sem dados para exportar");
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const head = [header, "Lançamentos", "Moedas ganhas", "Moedas perdidas", "Saldo de moedas", "XP"].map((h) => ({ value: h, fontWeight: "bold" as const }));
    const body = rows.map((r) => [r.key, r.count, r.earned, r.spent, r.coins, r.xp].map((v) => ({ value: v })));
    await writeXlsxFile([head, ...body], { stickyRowsCount: 1 }).toFile(`gamificacao-${group}-${from}-a-${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="flex flex-wrap items-end gap-2 pt-4">
        <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">Agrupar por</Label>
          <Select value={group} onValueChange={(v) => setGroup(v as typeof group)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="pessoa">Colaborador</SelectItem><SelectItem value="setor">Setor</SelectItem><SelectItem value="metrica">Métrica</SelectItem><SelectItem value="origem">Origem</SelectItem></SelectContent></Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet className="mr-1 h-4 w-4" />Exportar Excel</Button>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardContent></Card>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Lançamentos" value={total.count} />
        <Kpi label="Saldo de moedas no período" value={total.coins} />
        <Kpi label="XP no período" value={total.xp} />
        <Kpi label="Moedas em resgates" value={redeemed} />
      </div>
      <Card><CardContent className="pt-4">
        <Table>
          <TableHeader><TableRow><TableHead>{header}</TableHead><TableHead className="text-right">Lançamentos</TableHead><TableHead className="text-right">Ganhas</TableHead><TableHead className="text-right">Perdidas</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">XP</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Sem lançamentos no período.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.key}><TableCell>{r.key}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{r.earned}</TableCell><TableCell className="text-right">{r.spent}</TableCell><TableCell className="text-right font-medium">{r.coins}</TableCell><TableCell className="text-right">{r.xp}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</div></CardContent></Card>;
}

// ---------------- Avisos ----------------
export function Avisos() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: sectors = [] } = useSectors();
  const [f, setF] = useState({ title: "", body: "", sector: "todos", when: "" });
  const { data = [] } = useQuery({
    queryKey: ["gamif-admin-notifications"],
    queryFn: async () => (await supabase.from("gamif_notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gamif-admin-notifications"] }); qc.invalidateQueries({ queryKey: ["gamif-unread"] }); };
  const create = async (sendNow: boolean) => {
    if (!f.title.trim()) return toast.error("Informe o título");
    if (!sendNow && !f.when) return toast.error("Escolha data e hora para agendar");
    const { data: row, error } = await supabase.from("gamif_notifications").insert({
      title: f.title.trim(), body: f.body.trim() || null, created_by: me,
      target_sector_id: f.sector === "todos" ? null : f.sector,
      scheduled_at: sendNow ? null : new Date(f.when).toISOString(),
    }).select("id").single();
    if (error) return toast.error(error.message);
    if (sendNow) {
      const { data: n, error: e2 } = await supabase.rpc("gamif_send_notification", { _id: row.id });
      if (e2) return toast.error(e2.message);
      toast.success(`Aviso enviado para ${n} pessoa(s)`);
    } else toast.success("Aviso agendado");
    setF({ title: "", body: "", sector: "todos", when: "" }); refresh();
  };
  const sendNow = async (id: string) => {
    const { data: n, error } = await supabase.rpc("gamif_send_notification", { _id: id });
    if (error) return toast.error(error.message);
    toast.success(`Aviso enviado para ${n} pessoa(s)`); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir este aviso? Ele some também para quem já recebeu.")) return;
    const { error } = await supabase.from("gamif_notifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit"><CardHeader><CardTitle className="text-base">Novo aviso</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Textarea placeholder="Mensagem" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <Select value={f.sector} onValueChange={(v) => setF({ ...f, sector: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <div><Label className="text-xs">Agendar para (opcional)</Label><Input type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></div>
          <div className="flex gap-2"><Button onClick={() => create(true)}>Enviar agora</Button><Button variant="outline" onClick={() => create(false)}>Agendar</Button></div>
          <p className="text-xs text-muted-foreground">Avisos agendados são entregues quando alguém abre a Gamificação depois do horário marcado.</p>
        </CardContent>
      </Card>
      <Card><CardContent className="divide-y pt-4 text-sm">
        {data.length === 0 && <p className="text-muted-foreground">Nenhum aviso criado.</p>}
        {data.map((n) => (
          <div key={n.id} className="flex items-start justify-between gap-2 py-2">
            <div>
              <div className="font-medium">{n.title}</div>
              {n.body && <p className="whitespace-pre-wrap text-muted-foreground">{n.body}</p>}
              <div className="text-xs text-muted-foreground">
                {sectors.find((s) => s.id === n.target_sector_id)?.name ?? "Todos"} · {n.sent_at ? `enviado ${fmtDateTime(n.sent_at)}` : n.scheduled_at ? `agendado para ${fmtDateTime(n.scheduled_at)}` : "não enviado"}
              </div>
            </div>
            <div className="flex gap-1">
              {!n.sent_at && <Button size="sm" variant="outline" onClick={() => sendNow(n.id)}>Enviar agora</Button>}
              <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>Excluir</Button>
            </div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}

// ---------------- Duelos ----------------
export function DuelosAdmin() {
  const qc = useQueryClient();
  const { data: users = [] } = useRanking();
  const [filter, setFilter] = useState("abertos");
  const name = (id: string | null) => users.find((u) => u.user_id === id)?.name ?? "—";
  const { data = [] } = useQuery({
    queryKey: ["gamif-admin-duels"],
    queryFn: async () => (await supabase.from("gamif_pvp_challenges").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  const list = data.filter((d) => filter === "todos" || (filter === "disputa" ? d.status === "disputa" : ["pendente", "ativo", "disputa"].includes(d.status)));
  const resolve = async (id: string, winner: string | null) => {
    if (!confirm(winner ? `Confirmar ${name(winner)} como vencedor? As moedas serão transferidas.` : "Cancelar este duelo sem vencedor?")) return;
    const { error } = await supabase.rpc("gamif_resolve_duel", { _id: id, _winner: winner as string });
    if (error) return toast.error(error.message);
    toast.success("Duelo encerrado"); qc.invalidateQueries();
  };
  return (
    <div className="space-y-3">
      <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="disputa">Em disputa</SelectItem><SelectItem value="abertos">Em aberto</SelectItem><SelectItem value="todos">Todos</SelectItem></SelectContent></Select>
      {list.length === 0 && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Nenhum duelo.</CardContent></Card>}
      {list.map((d) => {
        const st = DUEL_STATUS[d.status] ?? { label: d.status, variant: "outline" as const };
        const open = ["pendente", "ativo", "disputa"].includes(d.status);
        return (
          <Card key={d.id}><CardContent className="space-y-2 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{d.title ?? "Duelo"}</span><Badge variant={st.variant}>{st.label}</Badge></div>
            <div className="text-muted-foreground">{name(d.challenger_id)} x {name(d.opponent_id)} · {d.stake_coins} moedas · criado {fmtDate(d.created_at)}{d.winner_id ? ` · vencedor ${name(d.winner_id)}` : ""}</div>
            {(d.challenger_vote || d.opponent_vote) && (
              <div className="text-xs">
                {name(d.challenger_id)}: {d.challenger_vote ?? "—"}{d.challenger_note ? ` (“${d.challenger_note}”)` : ""} · {name(d.opponent_id)}: {d.opponent_vote ?? "—"}{d.opponent_note ? ` (“${d.opponent_note}”)` : ""}
              </div>
            )}
            {open && (
              <div className="flex flex-wrap gap-2">
                {d.status !== "pendente" && <>
                  <Button size="sm" onClick={() => resolve(d.id, d.challenger_id)}>Vitória de {name(d.challenger_id)}</Button>
                  <Button size="sm" onClick={() => resolve(d.id, d.opponent_id)}>Vitória de {name(d.opponent_id)}</Button>
                </>}
                <Button size="sm" variant="outline" onClick={() => resolve(d.id, null)}>Cancelar duelo</Button>
              </div>
            )}
          </CardContent></Card>
        );
      })}
    </div>
  );
}

// ---------------- Conquistas ----------------
export function Conquistas() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: users = [] } = useRanking();
  const [b, setB] = useState({ name: "", icon: "🏅", description: "" });
  const [award, setAward] = useState({ user: "", badge: "" });
  const { data: badges = [] } = useQuery({ queryKey: ["gamif-badges"], queryFn: async () => (await supabase.from("gamif_badges").select("*").order("name")).data ?? [] });
  const { data: awarded = [] } = useQuery({ queryKey: ["gamif-admin-user-badges"], queryFn: async () => (await supabase.from("gamif_user_badges").select("*").not("user_id", "is", null).order("awarded_at", { ascending: false }).limit(100)).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gamif-badges"] }); qc.invalidateQueries({ queryKey: ["gamif-admin-user-badges"] }); qc.invalidateQueries({ queryKey: ["gamif-feed"] }); };
  const createBadge = async () => {
    if (!b.name.trim()) return toast.error("Informe o nome");
    const { error } = await supabase.from("gamif_badges").insert({ name: b.name.trim(), icon: b.icon.trim() || null, description: b.description.trim() || null });
    if (error) return toast.error(error.message);
    setB({ name: "", icon: "🏅", description: "" }); refresh();
  };
  const give = async () => {
    if (!award.user || !award.badge) return toast.error("Escolha colaborador e conquista");
    const { data, error } = await supabase.from("gamif_user_badges").insert({ user_id: award.user, badge_id: award.badge }).select("id").single();
    if (error) return toast.error(error.message);
    await audit(me, "conquista_concedida", "gamif_user_badges", data.id, { user_id: award.user, badge_id: award.badge });
    toast.success("Conquista concedida"); setAward({ user: "", badge: "" }); refresh();
  };
  const revoke = async (id: string) => {
    if (!confirm("Remover esta conquista do colaborador?")) return;
    const { error } = await supabase.from("gamif_user_badges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await audit(me, "conquista_removida", "gamif_user_badges", id); refresh();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Conquistas cadastradas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[70px_1fr]">
            <Input aria-label="Ícone" value={b.icon} onChange={(e) => setB({ ...b, icon: e.target.value })} />
            <Input placeholder="Nome" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
          </div>
          <Input placeholder="Descrição (como conquistar)" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} />
          <Button size="sm" onClick={createBadge}>Cadastrar conquista</Button>
          <div className="divide-y text-sm">{badges.map((x) => <div key={x.id} className="py-2"><span className="mr-2">{x.icon ?? "🏅"}</span>{x.name}<span className="text-muted-foreground"> · {x.description ?? ""}</span></div>)}</div>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Conceder conquista</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Select value={award.user} onValueChange={(v) => setAward({ ...award, user: v })}><SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}</SelectContent></Select>
            <Select value={award.badge} onValueChange={(v) => setAward({ ...award, badge: v })}><SelectTrigger><SelectValue placeholder="Conquista" /></SelectTrigger><SelectContent>{badges.map((x) => <SelectItem key={x.id} value={x.id}>{x.icon} {x.name}</SelectItem>)}</SelectContent></Select>
            <Button onClick={give}>Conceder</Button>
          </div>
          <div className="divide-y text-sm">
            {awarded.map((a) => {
              const badge = badges.find((x) => x.id === a.badge_id);
              return <div key={a.id} className="flex items-center justify-between py-2"><span>{badge?.icon} {badge?.name} · {users.find((u) => u.user_id === a.user_id)?.name ?? "—"} · {fmtDate(a.awarded_at)}</span><Button size="sm" variant="ghost" onClick={() => revoke(a.id)}>Remover</Button></div>;
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Auditoria ----------------
export function Auditoria() {
  const { data: users = [] } = useRanking();
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["gamif-audit"],
    queryFn: async () => (await supabase.from("gamif_audit_logs").select("*").neq("action", "analise_ia").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const name = (id: string | null) => users.find((u) => u.user_id === id)?.name ?? (id ? "Usuário removido" : "Sistema");
  const term = q.trim().toLowerCase();
  const list = term ? data.filter((r) => `${r.action} ${r.entity ?? ""} ${name(r.actor_id)} ${JSON.stringify(r.details)}`.toLowerCase().includes(term)) : data;
  return (
    <Card><CardContent className="space-y-3 pt-4">
      <Input placeholder="Filtrar por ação, pessoa ou detalhe" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <Table>
        <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Quem</TableHead><TableHead>Ação</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
        <TableBody>
          {list.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nenhum registro.</TableCell></TableRow>}
          {list.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
              <TableCell>{name(r.actor_id)}</TableCell>
              <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
              <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(r.details)}>{r.entity ?? ""} {JSON.stringify(r.details) === "{}" ? "" : JSON.stringify(r.details)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

// ---------------- Configurações ----------------
export function Configuracoes() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: settings } = useGamifSettings();
  const [f, setF] = useState<GamifSettings>(DEFAULT_GAMIF_SETTINGS);
  useEffect(() => { if (settings) setF(settings); }, [settings]);
  const save = async () => {
    const { error } = await supabase.from("gamif_settings").upsert({ id: "default", data: f as never, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    await audit(me, "configuracoes", "gamif_settings", "default", f as unknown as Record<string, unknown>);
    toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["gamif-settings"] });
  };
  const toggle = (k: "notifications_enabled" | "notify_new_mission" | "notify_redemption_status", label: string) => (
    <div className="flex items-center justify-between rounded-md border p-3"><Label htmlFor={k}>{label}</Label><Switch id={k} checked={f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} /></div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Temporada e pontuação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nome da temporada</Label><Input placeholder="Ex.: 1º trimestre 2027" value={f.season_name} onChange={(e) => setF({ ...f, season_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início</Label><Input type="date" value={f.season_start} onChange={(e) => setF({ ...f, season_start: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="date" value={f.season_end} onChange={(e) => setF({ ...f, season_end: e.target.value })} /></div>
          </div>
          <div><Label>Nome da moeda</Label><Input value={f.coin_name} onChange={(e) => setF({ ...f, coin_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>XP por nível</Label><Input type="number" min={1} value={f.xp_per_level} onChange={(e) => setF({ ...f, xp_per_level: Math.max(1, Number(e.target.value) || 1) })} /></div>
            <div><Label>Aposta máxima em duelos</Label><Input type="number" min={1} value={f.max_duel_stake} onChange={(e) => setF({ ...f, max_duel_stake: Math.max(1, Number(e.target.value) || 1) })} /></div>
          </div>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Notificações automáticas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {toggle("notifications_enabled", "Notificações da Gamificação ligadas")}
          {toggle("notify_new_mission", "Avisar a equipe quando houver nova missão")}
          {toggle("notify_redemption_status", "Avisar o colaborador quando o resgate mudar de situação")}
          <p className="text-xs text-muted-foreground">Duelos (desafio, aceite, resultado) avisam os participantes sempre que as notificações estiverem ligadas.</p>
        </CardContent>
      </Card>
      <div className="lg:col-span-2"><Button onClick={save}>Salvar configurações</Button></div>
    </div>
  );
}

// ---------------- Análises da IA ----------------
export function AnalisesIa() {
  const qc = useQueryClient();
  const gerar = useServerFn(gerarAnaliseGamificacao);
  const { data: users = [] } = useRanking();
  const [days, setDays] = useState("30");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { data: history = [] } = useQuery({
    queryKey: ["gamif-ai-history"],
    queryFn: async () => (await supabase.from("gamif_audit_logs").select("*").eq("action", "analise_ia").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });
  const run = async () => {
    setBusy(true);
    try {
      const r = await gerar({ data: { days: Number(days), focus } });
      setResult(r.content); qc.invalidateQueries({ queryKey: ["gamif-ai-history"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar análise");
    } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card><CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div><Label className="text-xs">Período</Label>
            <Select value={days} onValueChange={setDays}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent></Select>
          </div>
          <div className="min-w-60 flex-1"><Label className="text-xs">Foco (opcional)</Label><Input placeholder="Ex.: engajamento do setor Atendimento" value={focus} onChange={(e) => setFocus(e.target.value)} /></div>
          <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}Gerar análise</Button>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          {result ? <div className={MD_CLASS}><ReactMarkdown>{result}</ReactMarkdown></div>
            : <p className="text-sm text-muted-foreground">Gere uma análise para ver destaques, pontos de atenção e recomendações. Usa o Assistente IA do Gestão Online com o tom e as regras definidos em Configurações › Assistente IA.</p>}
        </CardContent></Card>
      </div>
      <Card className="h-fit"><CardHeader><CardTitle className="text-base">Análises anteriores</CardTitle></CardHeader>
        <CardContent className="divide-y text-sm">
          {history.length === 0 && <p className="text-muted-foreground">Nenhuma ainda.</p>}
          {history.map((h) => {
            const d = h.details as { content?: string; days?: number; focus?: string | null };
            return (
              <button key={h.id} type="button" className="w-full py-2 text-left hover:text-primary" onClick={() => setResult(d.content ?? "")}>
                {fmtDateTime(h.created_at)} · {d.days ?? "?"} dias
                <div className="text-xs text-muted-foreground">{users.find((u) => u.user_id === h.actor_id)?.name ?? ""}{d.focus ? ` · ${d.focus}` : ""}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
