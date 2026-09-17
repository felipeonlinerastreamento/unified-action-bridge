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

  const periodDays = filters.periodDays;

  const { data: tickets = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["service-tickets", periodDays],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const cutoff =
        periodDays === null
          ? null
          : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

      // Paginar para evitar o teto padrão do PostgREST (1000 linhas)
      const PAGE = 1000;
      let from = 0;
      const list: any[] = [];
      // hard cap defensivo (20k) — evita loop infinito em cenários anômalos
      while (from < 20000) {
        let q = supabase
          .from("service_tickets")
          .select("*, companies(name), ticket_tracking(last_status, last_status_date, last_location, is_delivered, tracking_code)");
        if (cutoff) {
          // Sempre inclui os que continuam abertos, mesmo fora da janela
          q = q.or(`created_at.gte.${cutoff},status.in.(aberto,em_andamento,reaberto)`);
        }
        const { data, error } = await q
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data || [];
        list.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }

      const ids = list.map((t: any) => t.id);
      const lastByTicket: Record<string, string> = {};
      const liberacaoByTicket: Record<string, any[]> = {};
      const suprimentoByTicket: Record<string, any[]> = {};
      const compraEquipByTicket: Record<string, any[]> = {};
      const purchaseItemsByTicket: Record<string, any[]> = {};
      const purchaseRequestByTicket: Record<string, any> = {};
      const agentsByTicket: Record<string, string[]> = {};
      const recurringSet = new Set<string>();
      const controleTicketSet = new Set<string>();

      if (ids.length > 0) {
        const idSet = new Set(ids);

        // Uma chamada por tabela auxiliar, todas em paralelo.
        const [
          commentsRes,
          libRes,
          supRes,
          ceRes,
          piRes,
          prRes,
          agentsRes,
          remRes,
          linksRes,
        ] = await Promise.all([
          (() => {
            let q = supabase.from("ticket_comments").select("ticket_id, created_at");
            if (cutoff) q = q.gte("created_at", cutoff);
            return q.order("created_at", { ascending: false }).limit(20000);
          })(),
          supabase.from("ticket_liberacao_items" as any).select("ticket_id, status, quantity, item_name, liberado_at"),
          supabase.from("ticket_suprimento_items" as any).select("ticket_id, status, quantity, item_name, delivered_at"),
          supabase.from("ticket_compra_equipamento_items" as any).select("ticket_id, status, quantity, item_name, delivered_at"),
          supabase.from("ticket_purchase_items" as any).select("ticket_id, status, quantity, item_name, delivered_at"),
          supabase.from("ticket_purchase_requests" as any).select("ticket_id, status, tracking_code, expected_delivery, freight"),
          supabase.from("ticket_agents" as any).select("ticket_id, user_id"),
          supabase
            .from("ticket_reminders" as any)
            .select("ticket_id, recurrence_type, is_dismissed")
            .eq("is_dismissed", false)
            .not("recurrence_type", "is", null)
            .neq("recurrence_type", "none"),
          supabase.from("chat_controle_links" as any).select("ticket_id").not("ticket_id", "is", null),
        ]);

        for (const c of ((commentsRes.data as any[]) || [])) {
          if (!idSet.has(c.ticket_id)) continue;
          if (!lastByTicket[c.ticket_id]) lastByTicket[c.ticket_id] = c.created_at;
        }
        const push = (map: Record<string, any[]>, rows: any[] | null) => {
          for (const it of rows || []) {
            if (!idSet.has(it.ticket_id)) continue;
            if (!map[it.ticket_id]) map[it.ticket_id] = [];
            map[it.ticket_id].push(it);
          }
        };
        push(liberacaoByTicket, libRes.data as any[]);
        push(suprimentoByTicket, supRes.data as any[]);
        push(compraEquipByTicket, ceRes.data as any[]);
        push(purchaseItemsByTicket, piRes.data as any[]);
        for (const r of ((prRes.data as any[]) || [])) {
          if (idSet.has(r.ticket_id)) purchaseRequestByTicket[r.ticket_id] = r;
        }
        for (const a of ((agentsRes.data as any[]) || [])) {
          if (!idSet.has(a.ticket_id)) continue;
          if (!agentsByTicket[a.ticket_id]) agentsByTicket[a.ticket_id] = [];
          agentsByTicket[a.ticket_id].push(a.user_id);
        }
        for (const r of ((remRes.data as any[]) || [])) {
          if (r.ticket_id) recurringSet.add(r.ticket_id);
        }
        for (const l of ((linksRes.data as any[]) || [])) {
          if (l.ticket_id) controleTicketSet.add(l.ticket_id);
        }
      }

      return list.map((t: any) => ({
        ...t,
        last_comment_at: lastByTicket[t.id] || null,
        liberacao_items: liberacaoByTicket[t.id] || [],
        suprimento_items: suprimentoByTicket[t.id] || [],
        compra_equipamento_items: compraEquipByTicket[t.id] || [],
        purchase_items: purchaseItemsByTicket[t.id] || [],
        purchase_request: purchaseRequestByTicket[t.id] || null,
        agent_user_ids: agentsByTicket[t.id] || [],
        is_recurring: recurringSet.has(t.id),
        has_controle_sheet: controleTicketSet.has(t.id),
      }));
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
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
        const { data } = await supabase.from("profiles").select("*").eq("is_active", true).eq("panel_only", false);
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
      <TicketKpis
        tickets={filteredTickets}
        activeStatus={filters.status}
        onStatusClick={(status) => setFilters((f) => ({ ...f, status: f.status === status ? "todos" : status }))}
      />

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
