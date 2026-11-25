import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

export type LogNotificacao = {
  id: string; sent_at: string; client_name: string; plates: string[] | null; channels: string[] | null;
  template_name: string; sent_by: string; status: string; error_message: string | null;
};

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const STATUS: Record<string, string> = { success: "Enviado", partial: "Parcial", error: "Não enviado" };
const statusDe = (h: LogNotificacao) => STATUS[h.status] ?? h.status;
const naoEnviado = (h: LogNotificacao) => h.status === "error" || h.status === "partial";

const COLUNAS: TableColumn<LogNotificacao>[] = [
  { id: "quando", label: "Quando", value: (h) => fmt(h.sent_at) },
  { id: "cliente", label: "Cliente", value: (h) => h.client_name },
  { id: "placas", label: "Placas", value: (h) => (h.plates || []).length },
  { id: "lista_placas", label: "Lista de placas", value: (h) => (h.plates || []).join(", "), defaultHidden: true },
  { id: "canais", label: "Canais", value: (h) => (h.channels || []).join(", ") },
  { id: "modelo", label: "Modelo", value: (h) => h.template_name },
  { id: "por", label: "Por", value: (h) => h.sent_by },
  { id: "status", label: "Status", value: statusDe },
  { id: "motivo", label: "Motivo / falha", value: (h) => h.error_message || "" },
];

const TAMANHOS = ["50", "100", "todos"] as const;

/** Histórico do Reconnect: páginas de 50/100/todos, filtro por coluna e atalho "Não enviados". */
export function HistoricoNotificacoes({ historico }: { historico: LogNotificacao[] }) {
  const [soFalhas, setSoFalhas] = useState(false);
  const [tamanho, setTamanho] = useState<(typeof TAMANHOS)[number]>("50");
  const [pagina, setPagina] = useState(0);
  const base = useMemo(() => (soFalhas ? historico.filter(naoEnviado) : historico), [historico, soFalhas]);
  const tabela = useTableColumns("reconnect-historico", COLUNAS, base);
  const linhas = tabela.filteredRows;
  const porPagina = tamanho === "todos" ? Math.max(linhas.length, 1) : Number(tamanho);
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  useEffect(() => { setPagina(0); }, [soFalhas, tamanho, tabela.filters]);
  const p = Math.min(pagina, totalPaginas - 1);
  const visiveis = linhas.slice(p * porPagina, p * porPagina + porPagina);
  const falhas = historico.filter(naoEnviado).length;

  const celula = (h: LogNotificacao, id: string) => {
    switch (id) {
      case "quando": return <TableCell key={id} className="text-xs whitespace-nowrap">{fmt(h.sent_at)}</TableCell>;
      case "cliente": return <TableCell key={id} className="text-xs">{h.client_name}</TableCell>;
      case "placas": return <TableCell key={id} className="text-xs" title={(h.plates || []).join(", ")}>{(h.plates || []).length}</TableCell>;
      case "lista_placas": return <TableCell key={id} className="text-xs max-w-[260px] truncate" title={(h.plates || []).join(", ")}>{(h.plates || []).join(", ")}</TableCell>;
      case "canais": return <TableCell key={id} className="text-xs">{(h.channels || []).join(", ") || "—"}</TableCell>;
      case "modelo": return <TableCell key={id} className="text-xs">{h.template_name}</TableCell>;
      case "por": return <TableCell key={id} className="text-xs">{h.sent_by}</TableCell>;
      case "status":
        return (
          <TableCell key={id} className="text-xs">
            {h.status === "error" ? <Badge variant="destructive">Não enviado</Badge> : h.status === "partial" ? <Badge variant="secondary">Parcial</Badge> : <Badge variant="outline">Enviado</Badge>}
          </TableCell>
        );
      case "motivo": return <TableCell key={id} className="text-xs max-w-[320px] text-muted-foreground break-words">{h.error_message || "—"}</TableCell>;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de notificações</CardTitle></CardHeader>
      <div className="px-4 pb-2">
        <TableToolbar state={tabela} fileName="reconnect-historico-notificacoes" count={linhas.length}>
          <Button size="sm" variant={soFalhas ? "default" : "outline"} onClick={() => setSoFalhas((x) => !x)}>
            Não enviados ({falhas})
          </Button>
        </TableToolbar>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {tabela.visibleColumns.map((c) => <TableHead key={c.id}><ColumnFilterHeader column={c} state={tabela} /></TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((h) => <TableRow key={h.id}>{tabela.visibleColumns.map((c) => celula(h, c.id))}</TableRow>)}
            {visiveis.length === 0 && (
              <TableRow><TableCell colSpan={tabela.visibleColumns.length} className="py-6 text-center text-xs text-muted-foreground">Nenhum registro com esses filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>Exibir</span>
        <Select value={tamanho} onValueChange={(v) => setTamanho(v as (typeof TAMANHOS)[number])}>
          <SelectTrigger className="h-7 w-[90px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <span>
          {linhas.length ? `${p * porPagina + 1}–${Math.min(linhas.length, (p + 1) * porPagina)} de ${linhas.length}` : "0 de 0"}
        </span>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={p === 0} onClick={() => setPagina(p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span>Página {p + 1} de {totalPaginas}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={p >= totalPaginas - 1} onClick={() => setPagina(p + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
