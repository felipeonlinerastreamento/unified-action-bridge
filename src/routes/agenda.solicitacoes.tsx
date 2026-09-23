import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Filter, Loader2, MapPin, Plus, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { listarAtividades, listarTecnicos } from "@/lib/seu-instalador.functions";
import { OsDetalhesDialog } from "@/components/agenda/os-detalhes-dialog";
import { SolicitarServicoDialog } from "@/components/agenda/solicitar-servico-dialog";
import {
  asList,
  errorMessage,
  formatDateTime,
  osAddress,
  pick,
  shiftDate,
  statusStyle,
  todayISO,
} from "@/components/agenda/shared";

export const Route = createFileRoute("/agenda/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Agenda — Solicitações | GSystem Hub" },
      {
        name: "description",
        content: "Gerencie pedidos de serviço, verifique disponibilidade e direcione atendimentos por região.",
      },
      { property: "og:title", content: "Agenda — Solicitações | GSystem Hub" },
      {
        property: "og:description",
        content: "Pedidos de serviço sincronizados com o Seu Instalador: disponibilidade, registro e região.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaSolicitacoesPage,
});

const ALL = "__all__";

const STATUS_CHIPS: { key: string; label: string; match: string[] }[] = [
  { key: "pendentes", label: "Pendentes", match: ["pendente", "aberto", "open", "agendad", "scheduled"] },
  { key: "andamento", label: "Em andamento", match: ["desloc", "execu", "andamento", "running", "moving"] },
  { key: "concluidas", label: "Concluídas", match: ["conclu", "done", "finaliz"] },
  { key: "canceladas", label: "Canceladas", match: ["cancel", "improdut"] },
  { key: "todas", label: "Todas", match: [] },
];

function AgendaSolicitacoesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <AgendaSolicitacoes />
    </AppLayout>
  );
}

function AgendaSolicitacoes() {
  const fetchAtividades = useServerFn(listarAtividades);
  const fetchTecnicos = useServerFn(listarTecnicos);
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("gestor");

  const [from, setFrom] = useState(shiftDate(todayISO(), -7));
  const [to, setTo] = useState(shiftDate(todayISO(), 30));
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState(ALL);
  const [statusChip, setStatusChip] = useState("pendentes");
  const [selected, setSelected] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const atividadesQuery = useQuery({
    queryKey: ["si-solicitacoes-lista", from, to],
    queryFn: () => fetchAtividades({ data: { scheduledFrom: from, scheduledTo: to, page: 1, pageSize: 100 } }),
    staleTime: 30_000,
  });

  const tecnicosQuery = useQuery({
    queryKey: ["si-technicians"],
    queryFn: () => fetchTecnicos({ data: {} }),
    staleTime: 10 * 60_000,
  });

  const activities = useMemo(() => asList(atividadesQuery.data), [atividadesQuery.data]);
  const technicians = useMemo(() => asList(tecnicosQuery.data), [tecnicosQuery.data]);

  const filtered = useMemo(() => {
    const chip = STATUS_CHIPS.find((c) => c.key === statusChip);
    const term = search.trim().toLowerCase();
    return activities.filter((a: any) => {
      const status = String(a?.status ?? "").toLowerCase();
      if (chip && chip.match.length > 0 && !chip.match.some((m) => status.includes(m))) return false;
      if (technicianFilter !== ALL) {
        const id = a?.technicianId ?? a?.technician?.id;
        if (!id || String(id) !== technicianFilter) return false;
      }
      if (term) {
        const haystack = [
          pick(a, ["identifier", "title"], ""),
          pick(a, ["clientName"], "") || pick(a?.client ?? {}, ["name", "nome"], ""),
          pick(a, ["serviceTypeName"], "") || pick(a?.serviceType ?? {}, ["name", "nome"], ""),
          osAddress(a),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [activities, statusChip, technicianFilter, search]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="h-6 w-6 text-primary" />
            Solicitações
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie pedidos de serviço — sincronizado com o Seu Instalador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => atividadesQuery.refetch()}>
            <RefreshCw className={`h-4 w-4 ${atividadesQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Solicitar serviço
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setStatusChip(c.key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              statusChip === c.key
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Buscar</span>
              <Input
                placeholder="Cliente, placa, endereço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">De</span>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Até</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Técnico</span>
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os técnicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os técnicos</SelectItem>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {pick(t, ["name", "nome", "fullName"], String(t.id))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {atividadesQuery.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage(atividadesQuery.error)}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {filtered.length} solicitação(ões) encontrada(s)
      </p>

      {atividadesQuery.isLoading ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando solicitações...
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma solicitação encontrada com estes filtros.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a: any) => {
            const st = statusStyle(String(a?.status ?? ""));
            const cliente = pick(a, ["clientName"], "") || pick(a?.client ?? {}, ["name", "nome"], "Cliente");
            const servico =
              pick(a, ["serviceTypeName", "title"], "") || pick(a?.serviceType ?? {}, ["name", "nome"], "");
            const tecnico =
              pick(a, ["technicianName"], "") || pick(a?.technician ?? {}, ["name", "nome", "fullName"], "");
            return (
              <button
                key={String(a.id)}
                type="button"
                onClick={() => setSelected(a)}
                className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{cliente}</span>
                  <Badge className={`${st.bg} border-0 text-white`}>{st.label}</Badge>
                </div>
                {servico && <p className="mt-1 text-sm text-muted-foreground">{servico}</p>}
                {tecnico && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> {tecnico}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {osAddress(a) || "sem endereço"}
                </p>
                <p className="mt-2 text-xs">
                  <span className="text-muted-foreground">Agendamento: </span>
                  {formatDateTime(a?.scheduledAt)}
                </p>
                {pick(a, ["identifier"], "") && (
                  <p className="mt-1 text-xs text-muted-foreground">{pick(a, ["identifier"], "")}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <SolicitarServicoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        technicians={technicians}
        defaultDate={todayISO()}
        onCreated={() => atividadesQuery.refetch()}
        onOpenOs={(a) => setSelected(a)}
      />

      <OsDetalhesDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        activity={selected}
        canEdit={canEdit}
        onUpdated={() => atividadesQuery.refetch()}
      />
    </div>
  );
}
