import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Clock, Timer, BarChart3, Users, ArrowRightLeft, RotateCcw, TrendingUp, Layers } from "lucide-react";

interface MetricSettings {
  id: string;
  show_first_response_time: boolean;
  show_avg_interaction_time: boolean;
  show_total_service_time: boolean;
  show_queue_time: boolean;
  show_attention_count: boolean;
  show_risk_count: boolean;
  show_critical_count: boolean;
  show_transfer_rate: boolean;
  show_avg_transfer_time: boolean;
  show_reopen_rate: boolean;
  show_agent_productivity: boolean;
  show_sector_congestion: boolean;
}

const METRICS = [
  { key: "show_first_response_time", label: "Tempo médio de primeira resposta", icon: Clock },
  { key: "show_avg_interaction_time", label: "Tempo médio entre interações", icon: Timer },
  { key: "show_total_service_time", label: "Tempo médio total de atendimento", icon: BarChart3 },
  { key: "show_queue_time", label: "Tempo médio em fila por setor", icon: Layers },
  { key: "show_attention_count", label: "Conversas em atenção", icon: Clock },
  { key: "show_risk_count", label: "Conversas em risco", icon: Timer },
  { key: "show_critical_count", label: "Conversas críticas", icon: BarChart3 },
  { key: "show_transfer_rate", label: "Taxa de transferência por setor", icon: ArrowRightLeft },
  { key: "show_avg_transfer_time", label: "Tempo médio até transferência", icon: Timer },
  { key: "show_reopen_rate", label: "Taxa de reabertura", icon: RotateCcw },
  { key: "show_agent_productivity", label: "Produtividade por atendente", icon: TrendingUp },
  { key: "show_sector_congestion", label: "Setor com maior congestionamento", icon: Users },
] as const;

export function MetricSettingsConfig() {
  const [settings, setSettings] = useState<MetricSettings | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("attendance_metric_settings").select("*").limit(1).single();
    if (data) setSettings(data as MetricSettings);
  }

  const handleToggle = async (key: string) => {
    if (!settings) return;
    const newValue = !(settings as any)[key];
    setSettings({ ...settings, [key]: newValue } as MetricSettings);
    const { error } = await supabase.from("attendance_metric_settings").update({ [key]: newValue } as any).eq("id", settings.id);
    if (error) { toast.error(error.message); load(); }
    else toast.success("Métrica atualizada!");
  };

  if (!settings) return <Card><CardContent className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Indicadores Operacionais</CardTitle>
        <CardDescription>Escolha quais métricas serão exibidas na central e no dashboard</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {METRICS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm cursor-pointer">{label}</Label>
              </div>
              <Switch
                checked={(settings as any)[key] as boolean}
                onCheckedChange={() => handleToggle(key)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
