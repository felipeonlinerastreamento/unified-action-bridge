import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TableColumnsState } from "./use-table-columns";

export function ColumnPicker<T>({ state }: { state: TableColumnsState<T> }) {
  const total = state.columns.length;
  const shown = state.visibleIds.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4 mr-1" /> Colunas ({shown}/{total})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {state.columns.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={state.visibleIds.includes(c.id)}
            onCheckedChange={() => state.toggleColumn(c.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); state.showAll(); }}>Mostrar todas</DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); state.resetColumns(); }}>Restaurar padrão</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
