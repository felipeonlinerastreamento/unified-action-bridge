import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetrics, useRanking, useSectors, fmtDate, useMyUserId } from "@/components/gamificacao/gamif-data";
import { Relatorios, Avisos, DuelosAdmin, Conquistas, Auditoria, Configuracoes, AnalisesIa } from "@/components/gamificacao/admin-extra";
import { ImportacaoTop } from "@/components/gamificacao/admin-import";

export const Route = createFileRoute("/gamificacao/admin")({
  head: () => ({ meta: [{ title: "Admin da Gamificação | Gestão Online" }, { name: "description", content: "Lançamentos, métricas, missões, loja, resgates, relatórios, duelos, auditoria e análises da IA." }, { property: "og:title", content: "Admin da Gamificação | Gestão Online" }, { property: "og:description", content: "Administração da gamificação." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { hasRole } = useAuth();
  if (!hasRole("admin") && !hasRole("gestor")) return <p className="text-muted-foreground">Somente admin e gestor.</p>;
  return (
    <Tabs defaultValue="lancamentos">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        <TabsTrigger value="metricas">Métricas</TabsTrigger>
        <TabsTrigger value="regras">Regras automáticas</TabsTrigger>
        <TabsTrigger value="missoes">Missões</TabsTrigger>
        <TabsTrigger value="loja">Loja</TabsTrigger>
        <TabsTrigger value="resgates">Resgates</TabsTrigger>
        <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
        <TabsTrigger value="pendentes">Usuários pendentes</TabsTrigger>
        <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        <TabsTrigger value="avisos">Notificações</TabsTrigger>
        <TabsTrigger value="duelos">Duelos</TabsTrigger>
        <TabsTrigger value="conquistas">Conquistas</TabsTrigger>
        <TabsTrigger value="ia">Análises da IA</TabsTrigger>
        <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        <TabsTrigger value="config">Configurações</TabsTrigger>
        <TabsTrigger value="importacao">Importação do TOP</TabsTrigger>
      </TabsList>
      <TabsContent value="lancamentos"><Lancamentos /></TabsContent>
      <TabsContent value="metricas"><Metricas /></TabsContent>
      <TabsContent value="regras"><Regras /></TabsContent>
      <TabsContent value="missoes"><Missoes /></TabsContent>
      <TabsContent value="loja"><Loja /></TabsContent>
      <TabsContent value="resgates"><Resgates /></TabsContent>
      <TabsContent value="sugestoes"><Sugestoes /></TabsContent>
      <TabsContent value="pendentes"><Pendentes /></TabsContent>
      <TabsContent value="relatorios"><Relatorios /></TabsContent>
      <TabsContent value="avisos"><Avisos /></TabsContent>
      <TabsContent value="duelos"><DuelosAdmin /></TabsContent>
      <TabsContent value="conquistas"><Conquistas /></TabsContent>
      <TabsContent value="ia"><AnalisesIa /></TabsContent>
      <TabsContent value="auditoria"><Auditoria /></TabsContent>
      <TabsContent value="config"><Configuracoes /></TabsContent>
      <TabsContent value="importacao"><ImportacaoTop /></TabsContent>
    </Tabs>
  );
}

function audit(action: string, entity: string, entity_id: string, details: Record<string, unknown> = {}) {
  return supabase.auth.getUser().then(({ data }) => supabase.from("gamif_audit_logs").insert({ actor_id: data.user?.id, action, entity, entity_id, details: details as never }));
}

function Lancamentos() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: users = [] } = useRanking();
  const { data: metrics = [] } = useMetrics();
  const [userId, setUserId] = useState("");
  const [metricId, setMetricId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const { data: recent = [] } = useQuery({ queryKey: ["gamif-admin-entries"], queryFn: async () => (await supabase.from("gamif_entries").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const name = (id: string | null) => users.find((u) => u.user_id === id)?.name ?? id ?? "—";
  const save = async () => {
    const m = metrics.find((x) => x.id === metricId);
    if (!userId || !m) return toast.error("Escolha colaborador e métrica.");
    const { data, error } = await supabase.from("gamif_entries").insert({ user_id: userId, metric_id: m.id, metric_name: m.name, entry_date: date, coins: m.coins, xp: m.xp, notes: notes || null, created_by: me, source: "manual" }).select("id").single();
    if (error) return toast.error(error.message);
    await audit("lancamento", "gamif_entries", data.id, { coins: m.coins, xp: m.xp, userId });
    setNotes(""); toast.success("Lançado"); qc.invalidateQueries();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir lançamento? O saldo será ajustado.")) return;
    const { error } = await supabase.from("gamif_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await audit("lancamento_excluido", "gamif_entries", id); qc.invalidateQueries();
  };
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">Novo lançamento</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-5">
          <Select value={userId} onValueChange={setUserId}><SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}</SelectContent></Select>
          <Select value={metricId} onValueChange={setMetricId}><SelectTrigger><SelectValue placeholder="Métrica" /></SelectTrigger><SelectContent>{metrics.filter((m) => m.is_active).map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.coins}/{m.xp})</SelectItem>)}</SelectContent></Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Observação" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={save}>Lançar</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="pt-4 divide-y text-sm">
        {recent.map((e) => (
          <div key={e.id} className="flex justify-between gap-2 py-2">
            <span>{fmtDate(e.entry_date)} · {name(e.user_id) === "—" && e.legacy_user_id ? `(pendente ${e.legacy_user_id})` : name(e.user_id)} · {e.metric_name} <Badge variant="outline">{e.source}</Badge></span>
            <span className="flex items-center gap-2">{e.coins} / {e.xp} XP<Button size="sm" variant="ghost" onClick={() => remove(e.id)}>Excluir</Button></span>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}

function Metricas() {
  const qc = useQueryClient();
  const { data = [] } = useMetrics();
  const [f, setF] = useState({ name: "", coins: "0", xp: "0", metric_type: "positivo" });
  const add = async () => {
    if (!f.name.trim()) return;
    const { error } = await supabase.from("gamif_metrics").insert({ name: f.name.trim(), coins: Number(f.coins), xp: Number(f.xp), metric_type: f.metric_type });
    if (error) return toast.error(error.message);
    setF({ name: "", coins: "0", xp: "0", metric_type: "positivo" }); qc.invalidateQueries({ queryKey: ["gamif-metrics"] });
  };
  const toggle = async (id: string, v: boolean) => { await supabase.from("gamif_metrics").update({ is_active: v }).eq("id", id); qc.invalidateQueries({ queryKey: ["gamif-metrics"] }); };
  return (
    <Card><CardContent className="pt-4 space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <Input placeholder="Nome da métrica" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input type="number" placeholder="Moedas" value={f.coins} onChange={(e) => setF({ ...f, coins: e.target.value })} />
        <Input type="number" placeholder="XP" value={f.xp} onChange={(e) => setF({ ...f, xp: e.target.value })} />
        <Select value={f.metric_type} onValueChange={(v) => setF({ ...f, metric_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="positivo">Positiva</SelectItem><SelectItem value="negativo">Negativa</SelectItem></SelectContent></Select>
        <Button onClick={add}>Adicionar</Button>
      </div>
      <div className="divide-y text-sm">{data.map((m) => (
        <div key={m.id} className="flex justify-between py-2"><span>{m.name} · {m.coins} moedas · {m.xp} XP</span><Switch checked={m.is_active} onCheckedChange={(v) => toggle(m.id, v)} /></div>
      ))}</div>
    </CardContent></Card>
  );
}

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
function Regras() {
  const qc = useQueryClient();
  const { data: sectors = [] } = useSectors();
  const { data: metrics = [] } = useMetrics();
  const [sectorId, setSectorId] = useState("");
  const [metricId, setMetricId] = useState("");
  const { data = [] } = useQuery({ queryKey: ["gamif-rules"], queryFn: async () => (await supabase.from("gamif_auto_rules").select("*").order("created_at")).data ?? [] });
  const add = async () => {
    if (!sectorId || !metricId) return toast.error("Escolha setor e métrica.");
    const { error } = await supabase.from("gamif_auto_rules").insert({ sector_id: sectorId, metric_id: metricId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gamif-rules"] });
  };
  const upd = async (id: string, patch: { is_active?: boolean; weekdays?: number[] }) => { await supabase.from("gamif_auto_rules").update(patch).eq("id", id); qc.invalidateQueries({ queryKey: ["gamif-rules"] }); };
  return (
    <Card><CardContent className="pt-4 space-y-3">
      <p className="text-sm text-muted-foreground">Todo dia às 23h50 cada pessoa ativa do setor recebe o valor da métrica (uma vez por dia).</p>
      <div className="grid gap-2 md:grid-cols-3">
        <Select value={sectorId} onValueChange={setSectorId}><SelectTrigger><SelectValue placeholder="Setor (squad)" /></SelectTrigger><SelectContent>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={metricId} onValueChange={setMetricId}><SelectTrigger><SelectValue placeholder="Métrica" /></SelectTrigger><SelectContent>{metrics.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
        <Button onClick={add}>Adicionar regra</Button>
      </div>
      <div className="divide-y text-sm">{data.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{sectors.find((s) => s.id === r.sector_id)?.name ?? "—"} · {metrics.find((m) => m.id === r.metric_id)?.name ?? "—"}</span>
          <span className="flex items-center gap-1">
            {WEEK.map((w, i) => { const d = i + 1; const on = r.weekdays.includes(d); return <Button key={w} size="sm" variant={on ? "default" : "outline"} className="h-7 px-2" onClick={() => upd(r.id, { weekdays: on ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d] })}>{w}</Button>; })}
            <Switch checked={r.is_active} onCheckedChange={(v) => upd(r.id, { is_active: v })} />
          </span>
        </div>
      ))}</div>
    </CardContent></Card>
  );
}

function Missoes() {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", reward_coins: "0", reward_xp: "0", expires_at: "" });
  const { data = [] } = useQuery({ queryKey: ["gamif-missions-all"], queryFn: async () => (await supabase.from("gamif_missions").select("*").order("created_at", { ascending: false })).data ?? [] });
  const add = async () => {
    if (!f.title.trim()) return;
    const { error } = await supabase.from("gamif_missions").insert({ title: f.title.trim(), reward_coins: Number(f.reward_coins), reward_xp: Number(f.reward_xp), expires_at: f.expires_at ? `${f.expires_at}T23:59:00-03:00` : null });
    if (error) return toast.error(error.message);
    setF({ title: "", reward_coins: "0", reward_xp: "0", expires_at: "" }); qc.invalidateQueries({ queryKey: ["gamif-missions-all"] });
  };
  const setStatus = async (id: string, status: string) => { await supabase.from("gamif_missions").update({ status }).eq("id", id); qc.invalidateQueries({ queryKey: ["gamif-missions-all"] }); };
  return (
    <Card><CardContent className="pt-4 space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <Input placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input type="number" placeholder="Moedas" value={f.reward_coins} onChange={(e) => setF({ ...f, reward_coins: e.target.value })} />
        <Input type="number" placeholder="XP" value={f.reward_xp} onChange={(e) => setF({ ...f, reward_xp: e.target.value })} />
        <Input type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} />
        <Button onClick={add}>Criar missão</Button>
      </div>
      <div className="divide-y text-sm">{data.map((m) => (
        <div key={m.id} className="flex justify-between py-2"><span>{m.title} · {m.reward_coins}/{m.reward_xp} XP · até {fmtDate(m.expires_at)}</span>
          <Select value={m.status} onValueChange={(v) => setStatus(m.id, v)}><SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="encerrada">Encerrada</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem></SelectContent></Select>
        </div>
      ))}</div>
    </CardContent></Card>
  );
}

function Loja() {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", cost_coins: "0", stock: "", image_url: "" });
  const { data = [] } = useQuery({ queryKey: ["gamif-store-admin"], queryFn: async () => (await supabase.from("gamif_store_items").select("*").order("cost_coins")).data ?? [] });
  const add = async () => {
    if (!f.name.trim()) return;
    const { error } = await supabase.from("gamif_store_items").insert({ name: f.name.trim(), cost_coins: Number(f.cost_coins), stock: f.stock === "" ? null : Number(f.stock), image_url: f.image_url || null });
    if (error) return toast.error(error.message);
    setF({ name: "", cost_coins: "0", stock: "", image_url: "" }); qc.invalidateQueries();
  };
  const toggle = async (id: string, v: boolean) => { await supabase.from("gamif_store_items").update({ is_active: v }).eq("id", id); qc.invalidateQueries(); };
  return (
    <Card><CardContent className="pt-4 space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <Input placeholder="Item" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input type="number" placeholder="Custo" value={f.cost_coins} onChange={(e) => setF({ ...f, cost_coins: e.target.value })} />
        <Input type="number" placeholder="Estoque (vazio = ilimitado)" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
        <Input placeholder="Link da imagem" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />
        <Button onClick={add}>Adicionar</Button>
      </div>
      <div className="divide-y text-sm">{data.map((i) => (
        <div key={i.id} className="flex justify-between py-2"><span>{i.name} · {i.cost_coins} moedas{i.stock !== null ? ` · estoque ${i.stock}` : ""}</span><Switch checked={i.is_active} onCheckedChange={(v) => toggle(i.id, v)} /></div>
      ))}</div>
    </CardContent></Card>
  );
}

function Resgates() {
  const qc = useQueryClient();
  const { data: users = [] } = useRanking();
  const { data = [] } = useQuery({ queryKey: ["gamif-redemptions-admin"], queryFn: async () => (await supabase.from("gamif_redemptions").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  const decide = async (id: string, status: string) => {
    const { error } = await supabase.rpc("gamif_decide_redemption", { _id: id, _status: status });
    if (error) return toast.error(error.message);
    toast.success(status === "recusado" ? "Recusado e moedas devolvidas" : "Atualizado"); qc.invalidateQueries();
  };
  return (
    <Card><CardContent className="pt-4 divide-y text-sm">
      {data.length === 0 && <p className="text-muted-foreground">Nenhum resgate.</p>}
      {data.map((r) => (
        <div key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
          <span>{fmtDate(r.created_at)} · {users.find((u) => u.user_id === r.user_id)?.name ?? r.legacy_user_id ?? "—"} · {r.item_name} · {r.cost_coins} moedas <Badge variant="outline">{r.status}</Badge></span>
          {r.status !== "recusado" && r.status !== "entregue" && (
            <span className="flex gap-1">
              {r.status === "pendente" && <Button size="sm" onClick={() => decide(r.id, "aprovado")}>Aprovar</Button>}
              <Button size="sm" variant="outline" onClick={() => decide(r.id, "entregue")}>Entregue</Button>
              <Button size="sm" variant="destructive" onClick={() => decide(r.id, "recusado")}>Recusar</Button>
            </span>
          )}
        </div>
      ))}
    </CardContent></Card>
  );
}

function Sugestoes() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["gamif-suggestions"], queryFn: async () => (await supabase.from("gamif_suggestions").select("*").order("created_at", { ascending: false })).data ?? [] });
  const upd = async (id: string, patch: { status?: string; admin_response?: string }) => { const { error } = await supabase.from("gamif_suggestions").update(patch).eq("id", id); if (error) toast.error(error.message); qc.invalidateQueries({ queryKey: ["gamif-suggestions"] }); };
  return (
    <Card><CardContent className="pt-4 divide-y text-sm">
      {data.map((s) => (
        <div key={s.id} className="py-2 space-y-1">
          <div className="flex justify-between gap-2"><b>{s.title}</b>
            <Select value={s.status} onValueChange={(v) => upd(s.id, { status: v })}><SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nova">Nova</SelectItem><SelectItem value="em_analise">Em análise</SelectItem><SelectItem value="aprovada">Aprovada</SelectItem><SelectItem value="recusada">Recusada</SelectItem></SelectContent></Select>
          </div>
          <Input defaultValue={s.admin_response ?? ""} placeholder="Resposta ao colaborador (Enter salva)" onKeyDown={(e) => { if (e.key === "Enter") upd(s.id, { admin_response: (e.target as HTMLInputElement).value }); }} />
        </div>
      ))}
    </CardContent></Card>
  );
}

function Pendentes() {
  const qc = useQueryClient();
  const { data: users = [] } = useRanking();
  const { data = [] } = useQuery({ queryKey: ["gamif-legacy"], queryFn: async () => (await supabase.from("gamif_legacy_users").select("*").order("name")).data ?? [] });
  const link = async (legacyId: string, userId: string) => {
    if (!confirm("Ligar este usuário do TOP ao usuário escolhido? Lançamentos e resgates dele passarão para essa pessoa.")) return;
    const { error } = await supabase.rpc("gamif_link_legacy_user", { _legacy_id: legacyId, _user_id: userId });
    if (error) return toast.error(error.message);
    toast.success("Usuário ligado"); qc.invalidateQueries();
  };
  return (
    <Card><CardContent className="pt-4 divide-y text-sm">
      {data.length === 0 && <p className="text-muted-foreground">Nenhum usuário do TOP Gamific importado ainda.</p>}
      {data.map((l) => (
        <div key={l.legacy_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{l.name ?? "—"} · {l.email ?? "sem e-mail"} · {l.coins} moedas · {l.xp} XP <Badge variant={l.status === "ligado" ? "default" : "secondary"}>{l.status}</Badge></span>
          {l.status !== "ligado" && (
            <Select onValueChange={(v) => link(l.legacy_id, v)}><SelectTrigger className="w-60 h-8"><SelectValue placeholder="Ligar a usuário do Gestão Online" /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}</SelectContent></Select>
          )}
        </div>
      ))}
    </CardContent></Card>
  );
}
