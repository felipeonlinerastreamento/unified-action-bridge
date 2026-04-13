import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPendencias } from "@/lib/gsystem-api.functions";
import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/atendimentos")({
  component: AtendimentosPage,
});

function AtendimentosPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("aberto");
  const [selected, setSelected] = useState<any>(null);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["gsystem-pendencias"],
    queryFn: async () => {
      const now = new Date();
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      return getPendencias({
        data: { dataInicial: fmt(past), dataFinal: fmt(now) },
        ...await getAuthHeaders(),
      });
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const pendencias = useMemo(() => {
    if (!data) return [];
    const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
    return list.filter((p: any) => {
      const matchSearch =
        !search ||
        JSON.stringify(p).toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "todos" ||
        (p.Status ?? p.status ?? "")
          .toString()
          .toLowerCase()
          .includes(statusFilter.toLowerCase());
      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  if (authLoading || !isAuthenticated) return null;

  const getStatusBadge = (status: string) => {
    const s = (status ?? "").toLowerCase();
    if (s.includes("cancel")) return <Badge variant="destructive">Cancelado</Badge>;
    if (s.includes("finaliz") || s.includes("resolv") || s.includes("conclu"))
      return <Badge className="bg-green-600 text-white">Finalizado</Badge>;
    if (s.includes("andamento") || s.includes("progress"))
      return <Badge className="bg-amber-500 text-white">Em Andamento</Badge>;
    return <Badge variant="secondary">Aberto</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
            <p className="text-sm text-muted-foreground">
              Pendências em aberto no GSystem
              {pendencias.length > 0 && ` — ${pendencias.length} registro(s)`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, cliente..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="andamento">Em Andamento</SelectItem>
              <SelectItem value="finaliz">Finalizado</SelectItem>
              <SelectItem value="cancel">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando pendências do GSystem...</p>
            </CardContent>
          </Card>
        ) : isError ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm text-destructive">
                Erro ao carregar pendências: {(error as Error)?.message ?? "Erro desconhecido"}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : pendencias.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma pendência encontrada com os filtros selecionados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {pendencias.map((p: any, idx: number) => {
              const key = p.Id ?? p.id ?? p.Codigo ?? idx;
              const title =
                p.Descricao ?? p.descricao ?? p.Titulo ?? p.titulo ?? p.Description ?? `Pendência #${key}`;
              const status = p.Status ?? p.status ?? "Aberto";
              const client =
                p.Cliente ?? p.cliente ?? p.NomeCliente ?? p.nomeCliente ?? "";
              const date =
                p.DataCriacao ?? p.dataCriacao ?? p.Data ?? p.data ?? p.CreatedAt ?? "";
              const plate = p.Placa ?? p.placa ?? "";

              return (
                <Card
                  key={key}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelected(p)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{title}</span>
                          {getStatusBadge(status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {client && <span>Cliente: {client}</span>}
                          {plate && <span>Placa: {plate}</span>}
                          {date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(date).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        #{key}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Pendência #{selected?.Id ?? selected?.id ?? selected?.Codigo ?? ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-medium text-muted-foreground min-w-[120px]">{k}:</span>
                  <span className="break-all">
                    {v === null || v === undefined
                      ? "—"
                      : typeof v === "object"
                        ? JSON.stringify(v, null, 2)
                        : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
