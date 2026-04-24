import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Loader2,
} from "lucide-react";

interface LabRow {
  id: string;
  ticket_id: string;
  item_name: string;
  quantity: number;
  status: "pendente" | "liberado";
  created_at: string;
  liberado_at: string | null;
  liberado_by: string | null;
  ticket: {
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    company_name: string | null;
    plate: string | null;
    liberacao_date: string | null;
    status: string;
    sector: string | null;
  };
}

interface Props {
  /** Tickets atualmente filtrados (já contendo somente setor Laboratório). */
  tickets: any[];
  /** Callback para abrir o painel de detalhes de um ticket. */
  onOpenTicket?: (ticket: any) => void;
}

/**
 * Painel completo do Laboratório, exibido dentro do menu Atendimentos
 * quando o filtro de setor "Laboratório" está ativo. Lista os itens de
 * liberação de equipamentos, com KPIs, visualizações em cards/kanban/tabela
 * e ação direta de "Liberar".
 */
export function LaboratorioPanel({ tickets, onOpenTicket }: Props) {
  const qc = useQueryClient();
  const [view, setView] = useState<"cards" | "kanban" | "tabela">("cards");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "liberado">("pendente");

  // IDs dos tickets atualmente filtrados (setor Laboratório)
  const ticketIds = useMemo(() => tickets.map((t) => t.id), [tickets]);
  const ticketById = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of tickets) map.set(t.id, t);
    return map;
  }, [tickets]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["lab-liberacao", ticketIds],
    enabled: ticketIds.length > 0,
    queryFn: async (): Promise<LabRow[]> => {
      const { data, error } = await supabase
        .from("ticket_liberacao_items" as any)
        .select(
          `id, ticket_id, item_name, quantity, status, created_at, liberado_at, liberado_by`
        )
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => {
        const t = ticketById.get(r.ticket_id) || {};
        return {
          id: r.id,
          ticket_id: r.ticket_id,
          item_name: r.item_name,
          quantity: r.quantity,
          status: r.status,
          created_at: r.created_at,
          liberado_at: r.liberado_at,
          liberado_by: r.liberado_by,
          ticket: {
            id: t.id || r.ticket_id,
            contact_name: t.contact_name || null,
            contact_phone: t.contact_phone || null,
            company_name: t.companies?.name || null,
            plate: t.plate || null,
            liberacao_date: t.liberacao_date || null,
            status: t.status || "",
            sector: t.sector || null,
          },
        };
      });
    },
    refetchInterval: 30000,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-lab"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });

  const liberar = useMutation({
    mutationFn: async (row: LabRow) => {
      const { error } = await supabase
        .from("ticket_liberacao_items" as any)
        .update({
          status: "liberado",
          liberado_at: new Date().toISOString(),
          liberado_by: currentUser?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      await supabase.from("ticket_comments").insert({
        ticket_id: row.ticket_id,
        user_id: currentUser?.id || null,
        content: `Item liberado pelo Laboratório: ${row.quantity}x ${row.item_name}`,
        comment_type: "sistema",
      });
    },
    onSuccess: () => {
      toast.success("Item liberado");
      qc.invalidateQueries({ queryKey: ["lab-liberacao"] });
      qc.invalidateQueries({ queryKey: ["service-tickets"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const totalPendentes = rows.filter((r) => r.status === "pendente").length;
  const totalLiberados = rows.filter((r) => r.status === "liberado").length;
  const atrasados = rows.filter(
    (r) =>
      r.status === "pendente" &&
      r.ticket.liberacao_date &&
      String(r.ticket.liberacao_date).slice(0, 10) < today
  ).length;
  const hoje = rows.filter(
    (r) =>
      r.status === "pendente" &&
      r.ticket.liberacao_date &&
      String(r.ticket.liberacao_date).slice(0, 10) === today
  ).length;

  const urgencyOf = (
    dateStr: string | null
  ): "atrasado" | "hoje" | "futuro" | "sem-data" => {
    if (!dateStr) return "sem-data";
    const d = String(dateStr).slice(0, 10);
    if (d < today) return "atrasado";
    if (d === today) return "hoje";
    return "futuro";
  };

  const urgencyBadge = (u: string) => {
    if (u === "atrasado")
      return (
        <Badge variant="destructive" className="text-[10px]">
          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
          Atrasado
        </Badge>
      );
    if (u === "hoje")
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
          <Clock className="h-2.5 w-2.5 mr-1" />
          Hoje
        </Badge>
      );
    if (u === "futuro")
      return (
        <Badge variant="outline" className="text-[10px]">
          <CalendarDays className="h-2.5 w-2.5 mr-1" />
          Futuro
        </Badge>
      );
    return (
      <Badge variant="secondary" className="text-[10px]">
        Sem data
      </Badge>
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<string, LabRow[]>();
    for (const r of filtered) {
      const key = r.ticket.liberacao_date
        ? String(r.ticket.liberacao_date).slice(0, 10)
        : "sem-data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "sem-data") return 1;
      if (b === "sem-data") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const handleOpen = (row: LabRow) => {
    const t = ticketById.get(row.ticket_id);
    if (t && onOpenTicket) onOpenTicket(t);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Laboratório — Liberação de Equipamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Pendentes" value={totalPendentes} icon={Clock} tone="default" />
          <KpiCard label="Atrasados" value={atrasados} icon={AlertTriangle} tone="danger" />
          <KpiCard label="Para hoje" value={hoje} icon={CalendarDays} tone="warning" />
          <KpiCard label="Liberados" value={totalLiberados} icon={CheckCircle2} tone="success" />
        </div>

        {/* Filtros */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="liberado">Liberados</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="cards" className="gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Cards
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1">
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="tabela" className="gap-1">
                <ListIcon className="h-3.5 w-3.5" /> Tabela
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum item nesta visualização.
          </div>
        ) : view === "tabela" ? (
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Liberação</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qtde</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {r.ticket.liberacao_date
                        ? new Date(r.ticket.liberacao_date).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>{urgencyBadge(urgencyOf(r.ticket.liberacao_date))}</TableCell>
                    <TableCell className="font-medium">{r.item_name}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell className="text-xs">
                      {r.ticket.company_name || r.ticket.contact_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.ticket.plate || "—"}</TableCell>
                    <TableCell>
                      {r.status === "liberado" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                          Liberado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status === "pendente" && (
                          <Button
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => liberar.mutate(r)}
                            disabled={liberar.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Liberar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px]"
                          onClick={() => handleOpen(r)}
                        >
                          Abrir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : view === "kanban" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["atrasado", "hoje", "futuro"] as const).map((bucket) => {
              const list = filtered.filter(
                (r) => urgencyOf(r.ticket.liberacao_date) === bucket
              );
              const labels: Record<string, string> = {
                atrasado: "Atrasados",
                hoje: "Para hoje",
                futuro: "Futuros",
              };
              return (
                <Card key={bucket} className="bg-background">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{labels[bucket]}</span>
                      <Badge variant="outline">{list.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-2">
                        Nenhum item.
                      </p>
                    ) : (
                      list.map((r) => (
                        <ItemMiniCard
                          key={r.id}
                          row={r}
                          onLiberar={() => liberar.mutate(r)}
                          onOpen={() => handleOpen(r)}
                          pending={liberar.isPending}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          // cards by date
          <div className="space-y-4">
            {grouped.map(([date, list]) => (
              <Card key={date} className="bg-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {date === "sem-data"
                      ? "Sem data definida"
                      : new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}
                    <Badge variant="outline" className="ml-auto">
                      {list.length} item{list.length > 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {list.map((r) => (
                    <ItemMiniCard
                      key={r.id}
                      row={r}
                      onLiberar={() => liberar.mutate(r)}
                      onOpen={() => handleOpen(r)}
                      pending={liberar.isPending}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: any;
  tone: "default" | "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-emerald-600"
          : "text-primary";
  return (
    <Card className="bg-background">
      <CardContent className="p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${toneClass}`} />
      </CardContent>
    </Card>
  );
}

function ItemMiniCard({
  row,
  onLiberar,
  onOpen,
  pending,
}: {
  row: LabRow;
  onLiberar: () => void;
  onOpen: () => void;
  pending: boolean;
}) {
  const isLiberado = row.status === "liberado";
  return (
    <div
      className={`rounded-md border p-2 text-xs space-y-1 ${
        isLiberado ? "bg-emerald-50 border-emerald-200" : "bg-card"
      }`}
    >
      <div className="flex items-center gap-1">
        <Package className="h-3.5 w-3.5 text-primary shrink-0" />
        <button
          type="button"
          onClick={onOpen}
          className="font-semibold truncate text-left hover:underline"
        >
          {row.quantity}x {row.item_name}
        </button>
      </div>
      <div className="text-muted-foreground truncate">
        {row.ticket.company_name || row.ticket.contact_name || "Sem cliente"}
        {row.ticket.plate ? ` · ${row.ticket.plate}` : ""}
      </div>
      <div className="flex items-center justify-between gap-1 pt-1">
        <span className="text-[10px] text-muted-foreground">
          {row.ticket.liberacao_date
            ? new Date(row.ticket.liberacao_date).toLocaleDateString("pt-BR")
            : "Sem data"}
        </span>
        {isLiberado ? (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
            Liberado
          </Badge>
        ) : (
          <Button
            size="sm"
            className="h-6 text-[10px] gap-1"
            onClick={onLiberar}
            disabled={pending}
          >
            <CheckCircle2 className="h-3 w-3" /> Liberar
          </Button>
        )}
      </div>
    </div>
  );
}
