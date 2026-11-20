import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TableColumn } from "@/lib/table-columns";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";

const LABEL: Record<string, string> = { vincular: "Vinculação", desvincular: "Desvinculação", kit_adicionar: "Kit: adicionado", kit_remover: "Kit: removido", desvincular_chip: "Chip desvinculado" };

type H = {
  id: string; created_at: string; operacao: string; equipamento_codigo: number | null; equipamento_serie: string | null;
  equipamento_modelo: string | null; chip: string | null; placa: string | null; acessorios: unknown;
  user_name: string | null; sucesso: boolean; erro: string | null;
};

function detalhe(r: H): string {
  const a = r.acessorios as any;
  return a?.nome ? `${a.nome}: ${a.de} → ${a.para}` : "";
}

const COLUMNS: TableColumn<H>[] = [
  { id: "data", label: "Data/hora", value: (r) => new Date(r.created_at).toLocaleString("pt-BR") },
  { id: "operacao", label: "Operação", value: (r) => LABEL[r.operacao] ?? r.operacao },
  { id: "equipamento", label: "Equipamento", value: (r) => `${r.equipamento_codigo ?? ""} · ${r.equipamento_serie ?? ""}` },
  { id: "modelo", label: "Modelo", value: (r) => r.equipamento_modelo },
  { id: "chip", label: "Chip", value: (r) => r.chip },
  { id: "placa", label: "Placa", value: (r) => r.placa },
  { id: "detalhe", label: "Detalhe", value: detalhe },
  { id: "usuario", label: "Usuário", value: (r) => r.user_name },
  { id: "resultado", label: "Resultado", value: (r) => (r.sucesso ? "OK" : "Falhou") },
  { id: "erro", label: "Erro", value: (r) => r.erro, defaultHidden: true },
];

export function VinculosHistoricoTab() {
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["estoque-historico"],
    queryFn: async () => ((await supabase.from("gsystem_vinculos_historico").select("*").order("created_at", { ascending: false }).limit(500)).data ?? []) as H[],
  });
  const s = q.toLowerCase().trim();
  const searched = s ? data.filter((r) => [r.equipamento_codigo, r.equipamento_serie, r.placa, r.chip, r.user_name].some((v) => String(v ?? "").toLowerCase().includes(s))) : data;
  const table = useTableColumns("estoque-historico", COLUMNS, searched);
  const rows = table.filteredRows;
  return (
    <div className="space-y-3">
      <TableToolbar state={table} fileName="estoque-historico" count={rows.length}>
        <Input className="max-w-sm mr-auto" placeholder="Buscar por ID, série, placa, chip ou usuário" value={q} onChange={(e) => setQ(e.target.value)} />
      </TableToolbar>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            {table.visibleColumns.map((c) => <TableHead key={c.id}><ColumnFilterHeader column={c} state={table} /></TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={table.visibleColumns.length || 1} className="text-center py-8 text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>
            ) : rows.map((r) => {
              const cells: Record<string, React.ReactNode> = {
                data: <TableCell key="data" className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>,
                operacao: <TableCell key="operacao" className="text-xs">{LABEL[r.operacao] ?? r.operacao}</TableCell>,
                equipamento: <TableCell key="equipamento" className="text-xs">{r.equipamento_codigo} · {r.equipamento_serie}</TableCell>,
                modelo: <TableCell key="modelo" className="text-xs">{r.equipamento_modelo ?? "—"}</TableCell>,
                chip: <TableCell key="chip" className="text-xs max-w-[160px] truncate">{r.chip ?? "—"}</TableCell>,
                placa: <TableCell key="placa" className="text-xs font-mono">{r.placa ?? "—"}</TableCell>,
                detalhe: <TableCell key="detalhe" className="text-xs">{detalhe(r) || "—"}</TableCell>,
                usuario: <TableCell key="usuario" className="text-xs">{r.user_name ?? "—"}</TableCell>,
                resultado: <TableCell key="resultado">{r.sucesso ? <Badge variant="outline">OK</Badge> : <Badge variant="destructive" title={r.erro ?? ""}>Falhou</Badge>}</TableCell>,
                erro: <TableCell key="erro" className="text-xs max-w-[220px] truncate" title={r.erro ?? ""}>{r.erro ?? "—"}</TableCell>,
              };
              return <TableRow key={r.id}>{table.visibleColumns.map((c) => cells[c.id])}</TableRow>;
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
