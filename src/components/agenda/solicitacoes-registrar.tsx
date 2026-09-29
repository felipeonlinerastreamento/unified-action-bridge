import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buscarClientes,
  criarSolicitacao,
  tiposDeServicoDoCliente,
} from "@/lib/seu-instalador.functions";
import { asList, errorMessage, minutesOfDaySP, pick } from "./shared";

export type Prefill = { technicianId?: string; time?: string; region?: string } | null;

interface Props {
  date: string;
  onDateChange: (v: string) => void;
  technicians: any[];
  activities: any[];
  prefill: Prefill;
  onConsumePrefill: () => void;
  onCreated: () => void;
  onOpenOs: (activity: any) => void;
}

function techIdOf(a: any): string {
  const v = a?.technicianId ?? a?.technician?.id;
  return v ? String(v) : "";
}

export function SolicitacoesRegistrar({
  date,
  onDateChange,
  technicians,
  activities,
  prefill,
  onConsumePrefill,
  onCreated,
  onOpenOs,
}: Props) {
  const searchClients = useServerFn(buscarClientes);
  const loadServiceTypes = useServerFn(tiposDeServicoDoCliente);
  const createRequest = useServerFn(criarSolicitacao);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notifyContact, setNotifyContact] = useState(true);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [identifier, setIdentifier] = useState("");
  const [address, setAddress] = useState("");
  const [noAddress, setNoAddress] = useState(false);
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState<any | null>(null);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.technicianId) setTechnicianId(prefill.technicianId);
    if (prefill.time) setTime(prefill.time);
    if (prefill.region && !address) setAddress(prefill.region);
    onConsumePrefill();
  }, [prefill, address, onConsumePrefill]);

  const clientsQuery = useQuery({
    queryKey: ["si-clients", debounced],
    enabled: debounced.length >= 3,
    retry: 1,
    queryFn: () => searchClients({ data: { search: debounced } }),
  });
  const clients = useMemo(() => asList(clientsQuery.data), [clientsQuery.data]);

  const serviceTypesQuery = useQuery({
    queryKey: ["si-service-types", clientId],
    enabled: !!clientId,
    queryFn: () => loadServiceTypes({ data: { clientId } }),
  });
  const serviceTypes = useMemo(() => asList(serviceTypesQuery.data), [serviceTypesQuery.data]);

  const conflict = useMemo(() => {
    if (!technicianId || !time) return null;
    const [h, m] = time.split(":").map(Number);
    const start = (h || 0) * 60 + (m || 0);
    const end = start + (Number(duration) || 60);
    return (
      activities.find((a) => {
        if (techIdOf(a) !== technicianId) return false;
        const s = minutesOfDaySP(a?.scheduledAt);
        if (s === null) return false;
        const e = s + (Number(a?.durationMinutes ?? a?.duration ?? 60) || 60);
        return s < end && e > start;
      }) ?? null
    );
  }, [activities, technicianId, time, duration]);

  const mutation = useMutation({
    mutationFn: async () =>
      await createRequest({
        data: {
          idempotencyKey: idempotencyKey.current,
          clientId,
          serviceTypeId,
          desiredAt: `${date}T${time}:00-03:00`,
          durationMinutes: Number(duration) || 60,
          address: noAddress ? "Sem endereço" : address.trim(),
          description:
            [technicianId ? `Técnico sugerido: ${technicians.find((t: any) => String(t.id) === technicianId)?.name ?? technicianId}` : "", description]
              .filter(Boolean)
              .join("\n") || undefined,
          contactName: contactName.trim(),
          contactPhone: contactPhone.replace(/\D/g, ""),
          contactEmail: contactEmail.trim() || undefined,
          notifyContact,
          identifier: identifier || undefined,
        },
      }),
    onSuccess: (res: any) => {
      toast.success("Solicitação registrada — aguardando aprovação no Seu Instalador.");
      const activity = res?.data ?? res;
      setCreated(activity);
      idempotencyKey.current = crypto.randomUUID();
      setIdentifier("");
      setDescription("");
      onCreated();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSubmit = clientId && serviceTypeId && date && time && (noAddress || address.trim()) && contactName.trim() && contactPhone.replace(/\D/g, "").length >= 8;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Registrar solicitação</CardTitle>
        <CardDescription>O agendamento é criado direto no Seu Instalador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Cliente {clientName && <span className="text-primary">· {clientName}</span>}</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Digite ao menos 3 letras do nome do cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {clientsQuery.isFetching && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando clientes...
            </p>
          )}
          {clientsQuery.isError && <p className="text-xs text-destructive">{errorMessage(clientsQuery.error)}</p>}
          {clients.length > 0 && (
            <div className="max-h-44 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {clients.map((c: any) => {
                const id = String(c.id);
                const label = pick(c, ["name", "nome", "companyName", "razaoSocial"], id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setClientId(id);
                      setClientName(label);
                      setServiceTypeId("");
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted/60 ${
                      clientId === id ? "bg-primary/10 font-medium text-primary" : ""
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de serviço</Label>
            <Select value={serviceTypeId} onValueChange={setServiceTypeId} disabled={!clientId}>
              <SelectTrigger>
                <SelectValue placeholder={clientId ? "Selecione o serviço" : "Escolha o cliente primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {pick(s, ["name", "nome", "title", "label"], String(s.id))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Técnico sugerido (opcional)</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {pick(t, ["name", "nome", "fullName"], String(t.id))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Hora</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Duração (minutos)</Label>
            <Input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Identificador (placa / série)</Label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Ex.: ABC1D23" />
          </div>
        </div>

        {conflict && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Este técnico já tem atendimento neste horário.</p>
              <button type="button" className="text-xs underline" onClick={() => onOpenOs(conflict)}>
                Ver {pick(conflict, ["identifier", "title"], "a OS")}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch id="sol-no-address" checked={noAddress} onCheckedChange={setNoAddress} />
            <Label htmlFor="sol-no-address" className="cursor-pointer text-sm">
              Sem endereço definido
            </Label>
          </div>
          {!noAddress && (
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF"
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Contato <span className="text-destructive">*</span></Label>
              <Input value={contactName} maxLength={200} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telefone <span className="text-destructive">*</span></Label>
              <Input value={contactPhone} maxLength={30} placeholder="31 99999-9999" onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={contactEmail} maxLength={255} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifyContact} onChange={(e) => setNotifyContact(e.target.checked)} />
            Avisar o contato sobre a solicitação
          </label>
          <Label>Observações</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        {created && (
          <div className="flex items-center gap-2 rounded-md border border-status-done/40 bg-status-done/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-status-done" />
            <span>Solicitação registrada — acompanhe em Solicitações › Pendentes.</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar solicitação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
