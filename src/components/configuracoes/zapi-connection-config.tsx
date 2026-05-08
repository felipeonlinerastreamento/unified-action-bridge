import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Wifi, WifiOff, Plus, RefreshCw, Loader2 } from "lucide-react";
import { getChannelStatus, setupZapiWebhooks } from "@/lib/zapi.functions";

export function ZapiConnectionConfig() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    zapi_instance_id: "",
    token: "",
    zapi_client_token: "",
    bot_mode: "always",
    is_active: true,
  });
  const [copied, setCopied] = useState(false);

  const { data: channels = [] } = useQuery({
    queryKey: ["channels-zapi-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("channels").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    if (channels.length > 0 && !selectedId) setSelectedId(channels[0].id);
  }, [channels, selectedId]);

  const current = channels.find((c) => c.id === selectedId);

  useEffect(() => {
    if (current) {
      setForm({
        name: current.name || "",
        zapi_instance_id: (current as any).zapi_instance_id || "",
        token: current.token || "",
        zapi_client_token: (current as any).zapi_client_token || "",
        bot_mode: (current as any).bot_mode || "always",
        is_active: !!current.is_active,
      });
    }
  }, [current?.id]);

  const webhookUrl = current
    ? `https://project--40ab25b5-cec0-4fe2-8de9-27bfd1074392.lovable.app/api/public/zapi-webhook/${current.id}?secret=${(current as any).webhook_secret || ""}`
    : "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Selecione um canal");
      const { error } = await supabase
        .from("channels")
        .update({
          name: form.name,
          zapi_instance_id: form.zapi_instance_id || null,
          token: form.token,
          zapi_client_token: form.zapi_client_token || null,
          bot_mode: form.bot_mode,
          is_active: form.is_active,
          platform: "zapi",
        } as any)
        .eq("id", selectedId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Canal salvo com sucesso");
      qc.invalidateQueries({ queryKey: ["channels-zapi-admin"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("channels")
        .insert({
          name: "Novo Canal Z-API",
          token: "",
          platform: "zapi",
          is_active: false,
          created_by: session?.user.id,
        } as any)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success("Canal criado");
      qc.invalidateQueries({ queryKey: ["channels-zapi-admin"] });
      if (data?.id) setSelectedId(data.id);
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Selecione um canal");
      const { data: { session } } = await supabase.auth.getSession();
      return await getChannelStatus({
        data: { channelId: selectedId },
        headers: { authorization: `Bearer ${session?.access_token}` },
      });
    },
    onSuccess: (r: any) => {
      if (r?.status === "CONNECTED") toast.success("Z-API conectada ✓");
      else toast.error(`Desconectada: ${r?.error || "verifique credenciais"}`);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao testar"),
  });

  const setupHooksMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Selecione um canal");
      const { data: { session } } = await supabase.auth.getSession();
      return await setupZapiWebhooks({
        data: { channelId: selectedId },
        headers: { authorization: `Bearer ${session?.access_token}` },
      });
    },
    onSuccess: (r: any) => {
      const failed = Object.entries(r?.results || {}).filter(([, v]: any) => !(v as any)?.ok);
      if (failed.length === 0) {
        toast.success("Webhooks Z-API configurados (inclui mensagens enviadas pelo celular)");
      } else {
        toast.warning(`Parcial: falhou em ${failed.map(([k]) => k).join(", ")}`);
      }
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao configurar webhooks"),
  });

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("URL do webhook copiada");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Conexão Z-API</CardTitle>
            <CardDescription>Credenciais da instância Z-API e modo do bot por canal.</CardDescription>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Novo canal
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Canal</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger><SelectValue placeholder="Selecione um canal" /></SelectTrigger>
            <SelectContent>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.is_active ? "✓" : "(inativo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {current && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome do canal</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Modo do bot</Label>
                <Select value={form.bot_mode} onValueChange={(v) => setForm({ ...form, bot_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Sempre disparar menu</SelectItem>
                    <SelectItem value="off_hours">Só fora do horário (8h-18h)</SelectItem>
                    <SelectItem value="never">Nunca (vai direto pra fila)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Z-API Instance ID</Label>
                <Input
                  value={form.zapi_instance_id}
                  onChange={(e) => setForm({ ...form, zapi_instance_id: e.target.value })}
                  placeholder="3D******"
                />
              </div>
              <div className="space-y-1">
                <Label>Z-API Instance Token</Label>
                <Input
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  placeholder="token da instância"
                  type="password"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Client-Token (Account Token)</Label>
                <Input
                  value={form.zapi_client_token}
                  onChange={(e) => setForm({ ...form, zapi_client_token: e.target.value })}
                  placeholder="token da conta Z-API"
                  type="password"
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Canal ativo</Label>
              </div>
            </div>

            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL do webhook (cole no painel Z-API)</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyWebhook}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure essa URL nos eventos: <Badge variant="outline" className="mr-1">message-received</Badge>
                <Badge variant="outline" className="mr-1">message-sent</Badge>
                <Badge variant="outline" className="mr-1">message-status</Badge>
                <Badge variant="outline">presence</Badge>
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Testar conexão
              </Button>
              <Button variant="secondary" onClick={() => setupHooksMutation.mutate()} disabled={setupHooksMutation.isPending}>
                {setupHooksMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Configurar webhooks (incluir envios pelo celular)
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
