import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildExportSheet } from "@/lib/table-columns";
import type { TableColumnsState } from "./use-table-columns";

/** Exports the filtered rows with the visible columns to a real .xlsx file. */
export function ExportExcelButton<T>({ state, fileName, rows }: { state: TableColumnsState<T>; fileName: string; rows?: T[] }) {
  const [busy, setBusy] = useState(false);
  const data = rows ?? state.filteredRows;

  const run = async () => {
    if (!data.length) { toast.error("Sem dados para exportar"); return; }
    setBusy(true);
    try {
      const sheet = buildExportSheet(data, state.columns, state.visibleIds);
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const sheetData = [
        sheet.headers.map((h) => ({ value: h, fontWeight: "bold" as const })),
        ...sheet.rows,
      ];
      const stamp = new Date().toISOString().slice(0, 10);
      await writeXlsxFile(sheetData, {
        columns: sheet.headers.map((h) => ({ width: Math.min(45, Math.max(10, h.length + 4)) })),
        stickyRowsCount: 1,
      }).toFile(`${fileName}-${stamp}.xlsx`);
      toast.success(`${data.length.toLocaleString("pt-BR")} linha(s) exportada(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar Excel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
      Exportar Excel
    </Button>
  );
}
