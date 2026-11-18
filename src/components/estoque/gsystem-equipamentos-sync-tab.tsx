import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { triggerGsystemEquipamentosSync } from "@/lib/gsystem-equipamentos-sync.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2, Search, DatabaseZap, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TableColumn } from "@/lib/table-columns";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";

interface EquipRow {
  codigo: number;
  display_name: string | null;
  equipamento: string | null;
  serie: string | null;
  observacao: string | null;
  comunicacao: string | null;
  empresa: any;
  synced_at: string;
}

interface SyncStatus {
  id: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_success_at: string | null;
  items_count: number | null;
  last_error: string | null;
}

function empresaName(e: any): string {
  return typeof e === "object" && e ? String(e.DisplayName ?? e.Nome ?? "") : "";
}

const COLUMNS: TableColumn<EquipRow>[] = [
  { id: "codigo", label: "Código", value: (r) => r.codigo },
  { id: "nome", label: "Nome", value: (r) => r.display_name },
  { id: "modelo", label: "Modelo", value: (r) => r.equipamento },
  { id: "serie", label: "Série", value: (r) => r.serie },
  { id: "comunicacao", label: "Comunicação", value: (r) => r.comunicacao },
  { id: "empresa", label: "Empresa", value: (r) => empresaName(r.empresa) },
  { id: "observacao", label: "Observação", value: (r) => r.observacao, defaultHidden: true },
  { id: "synced", label: "Sincronizado em", value: (r) => (r.synced_at ? new Date(r.synced_at).toLocaleString("pt-BR") : ""), defaultHidden: true },
];

export function GsystemEquipamentosSyncTab({ canSync }: { canSync: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const syncFn = useServerFn(triggerGsystemEquipamentosSync);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["gsystem-equipamentos-mirror"],
    queryFn: async (): Promise<EquipRow[]> => {
      const { data, error } = await supabase
        .from("gsystem_equipamentos" as any)
        .select("codigo, display_name, equipamento, serie, observacao, comunicacao, empresa, synced_at")
        .order("display_name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 30_000,
  });

  const { data: status } = useQuery({
    queryKey: ["gsystem-sync-status", "equipamentos"],
    queryFn: async (): Promise<SyncStatus | null> => {
      const { data } = await supabase
        .from("gsystem_sync_status" as any)
        .select("*")
        .eq("id", "equipamentos")
        .maybeSingle();
      return (data as any) ?? null;
    },
    refetchInterval: 30_000,
  });

  const syncMut = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success(`Sincronizado: ${res.itemsCount} itens (${res.removed} removidos)`);
      } else {
        toast.error(`Falha: ${res?.error ?? "erro desconhecido"}`);
      }
      qc.invalidateQueries({ queryKey: ["gsystem-equipamentos-mirror"] });
      qc.invalidateQueries({ queryKey: ["gsystem-sync-status", "equipamentos"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao sincronizar"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.display_name, r.equipamento, r.serie, r.observacao, r.comunicacao, String(r.codigo)]
        .some((v) => v && String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const table = useTableColumns("estoque-sincronizados", COLUMNS, filtered);
  const finalRows = table.filteredRows;

  const lastSync = status?.last_success_at ? new Date(status.last_success_at) : null;
  const running = status?.last_started_at && status?.last_finished_at
    ? new Date(status.last_started_at) > new Date(status.last_finished_at)
    : !!status?.last_started_at && !status?.last_finished_at;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 text-sm">
            <DatabaseZap className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Espelho local do GSystem</p>
              <p className="text-xs text-muted-foreground">
                Sincroniza automaticamente a cada 15 minutos. Consultas nesta aba são instantâneas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {status?.last_error ? (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Último erro: {status.last_error.slice(0, 80)}
              </span>
            ) : lastSync ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Última sync {formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}
                {typeof status?.items_count === "number" && ` — ${status.items_count} itens`}
              </span>
            ) : (
              <span className="text-muted-foreground">Nunca sincronizado</span>
            )}
            {canSync && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending || running}
              >
                {syncMut.isPending || running ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sincronizar agora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <TableToolbar state={table} fileName="estoque-sincronizados" count={finalRows.length}>
      <div className="relative max-w-sm flex-1 mr-auto">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por série, nome, modelo, código..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      </TableToolbar>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : finalRows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum equipamento encontrado.{" "}
              {rows.length === 0 && canSync && "Clique em \"Sincronizar agora\" para importar."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {table.visibleColumns.map((c) => (
                    <TableHead key={c.id} className={c.id === "codigo" ? "w-24" : undefined}>
                      <ColumnFilterHeader column={c} state={table} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalRows.slice(0, 500).map((r) => {
                  const cells: Record<string, React.ReactNode> = {
                    codigo: <TableCell key="codigo" className="font-mono text-xs">{r.codigo}</TableCell>,
                    nome: <TableCell key="nome" className="font-medium">{r.display_name ?? "—"}</TableCell>,
                    modelo: <TableCell key="modelo">{r.equipamento ?? "—"}</TableCell>,
                    serie: <TableCell key="serie" className="font-mono text-xs">{r.serie ?? "—"}</TableCell>,
                    comunicacao: <TableCell key="comunicacao">{r.comunicacao ? <Badge variant="outline">{r.comunicacao}</Badge> : "—"}</TableCell>,
                    empresa: <TableCell key="empresa" className="text-xs text-muted-foreground">{empresaName(r.empresa) || "—"}</TableCell>,
                    observacao: <TableCell key="observacao" className="text-xs max-w-[220px] truncate" title={r.observacao ?? ""}>{r.observacao ?? "—"}</TableCell>,
                    synced: <TableCell key="synced" className="text-xs whitespace-nowrap">{r.synced_at ? new Date(r.synced_at).toLocaleString("pt-BR") : "—"}</TableCell>,
                  };
                  return <TableRow key={r.codigo}>{table.visibleColumns.map((c) => cells[c.id])}</TableRow>;
                })}
              </TableBody>
            </Table>
          )}
          {finalRows.length > 500 && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              Exibindo 500 de {finalRows.length} resultados na tela — a exportação para Excel inclui todos.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
