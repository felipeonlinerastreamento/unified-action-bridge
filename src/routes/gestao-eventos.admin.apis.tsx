import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { testApiConnection, syncApiNow } from "@/lib/ge/api-integrations.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, XCircle, CircleDashed, PauseCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";

type ConnStatus = "active" | "inactive" | "error" | "never_synced";

const STATUS_META: Record<ConnStatus, { label: string; tooltip: string; icon: typeof CheckCircle2; className: string }> = {
  active: {
    label: "Ativa",
    tooltip: "Última operação foi bem-sucedida. A API está respondendo normalmente.",
    icon: CheckCircle2,
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  error: {
    label: "Erro",
    tooltip: "A última tentativa de teste ou sincronização falhou. Veja a mensagem de erro abaixo.",
    icon: XCircle,
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  inactive: {
    label: "Inativa",
    tooltip: "Configuração desativada. Nenhuma sincronização será executada.",
    icon: PauseCircle,
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  never_synced: {
    label: "Nunca sincronizada",
    tooltip: "Configuração salva, mas ainda não foi testada nem sincronizada.",
    icon: CircleDashed,
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

function ConnectionStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as ConnStatus] ?? {
    label: status,
    tooltip: "Estado desconhecido",
    icon: HelpCircle,
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  const Icon = meta.icon;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{meta.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const Route = createFileRoute("/gestao-eventos/admin/apis")({
  component: AdminApis,
});

function AdminApis() {
  const { isPlatformAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: configs } = useQuery({
    queryKey: ["api-configs-global"],
    queryFn: async () => {
      const { data } = await supabase.from("ge_api_configurations").select("*").is("client_id", null);
      return data ?? [];
    },
    enabled: isPlatformAdmin,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["api-configs-global"] });

  if (!isPlatformAdmin) {
    return <div className="text-muted-foreground">Apenas administradores da plataforma podem configurar as APIs.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuração de APIs (Global)</h1>
        <p className="text-sm text-muted-foreground">
          Credenciais únicas para toda a plataforma. Os eventos são roteados automaticamente para cada cliente
          com base no <strong>código externo</strong> cadastrado em <em>Clientes</em>. Eventos sem mapeamento
          ficam no cliente <code>__staging__</code>.
        </p>
      </div>
      <Tabs defaultValue="movias">
        <TabsList>
          <TabsTrigger value="movias">Movias (Telemetria)</TabsTrigger>
          <TabsTrigger value="yuv">YUV (Fadiga)</TabsTrigger>
        </TabsList>
        <TabsContent value="movias">
          {(() => {
            const cfg = (configs ?? []).find((c) => c.api_type === "movias");
            return <ApiCard key={cfg?.id ?? "movias-new"} type="movias" defaultUrl="https://api.movias.com.br" defaultEndpoint="/api/events" config={cfg} onChanged={refresh} />;
          })()}
        </TabsContent>
        <TabsContent value="yuv">
          {(() => {
            const cfg = (configs ?? []).find((c) => c.api_type === "yuv");
            return <ApiCard key={cfg?.id ?? "yuv-new"} type="yuv" defaultUrl="https://api.yuv.com.br" defaultEndpoint="/v1/events" config={cfg} onChanged={refresh} />;
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ApiConfigRow = {
  id: string;
  base_url: string;
  username: string | null;
  events_endpoint: string | null;
  sync_interval_minutes: number;
  auto_sync_enabled: boolean;
  connection_status: string;
  last_sync_at: string | null;
  last_test_at: string | null;
  last_test_status: string | null;
  error_message: string | null;
};

function ApiCard({ type, defaultUrl, defaultEndpoint, config, onChanged }: {
  type: "movias" | "yuv";
  defaultUrl: string;
  defaultEndpoint: string;
  config?: ApiConfigRow;
  onChanged: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(config?.base_url ?? defaultUrl);
  const [username, setUsername] = useState(config?.username ?? "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(config?.events_endpoint ?? "");
  const [interval, setInterval] = useState<number>(config?.sync_interval_minutes ?? 15);
  const [autoSync, setAutoSync] = useState<boolean>(config?.auto_sync_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const testFn = useServerFn(testApiConnection);
  const syncFn = useServerFn(syncApiNow);

  const save = async () => {
    setSaving(true);
    // Quando já existe config, não sobrescrever com vazio — preservar o valor atual.
    const keepIfEmpty = (val: string, current: string | null | undefined) =>
      val.trim() === "" ? (config ? current ?? null : null) : val;
    // Guarda: API Key nunca deve ser uma URL — bloqueio defensivo para evitar
    // o erro recorrente de colar a URL base no campo errado.
    if (apiKey && /^https?:\/\//i.test(apiKey.trim())) {
      setSaving(false);
      toast.error("API Key não pode ser uma URL. Use o campo URL Base.");
      return;
    }
    const payload = {
      client_id: null,
      api_type: type,
      base_url: baseUrl.trim() === "" && config ? config.base_url : baseUrl,
      username: keepIfEmpty(username, config?.username),
      events_endpoint: keepIfEmpty(endpoint, config?.events_endpoint),
      sync_interval_minutes: interval,
      auto_sync_enabled: autoSync,
      ...(password ? { password_encrypted: password } : {}),
      ...(token ? { bearer_token_encrypted: token } : {}),
      ...(apiKey ? { api_key_encrypted: apiKey } : {}),
      is_active: true,
    };
    const { error } = config
      ? await supabase.from("ge_api_configurations").update(payload).eq("id", config.id)
      : await supabase.from("ge_api_configurations").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Configuração salva"); setPassword(""); setToken(""); setApiKey(""); onChanged(); }
  };

  const handleTest = async () => {
    if (!config) { toast.error("Salve a configuração antes de testar"); return; }
    setTesting(true);
    try {
      const res = await testFn({ data: { configId: config.id } });
      if (res.ok) toast.success(`${res.message} (${res.latencyMs}ms)`);
      else toast.error(res.message);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    if (!config) { toast.error("Salve a configuração antes de sincronizar"); return; }
    setSyncing(true);
    try {
      const res = await syncFn({ data: { configId: config.id } });
      if (res.errorMessage) toast.error(res.errorMessage);
      else {
        const parts: string[] = [];
        if (typeof res.devicesFound === "number") parts.push(`${res.devicesFound} dispositivos`);
        if (typeof res.alarmsFetched === "number") parts.push(`${res.alarmsFetched} alarmes recebidos`);
        parts.push(`${res.inserted} novos`, `${res.updated} atualizados`);
        if (res.discardedByType > 0) parts.push(`${res.discardedByType} descartados (tipo do cliente)`);
        if (res.storedUnmatched > 0) parts.push(`${res.storedUnmatched} armazenados (sem cliente)`);
        if (res.discardedNoClientByType > 0) parts.push(`${res.discardedNoClientByType} descartados (tipo órfão)`);
        if (res.expiredUnmatched > 0) parts.push(`${res.expiredUnmatched} expirados`);
        toast.success(parts.join(" — "));
        if (res.warning) toast.warning(res.warning);
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          API {type.toUpperCase()} <Badge variant="outline">global</Badge>
          {config && <ConnectionStatusBadge status={config.connection_status} />}
        </CardTitle>
        <CardDescription className="space-y-1">
          <div>{config?.last_sync_at ? `Última sincronização: ${new Date(config.last_sync_at).toLocaleString("pt-BR")}` : "Nunca sincronizado"}</div>
          {config?.last_test_at && (
            <div>Último teste: {new Date(config.last_test_at).toLocaleString("pt-BR")} — {config.last_test_status}</div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>URL Base</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password {config && <span className="text-xs text-muted-foreground">(vazio mantém)</span>}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {type === "yuv" && (
            <div className="space-y-2">
              <Label>Bearer Token {config && <span className="text-xs text-muted-foreground">(vazio mantém)</span>}</Label>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>API Key (opcional) {config && <span className="text-xs text-muted-foreground">(vazio mantém)</span>}</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Endpoint de eventos</Label>
            <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder={defaultEndpoint} />
          </div>
        </div>

        <div className="rounded border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Sincronização automática</Label>
              <p className="text-xs text-muted-foreground">Coleta eventos periodicamente</p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
          <div className="space-y-2">
            <Label>Intervalo (minutos)</Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 15))}
              disabled={!autoSync}
            />
          </div>
        </div>

        {config?.error_message && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="font-medium">Último erro</div>
            <div className="mt-0.5 break-words">{config.error_message}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !config}>
            {testing ? "Testando..." : "Testar conexão"}
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing || !config}>
            {syncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
