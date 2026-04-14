import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Loader2, AlertTriangle, Plus, List, LayoutGrid, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TicketKpis } from "./ticket-kpis";
import { TicketListView } from "./ticket-list-view";
import { TicketKanbanView } from "./ticket-kanban-view";
import { TicketCalendarView } from "./ticket-calendar-view";
import { TicketDetailPanel } from "./ticket-detail-panel";
import { TicketCreateDialog } from "./ticket-create-dialog";
import { TicketReminderNotifications } from "./ticket-reminder-notifications";

export function AtendimentosContent() {
  const [viewMode, setViewMode] = useState<"lista" | "kanban" | "calendario">("lista");
  const [selected, setSelected] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tickets = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["service-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_tickets")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <TicketReminderNotifications />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
          <p className="text-sm text-muted-foreground">{tickets.length} ticket(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Ticket
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <TicketKpis tickets={tickets} />

      {/* View mode tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="lista" className="gap-1">
            <List className="h-3.5 w-3.5" /> Lista
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1">
            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <Card className="mt-4">
            <CardContent className="p-6 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando tickets...</p>
            </CardContent>
          </Card>
        ) : isError ? (
          <Card className="mt-4">
            <CardContent className="p-6 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">Erro: {(error as Error)?.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="lista" className="mt-4">
              <TicketListView tickets={tickets} onSelect={setSelected} />
            </TabsContent>
            <TabsContent value="kanban" className="mt-4">
              <TicketKanbanView tickets={tickets} onSelect={setSelected} onRefetch={refetch} />
            </TabsContent>
            <TabsContent value="calendario" className="mt-4">
              <TicketCalendarView tickets={tickets} onSelect={setSelected} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Detail panel */}
      <TicketDetailPanel
        ticket={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onRefetch={refetch}
        profiles={profiles}
      />

      {/* Create dialog */}
      <TicketCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
      />
    </div>
  );
}
