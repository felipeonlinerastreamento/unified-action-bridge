import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Clock, Flag, BadgeCheck, Palette, Zap } from "lucide-react";

interface VisualSettings {
  id: string;
  show_clock: boolean;
  show_sla_banner: boolean;
  show_status_badge: boolean;
  highlight_style: string;
  critical_effect: string;
}

export function VisualSettingsConfig() {
  const [settings, setSettings] = useState<VisualSettings | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("attendance_visual_settings").select("*").limit(1).single();
    if (data) setSettings(data as VisualSettings);
  }

  const handleToggle = async (key: string) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !(settings as any)[key] };
    setSettings(updated);
    const { error } = await supabase.from("attendance_visual_settings").update({ [key]: (updated as any)[key] }).eq("id", settings.id);
    if (error) { toast.error(error.message); load(); }
    else toast.success("Configuração salva!");
  };

  const handleSelect = async (key: string, value: string) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    const { error } = await supabase.from("attendance_visual_settings").update({ [key]: value }).eq("id", settings.id);
    if (error) { toast.error(error.message); load(); }
    else toast.success("Configuração salva!");
  };

  if (!settings) return <Card><CardContent className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visual do Chat</CardTitle>
        <CardDescription>Personalize a aparência dos indicadores na central de atendimento</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Relógio no topo do chat</Label>
              <p className="text-xs text-muted-foreground">Exibe cronômetro em tempo real no cabeçalho da conversa</p>
            </div>
          </div>
          <Switch checked={settings.show_clock} onCheckedChange={() => handleToggle("show_clock")} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
              <Flag className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Banner de SLA</Label>
              <p className="text-xs text-muted-foreground">Exibe barra colorida indicando status do SLA na conversa</p>
            </div>
          </div>
          <Switch checked={settings.show_sla_banner} onCheckedChange={() => handleToggle("show_sla_banner")} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Badge de status na lista</Label>
              <p className="text-xs text-muted-foreground">Exibe indicador colorido em cada conversa na lista lateral</p>
            </div>
          </div>
          <Switch checked={settings.show_status_badge} onCheckedChange={() => handleToggle("show_status_badge")} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
              <Palette className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Estilo de destaque</Label>
              <p className="text-xs text-muted-foreground">Como as conversas são visualmente destacadas</p>
            </div>
          </div>
          <Select value={settings.highlight_style} onValueChange={(v) => handleSelect("highlight_style", v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="color">Cor do texto</SelectItem>
              <SelectItem value="border">Borda colorida</SelectItem>
              <SelectItem value="background">Fundo colorido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
              <Zap className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <Label className="text-sm font-medium">Efeito para críticos</Label>
              <p className="text-xs text-muted-foreground">Comportamento visual para conversas no vermelho</p>
            </div>
          </div>
          <Select value={settings.critical_effect} onValueChange={(v) => handleSelect("critical_effect", v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="color">Apenas cor</SelectItem>
              <SelectItem value="blink">Piscar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
