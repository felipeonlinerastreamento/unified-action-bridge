import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  analisarDirecionamento,
  buscarClientes,
  confirmarDirecionamento,
  criarDirecionamento,
  listarAtividades,
  listarDirecionamentos,
  tiposDeServicoDoCliente,
} from "@/lib/seu-instalador.functions";
import { asList, errorMessage, minutesOfDaySP, pick, todayISO } from "./shared";
import { regionOf } from "./solicitacoes-regiao";
import { geocodificarEnderecos } from "@/lib/geocode.functions";
import { formatDateTime, saoPauloParts } from "./shared";

interface Props {
  technicians: any[];
  defaultDate: string;
  onCreated: (activity: any) => void;
}

function techIdOf(a: any): string {
  const v = a?.technicianId ?? a?.technician?.id;
  return v ? String(v) : "";
}

function techNameOf(a: any): string {
  return (
    pick(a, ["technicianName"], "") || pick(a?.technician ?? {}, ["name", "nome", "fullName"], "") || "Sem técnico"
  );
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Cliente em formato de caixa de seleção com busca (como no Seu Instalador). */
function EmpresaCombobox({
  value,
  label,
  onSelect,
}: {
  value: string;
  label: string;
  onSelect: (id: string, name: string) => void;
}) {
  const searchClients = useServerFn(buscarClientes);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const query = useQuery({
    queryKey: ["si-clients", debounced],
    enabled: debounced.length >= 3,
    retry: 1,
    queryFn: () => searchClients({ data: { search: debounced } }),
  });
  const clients = useMemo(() => asList(query.data), [query.data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
          type="button"
        >
          <span className={value ? "" : "text-muted-foreground"}>{value ? label : "Selecione"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite ao menos 3 letras" value={term} onValueChange={setTerm} />
          <CommandList>
            {query.isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
              </div>
            )}
            {!query.isFetching && debounced.length < 3 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Digite ao menos 3 letras do nome.</div>
            )}
            {!query.isFetching && debounced.length >= 3 && clients.length === 0 && (
              <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            )}
            {clients.map((c: any) => {
              const id = String(c.id);
              const name = pick(c, ["name", "nome", "companyName", "razaoSocial"], id);
              return (
                <CommandItem
                  key={id}
                  value={id}
                  onSelect={() => {
                    onSelect(id, name);
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === id ? "opacity-100" : "opacity-0"}`} />
                  {name}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SolicitacoesDirecionar({ technicians, defaultDate, onCreated }: Props) {
  const loadServiceTypes = useServerFn(tiposDeServicoDoCliente);
  const fetchAtividades = useServerFn(listarAtividades);
  const geocode = useServerFn(geocodificarEnderecos);
  const createRouting = useServerFn(criarDirecionamento);
  const analyzeRouting = useServerFn(analisarDirecionamento);
  const confirmRouting = useServerFn(confirmarDirecionamento);
  const loadRoutings = useServerFn(listarDirecionamentos);
  const [routing, setRouting] = useState<any | null>(null);
  const [confTech, setConfTech] = useState("");
  const [confDate, setConfDate] = useState("");
  const [confTime, setConfTime] = useState("09:00");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const routingsQuery = useQuery({
    queryKey: ["si-routings"],
    queryFn: () => loadRoutings({ data: { page: 1, pageSize: 20 } }),
    staleTime: 30_000,
  });
  const routings = useMemo(() => asList(routingsQuery.data), [routingsQuery.data]);

  function selectRouting(r: any) {
    setRouting(r);
    const techRec = r?.recommendedTechnicianId ?? r?.recommendation?.technicianId;
    setConfTech(techRec ? String(techRec) : "");
    const at = r?.recommendedScheduledAt ?? r?.recommendedAt ?? null;
    const parts = at && String(at).length > 10 ? saoPauloParts(at) : null;
    setConfDate(parts?.date ?? r?.serviceDate ?? date);
    setConfTime(parts?.time ?? String(r?.windowStart ?? "09:00").slice(0, 5));
    setJustification("");
  }

  async function analisar(id: string) {
    setBusy(true);
    try {
      const res: any = await analyzeRouting({ data: { idempotencyKey: crypto.randomUUID(), routingId: id } });
      selectRouting(res?.data ?? res);
      routingsQuery.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmar() {
    if (!routing?.id || !confTech || !confDate) return toast.error("Escolha o técnico, a data e o horário.");
    setBusy(true);
    try {
      const res: any = await confirmRouting({
        data: {
          idempotencyKey: crypto.randomUUID(),
          routingId: String(routing.id),
          technicianId: confTech,
          scheduledAt: `${confDate}T${confTime}:00-03:00`,
          justification: justification || undefined,
        },
      });
      toast.success("Direcionamento confirmado e OS criada.");
      setRouting(null);
      routingsQuery.refetch();
      onCreated(res?.data ?? res);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [priority, setPriority] = useState("normal");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(defaultDate || todayISO());
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<"exato" | "janela">("janela");
  const [exactTime, setExactTime] = useState("09:00");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const serviceTypesQuery = useQuery({
    queryKey: ["si-service-types", clientId],
    enabled: !!clientId,
    queryFn: () => loadServiceTypes({ data: { clientId } }),
  });
  const serviceTypes = useMemo(() => asList(serviceTypesQuery.data), [serviceTypesQuery.data]);

  const atividadesQuery = useQuery({
    queryKey: ["si-direcionar-atividades", date],
    enabled: !!date,
    queryFn: () => fetchAtividades({ data: { scheduledFrom: date, scheduledTo: date, page: 1, pageSize: 100 } }),
    staleTime: 60_000,
  });
  const dayActivities = useMemo(() => asList(atividadesQuery.data), [atividadesQuery.data]);

  const targetRegion = useMemo(() => regionOf({ address }), [address]);

  /** Técnico sugerido: o que mais atua na região e tem horário livre na janela. */
  const suggestion = useMemo(() => {
    if (!address.trim() || technicians.length === 0) return null;

    const start = mode === "exato" ? toMinutes(exactTime) : toMinutes(windowStart);
    const limit = mode === "exato" ? start + Number(duration || 60) : toMinutes(windowEnd);
    const dur = Number(duration) || 60;

    const regionCount = new Map<string, number>();
    const busyByTech = new Map<string, { s: number; e: number }[]>();
    for (const a of dayActivities) {
      const id = techIdOf(a);
      if (!id) continue;
      const s = minutesOfDaySP(a?.scheduledAt);
      if (s !== null) {
        const e = s + (Number(a?.durationMinutes ?? a?.duration ?? 60) || 60);
        const list = busyByTech.get(id) ?? [];
        list.push({ s, e });
        busyByTech.set(id, list);
      }
      if (targetRegion && regionOf(a).toLowerCase() === targetRegion.toLowerCase()) {
        regionCount.set(id, (regionCount.get(id) ?? 0) + 1);
      }
    }

    const firstFree = (techId: string): number | null => {
      const busy = busyByTech.get(techId) ?? [];
      for (let t = start; t + dur <= Math.max(limit, start + dur); t += 30) {
        const free = busy.every((b) => t >= b.e || t + dur <= b.s);
        if (free) return t;
      }
      return null;
    };

    const ranked = technicians
      .map((t: any) => {
        const id = String(t.id);
        const slot = firstFree(id);
        return {
          id,
          name: pick(t, ["name", "nome", "fullName"], id),
          naRegiao: regionCount.get(id) ?? 0,
          carga: (busyByTech.get(id) ?? []).length,
          slot,
        };
      })
      .filter((t) => t.slot !== null)
      .sort((a, b) => b.naRegiao - a.naRegiao || a.carga - b.carga || (a.slot! - b.slot!));

    return ranked[0] ?? null;
  }, [address, technicians, dayActivities, targetRegion, mode, exactTime, windowStart, windowEnd, duration]);

  const nearby = useMemo(() => {
    if (!targetRegion) return [];
    return dayActivities.filter((a: any) => regionOf(a).toLowerCase() === targetRegion.toLowerCase());
  }, [dayActivities, targetRegion]);

  const extraNotes = () => {
    const lines: string[] = [];
    if (priority !== "normal") lines.push(`Prioridade: ${priority}`);
    if (contact) lines.push(`Contato: ${contact}`);
    if (phone) lines.push(`Telefone: ${phone}`);
    if (mode === "janela") lines.push(`Janela de atendimento: ${windowStart} às ${windowEnd}`);
    if (description) lines.push(description);
    return lines.join("\n");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const [geo] = await geocode({ data: { addresses: [address.trim()] } });
      if (!geo || geo.lat == null || geo.lng == null) {
        throw new Error("Não foi possível localizar este endereço no mapa. Ajuste o endereço (rua, número, cidade - UF) e tente novamente.");
      }
      const created: any = await createRouting({
        data: {
          idempotencyKey: idempotencyKey.current,
          clientId,
          serviceTypeId,
          identifier: identifier || undefined,
          description: description || undefined,
          address: address.trim(),
          lat: geo.lat,
          lng: geo.lng,
          serviceDate: date,
          scheduleType: mode,
          windowStart: mode === "exato" ? exactTime : windowStart,
          windowEnd: mode === "exato" ? exactTime : windowEnd,
          durationMinutes: Number(duration) || 60,
          priority: (priority === "baixa" ? "normal" : priority) as "normal" | "alta" | "urgente",
          contactName: contact || undefined,
          contactPhone: phone || undefined,
        },
      });
      idempotencyKey.current = crypto.randomUUID();
      const r = created?.data ?? created;
      const analyzed: any = await analyzeRouting({ data: { idempotencyKey: crypto.randomUUID(), routingId: String(r.id) } });
      return analyzed?.data ?? analyzed ?? r;
    },
    onSuccess: (r: any) => {
      toast.success("Pedido registrado e analisado pelo Seu Instalador.");
      selectRouting(r);
      routingsQuery.refetch();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSubmit = !!clientId && !!serviceTypeId && !!address.trim() && !!date;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Informe o atendimento para localizar serviços próximos e sugerir o melhor técnico e horário.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            Empresa <span className="text-destructive">*</span>
          </Label>
          <EmpresaCombobox
            value={clientId}
            label={clientName}
            onSelect={(id, name) => {
              setClientId(id);
              setClientName(name);
              setServiceTypeId("");
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Atividade <span className="text-destructive">*</span>
          </Label>
          <Select value={serviceTypeId} onValueChange={setServiceTypeId} disabled={!clientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
          <Label>Identificador</Label>
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Placa, protocolo ou referência"
          />
        </div>

        <div className="space-y-2">
          <Label>Prioridade</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Endereço do serviço <span className="text-destructive">*</span>
        </Label>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, número, bairro, cidade - UF"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            Data <span className="text-destructive">*</span>
          </Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>
            Duração estimada (minutos) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Horário</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as "exato" | "janela")}
          className="flex flex-wrap gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="exato" id="hora-exata" />
            <Label htmlFor="hora-exata" className="cursor-pointer font-normal">
              Horário exato
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="janela" id="hora-janela" />
            <Label htmlFor="hora-janela" className="cursor-pointer font-normal">
              Janela de atendimento
            </Label>
          </div>
        </RadioGroup>
      </div>

      {mode === "exato" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Horário <span className="text-destructive">*</span>
            </Label>
            <Input type="time" value={exactTime} onChange={(e) => setExactTime(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>
              Início da janela <span className="text-destructive">*</span>
            </Label>
            <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>
              Fim da janela <span className="text-destructive">*</span>
            </Label>
            <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Contato</Label>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição e observações</Label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {address.trim() && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            {suggestion
              ? `Prévia local: ${suggestion.name} às ${toHHMM(mode === "exato" ? toMinutes(exactTime) : suggestion.slot!)}`
              : "Nenhum técnico livre para este endereço e horário."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {targetRegion ? `Região identificada: ${targetRegion}. ` : "Região não identificada pelo endereço. "}
            {nearby.length} atendimento(s) próximos nesta data
            {suggestion ? ` · ${suggestion.naRegiao} deste técnico na região` : ""}.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registrar e analisar
        </Button>
      </div>

      {routing && (
        <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Recomendação do Seu Instalador
          </p>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {typeof routing.recommendation === "string" ? routing.recommendation : "Sem recomendação ainda. Clique em Analisar."}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Técnico</Label>
              <Select value={confTech} onValueChange={setConfTech}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{pick(t, ["name", "nome"], String(t.id))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={confDate} onChange={(e) => setConfDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Horário</Label><Input type="time" value={confTime} onChange={(e) => setConfTime(e.target.value)} /></div>
          </div>
          <Input placeholder="Justificativa (opcional)" value={justification} maxLength={1000} onChange={(e) => setJustification(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRouting(null)}>Fechar</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void analisar(String(routing.id))}>Analisar novamente</Button>
            <Button size="sm" disabled={busy} onClick={() => void confirmar()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar e criar OS
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm font-medium">Direcionamentos recentes</p>
        {routingsQuery.isError ? (
          <p className="text-xs text-destructive">{errorMessage(routingsQuery.error)}</p>
        ) : routings.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum direcionamento registrado.</p>
        ) : (
          <ul className="space-y-1">
            {routings.map((r: any) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => selectRouting(r)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-xs hover:bg-muted/40"
                >
                  <span className="font-medium">{r?.client?.name ?? "Cliente"} · {r?.serviceType?.name ?? ""}</span>
                  <span className="text-muted-foreground">{r?.serviceDate ? formatDateTime(`${r.serviceDate}T12:00:00-03:00`).slice(0, 10) : ""} · <span className="capitalize">{r?.status}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
