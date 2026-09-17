import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarPlus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { listarAtividades } from "@/lib/seu-instalador.functions";
import { NovoAgendamentoDialog } from "./novo-agendamento-dialog";
import { OsHistoricoDialog } from "./os-historico-dialog";
import { asList, errorMessage, formatDateTime, pick, shiftDate, todayISO } from "./shared";

export function AtividadesContent() {
  const fetchAtividades = useServerFn(listarAtividades);
  const [from, setFrom] = useState(shiftDate(todayISO(), -7));
  const [to, setTo] = useState(shiftDate(todayISO(), 7));
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<{ orderId?: string; clientId?: string; title?: string } | null>(null);

  const query = useQuery({
    queryKey: ["si-activities", from, to, status, search, page],
    queryFn: () =>
      fetchAtividades({
        data: {
          scheduledFrom: from || undefined,
          scheduledTo: to || undefined,
          status: status || undefined,
          search: search || undefined,
          page,
          pageSize: 50,
        },
      }),
  });

  const rows = useMemo(() => asList(query.data), [query.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Agenda — Atividades</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${query.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Novo agendamento
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Agendado de</Label>
            <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">até</Label>
            <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Input value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} placeholder="Ex.: agendado" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Busca</Label>
            <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Cliente, placa, OS..." />
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando atividades...</p>
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma atividade encontrada para os filtros escolhidos.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any, i: number) => (
            <Card
              key={r.id ?? i}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() =>
                setDetail({
                  orderId: r.orderId ?? r.id,
                  clientId: r.clientId ?? r.client?.id,
                  title: pick(r, ["clientName", "client", "title"], "Atividade"),
                })
              }
            >
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {pick(r, ["clientName", "client", "title", "serviceType"], "Atividade")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {pick(r, ["serviceTypeName", "serviceType", "description"], "—")} ·{" "}
                    {pick(r, ["technicianName", "technician"], "Sem técnico")}
                    {r.identifier ? ` · ${r.identifier}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(r.scheduledAt ?? r.scheduledFor ?? r.date)}
                  </span>
                  {(r.status || r.statusName) && (
                    <Badge variant="secondary">{pick(r, ["statusName", "status"])}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {page}</span>
            <Button variant="outline" size="sm" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <NovoAgendamentoDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => query.refetch()} />
      <OsHistoricoDialog
        open={!!detail}
        onClose={() => setDetail(null)}
        orderId={detail?.orderId ?? null}
        clientId={detail?.clientId ?? null}
        title={detail?.title}
      />
    </div>
  );
}
