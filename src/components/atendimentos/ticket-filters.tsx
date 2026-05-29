import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProtocol, formatTicketProtocol } from "@/lib/protocol-format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface TicketFilters {
  search: string;
  status: string;
  priority: string;
  category: string;
  sector: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  contactPhone: string;
  assignedTo: string;
  trackingStatus: string;
  recurring: string;
}

export const defaultFilters: TicketFilters = {
  search: "",
  status: "abertos_em_andamento",
  priority: "todos",
  category: "todos",
  sector: "todos",
  dateFrom: undefined,
  dateTo: undefined,
  contactPhone: "",
  assignedTo: "todos",
  trackingStatus: "todos",
  recurring: "todos",
};

interface Props {
  filters: TicketFilters;
  onChange: (f: TicketFilters) => void;
  tickets: any[];
  profiles: any[];
  open: boolean;
  onToggle: () => void;
}

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "abertos_em_andamento", label: "Aberto + Em Andamento" },
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "finalizado", label: "Finalizado" },
  { value: "reaberto", label: "Reaberto" },
];

const PRIORITY_OPTIONS = [
  { value: "todos", label: "Todas" },
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

function DatePicker({ value, onChange, label }: { value: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => onChange(d)}
          locale={ptBR}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export function TicketFiltersBar({ filters, onChange, tickets, profiles, open, onToggle }: Props) {
  const set = (partial: Partial<TicketFilters>) => onChange({ ...filters, ...partial });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    tickets.forEach((t: any) => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [tickets]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t: any) => { if (t.sector) s.add(t.sector); });
    return Array.from(s).sort();
  }, [tickets]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.status !== "todos" && filters.status !== "abertos_em_andamento") c++;
    if (filters.priority !== "todos") c++;
    if (filters.category !== "todos") c++;
    if (filters.sector !== "todos") c++;
    if (filters.dateFrom) c++;
    if (filters.dateTo) c++;
    if (filters.contactPhone) c++;
    if (filters.assignedTo !== "todos") c++;
    if (filters.search) c++;
    if (filters.trackingStatus !== "todos") c++;
    if (filters.recurring !== "todos") c++;
    return c;
  }, [filters]);

  const showTrackingFilter = filters.category !== "todos" && filters.category.toLowerCase().includes("correios");

  const clearAll = () => onChange({ ...defaultFilters });

  return (
    <div className="space-y-3">
      {/* Search bar + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo, nome, descrição, placa, telefone..."
            className="pl-9 h-9"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onToggle} className="gap-1.5 h-9">
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground h-9 gap-1">
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {/* Collapsible filters panel */}
      <Collapsible open={open}>
        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 rounded-lg border bg-muted/30">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={filters.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select value={filters.priority} onValueChange={(v) => set({ priority: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Categoria</label>
              <Select value={filters.category} onValueChange={(v) => set({ category: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Setor</label>
              <Select value={filters.sector} onValueChange={(v) => set({ sector: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assigned to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Responsável</label>
              <Select value={filters.assignedTo} onValueChange={(v) => set({ assignedTo: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recurring */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Recorrente</label>
              <Select value={filters.recurring} onValueChange={(v) => set({ recurring: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sim">Apenas recorrentes</SelectItem>
                  <SelectItem value="nao">Não recorrentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Início</label>
              <DatePicker value={filters.dateFrom} onChange={(d) => set({ dateFrom: d })} label="De" />
            </div>

            {/* Date to */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
              <DatePicker value={filters.dateTo} onChange={(d) => set({ dateTo: d })} label="Até" />
            </div>

            {/* Contact phone */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <Input
                placeholder="Nº contato"
                className="h-9 text-sm"
                value={filters.contactPhone}
                onChange={(e) => set({ contactPhone: e.target.value })}
              />
            </div>
            {showTrackingFilter && (
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Status do Envio (Sedex)</label>
                <Select value={filters.trackingStatus} onValueChange={(v) => set({ trackingStatus: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="em_transito">Em trânsito</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="problema">Problema</SelectItem>
                    <SelectItem value="sem_codigo">Sem código</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** Apply filters to tickets array */
export function applyTicketFilters(tickets: any[], filters: TicketFilters): any[] {
  // When the search bar has any text, ignore all other filters and match only by search
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().replace(/^#/, "").trim();
    return tickets.filter((t) => {
      const protocolNumber = formatTicketProtocol(t);
      const protocolFromAttendance = t.attendance_id ? formatProtocol(t.attendance_id) : "";
      const protocolFromId = t.id ? formatProtocol(t.id) : "";
      const searchable = [
        t.contact_name, t.notes, t.plate, t.contact_phone,
        t.attendance_id, t.category, t.sector, t.companies?.name,
        t.protocol, protocolNumber, protocolFromAttendance, protocolFromId,
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }

  return tickets.filter((t) => {

    // Status
    if (filters.status === "abertos_em_andamento") {
      if (t.status !== "aberto" && t.status !== "em_andamento" && t.status !== "reaberto") return false;
    } else if (filters.status !== "todos" && t.status !== filters.status) return false;

    // Priority
    if (filters.priority !== "todos" && (t.priority || "media") !== filters.priority) return false;

    // Category
    if (filters.category !== "todos" && t.category !== filters.category) return false;

    // Recurring
    if (filters.recurring === "sim" && !t.is_recurring) return false;
    if (filters.recurring === "nao" && t.is_recurring) return false;

    // Sector
    if (filters.sector !== "todos" && t.sector !== filters.sector) return false;

    // Assigned to (responsável principal OU agente adicional)
    if (filters.assignedTo !== "todos") {
      const agentIds: string[] = Array.isArray(t.agent_user_ids) ? t.agent_user_ids : [];
      if (t.assigned_to !== filters.assignedTo && !agentIds.includes(filters.assignedTo)) return false;
    }

    // Contact phone
    if (filters.contactPhone) {
      const phone = (t.contact_phone || "").replace(/\D/g, "");
      const filter = filters.contactPhone.replace(/\D/g, "");
      if (!phone.includes(filter)) return false;
    }

    // Date range
    if (filters.dateFrom) {
      const created = new Date(t.created_at);
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      if (created < from) return false;
    }
    if (filters.dateTo) {
      const created = new Date(t.created_at);
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (created > to) return false;
    }

    // Tracking status (only meaningful for Correios)
    if (filters.trackingStatus !== "todos") {
      const tr = Array.isArray(t.ticket_tracking) ? t.ticket_tracking[0] : t.ticket_tracking;
      const status = (tr?.last_status || "").toLowerCase();
      const delivered = !!tr?.is_delivered;
      const hasCode = !!t.tracking_code;
      switch (filters.trackingStatus) {
        case "entregue":
          if (!delivered) return false;
          break;
        case "em_transito":
          if (!hasCode || delivered) return false;
          if (status && (status.includes("falha") || status.includes("erro") || status.includes("devolv"))) return false;
          break;
        case "problema":
          if (!status) return false;
          if (!(status.includes("falha") || status.includes("erro") || status.includes("ausent") || status.includes("devolv"))) return false;
          break;
        case "sem_codigo":
          if (hasCode) return false;
          break;
      }
    }

    return true;
  });
}
