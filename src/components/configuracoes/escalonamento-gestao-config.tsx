import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  id?: string;
  is_enabled: boolean;
  target_sector_id: string | null;
  target_sector_name: string;
  default_notes: string;
  default_category: string;
  notify_on_escalation: boolean;
}

const DEFAULTS: Settings = {
  is_enabled: true,
  target_sector_id: null,
  target_sector_name: "Gestão",
  default_notes: "Atendimento escalado para análise da Gestão",
  default_category: "Escalado para Gestão",
  notify_on_escalation: true,
};

export function EscalonamentoGestaoConfig() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [cfgRes, secRes] = await Promise.all([
        supabase.from("escalation_gestao_settings" as any).select("*").limit(1).maybeSingle(),
        supabase.from("sectors").select("id, name").eq("is_active", true).order("name"),
      ]);
      if (cfgRes.data) setS({ ...DEFAULTS, ...(cfgRes.data as any) });
      setSectors((secRes.data as any) || []);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { id, ...payload } = s;
    const { data: { user } } = await supabase.auth.getUser();
    const updateData: any = { ...payload, updated_at: new Date().toISOString(), updated_by: user?.id };
    let error;
    if (id) {
      ({ error } = await supabase.from("escalation_gestao_settings" as any).update(updateData).eq("id", id));
    } else {
      ({ error } = await supabase.from("escalation_gestao_settings" as any).insert(updateData));
      const { data } = await supabase.from("escalation_gestao_settings" as any).select("*").limit(1).maybeSingle();
      if (data) setS({ ...DEFAULTS, ...(data as any) });
    }
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração salva");
    setSaving(false);
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
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Escalonamento para Gestão
        </CardTitle>
        <CardDescription>
          Quando um administrador marcar o botão "Gestão" antes de finalizar um atendimento, um novo
          chamado em aberto é criado automaticamente para o setor configurado abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Recurso ativo</Label>
            <p className="text-xs text-muted-foreground">
              Quando desativado, o botão "Gestão" no atendimento fica sem efeito.
            </p>
          </div>
          <Switch checked={s.is_enabled} onCheckedChange={(v) => setS({ ...s, is_enabled: v })} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Setor de destino</Label>
          <Select
            value={s.target_sector_id || ""}
            onValueChange={(id) => {
              const sec = sectors.find((x) => x.id === id);
              setS({ ...s, target_sector_id: id, target_sector_name: sec?.name || s.target_sector_name });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um setor" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((sec) => (
                <SelectItem key={sec.id} value={sec.id}>
                  {sec.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Nome usado: <span className="font-medium">{s.target_sector_name}</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Categoria padrão do chamado de gestão</Label>
          <Input
            value={s.default_category}
            onChange={(e) => setS({ ...s, default_category: e.target.value })}
            placeholder="Escalado para Gestão"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Observação padrão</Label>
          <Textarea
            value={s.default_notes}
            onChange={(e) => setS({ ...s, default_notes: e.target.value })}
            placeholder="Atendimento escalado para análise da Gestão"
            className="min-h-[80px]"
          />
          <p className="text-[11px] text-muted-foreground">
            O número do protocolo de origem é anexado automaticamente.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <Label className="text-sm font-medium">Avisar gestores no escalonamento</Label>
            <p className="text-xs text-muted-foreground">
              Exibe notificação para os usuários do setor de destino.
            </p>
          </div>
          <Switch
            checked={s.notify_on_escalation}
            onCheckedChange={(v) => setS({ ...s, notify_on_escalation: v })}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
