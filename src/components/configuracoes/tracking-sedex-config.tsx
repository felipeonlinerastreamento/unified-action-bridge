import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTrackingSettings, type TrackingSettings } from "@/hooks/use-tracking-settings";
import { toast } from "sonner";
import { Loader2, RefreshCw, Package, CheckCircle2, AlertTriangle, TestTube2 } from "lucide-react";
import { previewTracking } from "@/lib/tracking.functions";

export function TrackingSedexConfig() {
  const { hasRole, session } = useAuth();
  const canManage = hasRole("admin") || hasRole("gestor");
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useTrackingSettings();

  const [local, setLocal] = useState<TrackingSettings | null>(null);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  // Quick metrics
  const { data: metrics } = useQuery({
    queryKey: ["tracking-metrics"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [inTransit, deliveredToday, withError] = await Promise.all([
        supabase.from("ticket_tracking").select("id", { count: "exact", head: true }).eq("is_delivered", false),
        supabase.from("ticket_tracking").select("id", { count: "exact", head: true }).eq("is_delivered", true).gte("updated_at", today.toISOString()),
        supabase.from("ticket_tracking").select("id", { count: "exact", head: true }).not("last_error", "is", null),
      ]);
      return {
        inTransit: inTransit.count || 0,
        deliveredToday: deliveredToday.count || 0,
        withError: withError.count || 0,
      };
    },
    refetchInterval: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<TrackingSettings>) => {
      if (!local?.id) throw new Error("Configuração não encontrada");
      const { error } = await supabase
        .from("tracking_settings")
        .update({ ...payload, updated_by: session?.user?.id || null })
        .eq("id", local.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      queryClient.invalidateQueries({ queryKey: ["tracking-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const update = (patch: Partial<TrackingSettings>) => {
    if (!local) return;
    const next = { ...local, ...patch };
    setLocal(next);
    saveMutation.mutate(patch);
  };

  const handleRefreshAll = async () => {
    if (!session?.access_token) return;
    setRefreshingAll(true);
    try {
      const res = await fetch("/hooks/refresh-tracking", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Atualizados: ${json.checked || 0} • Entregues agora: ${json.delivered || 0}`);
        queryClient.invalidateQueries({ queryKey: ["tracking-metrics"] });
      } else {
        toast.error(json?.error || "Falha ao atualizar");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleTestCode = async () => {
    const code = testCode.trim().toUpperCase();
    if (!code) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await previewTracking({ data: { code } });
      if (r.ok) {
        const ev = (r.result as any)?.eventoMaisRecente;
        setTestResult(`✓ ${ev?.descricao || "Consulta OK"}${ev?.local ? ` — ${ev.local}` : ""}`);
      } else {
        setTestResult(`✗ ${r.error}`);
      }
    } catch (e: any) {
      setTestResult(`✗ ${e?.message || "Erro"}`);
    } finally {
      setTesting(false);
    }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Rastreamento Sedex (Correios)
        </CardTitle>
        <CardDescription>
          Configure o comportamento da integração com SeuRastreio para tickets da categoria Correios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> Em trânsito
            </div>
            <div className="text-2xl font-bold mt-1">{metrics?.inTransit ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Entregues hoje
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{metrics?.deliveredToday ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Com erro
            </div>
            <div className="text-2xl font-bold mt-1 text-destructive">{metrics?.withError ?? "—"}</div>
          </div>
        </div>

        <Separator />

        {/* Auto-refresh */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Atualização automática</h4>
          <div className="flex items-center justify-between gap-3">
            <Label className="flex flex-col">
              <span>Ativar atualização automática</span>
              <span className="text-xs font-normal text-muted-foreground">Cron consulta SeuRastreio periodicamente</span>
            </Label>
            <Switch
              checked={local.auto_refresh_enabled}
              onCheckedChange={(v) => update({ auto_refresh_enabled: v })}
              disabled={!canManage}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Intervalo</Label>
            <Select
              value={String(local.refresh_interval_minutes)}
              onValueChange={(v) => update({ refresh_interval_minutes: parseInt(v) })}
              disabled={!canManage}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="360">6 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canManage && (
            <Button onClick={handleRefreshAll} disabled={refreshingAll} variant="secondary" size="sm" className="w-full">
              {refreshingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar todos agora
            </Button>
          )}
        </div>

        <Separator />

        {/* Notifications */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Notificações</h4>
          <div className="flex items-center justify-between gap-3">
            <Label>Notificar quando entregue</Label>
            <Switch checked={local.notify_on_delivered} onCheckedChange={(v) => update({ notify_on_delivered: v })} disabled={!canManage} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Notificar em exceções (devolução/ausência)</Label>
            <Switch checked={local.notify_on_exception} onCheckedChange={(v) => update({ notify_on_exception: v })} disabled={!canManage} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Notificar todos do setor</Label>
            <Switch checked={local.notify_sector_members} onCheckedChange={(v) => update({ notify_sector_members: v, notify_assigned_only: v ? false : local.notify_assigned_only })} disabled={!canManage} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Notificar somente o responsável</Label>
            <Switch checked={local.notify_assigned_only} onCheckedChange={(v) => update({ notify_assigned_only: v, notify_sector_members: v ? false : local.notify_sector_members })} disabled={!canManage} />
          </div>
          <div className="flex items-center justify-between gap-3 opacity-60">
            <Label className="flex flex-col">
              <span>Avisar cliente via WhatsApp</span>
              <span className="text-xs font-normal text-muted-foreground">Em breve</span>
            </Label>
            <Switch checked={false} disabled />
          </div>
        </div>

        <Separator />

        {/* Validation */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Cadastro de tickets</h4>
          <div className="flex items-center justify-between gap-3">
            <Label className="flex flex-col">
              <span>Exigir código no cadastro</span>
              <span className="text-xs font-normal text-muted-foreground">Bloqueia salvar ticket Correios sem código</span>
            </Label>
            <Switch checked={local.require_tracking_code} onCheckedChange={(v) => update({ require_tracking_code: v })} disabled={!canManage} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="flex flex-col">
              <span>Fechar ticket ao entregar</span>
              <span className="text-xs font-normal text-muted-foreground">Marca como resolvido automaticamente</span>
            </Label>
            <Switch checked={local.auto_close_ticket_on_delivery} onCheckedChange={(v) => update({ auto_close_ticket_on_delivery: v })} disabled={!canManage} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Padrão de validação (regex)</Label>
            <Input
              value={local.tracking_code_pattern}
              onChange={(e) => setLocal({ ...local, tracking_code_pattern: e.target.value })}
              onBlur={() => update({ tracking_code_pattern: local.tracking_code_pattern })}
              disabled={!canManage}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <Separator />

        {/* Test */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TestTube2 className="h-4 w-4" /> Testar código
          </h4>
          <div className="flex gap-2">
            <Input
              value={testCode}
              onChange={(e) => setTestCode(e.target.value.toUpperCase())}
              placeholder="AA123456789BR"
              className="font-mono"
              maxLength={13}
            />
            <Button onClick={handleTestCode} disabled={testing || !testCode} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
            </Button>
          </div>
          {testResult && (
            <Badge variant={testResult.startsWith("✓") ? "default" : "destructive"} className="font-mono text-xs">
              {testResult}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
