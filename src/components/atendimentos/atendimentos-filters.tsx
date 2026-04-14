import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronDown, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

export interface Filters {
  search: string;
  status: string;
  tipo: string;
  cliente: string;
  ramal: string;
  dataInicial: Date;
  dataFinal: Date;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  availableTipos: string[];
  availableRamais: string[];
  onRefetch: () => void;
}

function DatePicker({
  value,
  onChange,
  label,
}: {
  value: Date;
  onChange: (d: Date) => void;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          locale={ptBR}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export function AtendimentosFilters({
  filters,
  onChange,
  availableTipos,
  availableRamais,
  onRefetch,
}: Props) {
  const [open, setOpen] = useState(false);

  const set = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.status !== "todos") c++;
    if (filters.tipo !== "todos") c++;
    if (filters.cliente) c++;
    if (filters.ramal !== "todos") c++;
    return c;
  }, [filters]);

  const clearAll = () =>
    onChange({
      ...filters,
      status: "todos",
      tipo: "todos",
      cliente: "",
      ramal: "todos",
      search: "",
    });

  return (
    <div className="space-y-3">
      {/* Top row: search + date range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Buscar por descrição, cliente, placa..."
            className="pl-3"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        <DatePicker
          value={filters.dataInicial}
          onChange={(d) => {
            set({ dataInicial: d });
            onRefetch();
          }}
          label="Data Inicial"
        />
        <DatePicker
          value={filters.dataFinal}
          onChange={(d) => {
            set({ dataFinal: d });
            onRefetch();
          }}
          label="Data Final"
        />
      </div>

      {/* Collapsible advanced filters */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <Filter className="h-4 w-4" />
              Filtros
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeCount}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  open && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-xs text-muted-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(v) => set({ status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="andamento">Em Andamento</SelectItem>
                  <SelectItem value="resolvida">Resolvida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo
              </label>
              <Select
                value={filters.tipo}
                onValueChange={(v) => set({ tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {availableTipos.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Cliente
              </label>
              <Input
                placeholder="Filtrar por cliente"
                value={filters.cliente}
                onChange={(e) => set({ cliente: e.target.value })}
              />
            </div>

            {/* Ramal */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Ramal / Operador
              </label>
              <Select
                value={filters.ramal}
                onValueChange={(v) => set({ ramal: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {availableRamais.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
