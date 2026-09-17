import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown, ImageOff, Loader2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  alterarStatusAgendamento,
  atualizarAgendamento,
  historicoOS,
  listarTecnicos,
  tiposDeServicoDoCliente,
} from "@/lib/seu-instalador.functions";
import { asList, errorMessage, formatDateTime, osPhotos, pick, saoPauloParts } from "./shared";
import { gerarPdfOsCompleta } from "./os-pdf";

const STATUS_VALUES = [
  "em_aberto",
  "agendado",
  "em_deslocamento",
  "em_execucao",
  "concluido",
  "improdutiva",
  "cancelado",
];

const STATUS_LABEL: Record<string, string> = {
  em_aberto: "Em aberto",
  agendado: "Agendado",
  em_deslocamento: "Em deslocamento",
  em_execucao: "Em execução",
  concluido: "Concluído",
  improdutiva: "Improdutiva",
  cancelado: "Cancelada",
};

interface Props {
  open: boolean;
  onClose: () => void;
  activity: any | null;
  canEdit: boolean;
  onUpdated?: () => void;
}

function splitDateTime(value?: string | null) {
  const p = saoPauloParts(value);
  if (!p) return { date: "", time: "09:00" };
  return { date: p.date, time: p.time };
}

export function OsDetalhesDialog({ open, onClose, activity, canEdit, onUpdated }: Props) {
  const loadHistory = useServerFn(historicoOS);
  const loadTechnicians = useServerFn(listarTecnicos);
  const loadServiceTypes = useServerFn(tiposDeServicoDoCliente);
  const updateAppointment = useServerFn(atualizarAgendamento);
  const updateStatus = useServerFn(alterarStatusAgendamento);

  const id = activity?.orderId ?? activity?.id;
  const orderId = id ? String(id) : "";
  const rawClientId = activity?.clientId ?? activity?.client?.id;
  const clientId = rawClientId ? String(rawClientId) : "";

  const [editing, setEditing] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [identifier, setIdentifier] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!activity) return;
    const dt = splitDateTime(activity.scheduledAt);
    setEditing(false);
    const technicianIdValue = activity.technicianId ?? activity.technician?.id;
    const serviceTypeIdValue = activity.serviceTypeId ?? activity.serviceType?.id;
    setTechnicianId(technicianIdValue ? String(technicianIdValue) : "");
    setServiceTypeId(serviceTypeIdValue ? String(serviceTypeIdValue) : "");
    setDate(dt.date);
    setTime(dt.time);
    setDuration(Number(activity.durationMinutes) || 60);
    setIdentifier(activity.identifier || "");
    setAddress(activity.address || "");
    setDescription(activity.description || "");
    setStatus(String(activity.status || ""));
  }, [activity]);

  const historyQuery = useQuery({
    queryKey: ["si-order-history", orderId],
    enabled: open && !!orderId,
    queryFn: () => loadHistory({ data: { orderId } }),
  });
  const history = useMemo(() => asList(historyQuery.data), [historyQuery.data]);

  const techniciansQuery = useQuery({
    queryKey: ["si-technicians"],
    enabled: open && editing,
    queryFn: () => loadTechnicians({ data: {} }),
  });
  const technicians = useMemo(() => asList(techniciansQuery.data), [techniciansQuery.data]);

  const serviceTypesQuery = useQuery({
    queryKey: ["si-service-types", clientId],
    enabled: open && editing && !!clientId,
    queryFn: () => loadServiceTypes({ data: { clientId } }),
  });
  const serviceTypes = useMemo(() => asList(serviceTypesQuery.data), [serviceTypesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateAppointment({
        data: {
          appointmentId: orderId,
          technicianId: technicianId || undefined,
          serviceTypeId: serviceTypeId || undefined,
          scheduledAt: date ? `${date}T${time}:00-03:00` : undefined,
          durationMinutes: Number(duration) || undefined,
          identifier: identifier || undefined,
          address: address || undefined,
          description: description || undefined,
        },
      });
      if (status && status !== String(activity?.status || "")) {
        await updateStatus({ data: { appointmentId: orderId, status } });
      }
    },
    onSuccess: () => {
      toast.success("OS atualizada no Seu Instalador.");
      setEditing(false);
      onUpdated?.();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const photos = useMemo(() => osPhotos(activity), [activity]);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function baixarPdf() {
    setPdfLoading(true);
    try {
      await gerarPdfOsCompleta(activity, history);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPdfLoading(false);
    }
  }

  const info: [string, string][] = activity
    ? [
        ["Identificador", activity.identifier || "—"],
        ["Tipo de OS", pick(activity, ["serviceTypeName", "serviceType", "title"], "—")],
        ["Cliente", pick(activity, ["clientName", "client", "companyName"], "—")],
        ["Técnico", pick(activity, ["technicianName", "technician"], "Sem técnico")],
        ["Agendamento", formatDateTime(activity.scheduledAt)],
        ["Duração estimada", `${activity.durationMinutes || 60} min`],
        ["Endereço", activity.address || "—"],
        ["Descrição", activity.description || "—"],
        ["Criada em", formatDateTime(activity.createdAt)],
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>{activity?.title || "Detalhes da OS"}</span>
            {activity?.identifier && (
              <span className="text-sm text-muted-foreground font-normal">· {activity.identifier}</span>
            )}
            {activity?.status && (
              <Badge variant="secondary">{STATUS_LABEL[String(activity.status)] || activity.status}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes">
          <TabsList className="w-full">
            <TabsTrigger value="detalhes" className="flex-1">Detalhes</TabsTrigger>
            <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="pt-4">
            {!editing ? (
              <div className="space-y-3">
                {info.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-3 gap-3 text-sm border-b border-border pb-2 last:border-b-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="col-span-2 whitespace-pre-wrap">{value}</span>
                  </div>
                ))}

                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-foreground">
                    Fotos da OS{photos.length > 0 ? ` (${photos.length})` : ""}
                  </p>
                  {photos.length === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <ImageOff className="h-4 w-4" />
                      As fotos ainda não são enviadas pelo Seu Instalador nesta integração.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {photos.map((p, i) => (
                        <a
                          key={`${p.url}-${i}`}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-md border border-border"
                          title={p.caption || "Abrir foto"}
                        >
                          <img src={p.url} alt={p.caption || `Foto ${i + 1} da OS`} className="h-24 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </Button>
                  )}
                  <Button size="sm" onClick={() => void baixarPdf()} disabled={pdfLoading}>
                    {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                    Baixar PDF da OS completa
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Técnico</Label>
                    <Select value={technicianId} onValueChange={setTechnicianId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o técnico" /></SelectTrigger>
                      <SelectContent>
                        {technicians.map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {pick(t, ["name", "nome"], String(t.id))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de serviço</Label>
                    <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                      <SelectContent>
                        {serviceTypes.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {pick(s, ["name", "nome"], String(s.id))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Identificador</Label>
                    <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duração (minutos)</Label>
                    <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar alterações
                  </Button>
                </DialogFooter>
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="pt-4">
            {historyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </p>
            ) : historyQuery.isError ? (
              <p className="text-sm text-destructive py-4">{errorMessage(historyQuery.error)}</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Sem histórico registrado para esta OS.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h: any, i: number) => (
                  <li key={h.id || i} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{pick(h, ["action", "event", "status", "title"], "Evento")}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(h.createdAt || h.date || h.at)}
                      </span>
                    </div>
                    {pick(h, ["description", "notes", "message"]) && (
                      <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {pick(h, ["description", "notes", "message"])}
                      </p>
                    )}
                    {pick(h, ["userName", "user", "author"]) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        por {pick(h, ["userName", "user", "author"])}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
