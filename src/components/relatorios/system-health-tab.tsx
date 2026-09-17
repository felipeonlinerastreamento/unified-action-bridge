import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Database, Server, Plug, AlertTriangle, HardDrive, Gauge, Clock, Save,
} from "lucide-react";
import { getSystemHealth, saveSystemHealthSettings, listSystemHealthAlerts } from "@/lib/system-health.functions";
import { exportToCSV } from "./export-utils";

type Status = "ok" | "warn" | "down" | "unknown";

const STATUS_LABEL: Record<Status, string> = {
  ok: "Normal",
  warn: "Atenção",
  down: "Falha",
  unknown: "Sem dados",
};

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "ok" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
    : status === "warn" ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
    : status === "down" ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-muted text-muted-foreground border-border";
  return <Badge variant="outline" className={cls}>{STATUS_LABEL[status]}</Badge>;
}

function formatBytes(bytes: number | null | undefined) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function SummaryCard({ title, status, value, subtitle, icon: Icon }: {
  title: string; status: Status; value: string; subtitle: string; icon: any;
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" /> {title}
          </span>
          <StatusBadge status={status} />
        </div>
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  );
}

export function SystemHealthTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const fetchHealth = useServerFn(getSystemHealth);
  const saveSettings = useServerFn(saveSystemHealthSettings);
  const fetchAlerts = useServerFn(listSystemHealthAlerts);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fetchHealth({ data: {} }),
    refetchInterval: 60_000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["system-health-alerts"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60_000,
  });

  const health: any = data?.health;
  const status: any = data?.status || {};
  const settings = health?.settings || {};

  const [form, setForm] = useState<any>(null);
  const current = form || {
    connections_pct_warn: settings.connections_pct_warn ?? 80,
    cache_hit_min_pct: settings.cache_hit_min_pct ?? 95,
    db_growth_limit_mb: settings.db_growth_limit_mb ?? 2048,
    cron_stale_minutes: settings.cron_stale_minutes ?? 15,
    integration_errors_per_hour: settings.integration_errors_per_hour ?? 10,
    alerts_enabled: settings.alerts_enabled ?? true,
  };

  const save = useMutation({
    mutationFn: (payload: any) => saveSettings({ data: payload }),
    onSuccess: () => {
      toast.success("Limites de alerta salvos.");
      qc.invalidateQueries({ queryKey: ["system-health"] });
      setForm(null);
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível salvar."),
  });

  const refreshNow = async () => {
    await qc.fetchQuery({ queryKey: ["system-health"], queryFn: () => fetchHealth({ data: { force: true } }) });
    qc.invalidateQueries({ queryKey: ["system-health-alerts"] });
  };

  const openAlerts = useMemo(() => (alerts as any[]).filter((a) => a.is_open), [alerts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando o sistema...
      </div>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          Não foi possível verificar o sistema: {(error as any)?.message || "erro desconhecido"}
        </CardContent>
      </Card>
    );
  }

  const db = health.db;
  const mutedUntil = settings.muted_until && new Date(settings.muted_until).getTime() > Date.now()
    ? settings.muted_until : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Última verificação: {formatDateTime(health.generatedAt)}
          {mutedUntil && <> · alertas silenciados até {formatDateTime(mutedUntil)}</>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refreshNow} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Atualizar agora
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportToCSV(
              (health.integrations || []).map((i: any) => ({
                item: i.label, situacao: STATUS_LABEL[i.status as Status], tempo_ms: i.responseMs ?? "", detalhe: i.detail,
              })),
              "status-do-sistema",
            )}
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {openAlerts.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Problemas em aberto ({openAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openAlerts.map((a: any) => (
              <div key={a.id} className="text-sm">
                <strong>{a.title}</strong> — {a.message}
                <span className="text-xs text-muted-foreground"> · desde {formatDateTime(a.opened_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Banco de dados" status={status.db} icon={Database}
          value={formatBytes(db.sizeBytes)}
          subtitle={db.sizeGrowth7dBytes !== null ? `${formatBytes(db.sizeGrowth7dBytes)} em 7 dias` : "sem histórico ainda"}
        />
        <SummaryCard
          title="Rotinas automáticas" status={status.cron} icon={Server}
          value={`${(health.cron.rows || []).length} rotinas`}
          subtitle={health.cron.available ? "agendadas no sistema" : "não disponível"}
        />
        <SummaryCard
          title="Integrações" status={status.integrations} icon={Plug}
          value={`${(health.integrations || []).filter((i: any) => i.status === "ok").length}/${(health.integrations || []).length} ok`}
          subtitle="serviços externos"
        />
        <SummaryCard
          title="Falhas" status={status.failures} icon={AlertTriangle}
          value={String(health.failures.last24h)}
          subtitle={`${health.failures.last7d} nos últimos 7 dias`}
        />
      </div>

      {/* Banco */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> Disponibilidade e desempenho do banco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {db.error && <div className="text-sm text-destructive">Não foi possível verificar: {db.error}</div>}
          {!db.error && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Conexões em uso</span>
                    <span>{db.connections} de {db.maxConnections} ({db.connectionsPct}%)</span>
                  </div>
                  <Progress value={db.connectionsPct} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Leituras atendidas pela memória</span>
                    <span>{db.cacheHitPct}%</span>
                  </div>
                  <Progress value={Number(db.cacheHitPct)} />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 text-sm">
                <div><div className="text-xs text-muted-foreground">Armazenamento</div>{formatBytes(db.sizeBytes)}</div>
                <div><div className="text-xs text-muted-foreground">Consultas ativas</div>{db.activeConnections}</div>
                <div><div className="text-xs text-muted-foreground">Travamentos</div>{db.deadlocks}</div>
                <div><div className="text-xs text-muted-foreground">Transações desfeitas</div>{db.rollbacks}</div>
                <div><div className="text-xs text-muted-foreground">Arquivos temporários</div>{db.tempFiles} ({formatBytes(db.tempBytes)})</div>
                <div><div className="text-xs text-muted-foreground">Consulta mais longa agora</div>{db.longestQuerySeconds}s</div>
                <div><div className="text-xs text-muted-foreground">Ligado desde</div>{formatDateTime(db.startedAt)}</div>
                <div><div className="text-xs text-muted-foreground">Transações confirmadas</div>{db.commits.toLocaleString("pt-BR")}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Rotinas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Rotinas automáticas</CardTitle>
        </CardHeader>
        <CardContent>
          {!health.cron.available ? (
            <div className="text-sm text-muted-foreground">
              Não foi possível ler as rotinas automáticas{health.cron.error ? `: ${health.cron.error}` : "."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rotina</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Falhas 24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(health.cron.rows || []).map((j: any) => (
                  <TableRow key={j.jobid}>
                    <TableCell className="font-medium">{j.jobname}</TableCell>
                    <TableCell className="font-mono text-xs">{j.schedule}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(j.last_run)}</TableCell>
                    <TableCell>
                      <StatusBadge status={!j.last_status ? "unknown" : j.last_status === "succeeded" ? "ok" : "down"} />
                    </TableCell>
                    <TableCell className="text-right">{j.failures_24h ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Integrações */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Plug className="h-4 w-4" /> Integrações externas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Tempo de resposta</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(health.integrations || []).map((i: any) => (
                <TableRow key={i.key}>
                  <TableCell className="font-medium">{i.label}</TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                  <TableCell>{i.responseMs !== null ? `${i.responseMs} ms` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.detail}</TableCell>
                </TableRow>
              ))}
              {!(health.integrations || []).length && (
                <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhuma integração ativa encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Gargalos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4" /> Maiores tabelas</CardTitle>
          </CardHeader>
          <CardContent>
            {health.tables.error ? (
              <div className="text-sm text-destructive">Não foi possível verificar: {health.tables.error}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Tabela</TableHead><TableHead className="text-right">Tamanho</TableHead><TableHead className="text-right">Registros</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(health.tables.rows || []).map((t: any) => (
                    <TableRow key={t.table_name}>
                      <TableCell className="font-mono text-xs">{t.table_name}</TableCell>
                      <TableCell className="text-right">{formatBytes(t.total_bytes)}</TableCell>
                      <TableCell className="text-right">{Number(t.live_rows || 0).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fila de trabalho acumulada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Respostas do robô aguardando envio</span><strong>{health.queues.botPending}</strong></div>
            <div className="flex justify-between"><span>Caixas de e-mail com erro</span><strong>{health.queues.emailChannelsWithError}</strong></div>
            <div className="flex justify-between"><span>Chamados abertos há mais de 24h</span><strong>{health.queues.ticketsOpenOver24h}</strong></div>
            <div className="flex justify-between"><span>Conversas aguardando há mais de 1h</span><strong>{health.queues.chatsWaitingOver1h}</strong></div>
          </CardContent>
        </Card>
      </div>

      {/* Consultas lentas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Consultas mais lentas</CardTitle>
        </CardHeader>
        <CardContent>
          {!health.slowQueries.available ? (
            <div className="text-sm text-muted-foreground">
              A medição de consultas lentas não está disponível neste banco{health.slowQueries.error ? `: ${health.slowQueries.error}` : "."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Consulta</TableHead><TableHead className="text-right">Execuções</TableHead><TableHead className="text-right">Média</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(health.slowQueries.rows || []).map((q: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-[11px] max-w-[520px] truncate">{q.query}</TableCell>
                    <TableCell className="text-right">{Number(q.calls || 0).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{q.mean_ms} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Falhas recentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Falhas de integração (7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Serviço/endpoint</TableHead><TableHead className="text-right">Falhas</TableHead><TableHead>Último erro</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(health.failures.byService || []).map((f: any) => (
                <TableRow key={f.service}>
                  <TableCell className="font-mono text-xs">{f.service}</TableCell>
                  <TableCell className="text-right">{f.count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.lastError} · {formatDateTime(f.lastAt)}</TableCell>
                </TableRow>
              ))}
              {!(health.failures.byService || []).length && (
                <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">Nenhuma falha registrada no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Limites de alerta */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Limites de alerta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Alerta de conexões acima de (%)</Label>
                <Input type="number" value={current.connections_pct_warn}
                  onChange={(e) => setForm({ ...current, connections_pct_warn: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Leitura pela memória mínima (%)</Label>
                <Input type="number" value={current.cache_hit_min_pct}
                  onChange={(e) => setForm({ ...current, cache_hit_min_pct: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Crescimento máximo em 7 dias (MB)</Label>
                <Input type="number" value={current.db_growth_limit_mb}
                  onChange={(e) => setForm({ ...current, db_growth_limit_mb: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rotina parada há mais de (min)</Label>
                <Input type="number" value={current.cron_stale_minutes}
                  onChange={(e) => setForm({ ...current, cron_stale_minutes: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Falhas por hora toleradas</Label>
                <Input type="number" value={current.integration_errors_per_hour}
                  onChange={(e) => setForm({ ...current, integration_errors_per_hour: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={!!current.alerts_enabled}
                  onCheckedChange={(v) => setForm({ ...current, alerts_enabled: v })} />
                <Label className="text-xs">Enviar alertas para admin e gestor</Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => save.mutate(current)} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar limites
              </Button>
              <Button size="sm" variant="outline" disabled={save.isPending}
                onClick={() => save.mutate({ ...current, mute_hours: 1 })}>
                Silenciar alertas por 1 hora
              </Button>
              {mutedUntil && (
                <Button size="sm" variant="ghost" disabled={save.isPending}
                  onClick={() => save.mutate({ ...current, mute_hours: 0 })}>
                  Retomar alertas
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
