import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarPlus, ChevronDown, ChevronUp, Eraser, FileText, Filter, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listarAtividades } from "@/lib/seu-instalador.functions";
import { useAuth } from "@/hooks/use-auth";
import { NovoAgendamentoDialog } from "./novo-agendamento-dialog";
import { OsDetalhesDialog } from "./os-detalhes-dialog";
import { asList, errorMessage, formatDateTime, pick, shiftDate, todayISO } from "./shared";

const STATUS_OPTIONS = [
  "Em aberto",
  "Agendado",
  "Em deslocamento",
  "Em execução",
  "Concluído",
  "Improdutiva",
  "Cancelada",
];

const ALL = "__all__";
const PAGE_SIZE = 50;

function row(r: any) {
  return {
    raw: r,
    id: String(r.id ?? r.orderId ?? ""),
    orderId: r.orderId ?? r.id,
    clientId: r.clientId ?? r.client?.id,
    identifier: pick(r, ["identifier", "code", "os"], "—"),
    title: pick(r, ["title", "serviceTypeName", "serviceType"], "Atividade"),
    status: pick(r, ["statusName", "status"], "—"),
    company: pick(r, ["clientName", "client", "companyName"], "—"),
    technician: pick(r, ["technicianName", "technician"], "Sem técnico"),
    scheduledAt: r.scheduledAt ?? r.scheduledFor ?? r.date ?? null,
    address: pick(r, ["address", "endereco"], ""),
    description: pick(r, ["description", "observacao", "notes"], ""),
  };
}

export function AtividadesContent() {
  const fetchAtividades = useServerFn(listarAtividades);
  const [from, setFrom] = useState(shiftDate(todayISO(), -7));
  const [to, setTo] = useState(shiftDate(todayISO(), 7));
  const [status, setStatus] = useState(ALL);
  const [company, setCompany] = useState(ALL);
  const [technician, setTechnician] = useState(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<{ orderId?: string; clientId?: string; title?: string } | null>(null);

  const query = useQuery({
    queryKey: ["si-activities", from, to, status, search, page],
    queryFn: () =>
      fetchAtividades({
        data: {
          scheduledFrom: from || undefined,
          scheduledTo: to || undefined,
          status: status === ALL ? undefined : status,
          search: search || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
  });

  const allRows = useMemo(() => asList(query.data).map(row), [query.data]);

  const companies = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.company).filter((c) => c && c !== "—"))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allRows],
  );
  const technicians = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.technician).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allRows],
  );

  const rows = useMemo(
    () =>
      allRows.filter(
        (r) => (company === ALL || r.company === company) && (technician === ALL || r.technician === technician),
      ),
    [allRows, company, technician],
  );

  function clearFilters() {
    setFrom("");
    setTo("");
    setStatus(ALL);
    setCompany(ALL);
    setTechnician(ALL);
    setSearch("");
    setPage(1);
  }

  async function baixarPdf(r: ReturnType<typeof row>) {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const left = 48;
      let y = 60;
      doc.setFontSize(16);
      doc.text("Ordem de Serviço", left, y);
      y += 10;
      doc.setDrawColor(200);
      doc.line(left, y, 547, y);
      y += 24;
      doc.setFontSize(11);
      const lines: [string, string][] = [
        ["Identificador", r.identifier],
        ["Título", r.title],
        ["Status", r.status],
        ["Empresa", r.company],
        ["Técnico", r.technician],
        ["Agendamento", formatDateTime(r.scheduledAt)],
        ["Endereço", r.address || "—"],
      ];
      for (const [label, value] of lines) {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, left, y);
        doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(String(value || "—"), 360), left + 110, y);
        y += 22;
      }
      if (r.description) {
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.text("Descrição:", left, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        const body = doc.splitTextToSize(r.description, 470) as string[];
        doc.text(body, left, y);
        y += body.length * 14;
      }
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, left, 800);
      doc.save(`OS-${r.identifier !== "—" ? r.identifier : r.id || "detalhe"}.pdf`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Atividades</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${query.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Nova OS
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-foreground"
            onClick={() => setShowFilters((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </span>
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Buscar título/identificador"
              />
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as empresas</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={technician} onValueChange={setTechnician}>
                <SelectTrigger><SelectValue placeholder="Todos os técnicos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os técnicos</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
                <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
              </div>
              <Button variant="outline" onClick={clearFilters} className="w-fit">
                <Eraser className="h-4 w-4 mr-2" /> Limpar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando atividades...</p>
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma atividade encontrada para os filtros escolhidos.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-end px-4 py-2 text-xs text-muted-foreground border-b border-border">
              {rows.length} OS
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Identificador</th>
                    <th className="px-4 py-2 text-left font-medium">Título</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Empresa</th>
                    <th className="px-4 py-2 text-left font-medium">Técnico</th>
                    <th className="px-4 py-2 text-left font-medium">Agendamento</th>
                    <th className="px-4 py-2 text-right font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id || i}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetail({ orderId: r.orderId, clientId: r.clientId, title: r.company })}
                    >
                      <td className="px-4 py-2 font-mono text-xs">{r.identifier}</td>
                      <td className="px-4 py-2 text-primary">{r.title}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{r.status}</Badge>
                      </td>
                      <td className="px-4 py-2">{r.company}</td>
                      <td className="px-4 py-2">{r.technician}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(r.scheduledAt)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Baixar PDF da OS"
                          onClick={(e) => {
                            e.stopPropagation();
                            void baixarPdf(r);
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">Página {page}</span>
              <Button variant="outline" size="sm" disabled={allRows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <NovoAgendamentoDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => query.refetch()} />
      <OsHistoricoDialog
        open={!!detail}
        onClose={() => setDetail(null)}
        orderId={detail?.orderId ?? null}
        clientId={detail?.clientId ?? null}
        title={detail?.title}
      />
    </div>
  );
}
