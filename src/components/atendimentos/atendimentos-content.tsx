import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Loader2, AlertTriangle, Plus, List, LayoutGrid, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TicketKpis } from "./ticket-kpis";
import { TicketListView } from "./ticket-list-view";
import { TicketKanbanView } from "./ticket-kanban-view";
import { TicketCalendarView } from "./ticket-calendar-view";
import { TicketDetailPanel } from "./ticket-detail-panel";
import { TicketCreateDialog } from "./ticket-create-dialog";
import { TicketReminderNotifications } from "./ticket-reminder-notifications";
import { TicketFiltersBar, applyTicketFilters, defaultFilters, type TicketFilters } from "./ticket-filters";
import { LaboratorioPanel } from "./laboratorio-panel";

export function AtendimentosContent() {
  const { user, hasRole } = useAuth();
  const [viewMode, setViewMode] = useState<"lista" | "kanban" | "calendario">("lista");
  const [selected, setSelected] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sectorDefaultApplied = useRef(false);

  // Define o setor padrão do usuário logado (atendentes/gestores).
  // Admins veem "todos". O usuário pode trocar livremente depois.
  useEffect(() => {
    if (sectorDefaultApplied.current || !user?.id) return;
    if (hasRole("admin")) {
      sectorDefaultApplied.current = true;
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_sector_assignments" as any)
        .select("sector_id, sectors(name)")
        .eq("user_id", user.id)
        .limit(1);
      const sectorName = (data?.[0] as any)?.sectors?.name;
      if (sectorName) {
        setFilters((f) => ({ ...f, sector: sectorName, status: "abertos_em_andamento" }));
      }
      sectorDefaultApplied.current = true;
    })();
  }, [user?.id, hasRole]);

  const { data: tickets = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["service-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_tickets")
        .select("*, companies(name), ticket_tracking(last_status, last_status_date, last_location, is_delivered, tracking_code)")
        .order("created_at", { ascending: false });
      const list = data || [];

      // Buscar último comentário por ticket
      const ids = list.map((t: any) => t.id);
      const lastByTicket: Record<string, string> = {};
      const liberacaoByTicket: Record<string, any[]> = {};
      const suprimentoByTicket: Record<string, any[]> = {};
      const compraEquipByTicket: Record<string, any[]> = {};
      if (ids.length > 0) {
        const { data: comments } = await supabase
          .from("ticket_comments")
          .select("ticket_id, created_at")
          .in("ticket_id", ids)
          .order("created_at", { ascending: false });
        for (const c of comments || []) {
          if (!lastByTicket[c.ticket_id]) lastByTicket[c.ticket_id] = c.created_at;
        }

        // Buscar itens de liberação dos tickets em lote
        const { data: libItems } = await supabase
          .from("ticket_liberacao_items" as any)
          .select("ticket_id, status, quantity, item_name, liberado_at")
          .in("ticket_id", ids);
        for (const it of (libItems as any[]) || []) {
          if (!liberacaoByTicket[it.ticket_id]) liberacaoByTicket[it.ticket_id] = [];
          liberacaoByTicket[it.ticket_id].push(it);
        }

        // Buscar itens de suprimento dos tickets em lote
        const { data: supItems } = await supabase
          .from("ticket_suprimento_items" as any)
          .select("ticket_id, status, quantity, item_name, delivered_at")
          .in("ticket_id", ids);
        for (const it of (supItems as any[]) || []) {
          if (!suprimentoByTicket[it.ticket_id]) suprimentoByTicket[it.ticket_id] = [];
          suprimentoByTicket[it.ticket_id].push(it);
        }

        // Buscar itens de Compra Equipamento/Chip dos tickets em lote
        const { data: ceItems } = await supabase
          .from("ticket_compra_equipamento_items" as any)
          .select("ticket_id, status, quantity, item_name, delivered_at")
          .in("ticket_id", ids);
        for (const it of (ceItems as any[]) || []) {
          if (!compraEquipByTicket[it.ticket_id]) compraEquipByTicket[it.ticket_id] = [];
          compraEquipByTicket[it.ticket_id].push(it);
        }

        // Buscar agentes adicionais (ticket_agents) para cada ticket
        var agentsByTicket: Record<string, string[]> = {};
        const { data: agents } = await supabase
          .from("ticket_agents")
          .select("ticket_id, user_id")
          .in("ticket_id", ids);
        for (const a of (agents as any[]) || []) {
          if (!agentsByTicket[a.ticket_id]) agentsByTicket[a.ticket_id] = [];
          agentsByTicket[a.ticket_id].push(a.user_id);
        }

        // Buscar lembretes recorrentes ativos para marcar chamados "recorrentes"
        var recurringSet = new Set<string>();
        const { data: recRem } = await supabase
          .from("ticket_reminders")
          .select("ticket_id, recurrence_type, is_dismissed")
          .in("ticket_id", ids)
          .eq("is_dismissed", false)
          .not("recurrence_type", "is", null)
          .neq("recurrence_type", "none");
        for (const r of (recRem as any[]) || []) {
          if (r.ticket_id) recurringSet.add(r.ticket_id);
        }
      }
      return list.map((t: any) => ({
        ...t,
        last_comment_at: lastByTicket[t.id] || null,
        liberacao_items: liberacaoByTicket[t.id] || [],
        suprimento_items: suprimentoByTicket[t.id] || [],
        compra_equipamento_items: compraEquipByTicket[t.id] || [],
        agent_user_ids: (typeof agentsByTicket !== "undefined" ? agentsByTicket[t.id] : undefined) || [],
        is_recurring: typeof recurringSet !== "undefined" ? recurringSet.has(t.id) : false,
      }));
    },
    refetchInterval: 30000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      // Usa server function (admin client) para listar TODOS os usuários,
      // contornando a RLS de profiles que só permite o próprio perfil.
      try {
        const { listAllProfiles } = await import("@/lib/user-admin.functions");
        const result = await listAllProfiles();
        return Array.isArray(result) ? result : [];
      } catch {
        const { data } = await supabase.from("profiles").select("*");
        return Array.isArray(data) ? data : [];
      }
    },
  });

  const filteredTickets = useMemo(
    () => applyTicketFilters(tickets, filters),
    [tickets, filters]
  );

  return (
    <div className="space-y-6">
      <TicketReminderNotifications />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
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

      {/* Filters */}
      <TicketFiltersBar
        filters={filters}
        onChange={setFilters}
        tickets={tickets}
        profiles={profiles}
        open={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
      />

      {/* Painel completo do Laboratório (apenas quando o setor Laboratório é filtrado) */}
      {filters.sector.toLowerCase().includes("laborat") && (
        <LaboratorioPanel tickets={filteredTickets} onOpenTicket={setSelected} />
      )}

      {/* KPIs — refletem os filtros aplicados */}
      <TicketKpis tickets={filteredTickets} />

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
              <TicketListView tickets={filteredTickets} onSelect={setSelected} profiles={profiles} />
            </TabsContent>
            <TabsContent value="kanban" className="mt-4">
              <TicketKanbanView tickets={filteredTickets} onSelect={setSelected} onRefetch={refetch} />
            </TabsContent>
            <TabsContent value="calendario" className="mt-4">
              <TicketCalendarView tickets={filteredTickets} onSelect={setSelected} />
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
