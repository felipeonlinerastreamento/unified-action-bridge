import { techStageLabel } from "@/lib/technical-service-cycle";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, CalendarPlus, Copy, Eye, Loader2, Plus, RefreshCw, Search, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cancelTechnicalTerm, resendTechnicalTerm } from "@/lib/technical-terms.functions";
import { listarTecnicos } from "@/lib/seu-instalador.functions";
import {
  serviceTypeLabel,
  TERM_STATUS_LABELS,
  buildSchedulingDescription,
  buildTermUrl,
  canSendToScheduling,
  termNumberLabel,
  type ChecklistItem,
  type TechnicalTermStatus,
} from "@/lib/technical-terms";
import { TechnicalTermDialog } from "./technical-term-dialog";
import { SolicitarServicoDialog } from "@/components/agenda/solicitar-servico-dialog";
import { asList, todayISO } from "@/components/agenda/shared";
import type { TermPrefill } from "@/components/agenda/solicitacoes-registrar";

type Filter = "pendente" | "aceito" | "recusado" | "enviada" | "cancelado";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aceito", label: "Aceitos" },
  { key: "recusado", label: "Recusados" },
  { key: "enviada", label: "Enviadas" },
  { key: "cancelado", label: "Cancelados" },
];
const STATUS_VARIANT: Record<TechnicalTermStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "outline",
  aceito: "default",
  recusado: "destructive",
  enviada: "secondary",
  cancelado: "outline",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export function CrmTechnicalServicesTab() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const isManager = hasRole("admin") || hasRole("gestor");
  const resend = useServerFn(resendTechnicalTerm);
  const cancel = useServerFn(cancelTechnicalTerm);
  const fetchTecnicos = useServerFn(listarTecnicos);
  const [filter, setFilter] = useState<Filter>("pendente");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [scheduling, setScheduling] = useState<any | null>(null);

  const { data: terms = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["technical-terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_service_terms")
        .select("*, service_tickets(protocol_number, tech_stage)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const { data: brand } = useQuery({
    queryKey: ["crm-proposal-settings-base"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_proposal_settings").select("public_base_url").limit(1).maybeSingle();
      return data;
    },
    staleTime: 10 * 60_000,
  });
  const linkOf = (t: any) => buildTermUrl(brand?.public_base_url || window.location.origin, t.token);

  const tecnicosQuery = useQuery({
    queryKey: ["si-technicians"],
    queryFn: () => fetchTecnicos({ data: {} }),
    enabled: !!scheduling,
    staleTime: 10 * 60_000,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of terms as any[]) c[t.status] = (c[t.status] || 0) + 1;
    return c;
  }, [terms]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (terms as any[]).filter((t) => {
      if (t.status !== filter) return false;
      if (!q) return true;
      return [t.client_name, t.plate, t.responsible_name, t.equipment_id, termNumberLabel(t.seq), t.service_tickets?.protocol_number ? String(t.service_tickets.protocol_number).padStart(5, "0") : ""]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [terms, filter, search]);

  const resendMut = useMutation({
    mutationFn: (t: any) => resend({ data: { id: t.id, sendWhatsapp: !!t.responsible_phone, sendEmail: !!t.responsible_email } }),
    onSuccess: (r: any) => {
      if (r?.sent?.length) toast.success("Termo reenviado");
      else toast.error(Object.values(r?.errors || {}).join(" / ") || "Falha ao reenviar");
      qc.invalidateQueries({ queryKey: ["technical-terms"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao reenviar"),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Termo cancelado");
      setDetail(null);
      qc.invalidateQueries({ queryKey: ["technical-terms"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao cancelar"),
  });

  const termPrefill = (t: any): TermPrefill => ({
    id: t.id,
    clientName: t.client_name,
    plate: t.plate,
    address: t.address,
    contactName: t.responsible_name,
    contactPhone: t.responsible_phone,
    contactEmail: t.responsible_email,
    description: buildSchedulingDescription({
      seq: t.seq,
      service_type: t.service_type,
      service_label: t.service_label,
      description: t.description,
      checklist: t.checklist as ChecklistItem[],
      responder_name: t.responder_name,
      responded_at: t.responded_at,
      equipment_id: t.equipment_id,
    }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Serviços técnicos</h2>
          <p className="text-sm text-muted-foreground">Instalação, manutenção e retirada só vão para a Agenda depois do aceite do responsável pela frota.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo termo</Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${filter === f.key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.label} <span className="ml-1 text-xs text-muted-foreground">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Cliente, placa, responsável, nº" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum termo em {FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {rows.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{termNumberLabel(t.seq)}</span>
                    <Badge variant="outline">{serviceTypeLabel(t.service_type, null, t.service_label)}</Badge>
                    <Badge variant={STATUS_VARIANT[t.status as TechnicalTermStatus]}>{TERM_STATUS_LABELS[t.status as TechnicalTermStatus]}</Badge>
                    {t.service_tickets?.tech_stage && <Badge variant="secondary">Protocolo: {techStageLabel(t.service_tickets.tech_stage)}</Badge>}
                    {t.service_tickets?.protocol_number && <span className="text-xs text-muted-foreground">Chamado #{String(t.service_tickets.protocol_number).padStart(5, "0")}</span>}
                  </div>
                  <p className="font-medium truncate">{t.client_name || "Cliente não informado"}{t.plate ? ` — ${t.plate}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    Responsável: {t.responsible_name} · Criado {fmt(t.created_at)}
                    {t.responded_at && ` · Respondido ${fmt(t.responded_at)}`}
                    {t.scheduled_at && ` · Enviado à Agenda ${fmt(t.scheduled_at)}`}
                  </p>
                  {t.status === "recusado" && t.responder_note && <p className="text-xs text-destructive">Motivo: {t.responder_note}</p>}
                  {Object.keys(t.send_errors || {}).length > 0 && t.status === "pendente" && (
                    <p className="text-xs text-destructive">Falha no envio: {Object.values(t.send_errors).join(" / ")}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDetail(t)}><Eye className="h-4 w-4 mr-1" /> Detalhes</Button>
                  {t.status === "pendente" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(linkOf(t)); toast.success("Link copiado"); }}>
                        <Copy className="h-4 w-4 mr-1" /> Link
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => resendMut.mutate(t)} disabled={resendMut.isPending}>
                        <Send className="h-4 w-4 mr-1" /> Reenviar
                      </Button>
                    </>
                  )}
                  {canSendToScheduling(t.status) && (
                    <Button size="sm" onClick={() => setScheduling(t)}>
                      <CalendarPlus className="h-4 w-4 mr-1" /> Enviar solicitação
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TechnicalTermDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{termNumberLabel(detail.seq)} — {serviceTypeLabel(detail.service_type, null, detail.service_label)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Badge variant={STATUS_VARIANT[detail.status as TechnicalTermStatus]}>{TERM_STATUS_LABELS[detail.status as TechnicalTermStatus]}</Badge>
                <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Termo de aceite</dt><dd>{detail.term_label || detail.term_title || "—"}</dd>
                  <dt className="text-muted-foreground">Cliente</dt><dd>{detail.client_name || "—"}</dd>
                  <dt className="text-muted-foreground">Placa</dt><dd>{detail.plate || "—"}</dd>
                  <dt className="text-muted-foreground">ID equipamento</dt><dd>{detail.equipment_id || "—"}</dd>
                  <dt className="text-muted-foreground">Endereço</dt><dd>{detail.address || "—"}</dd>
                  <dt className="text-muted-foreground">Responsável</dt><dd>{detail.responsible_name} {detail.responsible_phone && `· ${detail.responsible_phone}`} {detail.responsible_email && `· ${detail.responsible_email}`}</dd>
                  <dt className="text-muted-foreground">Enviado por</dt><dd>{(detail.sent_channels || []).join(", ") || "—"} {detail.sent_at && `em ${fmt(detail.sent_at)}`}</dd>
                  <dt className="text-muted-foreground">Visualizações</dt><dd>{detail.view_count || 0}{detail.last_viewed_at && ` (última ${fmt(detail.last_viewed_at)})`}</dd>
                  {detail.responded_at && (<><dt className="text-muted-foreground">Resposta</dt><dd>{detail.responder_name} em {fmt(detail.responded_at)}{detail.responder_note && ` — ${detail.responder_note}`}</dd></>)}
                  {detail.schedule_reference && (<><dt className="text-muted-foreground">Ref. Agenda</dt><dd>{detail.schedule_reference}</dd></>)}
                </dl>
                {Array.isArray(detail.checklist) && detail.checklist.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Checklist do atendente</p>
                    <ul className="space-y-0.5">
                      {detail.checklist.map((i: ChecklistItem) => <li key={i.label}>{i.checked ? "✔" : "✗"} {i.label}</li>)}
                    </ul>
                  </div>
                )}
                {detail.description && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2">{detail.description}</p>}
                {["pendente", "aceito", "recusado"].includes(detail.status) && (detail.created_by === user?.id || isManager) && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => cancelMut.mutate(detail.id)} disabled={cancelMut.isPending}>
                      <Ban className="h-4 w-4 mr-1" /> Cancelar termo
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {scheduling && (
        <SolicitarServicoDialog
          key={scheduling.id}
          open
          onOpenChange={(o) => !o && setScheduling(null)}
          technicians={asList(tecnicosQuery.data)}
          defaultDate={todayISO()}
          term={termPrefill(scheduling)}
          onCreated={() => {
            toast.success("Solicitação aberta — termo movido para Enviadas");
            setScheduling(null);
            setFilter("enviada");
            qc.invalidateQueries({ queryKey: ["technical-terms"] });
          }}
          onOpenOs={() => {}}
        />
      )}
    </div>
  );
}
