import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPendencias } from "@/lib/gsystem-api.functions";
import { AtendimentosFilters, type Filters } from "./atendimentos-filters";

function defaultDates() {
  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 90);
  return { dataInicial: past, dataFinal: now };
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function AtendimentosContent() {
  const { dataInicial: defaultStart, dataFinal: defaultEnd } = defaultDates();

  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "todos",
    tipo: "todos",
    cliente: "",
    ramal: "todos",
    dataInicial: defaultStart,
    dataFinal: defaultEnd,
  });

  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [
      "gsystem-pendencias",
      fmt(filters.dataInicial),
      fmt(filters.dataFinal),
    ],
    queryFn: () =>
      getPendencias({
        data: {
          dataInicial: fmt(filters.dataInicial),
          dataFinal: fmt(filters.dataFinal),
        },
      }),
    refetchInterval: 30000,
  });

  const rawList = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data?.data ?? data?.items ?? [];
  }, [data]);

  // Extract dynamic filter options from the raw data
  const availableTipos = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach((p: any) => {
      const t = p.Tipo ?? p.tipo ?? p.TipoPendencia ?? "";
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [rawList]);

  const availableRamais = useMemo(() => {
    const set = new Set<string>();
    rawList.forEach((p: any) => {
      const r = p.Ramal ?? p.ramal ?? p.Operador ?? p.operador ?? "";
      if (r) set.add(String(r));
    });
    return Array.from(set).sort();
  }, [rawList]);

  // Apply client-side filters
  const pendencias = useMemo(() => {
    return rawList.filter((p: any) => {
      // Text search
      if (
        filters.search &&
        !JSON.stringify(p).toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // Status — match the GSystem status strings
      if (filters.status !== "todos") {
        const s = (p.Status ?? p.status ?? "").toString().toLowerCase();
        if (!s.includes(filters.status.toLowerCase())) return false;
      }

      // Tipo
      if (filters.tipo !== "todos") {
        const t = (
          p.Tipo ??
          p.tipo ??
          p.TipoPendencia ??
          ""
        ).toString();
        if (t !== filters.tipo) return false;
      }

      // Cliente
      if (filters.cliente) {
        const c = (
          p.Cliente ??
          p.cliente ??
          p.NomeCliente ??
          p.nomeCliente ??
          ""
        )
          .toString()
          .toLowerCase();
        if (!c.includes(filters.cliente.toLowerCase())) return false;
      }

      // Ramal
      if (filters.ramal !== "todos") {
        const r = (
          p.Ramal ??
          p.ramal ??
          p.Operador ??
          p.operador ??
          ""
        ).toString();
        if (r !== filters.ramal) return false;
      }

      return true;
    });
  }, [rawList, filters]);

  const getStatusBadge = (status: string) => {
    const s = (status ?? "").toLowerCase();
    if (s.includes("cancel"))
      return <Badge variant="destructive">Cancelada</Badge>;
    if (s.includes("resolv") || s.includes("finaliz") || s.includes("conclu"))
      return <Badge className="bg-green-600 text-white">Resolvida</Badge>;
    if (s.includes("andamento") || s.includes("progress"))
      return <Badge className="bg-amber-500 text-white">Em Andamento</Badge>;
    if (s.includes("aberta") || s.includes("aberto"))
      return <Badge variant="secondary">Aberta</Badge>;
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
          <p className="text-sm text-muted-foreground">
            Pendências do GSystem
            {pendencias.length > 0 && ` — ${pendencias.length} registro(s)`}
            {rawList.length !== pendencias.length &&
              ` de ${rawList.length} total`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      </div>

      <AtendimentosFilters
        filters={filters}
        onChange={setFilters}
        availableTipos={availableTipos}
        availableRamais={availableRamais}
        onRefetch={() => refetch()}
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Carregando pendências do GSystem...
            </p>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">
              Erro ao carregar pendências:{" "}
              {(error as Error)?.message ?? "Erro desconhecido"}
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
            const key = p.Codigo ?? p.Id ?? p.id ?? idx;
            const situacao = (p.Situacao ?? p.situacao ?? "").toString().split("\\r\\n")[0].substring(0, 120);
            const title = situacao || p.Descricao ?? p.descricao ?? p.Defeito ?? `Pendência #${key}`;
            const status = p.Status ?? p.status ?? "Aberta";
            const client = p.Cliente ?? p.cliente ?? p.NomeCliente ?? "";
            const date = p.DataOcorrencia ?? p.Data ?? p.DataCriacao ?? p.data ?? "";
            const plate = p.Placa ?? p.placa ?? "";
            const tipo = p.Tipo ?? p.tipo ?? p.TipoPendencia ?? "";
            const ramal = p.Ramal ?? p.ramal ?? "";

            return (
              <Card
                key={key}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelected(p)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {title}
                        </span>
                        {getStatusBadge(status)}
                        {tipo && (
                          <Badge variant="outline" className="text-xs">
                            {tipo}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes da Pendência #
              {selected?.Id ?? selected?.id ?? selected?.Codigo ?? ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-medium text-muted-foreground min-w-[120px]">
                    {k}:
                  </span>
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
    </div>
  );
}
