import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WifiOff, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  id?: string;
  is_enabled: boolean;
  target_sector_id: string | null;
  target_sector_name: string;
}

const DEFAULTS: Settings = {
  is_enabled: true,
  target_sector_id: null,
  target_sector_name: "Atendimento",
};

export function OfflineRoutingConfig() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [cfgRes, secRes] = await Promise.all([
        supabase.from("offline_routing_settings").select("*").limit(1).maybeSingle(),
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
      ({ error } = await supabase.from("offline_routing_settings").update(updateData).eq("id", id));
    } else {
      ({ error } = await supabase.from("offline_routing_settings").insert(updateData));
      // Refresh to get the ID
      const { data } = await supabase.from("offline_routing_settings").select("*").limit(1).maybeSingle();
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
          <WifiOff className="h-5 w-5 text-amber-500" />
          Roteamento Automático (Operador Offline)
        </CardTitle>
        <CardDescription>
          Quando um operador estiver offline e o chat sob sua responsabilidade receber uma mensagem, 
          ele será redirecionado para outro operador disponível no setor configurado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Recurso ativo</Label>
            <p className="text-xs text-muted-foreground">
              Ativa o redirecionamento automático de chats para operadores online.
            </p>
          </div>
          <Switch checked={s.is_enabled} onCheckedChange={(v) => setS({ ...s, is_enabled: v })} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Setor de destino (Fallback)</Label>
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
            Chats de operadores offline serão enviados para o operador menos sobrecarregado deste setor.
          </p>
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
