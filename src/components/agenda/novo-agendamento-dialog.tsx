import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buscarClientes,
  criarAgendamento,
  listarTecnicos,
  tiposDeServicoDoCliente,
} from "@/lib/seu-instalador.functions";
import { asList, errorMessage, pick, todayISO } from "./shared";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function NovoAgendamentoDialog({ open, onClose, onCreated }: Props) {
  const searchClients = useServerFn(buscarClientes);
  const loadServiceTypes = useServerFn(tiposDeServicoDoCliente);
  const loadTechnicians = useServerFn(listarTecnicos);
  const createAppointment = useServerFn(criarAgendamento);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [identifier, setIdentifier] = useState("");
  const [address, setAddress] = useState("");
  const [noAddress, setNoAddress] = useState(false);
  const [description, setDescription] = useState("");
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (open) idempotencyKey.current = crypto.randomUUID();
  }, [open]);

  const clientsQuery = useQuery({
    queryKey: ["si-clients", debounced],
    enabled: open && debounced.length >= 3,
    queryFn: () => searchClients({ data: { search: debounced } }),
  });
  const clients = useMemo(() => asList(clientsQuery.data), [clientsQuery.data]);

  const serviceTypesQuery = useQuery({
    queryKey: ["si-service-types", clientId],
    enabled: open && !!clientId,
    queryFn: () => loadServiceTypes({ data: { clientId } }),
  });
  const serviceTypes = useMemo(() => asList(serviceTypesQuery.data), [serviceTypesQuery.data]);

  const techniciansQuery = useQuery({
    queryKey: ["si-technicians"],
    enabled: open,
    queryFn: () => loadTechnicians({ data: {} }),
  });
  const technicians = useMemo(() => asList(techniciansQuery.data), [techniciansQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = `${date}T${time}:00-03:00`;
      return await createAppointment({
        data: {
          idempotencyKey: idempotencyKey.current,
          clientId,
          technicianId,
          serviceTypeId,
          scheduledAt,
          durationMinutes: Number(duration) || 60,
          identifier: identifier || undefined,
          address: noAddress ? undefined : address || undefined,
          noAddress,
          description: description || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Agendamento criado no Seu Instalador.");
      onCreated?.();
      reset();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reset = () => {
    setSearch("");
    setDebounced("");
    setClientId("");
    setServiceTypeId("");
    setTechnicianId("");
    setIdentifier("");
    setAddress("");
    setNoAddress(false);
    setDescription("");
    idempotencyKey.current = crypto.randomUUID();
  };

  const canSubmit = clientId && serviceTypeId && technicianId && date && time && (noAddress || address.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
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
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando clientes...
              </p>
            )}
            {clientsQuery.isError && (
              <p className="text-xs text-destructive">{errorMessage(clientsQuery.error)}</p>
            )}
            {clients.length > 0 && (
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setServiceTypeId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {pick(c, ["name", "nome", "companyName", "razaoSocial"], String(c.id))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {serviceTypesQuery.isError && (
                <p className="text-xs text-destructive">{errorMessage(serviceTypesQuery.error)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Técnico</Label>
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
              {techniciansQuery.isError && (
                <p className="text-xs text-destructive">{errorMessage(techniciansQuery.error)}</p>
              )}
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

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch id="no-address" checked={noAddress} onCheckedChange={setNoAddress} />
              <Label htmlFor="no-address" className="cursor-pointer text-sm">
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
            <Label>Observações</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
