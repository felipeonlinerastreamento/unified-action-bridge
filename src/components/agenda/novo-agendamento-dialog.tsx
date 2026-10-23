import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buscarClientes,
  criarAgendamento,
  criarAgendamentoTerceiro,
  listarTecnicos,
  listarTecnicosTerceiros,
  tiposDeServicoDoCliente,
} from "@/lib/seu-instalador.functions";
import { geocodificarEnderecos } from "@/lib/geocode.functions";
import { asList, errorMessage, pick, todayISO } from "./shared";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const DEFAULT_DESCRIPTION =
  "Atendimento técnico conforme solicitado. Verificar condições no local e registrar evidências.";

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function NovoAgendamentoDialog({ open, onClose, onCreated }: Props) {
  const searchClients = useServerFn(buscarClientes);
  const loadServiceTypes = useServerFn(tiposDeServicoDoCliente);
  const loadTechnicians = useServerFn(listarTecnicos);
  const createAppointment = useServerFn(criarAgendamento);
  const createThirdParty = useServerFn(criarAgendamentoTerceiro);
  const loadThirdParty = useServerFn(listarTecnicosTerceiros);
  const geocode = useServerFn(geocodificarEnderecos);

  const [thirdParty, setThirdParty] = useState(false);
  const [thirdResult, setThirdResult] = useState<{ whatsappUrl?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientLabel, setClientLabel] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [identifier, setIdentifier] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notifyContact, setNotifyContact] = useState(false);
  const [address, setAddress] = useState("");
  const [noAddress, setNoAddress] = useState(false);
  const [addrStatus, setAddrStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [touched, setTouched] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiList, setMultiList] = useState("");
  const [multiSequential, setMultiSequential] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const keys = useRef<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const clientsQuery = useQuery({
    queryKey: ["si-clients", debounced],
    enabled: open && debounced.length >= 3 && debounced !== clientLabel,
    retry: 1,
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
  const thirdQuery = useQuery({
    queryKey: ["si-third-party-technicians"],
    enabled: open && thirdParty,
    retry: 0,
    queryFn: () => loadThirdParty({ data: {} }),
  });
  const activeQuery = thirdParty ? thirdQuery : techniciansQuery;
  const technicians = useMemo(() => asList(activeQuery.data), [activeQuery.data]);

  const reset = () => {
    setSearch(""); setDebounced(""); setClientId(""); setClientLabel("");
    setServiceTypeId(""); setTechnicianId(""); setIdentifier("");
    setContactName(""); setContactPhone(""); setNotifyContact(false);
    setAddress(""); setNoAddress(false); setAddrStatus("idle");
    setDescription(DEFAULT_DESCRIPTION); setTouched(false);
    setMultiOpen(false); setMultiList(""); keys.current = {};
  };

  const validateAddress = async () => {
    if (address.trim().length < 5) return toast.error("Digite o endereço completo para validar.");
    setAddrStatus("checking");
    try {
      const [r] = await geocode({ data: { addresses: [address.trim()] } });
      setAddrStatus(r && r.lat != null ? "ok" : "fail");
    } catch {
      setAddrStatus("fail");
    }
  };

  const baseOk = clientId && serviceTypeId && technicianId && date && time && (noAddress || address.trim());
  const canSubmit = baseOk && identifier.trim();

  const createOne = async (ident: string, at: string) => {
    const keyId = `${ident}|${at}`;
    keys.current[keyId] ||= crypto.randomUUID();
    const common = {
      idempotencyKey: keys.current[keyId],
      clientId,
      serviceTypeId,
      scheduledAt: `${date}T${at}:00-03:00`,
      durationMinutes: Number(duration) || 60,
      identifier: ident,
      address: noAddress ? undefined : address.trim() || undefined,
      noAddress,
      description: description || undefined,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.replace(/\D/g, "") || undefined,
      notifyContact,
    };
    return thirdParty
      ? await createThirdParty({ data: { ...common, thirdPartyTechnicianId: technicianId } })
      : await createAppointment({ data: { ...common, technicianId } });
  };

  const submitSingle = async () => {
    setTouched(true);
    if (!canSubmit) return toast.error("Preencha os campos obrigatórios.");
    setSubmitting(true);
    try {
      const res: any = await createOne(identifier.trim(), time);
      toast.success("OS criada no Seu Instalador.");
      onCreated?.();
      const d = res?.data ?? res;
      reset();
      if (thirdParty && d?.whatsappUrl) setThirdResult({ whatsappUrl: d.whatsappUrl });
      else onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitMulti = async () => {
    const idents = Array.from(new Set(multiList.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)));
    if (!baseOk) return toast.error("Preencha cliente, tipo, técnico e endereço antes de multiplicar.");
    if (idents.length < 1) return toast.error("Informe ao menos um identificador.");
    setSubmitting(true);
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < idents.length; i++) {
      const at = multiSequential ? addMinutes(time, i * (Number(duration) || 60)) : time;
      try { await createOne(idents[i], at); ok++; }
      catch (e) { fails.push(`${idents[i]}: ${errorMessage(e)}`); }
    }
    setSubmitting(false);
    if (ok) { toast.success(`${ok} OS criada(s).`); onCreated?.(); }
    if (fails.length) {
      toast.error(`${fails.length} falharam. ${fails.slice(0, 3).join(" | ")}`, { duration: 10000 });
      setMultiList(fails.map((f) => f.split(":")[0]).join("\n"));
    } else { reset(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova OS</DialogTitle>
        </DialogHeader>

        {thirdResult ? (
          <div className="space-y-3 text-sm">
            <p>OS criada para o técnico terceiro. Envie o link a ele — a mensagem não é enviada automaticamente.</p>
            <Button asChild>
              <a href={thirdResult.whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Enviar pelo WhatsApp
              </a>
            </Button>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setThirdResult(null); onClose(); }}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <div className="relative">
                  <Input
                    placeholder="Digite para buscar cliente"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); if (clientId) { setClientId(""); setClientLabel(""); setServiceTypeId(""); } }}
                  />
                  {!clientId && debounced.length >= 3 && (clientsQuery.isFetching || clients.length > 0 || clientsQuery.isError) && (
                    <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {clientsQuery.isFetching && (
                        <p className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                        </p>
                      )}
                      {clientsQuery.isError && <p className="px-3 py-2 text-xs text-destructive">{errorMessage(clientsQuery.error)}</p>}
                      {clients.map((c: any) => {
                        const id = String(c.id);
                        const label = pick(c, ["name", "nome", "companyName", "razaoSocial"], id);
                        return (
                          <button key={id} type="button"
                            onClick={() => { setClientId(id); setClientLabel(label); setSearch(label); setServiceTypeId(""); }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/60">
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {!clientsQuery.isFetching && debounced.length >= 3 && !clientId && clients.length === 0 && !clientsQuery.isError && (
                  <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Identificador *</Label>
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} onBlur={() => setTouched(true)} placeholder="Único por organização" />
                {touched && !identifier.trim() && <p className="text-xs text-destructive">Identificador obrigatório</p>}
              </div>

              <div className="space-y-2">
                <Label>Tipo de OS *</Label>
                <Select value={serviceTypeId} onValueChange={setServiceTypeId} disabled={!clientId}>
                  <SelectTrigger><SelectValue placeholder={clientId ? "Selecione" : "Escolha o cliente primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{pick(s, ["name", "nome", "title", "label"], String(s.id))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {serviceTypesQuery.isError && <p className="text-xs text-destructive">{errorMessage(serviceTypesQuery.error)}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Técnico *</Label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <Checkbox checked={thirdParty} onCheckedChange={(v) => { setThirdParty(!!v); setTechnicianId(""); }} />
                    Terceiro
                  </label>
                </div>
                <Select value={technicianId} onValueChange={setTechnicianId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {technicians.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{pick(t, ["name", "nome", "fullName"], String(t.id))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeQuery.isError && <p className="text-xs text-destructive">{errorMessage(activeQuery.error)}</p>}
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do contato</Label>
                  <Input value={contactName} maxLength={200} onChange={(e) => setContactName(e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone do contato</Label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(maskPhone(e.target.value))} placeholder="(DDD) número" inputMode="tel" />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={notifyContact} onCheckedChange={(v) => setNotifyContact(!!v)} />
                Enviar notificações ao contato
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Endereço</Label>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <Checkbox checked={noAddress} onCheckedChange={(v) => { setNoAddress(!!v); setAddrStatus("idle"); }} />
                  Sem endereço
                </label>
              </div>
              <div className="flex gap-2">
                <Input value={address} disabled={noAddress}
                  onChange={(e) => { setAddress(e.target.value); setAddrStatus("idle"); }}
                  placeholder="Rua, número, bairro, cidade - UF" />
                <Button type="button" variant="outline" disabled={noAddress || addrStatus === "checking"} onClick={validateAddress}>
                  {addrStatus === "checking" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Validar
                </Button>
              </div>
              {addrStatus === "ok" && <p className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3 w-3" /> Endereço localizado no mapa.</p>}
              {addrStatus === "fail" && <p className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3 w-3" /> Endereço não localizado. Confira número, bairro e cidade.</p>}
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              <p className="text-xs text-muted-foreground">Mensagem padrão da organização — edite se necessário.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Hora</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              <div className="space-y-2"><Label>Duração (min)</Label><Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
            </div>

            {multiOpen && (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <Label>Identificadores (um por linha ou separados por vírgula)</Label>
                <Textarea rows={4} value={multiList} onChange={(e) => setMultiList(e.target.value)} placeholder={"ABC1D23\nDEF4G56"} />
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={multiSequential} onCheckedChange={(v) => setMultiSequential(!!v)} />
                  Horários em sequência (soma a duração a cada OS)
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMultiOpen(false)}>Cancelar</Button>
                  <Button size="sm" onClick={submitMulti} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar {multiList.split(/[\n,;]+/).filter((s) => s.trim()).length || ""} OS
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setMultiOpen(true); if (!multiList && identifier.trim()) setMultiList(identifier.trim()); }} disabled={submitting}>
                Multiplicar OS
              </Button>
              <Button onClick={submitSingle} disabled={submitting}>
                {submitting && !multiOpen && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar OS
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
