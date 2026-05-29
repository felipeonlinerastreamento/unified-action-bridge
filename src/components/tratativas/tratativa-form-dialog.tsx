import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export type Categoria = "telemetria" | "fadiga";

type AlarmeRow = {
  data_hora: string;
  latitude: string;
  longitude: string;
  velocidade: string;
};

export type TratativaRow = {
  id: string;
  categoria: Categoria;
  numero_ocorrencia: string;
  situacao: string | null;
  cliente: string | null;
  identificador: string | null;
  imei: string | null;
  tipo: string | null;
  responsavel_email: string | null;
  data_tratativa: string | null;
  primeiro_alarme: string | null;
  ultimo_alarme: string | null;
  motorista_nome: string | null;
  motorista_situacao: string | null;
  motorista_observacoes: string | null;
  alarmes: AlarmeRow[];
  created_at?: string;
};

const SITUACOES = ["Sem risco", "Risco baixo", "Risco médio", "Risco alto"];

const TIPOS_TELEMETRIA = [
  "Excesso de velocidade",
  "Frenagem brusca",
  "Aceleração brusca",
  "Curva agressiva",
  "Direção noturna",
  "Tempo excedido de condução",
];
const TIPOS_FADIGA = [
  "Distração",
  "Sonolência",
  "Bocejo",
  "Olhos fechados",
  "Uso de celular",
  "Fumando",
  "Sem cinto",
];

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  } catch {
    return "";
  }
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoria: Categoria;
  editing?: TratativaRow | null;
}

