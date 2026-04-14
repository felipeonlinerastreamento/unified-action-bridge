import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, ArrowUpToLine, Volume2, SortAsc, Sparkles, Loader2 } from "lucide-react";

interface AlertSettings {
  id: string;
  notify_supervisor_on_red: boolean;
  highlight_critical_conversations: boolean;
  enable_sound_alert: boolean;
  enable_priority_sort: boolean;
  enable_blink_effect: boolean;
}

const SETTINGS_ITEMS = [
  { key: "notify_supervisor_on_red", label: "Notificar supervisor no vermelho", desc: "Envia alerta ao supervisor quando conversa entra em estado crítico", icon: Bell },
  { key: "highlight_critical_conversations", label: "Destacar conversas críticas", desc: "Move conversas críticas para o topo da fila", icon: ArrowUpToLine },
  { key: "enable_sound_alert", label: "Alerta sonoro", desc: "Emite um som quando conversa entra em estado vermelho", icon: Volume2 },
  { key: "enable_priority_sort", label: "Ordenação por prioridade", desc: "Ordena automaticamente a lista pela urgência da conversa", icon: SortAsc },
  { key: "enable_blink_effect", label: "Efeito piscar", desc: "Conversas críticas piscam visualmente para chamar atenção", icon: Sparkles },
] as const;

export function AlertSettingsConfig() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("attendance_alert_settings").select("*").limit(1).single();
    if (data) setSettings(data as AlertSettings);
  }

  const handleToggle = async (key: keyof Omit<AlertSettings, "id">) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    const { error } = await supabase.from("attendance_alert_settings").update({ [key]: updated[key] }).eq("id", settings.id);
    if (error) { toast.error(error.message); load(); }
    else toast.success("Configuração salva!");
  };

  if (!settings) return <Card><CardContent className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas e Escalonamento</CardTitle>
        <CardDescription>Configure o comportamento quando conversas entram em estado crítico</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {SETTINGS_ITEMS.map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-sm font-medium cursor-pointer">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Switch
              checked={settings[key as keyof AlertSettings] as boolean}
              onCheckedChange={() => handleToggle(key as keyof Omit<AlertSettings, "id">)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
