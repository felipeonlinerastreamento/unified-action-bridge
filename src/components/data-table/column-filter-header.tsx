import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { distinctOptions, isFilterActive, normalize, type TableColumn } from "@/lib/table-columns";
import type { TableColumnsState } from "./use-table-columns";
import { cn } from "@/lib/utils";

const MAX_OPTIONS = 300;

/** Column title with an Excel-like filter: "contém" text + checkbox list of values. */
export function ColumnFilterHeader<T>({ column, state }: { column: TableColumn<T>; state: TableColumnsState<T> }) {
  const current = state.filters[column.id];
  const active = isFilterActive(current);
  const [open, setOpen] = useState(false);

  if (column.data === false) return <span>{column.label}</span>;

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{column.label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")}
            aria-label={`Filtrar ${column.label}`}
          >
            <Filter className={cn("h-3.5 w-3.5", active && "fill-current")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          {open && <FilterBody column={column} state={state} onClose={() => setOpen(false)} />}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterBody<T>({ column, state, onClose }: { column: TableColumn<T>; state: TableColumnsState<T>; onClose: () => void }) {
  const current = state.filters[column.id];
  const options = useMemo(
    () => distinctOptions(state.rows, state.columns, state.filters, column.id),
    [state.rows, state.columns, state.filters, column.id],
  );
  const [text, setText] = useState(current?.text ?? "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(current?.values ?? options.map((o) => o.value)),
  );

  const shown = useMemo(() => {
    const s = normalize(search);
    return (s ? options.filter((o) => normalize(o.value).includes(s)) : options).slice(0, MAX_OPTIONS);
  }, [options, search]);

  const allShownChecked = shown.length > 0 && shown.every((o) => selected.has(o.value));

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    setSelected(next);
  };
  const toggleAllShown = () => {
    const next = new Set(selected);
    if (allShownChecked) shown.forEach((o) => next.delete(o.value));
    else shown.forEach((o) => next.add(o.value));
    setSelected(next);
  };

  const apply = () => {
    const allSelected = options.every((o) => selected.has(o.value));
    const values = allSelected ? undefined : [...selected];
    const t = text.trim();
    state.setFilter(column.id, t || values ? { text: t || undefined, values } : undefined);
    onClose();
  };
  const clear = () => { state.setFilter(column.id, undefined); onClose(); };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Filtrar “{column.label}”</p>
      <Input
        placeholder="Contém o texto…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
        className="h-8"
      />
      <div className="border-t pt-2 space-y-2">
        <Input placeholder="Buscar valor…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <Checkbox checked={allShownChecked} onCheckedChange={toggleAllShown} />
          Selecionar todos {search ? "(resultado da busca)" : ""}
        </label>
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {shown.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-muted">
              <Checkbox checked={selected.has(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="flex-1 truncate" title={o.value}>{o.value}</span>
              <span className="text-muted-foreground">{o.count}</span>
            </label>
          ))}
          {!shown.length && <p className="text-xs text-muted-foreground py-2">Nenhum valor.</p>}
          {options.length > MAX_OPTIONS && !search && (
            <p className="text-[11px] text-muted-foreground pt-1">Mostrando {MAX_OPTIONS} de {options.length}. Use a busca.</p>
          )}
        </div>
      </div>
      <div className="flex justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={clear}>Limpar</Button>
        <Button size="sm" onClick={apply} disabled={selected.size === 0 && !text.trim()}>Aplicar</Button>
      </div>
    </div>
  );
}
