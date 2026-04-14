import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Loader2,
  MessageSquare,
  CheckCircle,
  PhoneCall,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const [activeTab, setActiveTab] = useState("todos");

  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "todos",
    tipo: "todos",
    cliente: "",
    ramal: "todos",
    setor: "todos",
    dataInicial: defaultStart,
    dataFinal: defaultEnd,
  });

  const [selected, setSelected] = useState<any>(null);

  // Fetch local service tickets
  const { data: localTickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ["local-service-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_tickets")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch GSystem pendências
  const { data: gsData, isLoading: gsLoading, isError, error, refetch: refetchGs, isFetching } = useQuery({
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

  const gsPendencias = useMemo(() => {
    if (!gsData) return [];
    return Array.isArray(gsData) ? gsData : gsData?.data ?? gsData?.items ?? [];
  }, [gsData]);

  // Merge: normalize both sources into a unified format
  const allItems = useMemo(() => {
    const items: any[] = [];

    // Local tickets
    for (const t of localTickets) {
      items.push({
        _source: "local",
        _id: t.id,
        key: t.id,
        title: t.contact_name || t.attendance_id || "Atendimento",
        status: t.status === "finalizado" ? "Finalizado" : t.status === "em_andamento" ? "Em andamento" : "Aberto",
        statusRaw: t.status,
        client: (t.companies as any)?.name || t.contact_name || "",
        phone: t.contact_phone || "",
        plate: t.plate || "",
        notes: t.notes || "",
        date: t.created_at,
        closedAt: t.closed_at,
        pendenciaKey: t.pendencia_key,
        attendanceId: t.attendance_id,
        raw: t,
      });
    }

    // GSystem pendências that are NOT already linked to a local ticket
    const linkedKeys = new Set(localTickets.map((t) => t.pendencia_key).filter(Boolean));
    for (const p of gsPendencias) {
      const pKey = String(p.Key || p.key || p.Codigo || p.Id || p.id || "");
      if (pKey && linkedKeys.has(pKey)) continue; // Already shown via local ticket

      const statusStr = String(p.Status ?? p.status ?? "Aberta");
      items.push({
        _source: "gsystem",
        _id: pKey || `gs-${Math.random()}`,
        key: pKey,
        title: (p.Situacao ?? p.situacao ?? p.Descricao ?? p.descricao ?? `Pendência #${pKey}`).toString().split("\\r\\n")[0].substring(0, 120),
        status: statusStr,
        statusRaw: statusStr.toLowerCase(),
        client: p.Cliente ?? p.cliente ?? p.NomeCliente ?? "",
        phone: "",
        plate: (Array.isArray(p.Veiculos) ? p.Veiculos.filter(Boolean).join(", ") : (p.Placa ?? p.placa ?? "")),
        notes: p.Observacao ?? p.observacao ?? "",
        date: p.DataOcorrencia ?? p.Data ?? p.DataCriacao ?? "",
        closedAt: null,
        pendenciaKey: pKey,
        tipo: p.Tipo ?? p.tipo ?? p.TipoPendencia ?? "",
        ramal: p.Ramal ?? p.ramal ?? "",
        raw: p,
      });
    }

    // Sort by date descending
    items.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return items;
  }, [localTickets, gsPendencias]);

  // Extract dynamic filter options
  const availableTipos = useMemo(() => {
    const set = new Set<string>();
    gsPendencias.forEach((p: any) => {
      const t = p.Tipo ?? p.tipo ?? p.TipoPendencia ?? "";
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [gsPendencias]);

  const availableRamais = useMemo(() => {
    const set = new Set<string>();
    gsPendencias.forEach((p: any) => {
      const r = p.Ramal ?? p.ramal ?? p.Operador ?? p.operador ?? "";
      if (r) set.add(String(r));
    });
    return Array.from(set).sort();
  }, [gsPendencias]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Tab filter
      if (activeTab === "local" && item._source !== "local") return false;
      if (activeTab === "gsystem" && item._source !== "gsystem") return false;

      // Text search
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const searchable = `${item.title} ${item.client} ${item.phone} ${item.plate} ${item.notes}`.toLowerCase();
        if (!searchable.includes(s)) return false;
      }

      // Status
      if (filters.status !== "todos") {
        const s = item.statusRaw.toString().toLowerCase();
        if (!s.includes(filters.status.toLowerCase())) return false;
      }

      // Tipo (GSystem only)
      if (filters.tipo !== "todos" && item._source === "gsystem") {
        if (item.tipo !== filters.tipo) return false;
      }

      // Cliente
      if (filters.cliente) {
        if (!item.client.toLowerCase().includes(filters.cliente.toLowerCase())) return false;
      }

      // Ramal
      if (filters.ramal !== "todos" && item._source === "gsystem") {
        if (item.ramal !== filters.ramal) return false;
      }

      return true;
    });
  }, [allItems, activeTab, filters]);

  const getStatusBadge = (status: string) => {
    const s = (status ?? "").toLowerCase();
    if (s.includes("cancel"))
      return <Badge variant="destructive">Cancelada</Badge>;
    if (s.includes("resolv") || s.includes("finaliz") || s.includes("conclu"))
      return <Badge className="bg-emerald-600 text-white">Finalizado</Badge>;
    if (s.includes("andamento") || s.includes("progress"))
      return <Badge className="bg-amber-500 text-white">Em Andamento</Badge>;
    if (s.includes("aberta") || s.includes("aberto"))
      return <Badge variant="secondary">Aberto</Badge>;
    return <Badge variant="outline">{status || "—"}</Badge>;
  };

  const isLoading = ticketsLoading || gsLoading;

  const refetchAll = () => {
    refetchTickets();
    refetchGs();
  };

  const localCount = allItems.filter((i) => i._source === "local").length;
  const gsCount = allItems.filter((i) => i._source === "gsystem").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
          <p className="text-sm text-muted-foreground">
            {filteredItems.length} registro(s)
            {filteredItems.length !== allItems.length && ` de ${allItems.length} total`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetchAll}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos" className="gap-1">
            Todos <Badge variant="secondary" className="ml-1 text-xs">{allItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="local" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> Central
            <Badge variant="secondary" className="ml-1 text-xs">{localCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gsystem" className="gap-1">
            <PhoneCall className="h-3.5 w-3.5" /> Pendências GSystem
            <Badge variant="secondary" className="ml-1 text-xs">{gsCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <AtendimentosFilters
        filters={filters}
        onChange={setFilters}
        availableTipos={availableTipos}
        availableRamais={availableRamais}
        onRefetch={refetchAll}
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando atendimentos...</p>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">
              Erro ao carregar pendências: {(error as Error)?.message ?? "Erro desconhecido"}
            </p>
            <Button variant="outline" size="sm" onClick={refetchAll}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum atendimento encontrado com os filtros selecionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <Card
              key={item._id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelected(item)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{item.title}</span>
                      {getStatusBadge(item.status)}
                      {item._source === "local" && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <MessageSquare className="h-3 w-3" /> Central
                        </Badge>
                      )}
                      {item._source === "gsystem" && item.tipo && (
                        <Badge variant="outline" className="text-xs">{item.tipo}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {item.client && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {item.client}
                        </span>
                      )}
                      {item.phone && <span>Tel: {item.phone}</span>}
                      {item.plate && <span>Placa: {item.plate}</span>}
                      {item.pendenciaKey && (
                        <span className="text-primary/70">Pend: #{item.pendenciaKey}</span>
                      )}
                      {item.date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {item.closedAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {new Date(item.closedAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    #{item.key?.toString().substring(0, 8)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes — {selected?.title}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              {selected._source === "local" ? (
                <>
                  <DetailRow label="Status" value={selected.status} />
                  <DetailRow label="Contato" value={selected.raw.contact_name} />
                  <DetailRow label="Telefone" value={selected.raw.contact_phone} />
                  <DetailRow label="Empresa" value={(selected.raw.companies as any)?.name} />
                  <DetailRow label="Placa" value={selected.raw.plate} />
                  <DetailRow label="Pendência GSystem" value={selected.raw.pendencia_key} />
                  <DetailRow label="Observações" value={selected.raw.notes} />
                  <DetailRow label="Criado em" value={selected.raw.created_at ? new Date(selected.raw.created_at).toLocaleString("pt-BR") : null} />
                  <DetailRow label="Finalizado em" value={selected.raw.closed_at ? new Date(selected.raw.closed_at).toLocaleString("pt-BR") : null} />
                  <DetailRow label="ID Atendimento" value={selected.raw.attendance_id} />
                </>
              ) : (
                Object.entries(selected.raw).map(([k, v]) => (
                  <DetailRow key={k} label={k} value={
                    v === null || v === undefined
                      ? null
                      : typeof v === "object"
                        ? JSON.stringify(v, null, 2)
                        : String(v)
                  } />
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium text-muted-foreground min-w-[120px]">{label}:</span>
      <span className="break-all">{value || "—"}</span>
    </div>
  );
}
