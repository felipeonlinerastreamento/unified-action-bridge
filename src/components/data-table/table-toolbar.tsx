import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColumnPicker } from "./column-picker";
import { ExportExcelButton } from "./export-excel-button";
import type { TableColumnsState } from "./use-table-columns";

/** Column picker + "limpar filtros de coluna" + Excel export, shown above a table. */
export function TableToolbar<T>({ state, fileName, count, children }: {
  state: TableColumnsState<T>; fileName: string; count?: number; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {children}
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground mr-auto">{count.toLocaleString("pt-BR")} registro(s)</span>
      )}
      {state.activeFilters > 0 && (
        <Button variant="ghost" size="sm" onClick={state.clearFilters}>
          <X className="h-4 w-4 mr-1" /> Limpar filtros de coluna ({state.activeFilters})
        </Button>
      )}
      <ColumnPicker state={state} />
      <ExportExcelButton state={state} fileName={fileName} />
    </div>
  );
}