export function TratativaFormDialog({ open, onOpenChange, categoria, editing }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [numero, setNumero] = useState("");
  const [situacao, setSituacao] = useState<string>("Sem risco");
  const [cliente, setCliente] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [imei, setImei] = useState("");
  const [tipo, setTipo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [dataTratativa, setDataTratativa] = useState("");
  const [primeiroAlarme, setPrimeiroAlarme] = useState("");
  const [ultimoAlarme, setUltimoAlarme] = useState("");
  const [motoristaNome, setMotoristaNome] = useState("");
  const [motoristaSituacao, setMotoristaSituacao] = useState("Sem risco");
  const [motoristaObs, setMotoristaObs] = useState("");
  const [alarmes, setAlarmes] = useState<AlarmeRow[]>([
    { data_hora: "", latitude: "", longitude: "", velocidade: "" },
  ]);

  const tipoOptions = categoria === "fadiga" ? TIPOS_FADIGA : TIPOS_TELEMETRIA;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumero(editing.numero_ocorrencia || "");
      setSituacao(editing.situacao || "Sem risco");
      setCliente(editing.cliente || "");
      setIdentificador(editing.identificador || "");
      setImei(editing.imei || "");
      setTipo(editing.tipo || "");
      setResponsavel(editing.responsavel_email || user?.email || "");
      setDataTratativa(toLocalInput(editing.data_tratativa));
      setPrimeiroAlarme(toLocalInput(editing.primeiro_alarme));
      setUltimoAlarme(toLocalInput(editing.ultimo_alarme));
      setMotoristaNome(editing.motorista_nome || "");
      setMotoristaSituacao(editing.motorista_situacao || "Sem risco");
      setMotoristaObs(editing.motorista_observacoes || "");
      const arr = (editing.alarmes || []).map((a) => ({
        data_hora: toLocalInput(a.data_hora),
        latitude: a.latitude || "",
        longitude: a.longitude || "",
        velocidade: a.velocidade || "",
      }));
      setAlarmes(arr.length > 0 ? arr : [{ data_hora: "", latitude: "", longitude: "", velocidade: "" }]);
    } else {
      setNumero("");
      setSituacao("Sem risco");
      setCliente("");
      setIdentificador("");
      setImei("");
      setTipo("");
      setResponsavel(user?.email || "");
      const now = toLocalInput(new Date().toISOString());
      setDataTratativa(now);
      setPrimeiroAlarme("");
      setUltimoAlarme("");
      setMotoristaNome("");
      setMotoristaSituacao("Sem risco");
      setMotoristaObs("");
      setAlarmes([{ data_hora: "", latitude: "", longitude: "", velocidade: "" }]);
    }
  }, [open, editing, user?.email]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!numero.trim()) throw new Error("Informe o nº da ocorrência");
      const payload = {
        categoria,
        numero_ocorrencia: numero.trim(),
        situacao,
        cliente: cliente.trim() || null,
        identificador: identificador.trim() || null,
        imei: imei.trim() || null,
        tipo: tipo || null,
        responsavel_email: responsavel.trim() || null,
        data_tratativa: fromLocalInput(dataTratativa),
        primeiro_alarme: fromLocalInput(primeiroAlarme),
        ultimo_alarme: fromLocalInput(ultimoAlarme),
        motorista_nome: motoristaNome.trim() || null,
        motorista_situacao: motoristaSituacao,
        motorista_observacoes: motoristaObs.trim() || null,
        alarmes: alarmes
          .filter((a) => a.data_hora || a.latitude || a.longitude || a.velocidade)
          .map((a) => ({
            data_hora: fromLocalInput(a.data_hora),
            latitude: a.latitude || null,
            longitude: a.longitude || null,
            velocidade: a.velocidade || null,
          })),
        created_by: user?.id || null,
      };
      if (editing) {
        const { error } = await supabase.from("tratativas" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tratativas" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Tratativa atualizada" : "Tratativa registrada");
      qc.invalidateQueries({ queryKey: ["tratativas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const updateAlarme = (i: number, patch: Partial<AlarmeRow>) => {
    setAlarmes((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const addAlarme = () =>
    setAlarmes((p) => [...p, { data_hora: "", latitude: "", longitude: "", velocidade: "" }]);
  const removeAlarme = (i: number) =>
    setAlarmes((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar" : "Nova"} tratativa — {categoria === "fadiga" ? "Fadiga" : "Telemetria"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nº da Ocorrência *</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div>
            <Label>Situação</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SITUACOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </div>
          <div>
            <Label>Identificador</Label>
            <Input value={identificador} onChange={(e) => setIdentificador(e.target.value)} />
          </div>
          <div>
            <Label>IMEI</Label>
            <Input value={imei} onChange={(e) => setImei(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {tipoOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 border-t pt-3 mt-1">
            <h4 className="text-sm font-semibold mb-2">Tratativa</h4>
          </div>
          <div>
            <Label>Responsável (e-mail)</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
          </div>
          <div>
            <Label>Data da Tratativa</Label>
            <Input type="datetime-local" value={dataTratativa} onChange={(e) => setDataTratativa(e.target.value)} />
          </div>
          <div>
            <Label>Primeiro Alarme</Label>
            <Input type="datetime-local" value={primeiroAlarme} onChange={(e) => setPrimeiroAlarme(e.target.value)} />
          </div>
          <div>
            <Label>Último Alarme</Label>
            <Input type="datetime-local" value={ultimoAlarme} onChange={(e) => setUltimoAlarme(e.target.value)} />
          </div>

          <div className="md:col-span-2 border-t pt-3 mt-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Alarmes</h4>
            <Button type="button" variant="outline" size="sm" onClick={addAlarme}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {alarmes.map((a, i) => (
            <div key={i} className="md:col-span-2 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <Label className="text-xs">Data / Hora</Label>
                <Input type="datetime-local" value={a.data_hora}
                  onChange={(e) => updateAlarme(i, { data_hora: e.target.value })} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Latitude</Label>
                <Input value={a.latitude} onChange={(e) => updateAlarme(i, { latitude: e.target.value })} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Longitude</Label>
                <Input value={a.longitude} onChange={(e) => updateAlarme(i, { longitude: e.target.value })} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Vel.</Label>
                <Input value={a.velocidade} onChange={(e) => updateAlarme(i, { velocidade: e.target.value })} placeholder="KM/H" />
              </div>
              <div className="col-span-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeAlarme(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          <div className="md:col-span-2 border-t pt-3 mt-1">
            <h4 className="text-sm font-semibold mb-2">Motorista</h4>
          </div>
          <div>
            <Label>Motorista</Label>
            <Input value={motoristaNome} onChange={(e) => setMotoristaNome(e.target.value)} placeholder="Não Definido" />
          </div>
          <div>
            <Label>Situação</Label>
            <Select value={motoristaSituacao} onValueChange={setMotoristaSituacao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SITUACOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={motoristaObs} onChange={(e) => setMotoristaObs(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {editing ? "Salvar alterações" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
