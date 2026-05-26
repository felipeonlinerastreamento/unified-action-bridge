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

export function AtendimentosContent({ autoOpenTicketId }: { autoOpenTicketId?: string } = {}) {
  const { user, hasRole } = useAuth();
  const [viewMode, setViewMode] = useState<"lista" | "kanban" | "calendario">("lista");
  const [selected, setSelected] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sectorDefaultApplied = useRef(false);
  const autoOpenedRef = useRef(false);

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
      var purchaseItemsByTicket: Record<string, any[]> = {};
      var purchaseRequestByTicket: Record<string, any> = {};
      var agentsByTicket: Record<string, string[]> = {};
      var recurringSet = new Set<string>();
      if (ids.length > 0) {
        const idSet = new Set(ids);
        // Helper: chunk .in() para evitar URLs gigantes (PostgREST)
        const CHUNK = 200;
        const chunkedIn = async <T,>(
          table: string,
          select: string,
          extra?: (q: any) => any,
        ): Promise<T[]> => {
          const out: T[] = [];
          for (let i = 0; i < ids.length; i += CHUNK) {
            const slice = ids.slice(i, i + CHUNK);
            let q = supabase.from(table as any).select(select).in("ticket_id", slice);
            if (extra) q = extra(q);
            const { data } = await q;
            if (data) out.push(...(data as any[] as T[]));
          }
          return out;
        };

        const comments = await chunkedIn<any>(
          "ticket_comments",
          "ticket_id, created_at",
          (q) => q.order("created_at", { ascending: false }),
        );
        for (const c of comments) {
          if (!lastByTicket[c.ticket_id]) lastByTicket[c.ticket_id] = c.created_at;
        }

        // Tabelas pequenas: SELECT completo e filtra no cliente (evita URL grande)
        const { data: libItems } = await supabase
          .from("ticket_liberacao_items" as any)
          .select("ticket_id, status, quantity, item_name, liberado_at");
        for (const it of (libItems as any[]) || []) {
          if (!idSet.has(it.ticket_id)) continue;
          if (!liberacaoByTicket[it.ticket_id]) liberacaoByTicket[it.ticket_id] = [];
          liberacaoByTicket[it.ticket_id].push(it);
        }

        const { data: supItems } = await supabase
          .from("ticket_suprimento_items" as any)
          .select("ticket_id, status, quantity, item_name, delivered_at");
        for (const it of (supItems as any[]) || []) {
          if (!idSet.has(it.ticket_id)) continue;
          if (!suprimentoByTicket[it.ticket_id]) suprimentoByTicket[it.ticket_id] = [];
          suprimentoByTicket[it.ticket_id].push(it);
        }

        const { data: ceItems } = await supabase
          .from("ticket_compra_equipamento_items" as any)
          .select("ticket_id, status, quantity, item_name, delivered_at");
        for (const it of (ceItems as any[]) || []) {
          if (!idSet.has(it.ticket_id)) continue;
          if (!compraEquipByTicket[it.ticket_id]) compraEquipByTicket[it.ticket_id] = [];
          compraEquipByTicket[it.ticket_id].push(it);
        }

        // Compras: itens + request (tabelas pequenas)
        const { data: pItems } = await supabase
          .from("ticket_purchase_items" as any)
          .select("ticket_id, status, quantity, item_name, delivered_at");
        for (const it of (pItems as any[]) || []) {
          if (!idSet.has(it.ticket_id)) continue;
          if (!purchaseItemsByTicket[it.ticket_id]) purchaseItemsByTicket[it.ticket_id] = [];
          purchaseItemsByTicket[it.ticket_id].push(it);
        }
        const { data: pReqs } = await supabase
          .from("ticket_purchase_requests" as any)
          .select("ticket_id, status, tracking_code, expected_delivery, freight");
        for (const r of (pReqs as any[]) || []) {
          if (!idSet.has(r.ticket_id)) continue;
          purchaseRequestByTicket[r.ticket_id] = r;
        }

        const agents = await chunkedIn<any>("ticket_agents", "ticket_id, user_id");
        for (const a of agents) {
          if (!agentsByTicket[a.ticket_id]) agentsByTicket[a.ticket_id] = [];
          agentsByTicket[a.ticket_id].push(a.user_id);
        }

        const recRem = await chunkedIn<any>(
          "ticket_reminders",
          "ticket_id, recurrence_type, is_dismissed",
          (q) =>
            q
              .eq("is_dismissed", false)
              .not("recurrence_type", "is", null)
              .neq("recurrence_type", "none"),
        );
        for (const r of recRem) {
          if (r.ticket_id) recurringSet.add(r.ticket_id);
        }
      }
      return list.map((t: any) => ({
        ...t,
        last_comment_at: lastByTicket[t.id] || null,
        liberacao_items: liberacaoByTicket[t.id] || [],
        suprimento_items: suprimentoByTicket[t.id] || [],
        compra_equipamento_items: compraEquipByTicket[t.id] || [],
        purchase_items: (typeof purchaseItemsByTicket !== "undefined" ? purchaseItemsByTicket[t.id] : undefined) || [],
        purchase_request: (typeof purchaseRequestByTicket !== "undefined" ? purchaseRequestByTicket[t.id] : undefined) || null,
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

  useEffect(() => {
    if (!selected?.id) return;
    const fresh = (tickets as any[]).find((t) => t.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [tickets, selected]);

  // Auto-open ticket detail when arriving with ?ticket=<id>
  useEffect(() => {
    if (autoOpenedRef.current || !autoOpenTicketId || tickets.length === 0) return;
    const t = (tickets as any[]).find((x) => x.id === autoOpenTicketId);
    if (t) {
      setSelected(t);
      autoOpenedRef.current = true;
    }
  }, [autoOpenTicketId, tickets]);

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
