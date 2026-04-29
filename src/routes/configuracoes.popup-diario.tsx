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
import { Sparkles, Bell, MessageSquare, CheckSquare, Loader2, Save, Eye } from "lucide-react";
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
