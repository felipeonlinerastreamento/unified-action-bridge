import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { CRITICIDADE_LABEL, getCriticality, todaySP, STATUS_SEM_COMUNICACAO, type Criticidade, type VehicleRow } from "@/lib/reconnect";
import { logRc, rc, useRcInvalidate, type RcClient, type RcImportTemplate, type RcRecovered, type RcTemplate } from "./use-rc";
import { UploadPlanilhas, type ResumoImportacao } from "./upload-planilhas";
import { NotificarDialog } from "./notificar-dialog";

export const COR: Record<Criticidade, string> = {
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  yellow: "bg-yellow-500/15 text-yellow-700 border-yellow-500/40",
  orange: "bg-orange-500/15 text-orange-700 border-orange-500/40",
  red: "bg-red-500/15 text-red-700 border-red-500/40",
};
export function Crit({ dias }: { dias: number }) {
  const c = getCriticality(dias);
  return <Badge variant="outline" className={COR[c]}>{dias}d</Badge>;
}

export function PainelTab({ vehicles, clients, recovered, templates, importTemplates }: {
  vehicles: VehicleRow[]; clients: RcClient[]; recovered: RcRecovered[]; templates: RcTemplate[]; importTemplates: RcImportTemplate[];
}) {
  const { user, hasRole } = useAuth();
  const invalidate = useRcInvalidate();
  const hoje = todaySP();
  const datas = useMemo(() => [...new Set([hoje, ...vehicles.map((v) => v.import_date)])].sort().reverse(), [vehicles, hoje]);
  const [sessao, setSessao] = useState(hoje);
  const [q, setQ] = useState("");
  const [fCrit, setFCrit] = useState<"all" | Criticidade>("all");
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [notificar, setNotificar] = useState<RcClient | null>(null);
  const [editObs, setEditObs] = useState<Record<string, string>>({});
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const daSessao = vehicles.filter((v) => v.import_date === sessao);
  const rows = daSessao.filter((v) => {
    if (fCrit !== "all" && getCriticality(v.days_offline) !== fCrit) return false;
    const t = q.trim().toLowerCase();
    return !t || `${v.plate} ${v.client_name} ${v.observation}`.toLowerCase().includes(t);
  }).sort((a, b) => b.days_offline - a.days_offline);

  const porCrit = (c: Criticidade) => daSessao.filter((v) => getCriticality(v.days_offline) === c).length;
  const semana = Date.now() - 7 * 86_400_000;
  const recSemana = recovered.filter((r) => new Date(r.recovered_at).getTime() >= semana).length;

  const salvarObs = async (v: VehicleRow) => {
    const obs = editObs[v.id];
    if (obs === undefined || obs === v.observation) return;
    const { error } = await rc.from("rc_vehicles").update({ observation: obs }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    await rc.from("rc_vehicle_annotations").insert({ plate: v.plate, client_id: v.client_id, client_name: v.client_name, observation: obs, created_by: user?.id ?? null, created_by_email: user?.email ?? "" });
    await logRc(user?.id, "annotation", { plate: v.plate });
    toast.success(`Anotação salva (${v.plate}).`);
    invalidate();
  };

  const reiniciarSessao = async () => {
    const ids = vehicles.filter((v) => v.import_date === hoje).map((v) => v.id);
    if (!ids.length) { toast.info("Não há veículos importados hoje."); return; }
    if (!confirm(`Remover os ${ids.length} veículo(s) importados hoje para importar de novo? Anotações e histórico de recuperados ficam guardados.`)) return;
    for (let i = 0; i < ids.length; i += 300) await rc.from("rc_vehicles").delete().in("id", ids.slice(i, i + 300));
    await logRc(user?.id, "session_reset", { removed: ids.length });
    invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Placas sem comunicação</p><p className="text-xl font-semibold">{daSessao.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Clientes</p><p className="text-xl font-semibold">{new Set(daSessao.map((v) => v.client_id)).size}</p></CardContent></Card>
        {(["green", "yellow", "orange", "red"] as Criticidade[]).map((c) => (
          <Card key={c} className={`cursor-pointer ${fCrit === c ? "ring-2 ring-primary" : ""}`} onClick={() => setFCrit(fCrit === c ? "all" : c)}>
            <CardContent className="p-3"><p className="text-xs text-muted-foreground">{CRITICIDADE_LABEL[c]}</p><p className="text-xl font-semibold">{porCrit(c)}</p></CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Recuperados nos últimos 7 dias: <b>{recSemana}</b></p>

      <UploadPlanilhas vehicles={vehicles} clients={clients} importTemplates={importTemplates} onResumo={(r) => { setResumo(r); setSessao(hoje); }} />

      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Select value={sessao} onValueChange={setSessao}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>{datas.map((d) => <SelectItem key={d} value={d}>{d === hoje ? "Hoje" : d.split("-").reverse().join("/")}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar placa, cliente ou anotação..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {(hasRole("admin") || hasRole("gestor")) && <Button variant="outline" size="sm" onClick={reiniciarSessao}><RotateCcw className="h-4 w-4 mr-1" />Reiniciar sessão de hoje</Button>}
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead><TableHead>Cliente</TableHead><TableHead>Sem comunicação</TableHead><TableHead>Status</TableHead>
              <TableHead>Bateria</TableHead><TableHead>Incid.</TableHead><TableHead>Notif.</TableHead><TableHead className="min-w-[220px]">Anotação</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma placa nesta sessão.</TableCell></TableRow>}
            {rows.slice(0, 1000).map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono font-semibold">{v.plate}{v.was_recovered && <Badge variant="outline" className="ml-1 text-[10px]" title={`Já foi recuperada ${v.recovery_count}x`}>↺{v.recovery_count}</Badge>}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={v.client_name}>{v.client_name}</TableCell>
                <TableCell>{v.status === STATUS_SEM_COMUNICACAO
                  ? <Badge variant="outline" className="bg-slate-500/15 text-slate-700 border-slate-500/40">Sem comunicação</Badge>
                  : <Crit dias={v.days_offline} />}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.status}</TableCell>
                <TableCell className="text-xs">{v.battery_voltage || "—"}</TableCell>
                <TableCell>{v.incidences}</TableCell>
                <TableCell>{v.notifications}</TableCell>
                <TableCell>
                  <Input className="h-7 text-xs" value={editObs[v.id] ?? v.observation} onChange={(e) => setEditObs((x) => ({ ...x, [v.id]: e.target.value }))} onBlur={() => salvarObs(v)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Notificar cliente" onClick={() => { const c = clientById.get(v.client_id); if (c) setNotificar(c); else toast.error("Cliente não encontrado."); }}><Send className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 1000 && <p className="p-2 text-xs text-muted-foreground">Mostrando 1.000 de {rows.length}. Use a busca ou o filtro.</p>}
      </Card>

      <NotificarDialog client={notificar} vehicles={notificar ? daSessao.filter((v) => v.client_id === notificar.id) : []} templates={templates} onClose={() => setNotificar(null)} />

      <Dialog open={!!resumo} onOpenChange={(o) => !o && setResumo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Resumo da importação</DialogTitle></DialogHeader>
          {resumo && (
            <div className="space-y-2 text-sm">
              <p>{resumo.total} linha(s) lida(s): <b>{resumo.novos}</b> nova(s), <b>{resumo.atualizados}</b> atualizada(s), <b>{resumo.recuperados}</b> recuperada(s), <b>{resumo.pulados.length}</b> pulada(s), <b>{resumo.avisos.length}</b> aviso(s).</p>
              {resumo.pulados.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border p-2 text-xs">
                  {resumo.pulados.slice(0, 200).map((p, i) => <div key={i}>Linha {p.rowNumber}: {p.rawPlate} · {p.rawClient} — {p.reason}</div>)}
                </div>
              )}
              {resumo.avisos.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded border p-2 text-xs">
                  {resumo.avisos.slice(0, 200).map((w, i) => <div key={i}>Linha {w.row}: {w.issue} ({w.value})</div>)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
