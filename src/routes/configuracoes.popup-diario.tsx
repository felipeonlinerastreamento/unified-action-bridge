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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Bell, MessageSquare, CheckSquare, Loader2, Save, Eye, Repeat, Users, Briefcase, Volume2, Send, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/configuracoes/popup-diario")({
  component: PopupDiarioConfigPage,
});

interface Settings {
  id?: string;
  is_enabled: boolean;
  show_quote: boolean;
  quote_source: "ai" | "manual";
  manual_quote: string;
  manual_quote_author: string;
  show_reminders: boolean;
  show_tickets: boolean;
  show_tasks: boolean;
  greeting_text: string;
  reset_hour: number;
}

const DEFAULTS: Settings = {
  is_enabled: true,
  show_quote: true,
  quote_source: "ai",
  manual_quote: "",
  manual_quote_author: "",
  show_reminders: true,
  show_tickets: true,
  show_tasks: true,
  greeting_text: "Bom dia",
  reset_hour: 0,
};

function PopupDiarioConfigPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            Popup Diário de Boas-vindas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o popup que aparece no primeiro acesso do dia para cada usuário.
          </p>
        </div>
        <PopupSettingsForm />
      </div>
    </AppLayout>
  );
}

function PopupSettingsForm() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todaysQuote, setTodaysQuote] = useState<{ content: string; author: string } | null>(null);

  useEffect(() => {
    load();
    loadTodaysQuote();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("daily_welcome_settings" as any)
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(error);
    }
    if (data) setSettings({ ...DEFAULTS, ...(data as any) });
    setLoading(false);
  }

  async function loadTodaysQuote() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("daily_motivational_quotes" as any)
      .select("content, author")
      .eq("quote_date", today)
      .maybeSingle();
    if (data) setTodaysQuote(data as any);
  }

  async function save() {
    setSaving(true);
    const { id, ...payload } = settings;
    const { data: { user } } = await supabase.auth.getUser();
    const updateData: any = { ...payload, updated_at: new Date().toISOString(), updated_by: user?.id };

    let error;
    if (id) {
      ({ error } = await supabase.from("daily_welcome_settings" as any).update(updateData).eq("id", id));
    } else {
      ({ error } = await supabase.from("daily_welcome_settings" as any).insert(updateData));
    }
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configurações salvas");
      load();
    }
    setSaving(false);
  }

  async function regenerateTodaysQuote() {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("daily_motivational_quotes" as any).delete().eq("quote_date", today);
    setTodaysQuote(null);
    toast.success("Frase de hoje removida — uma nova será gerada no próximo acesso");
  }

  function previewPopup() {
    if (typeof window === "undefined") return;
    // Limpa o flag do dia atual para permitir reabrir
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("daily-welcome-shown:"));
    keys.forEach((k) => localStorage.removeItem(k));
    toast.success("Recarregue qualquer página para visualizar o popup");
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
      {/* Status geral */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado do popup</CardTitle>
          <CardDescription>Ativa ou desativa o popup de boas-vindas para todos os usuários.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Popup ativo</Label>
              <p className="text-xs text-muted-foreground">Quando desativado, o popup não é exibido a ninguém.</p>
            </div>
            <Switch
              checked={settings.is_enabled}
              onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Saudação</Label>
            <Input
              value={settings.greeting_text}
              onChange={(e) => setSettings({ ...settings, greeting_text: e.target.value })}
              placeholder="Bom dia"
            />
            <p className="text-xs text-muted-foreground">Aparecerá como "{settings.greeting_text}, [primeiro nome]"</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Hora de reset (0–23h)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={settings.reset_hour}
              onChange={(e) => setSettings({ ...settings, reset_hour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              A partir desse horário cada dia é considerado um "novo dia" para mostrar o popup.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Frase motivacional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> Frase motivacional
          </CardTitle>
          <CardDescription>Define como a frase do dia é gerada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Mostrar frase motivacional</Label>
            <Switch
              checked={settings.show_quote}
              onCheckedChange={(v) => setSettings({ ...settings, show_quote: v })}
            />
          </div>

          {settings.show_quote && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Origem da frase</Label>
                <Select
                  value={settings.quote_source}
                  onValueChange={(v: "ai" | "manual") => setSettings({ ...settings, quote_source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">IA (renovada todos os dias)</SelectItem>
                    <SelectItem value="manual">Frase fixa cadastrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.quote_source === "manual" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Frase</Label>
                    <Textarea
                      value={settings.manual_quote}
                      onChange={(e) => setSettings({ ...settings, manual_quote: e.target.value })}
                      placeholder="Digite a frase motivacional fixa..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Autor (opcional)</Label>
                    <Input
                      value={settings.manual_quote_author}
                      onChange={(e) => setSettings({ ...settings, manual_quote_author: e.target.value })}
                      placeholder="Nome do autor"
                    />
                  </div>
                </>
              )}

              {settings.quote_source === "ai" && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Frase de hoje (cache)</p>
                    <Button size="sm" variant="ghost" onClick={regenerateTodaysQuote} className="h-7 text-xs">
                      Regenerar
                    </Button>
                  </div>
                  {todaysQuote ? (
                    <>
                      <p className="text-sm italic">"{todaysQuote.content}"</p>
                      {todaysQuote.author && (
                        <p className="text-xs text-muted-foreground">— {todaysQuote.author}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma frase gerada ainda hoje.</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pendências exibidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seções de pendências</CardTitle>
          <CardDescription>Escolha quais blocos de pendências aparecem no popup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            icon={<Bell className="h-4 w-4 text-amber-500" />}
            label="Lembretes vencidos"
            description="Lembretes criados pelo usuário cuja data já venceu."
            checked={settings.show_reminders}
            onChange={(v) => setSettings({ ...settings, show_reminders: v })}
          />
          <ToggleRow
            icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
            label="Atendimentos atribuídos"
            description="Tickets em aberto ou em andamento atribuídos ao usuário."
            checked={settings.show_tickets}
            onChange={(v) => setSettings({ ...settings, show_tickets: v })}
          />
          <ToggleRow
            icon={<CheckSquare className="h-4 w-4 text-green-500" />}
            label="Tarefas pendentes"
            description="Tarefas atribuídas ao usuário que ainda não foram concluídas."
            checked={settings.show_tasks}
            onChange={(v) => setSettings({ ...settings, show_tasks: v })}
          />
        </CardContent>
      </Card>

      {/* Lembrete recorrente de pendências */}
      <RecurringReminderSection />

      {/* Ações */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={previewPopup} className="gap-1">
          <Eye className="h-4 w-4" />
          Pré-visualizar
        </Button>
        <Button onClick={save} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-md border">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-0.5">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{label}</Label>
            {checked && (
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                ativo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ============================================================
// Lembrete recorrente de pendências
// ============================================================

interface RecurringSettings {
  id?: string;
  is_enabled: boolean;
  interval_hours: number;
  quiet_start: string;
  quiet_end: string;
  weekdays: number[];
  target_type: "all" | "sector" | "users";
  target_sector_ids: string[];
  target_user_ids: string[];
  show_open_chats: boolean;
  show_my_tickets: boolean;
  show_sector_tickets: boolean;
  min_total_to_show: number;
  sound_enabled: boolean;
  requires_acknowledge: boolean;
}

const RECURRING_DEFAULTS: RecurringSettings = {
  is_enabled: false,
  interval_hours: 2,
  quiet_start: "08:00",
  quiet_end: "18:00",
  weekdays: [1, 2, 3, 4, 5],
  target_type: "all",
  target_sector_ids: [],
  target_user_ids: [],
  show_open_chats: true,
  show_my_tickets: true,
  show_sector_tickets: true,
  min_total_to_show: 1,
  sound_enabled: false,
  requires_acknowledge: true,
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function RecurringReminderSection() {
  const [s, setS] = useState<RecurringSettings>(RECURRING_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ user_id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [cfgRes, secRes, userRes] = await Promise.all([
        supabase.from("pending_reminder_settings" as any).select("*").limit(1).maybeSingle(),
        supabase.from("sectors").select("id, name").eq("is_active", true).order("name"),
        supabase.from("profiles").select("user_id, name").order("name"),
      ]);
      if (cfgRes.data) setS({ ...RECURRING_DEFAULTS, ...(cfgRes.data as any) });
      setSectors((secRes.data as any) || []);
      setUsers((userRes.data as any) || []);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { id, ...payload } = s;
    const { data: { user } } = await supabase.auth.getUser();
    const updateData: any = { ...payload, updated_by: user?.id };
    let error;
    if (id) {
      ({ error } = await supabase.from("pending_reminder_settings" as any).update(updateData).eq("id", id));
    } else {
      ({ error } = await supabase.from("pending_reminder_settings" as any).insert(updateData));
      // recarrega para obter o id
      const { data } = await supabase.from("pending_reminder_settings" as any).select("*").limit(1).maybeSingle();
      if (data) setS({ ...RECURRING_DEFAULTS, ...(data as any) });
    }
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Lembrete recorrente salvo");
    setSaving(false);
  }

  function preview() {
    if (typeof window === "undefined") return;
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("pending-reminder:last:"));
    keys.forEach((k) => localStorage.removeItem(k));
    toast.success("Lembrete será reavaliado em até 60s — ou recarregue a página");
  }

  function toggleWeekday(d: number) {
    const set = new Set(s.weekdays);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    setS({ ...s, weekdays: Array.from(set).sort() });
  }

  function toggleArrayItem(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          Lembrete recorrente de pendências
        </CardTitle>
        <CardDescription>
          Reabre o popup periodicamente lembrando o operador de chats e atendimentos em aberto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Ativar lembrete recorrente</Label>
            <p className="text-xs text-muted-foreground">Quando desativado, este popup nunca aparece.</p>
          </div>
          <Switch checked={s.is_enabled} onCheckedChange={(v) => setS({ ...s, is_enabled: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">A cada (horas)</Label>
            <Input
              type="number"
              step="0.25"
              min={0.25}
              max={24}
              value={s.interval_hours}
              onChange={(e) => setS({ ...s, interval_hours: Math.max(0.25, Math.min(24, Number(e.target.value) || 1)) })}
            />
            <p className="text-[10px] text-muted-foreground">Aceita decimais (ex.: 0.5 = 30 min).</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Janela ativa — início</Label>
            <Input
              type="time"
              value={s.quiet_start}
              onChange={(e) => setS({ ...s, quiet_start: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Janela ativa — fim</Label>
            <Input
              type="time"
              value={s.quiet_end}
              onChange={(e) => setS({ ...s, quiet_end: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Dias da semana</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, idx) => {
              const active = s.weekdays.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleWeekday(idx)}
                  className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Destinatários</Label>
          <Select
            value={s.target_type}
            onValueChange={(v: "all" | "sector" | "users") => setS({ ...s, target_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              <SelectItem value="sector">Apenas usuários de setores específicos</SelectItem>
              <SelectItem value="users">Usuários selecionados</SelectItem>
            </SelectContent>
          </Select>

          {s.target_type === "sector" && (
            <div className="border rounded-md p-3 max-h-44 overflow-auto space-y-1.5">
              {sectors.length === 0 && <p className="text-xs text-muted-foreground">Nenhum setor ativo cadastrado.</p>}
              {sectors.map((sec) => {
                const checked = s.target_sector_ids.includes(sec.id);
                return (
                  <label key={sec.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => setS({ ...s, target_sector_ids: toggleArrayItem(s.target_sector_ids, sec.id) })}
                    />
                    {sec.name}
                  </label>
                );
              })}
            </div>
          )}

          {s.target_type === "users" && (
            <div className="border rounded-md p-3 max-h-44 overflow-auto space-y-1.5">
              {users.length === 0 && <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>}
              {users.map((u) => {
                const checked = s.target_user_ids.includes(u.user_id);
                return (
                  <label key={u.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => setS({ ...s, target_user_ids: toggleArrayItem(s.target_user_ids, u.user_id) })}
                    />
                    {u.name || u.user_id}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Conteúdo exibido</Label>
          <ToggleRow
            icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
            label="Chats em aberto"
            description="Conversas Z-API aguardando atendimento ou em andamento."
            checked={s.show_open_chats}
            onChange={(v) => setS({ ...s, show_open_chats: v })}
          />
          <ToggleRow
            icon={<Briefcase className="h-4 w-4 text-amber-500" />}
            label="Meus atendimentos"
            description="Tickets atribuídos ao usuário (em aberto ou em andamento)."
            checked={s.show_my_tickets}
            onChange={(v) => setS({ ...s, show_my_tickets: v })}
          />
          <ToggleRow
            icon={<Users className="h-4 w-4 text-purple-500" />}
            label="Atendimentos do meu setor"
            description="Tickets em aberto/andamento dos setores que o usuário pertence."
            checked={s.show_sector_tickets}
            onChange={(v) => setS({ ...s, show_sector_tickets: v })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Mostrar somente se houver pelo menos</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={s.min_total_to_show}
              onChange={(e) => setS({ ...s, min_total_to_show: Math.max(0, Number(e.target.value) || 0) })}
            />
            <p className="text-[10px] text-muted-foreground">Soma de chats + atendimentos. Use 0 para sempre abrir.</p>
          </div>
          <div className="flex items-end">
            <ToggleRow
              icon={<Volume2 className="h-4 w-4 text-emerald-500" />}
              label="Som ao abrir"
              description="Toca um aviso sonoro quando o popup aparece."
              checked={s.sound_enabled}
              onChange={(v) => setS({ ...s, sound_enabled: v })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <Button variant="outline" onClick={preview} className="gap-1">
            <Eye className="h-4 w-4" />
            Pré-visualizar
          </Button>
          <Button onClick={save} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar lembrete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

