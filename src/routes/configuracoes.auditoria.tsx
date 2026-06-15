import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { listAuditLogs, exportAuditLogsCsv } from "@/lib/audit.functions";
import { Download, Eye, Loader2, ShieldAlert, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes/auditoria")({
  component: AuditoriaPage,
});

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "auth", label: "Login / Logout", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "presence", label: "Presença (Online/Offline)", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "central_atendimento", label: "Central de Atendimento", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "contact_link", label: "Vinculação de Contato", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "crm", label: "CRM", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "ticket", label: "Atendimento", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "task", label: "Tarefa", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "okr", label: "OKR", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "system", label: "Sistema", color: "bg-muted text-foreground border-border" },
];

function categoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

async function callAudit<T>(fn: any, payload: any): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  return fn({
    data: payload,
    headers: { authorization: `Bearer ${session?.access_token}` },
  });
}

function AuditoriaPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const canView = hasRole("admin") || hasRole("gestor");

  const [category, setCategory] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailRow, setDetailRow] = useState<any>(null);

  const [users, setUsers] = useState<{ user_id: string; name: string }[]>([]);
  useMemo(() => {
    if (!canView) return;
    supabase
      .from("profiles")
      .select("user_id, name")
      .order("name")
      .then(({ data }) => setUsers(data ?? []));
  }, [canView]);

  const filters = useMemo(
    () => ({
      categories: category === "all" ? undefined : [category],
      user_ids: userId === "all" ? undefined : [userId],
      search: search || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
    }),
    [category, userId, search, dateFrom, dateTo],
  );

  const query = useInfiniteQuery({
    queryKey: ["audit-logs", filters],
    enabled: canView,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      return callAudit<{ items: any[]; nextCursor: string | null }>(listAuditLogs, {
        ...filters,
        cursor: pageParam,
        limit: 50,
      });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = (query.data?.pages ?? []).flatMap((p) => p.items);

  async function handleExport() {
    try {
      const res = await callAudit<{ csv: string; count: number }>(exportAuditLogsCsv, filters);
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${res.count} registros exportados`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao exportar");
    }
  }

  if (isLoading || !isAuthenticated) return null;

  if (!canView) {
    return (
      <AppLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Sem permissão</p>
            <p className="text-sm text-muted-foreground">
              Apenas administradores e gestores podem acessar a auditoria.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Registro completo de ações realizadas no sistema.
            </p>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operador</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.name || u.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Busca</Label>
              <form
                onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
                className="flex gap-1"
              >
                <Input
                  placeholder="Nome do contato/grupo, telefone, evento..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <Button type="submit" size="sm" variant="secondary">Ok</Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Data/Hora</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Alvo</TableHead>
                    <TableHead className="w-[80px]">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!query.isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => {
                    const meta = categoryMeta(r.event_category);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{formatDate(r.created_at)}</TableCell>
                        <TableCell className="text-sm">{r.user_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.event_type}</TableCell>
                        <TableCell className="text-sm max-w-[260px] truncate" title={r.target_label || r.target_id || ""}>
                          {r.target_label || r.target_id || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => setDetailRow(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {query.hasNextPage && (
              <div className="p-3 border-t flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Data</div><div className="font-mono">{formatDate(detailRow.created_at)}</div></div>
                <div><div className="text-xs text-muted-foreground">Operador</div><div>{detailRow.user_name || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Categoria</div><div>{categoryMeta(detailRow.event_category).label}</div></div>
                <div><div className="text-xs text-muted-foreground">Evento</div><div className="font-mono">{detailRow.event_type}</div></div>
                <div><div className="text-xs text-muted-foreground">Alvo</div><div>{detailRow.target_label || detailRow.target_id || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">IP</div><div className="font-mono text-xs">{detailRow.ip_address || "—"}</div></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Metadados</div>
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-72">{JSON.stringify(detailRow.metadata, null, 2)}</pre>
              </div>
              {detailRow.user_agent && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">User Agent</div>
                  <div className="font-mono text-xs break-all">{detailRow.user_agent}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
