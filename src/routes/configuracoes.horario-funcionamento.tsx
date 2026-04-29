import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes/horario-funcionamento")({
  component: BusinessHoursPage,
});

type DaySchedule = {
  enabled: boolean;
  open: string;
  close: string;
  lunch_start: string | null;
  lunch_end: string | null;
};

type Schedule = Record<string, DaySchedule>;

interface Settings {
  id?: string;
  is_enabled: boolean;
  timezone: string;
  schedule: Schedule;
  out_of_hours_message: string;
  cooldown_minutes: number;
  holidays: string[];
}

const DAYS = [
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" },
  { key: "0", label: "Domingo" },
];

const DEFAULT_DAY: DaySchedule = {
  enabled: true,
  open: "08:00",
  close: "18:00",
  lunch_start: "12:00",
  lunch_end: "13:00",
};

const DEFAULTS: Settings = {
  is_enabled: false,
  timezone: "America/Sao_Paulo",
  schedule: {
    "0": { ...DEFAULT_DAY, enabled: false, lunch_start: null, lunch_end: null },
    "1": { ...DEFAULT_DAY },
    "2": { ...DEFAULT_DAY },
    "3": { ...DEFAULT_DAY },
    "4": { ...DEFAULT_DAY },
    "5": { ...DEFAULT_DAY },
    "6": { ...DEFAULT_DAY, enabled: false, lunch_start: null, lunch_end: null },
  },
  out_of_hours_message:
    "Olá! No momento estamos fora do horário de atendimento. Retornaremos seu contato assim que possível durante o nosso horário comercial. Obrigado!",
  cooldown_minutes: 120,
  holidays: [],
};

function BusinessHoursPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Horário de Funcionamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o horário comercial e a mensagem automática enviada quando uma mensagem chegar fora do horário.
          </p>
        </div>
        <BusinessHoursForm />
      </div>
    </AppLayout>
  );
}

function BusinessHoursForm() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_hours_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      toast.error("Erro ao carregar configurações");
    } else if (data) {
      setSettings({
        id: data.id,
        is_enabled: data.is_enabled,
        timezone: data.timezone,
        schedule: { ...DEFAULTS.schedule, ...(data.schedule as Schedule) },
        out_of_hours_message: data.out_of_hours_message,
        cooldown_minutes: data.cooldown_minutes,
        holidays: (data.holidays as string[]) ?? [],
      });
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      is_enabled: settings.is_enabled,
      timezone: settings.timezone,
      schedule: settings.schedule,
      out_of_hours_message: settings.out_of_hours_message,
      cooldown_minutes: settings.cooldown_minutes,
      holidays: settings.holidays,
      updated_by: userData.user?.id ?? null,
    };
    const query = settings.id
      ? supabase.from("business_hours_settings").update(payload).eq("id", settings.id)
      : supabase.from("business_hours_settings").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configurações salvas");
      load();
    }
  }

  function updateDay(key: string, patch: Partial<DaySchedule>) {
    setSettings((s) => ({
      ...s,
      schedule: { ...s.schedule, [key]: { ...s.schedule[key], ...patch } },
    }));
  }

  function addHoliday() {
    if (!newHoliday) return;
    if (settings.holidays.includes(newHoliday)) {
      toast.error("Data já adicionada");
      return;
    }
    setSettings((s) => ({ ...s, holidays: [...s.holidays, newHoliday].sort() }));
    setNewHoliday("");
  }

  function removeHoliday(d: string) {
    setSettings((s) => ({ ...s, holidays: s.holidays.filter((x) => x !== d) }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração geral</CardTitle>
          <CardDescription>Ative o controle de horário e defina o fuso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Habilitar resposta automática fora do horário</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, mensagens recebidas fora do horário receberão a resposta automática.
              </p>
            </div>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, is_enabled: v }))}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Fuso horário</Label>
              <Input
                value={settings.timezone}
                onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                placeholder="America/Sao_Paulo"
              />
            </div>
            <div>
              <Label>Cooldown (minutos)</Label>
              <Input
                type="number"
                min={0}
                value={settings.cooldown_minutes}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, cooldown_minutes: Number(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tempo mínimo antes de reenviar a mensagem ao mesmo contato.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agenda semanal</CardTitle>
          <CardDescription>Configure o horário de cada dia. Intervalo de almoço é opcional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const day = settings.schedule[key];
            return (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_1fr_1fr] gap-2 items-center p-3 border rounded-md"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(v) => updateDay(key, { enabled: v })}
                  />
                  <span className="font-medium">{label}</span>
                </div>
                <div>
                  <Label className="text-xs">Abre</Label>
                  <Input
                    type="time"
                    value={day.open}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    type="time"
                    value={day.close}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Almoço (início)</Label>
                  <Input
                    type="time"
                    value={day.lunch_start ?? ""}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, { lunch_start: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Almoço (fim)</Label>
                  <Input
                    type="time"
                    value={day.lunch_end ?? ""}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, { lunch_end: e.target.value || null })}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensagem automática fora do horário</CardTitle>
          <CardDescription>Texto enviado quando uma mensagem chegar fora do horário comercial.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={5}
            value={settings.out_of_hours_message}
            onChange={(e) => setSettings((s) => ({ ...s, out_of_hours_message: e.target.value }))}
            placeholder="Mensagem que será enviada automaticamente..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feriados e datas especiais</CardTitle>
          <CardDescription>Datas em que o atendimento estará fechado, independentemente da agenda semanal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="date"
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="max-w-xs"
            />
            <Button type="button" variant="outline" onClick={addHoliday}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {settings.holidays.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum feriado cadastrado.</p>
            )}
            {settings.holidays.map((h) => (
              <Badge key={h} variant="secondary" className="gap-1">
                {new Date(h + "T00:00:00").toLocaleDateString("pt-BR")}
                <button
                  type="button"
                  onClick={() => removeHoliday(h)}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remover ${h}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
