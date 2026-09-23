import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { listarAtividades, listarTecnicos } from "@/lib/seu-instalador.functions";
import { OsDetalhesDialog } from "@/components/agenda/os-detalhes-dialog";
import { SolicitacoesDisponibilidade } from "@/components/agenda/solicitacoes-disponibilidade";
import { SolicitacoesRegistrar, type Prefill } from "@/components/agenda/solicitacoes-registrar";
import { SolicitacoesRegiao } from "@/components/agenda/solicitacoes-regiao";
import { asList, errorMessage, shiftDate, todayISO } from "@/components/agenda/shared";

export const Route = createFileRoute("/agenda/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Agenda — Solicitações | GSystem Hub" },
      {
        name: "description",
        content: "Verifique disponibilidade dos técnicos, registre solicitações e direcione atendimentos por região.",
      },
      { property: "og:title", content: "Agenda — Solicitações | GSystem Hub" },
      {
        property: "og:description",
        content: "Disponibilidade, registro de solicitação e direcionamento por região em uma só tela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaSolicitacoesPage,
});

const ALL = "__all__";

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

  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState("disponibilidade");
  const [technicianFilter, setTechnicianFilter] = useState(ALL);
  const [duration, setDuration] = useState(60);
  const [prefill, setPrefill] = useState<Prefill>(null);
  const [selected, setSelected] = useState<any | null>(null);

  const atividadesQuery = useQuery({
    queryKey: ["si-solicitacoes-atividades", date],
    queryFn: () => fetchAtividades({ data: { scheduledFrom: date, scheduledTo: date, page: 1, pageSize: 100 } }),
    staleTime: 30_000,
  });

  const tecnicosQuery = useQuery({
    queryKey: ["si-technicians"],
    queryFn: () => fetchTecnicos({ data: {} }),
    staleTime: 10 * 60_000,
  });

  const activities = useMemo(() => asList(atividadesQuery.data), [atividadesQuery.data]);
  const technicians = useMemo(() => asList(tecnicosQuery.data), [tecnicosQuery.data]);

  const consumePrefill = useCallback(() => setPrefill(null), []);
  const openOs = useCallback((activity: any) => setSelected(activity), []);

  const pickSlot = (technicianId: string, time: string) => {
    setPrefill({ technicianId, time });
    setDuration(duration);
    setTab("registrar");
  };

  const scheduleHere = (technicianId: string, region: string) => {
    setPrefill({ technicianId, region });
    setTab("registrar");
  };

  const techFilterValue = technicianFilter === ALL ? "" : technicianFilter;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="h-6 w-6 text-primary" />
            Solicitações
          </h1>
          <p className="text-sm text-muted-foreground">
            Disponibilidade, registro e direcionamento por região — sincronizado com o Seu Instalador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" />
          <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setDate(todayISO())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => atividadesQuery.refetch()}>
            <RefreshCw className={`h-4 w-4 ${atividadesQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os técnicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os técnicos</SelectItem>
              {technicians.map((t: any) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name ?? t.nome ?? String(t.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{activities.length} OS no dia</Badge>
        </div>
      </div>

      {atividadesQuery.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage(atividadesQuery.error)}
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="disponibilidade">Verificar disponibilidade</TabsTrigger>
          <TabsTrigger value="registrar">Registrar solicitação</TabsTrigger>
          <TabsTrigger value="regiao">Direcionar por região</TabsTrigger>
        </TabsList>

        <TabsContent value="disponibilidade" className="mt-4">
          <SolicitacoesDisponibilidade
            activities={activities}
            technicians={technicians}
            loading={atividadesQuery.isLoading || tecnicosQuery.isLoading}
            duration={duration}
            onDurationChange={setDuration}
            technicianFilter={techFilterValue}
            onPickSlot={pickSlot}
            onOpenOs={openOs}
          />
        </TabsContent>

        <TabsContent value="registrar" className="mt-4">
          <SolicitacoesRegistrar
            date={date}
            onDateChange={setDate}
            technicians={technicians}
            activities={activities}
            prefill={prefill}
            onConsumePrefill={consumePrefill}
            onCreated={() => atividadesQuery.refetch()}
            onOpenOs={openOs}
          />
        </TabsContent>

        <TabsContent value="regiao" className="mt-4">
          <SolicitacoesRegiao
            activities={activities.filter((a: any) => {
              if (!techFilterValue) return true;
              const id = a?.technicianId ?? a?.technician?.id;
              return id ? String(id) === techFilterValue : false;
            })}
            loading={atividadesQuery.isLoading}
            onOpenOs={openOs}
            onScheduleHere={scheduleHere}
          />
        </TabsContent>
      </Tabs>

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
