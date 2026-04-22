import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useTesteEquipamentoSettings,
  type TesteEquipamentoSettings,
} from "@/hooks/use-teste-equipamento-settings";
import { toast } from "sonner";
import { Loader2, Wrench } from "lucide-react";
import { getTiposPendencia } from "@/lib/gsystem-api.functions";

export function TesteEquipamentoConfig() {
  const { hasRole, session } = useAuth();
  const canManage = hasRole("admin") || hasRole("gestor");
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTesteEquipamentoSettings();
  const [local, setLocal] = useState<TesteEquipamentoSettings | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const getAuthHeaders = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${s?.access_token}` } };
  };

  // GSystem categories
  const { data: tiposPendencia = [] } = useQuery({
    queryKey: ["tipos-pendencia-teste-equip"],
    queryFn: async () => {
      const result = await getTiposPendencia(await getAuthHeaders());
      return Array.isArray(result) ? result : [];
    },
    staleTime: 60_000,
  });

  // Local active sectors
  const { data: localSectors = [] } = useQuery({
    queryKey: ["local-sectors-active-te"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<TesteEquipamentoSettings>) => {
      if (!local?.id) throw new Error("Configuração não encontrada");
      const { error } = await (supabase as any)
        .from("teste_equipamento_settings")
        .update({ ...payload, updated_by: session?.user?.id || null })
        .eq("id", local.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["teste-equipamento-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const update = (patch: Partial<TesteEquipamentoSettings>) => {
    if (!local) return;
    const next = { ...local, ...patch };
    setLocal(next);
    saveMutation.mutate(patch);
  };

  if (isLoading || !local) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const sectorExists = localSectors.some((s) => s.name === local.target_sector_name);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Fluxo Teste de Equipamento
          <Badge variant={local.is_enabled ? "default" : "secondary"} className="ml-auto">
            {local.is_enabled ? "Ativo" : "Inativo"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Configure os campos obrigatórios e o encaminhamento automático para tickets
          da categoria Teste de Equipamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Label className="flex flex-col">
            <span>Ativar fluxo Teste de Equipamento</span>
            <span className="text-xs font-normal text-muted-foreground">
              Mostra campos extras na criação e dispara o encaminhamento ao finalizar
            </span>
          </Label>
          <Switch
            checked={local.is_enabled}
            onCheckedChange={(v) => update({ is_enabled: v })}
            disabled={!canManage}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Categoria gatilho</h4>
          <div className="space-y-1">
            <Label className="text-xs">Categoria GSystem</Label>
            <Select
              value={local.trigger_category_key}
              onValueChange={(v) => {
                const found = tiposPendencia.find((t: any) => t.Key === v || t.Descricao === v);
                update({
                  trigger_category_key: v,
                  trigger_category_label: found?.Descricao || v,
                });
              }}
              disabled={!canManage}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={local.trigger_category_key}>
                  {local.trigger_category_label || local.trigger_category_key}
                </SelectItem>
                {tiposPendencia
                  .filter((t: any) => t.Descricao !== local.trigger_category_key)
                  .map((t: any) => (
                    <SelectItem key={t.Key} value={t.Descricao}>
                      {t.Descricao}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Tickets cuja categoria seja igual a esta entram no fluxo.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Encaminhamento ao finalizar</h4>
          <div className="space-y-1">
            <Label className="text-xs">Setor destino</Label>
            <Select
              value={local.target_sector_name}
              onValueChange={(v) => update({ target_sector_name: v })}
              disabled={!canManage}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um setor..." />
              </SelectTrigger>
              <SelectContent>
                {!sectorExists && local.target_sector_name && (
                  <SelectItem value={local.target_sector_name}>
                    {local.target_sector_name} (não cadastrado)
                  </SelectItem>
                )}
                {localSectors.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!sectorExists && local.target_sector_name && (
              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Setor "{local.target_sector_name}" não existe em Configurações → Setores. Crie-o ou escolha outro.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Status no destino</Label>
            <Select
              value={local.target_status}
              onValueChange={(v) => update({ target_status: v })}
              disabled={!canManage}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="flex flex-col">
              <span>Sincronizar com GSystem ao finalizar</span>
              <span className="text-xs font-normal text-muted-foreground">
                Cria pendência no GSystem com toda a descrição do atendimento
              </span>
            </Label>
            <Switch
              checked={local.auto_sync_gsystem}
              onCheckedChange={(v) => update({ auto_sync_gsystem: v })}
              disabled={!canManage}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Obrigatoriedade dos campos</h4>
          <div className="flex items-center justify-between gap-3">
            <Label>Exigir Subtipo (Instalação/Retirada/Manutenção)</Label>
            <Switch
              checked={local.require_subtipo}
              onCheckedChange={(v) => update({ require_subtipo: v })}
              disabled={!canManage}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Exigir Motivo quando "Necessário cobrar" = Sim</Label>
            <Switch
              checked={local.require_motivo_when_cobrar}
              onCheckedChange={(v) => update({ require_motivo_when_cobrar: v })}
              disabled={!canManage}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Exigir Garantia (em Manutenção)</Label>
            <Switch
              checked={local.require_garantia}
              onCheckedChange={(v) => update({ require_garantia: v })}
              disabled={!canManage}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
