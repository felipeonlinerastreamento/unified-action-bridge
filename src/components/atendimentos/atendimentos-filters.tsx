import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export interface Filters {
  search: string;
  status: string;
  tipo: string;
  cliente: string;
  ramal: string;
  setor: string;
  dataInicial: Date;
  dataFinal: Date;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  availableTipos: string[];
  availableRamais: string[];
  availableSetores: string[];
  onRefetch: () => void;
}

const STATUS_CHIPS = [
  { value: "todos", label: "Todos" },
  { value: "aberta", label: "Em Aberto" },
  { value: "andamento", label: "Em Andamento" },
  { value: "resolvida", label: "Resolvido" },
  { value: "cancelada", label: "Cancelado" },
];

function DatePicker({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
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

export function AtendimentosFilters({ filters, onChange, availableTipos, availableRamais, availableSetores, onRefetch }: Props) {
  const set = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.status !== "todos") c++;
    if (filters.tipo !== "todos") c++;
    if (filters.cliente) c++;
    if (filters.ramal !== "todos") c++;
    if (filters.setor !== "todos") c++;
    return c;
  }, [filters]);

  const clearAll = () =>
    onChange({ ...filters, status: "todos", tipo: "todos", cliente: "", ramal: "todos", setor: "todos", search: "" });

  return (
    <div className="space-y-3">
      {/* Row 1: Search + Dates */}
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
          onChange={(d) => { set({ dataInicial: d }); onRefetch(); }}
          label="Data Inicial"
        />
        <DatePicker
          value={filters.dataFinal}
          onChange={(d) => { set({ dataFinal: d }); onRefetch(); }}
          label="Data Final"
        />
      </div>

      {/* Row 2: Status chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_CHIPS.map((chip) => (
          <Button
            key={chip.value}
            size="sm"
            variant={filters.status === chip.value ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => set({ status: chip.value })}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Row 3: Selects */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">Setor</label>
          <Select value={filters.setor} onValueChange={(v) => set({ setor: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {availableSetores.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">Operador</label>
          <Select value={filters.ramal} onValueChange={(v) => set({ ramal: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {availableRamais.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={filters.tipo} onValueChange={(v) => set({ tipo: v })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {availableTipos.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-[160px] flex-1 max-w-[240px]">
          <label className="text-xs font-medium text-muted-foreground">Cliente</label>
          <Input
            placeholder="Filtrar por cliente"
            className="h-9"
            value={filters.cliente}
            onChange={(e) => set({ cliente: e.target.value })}
          />
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground h-9">
            <X className="h-3 w-3 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
