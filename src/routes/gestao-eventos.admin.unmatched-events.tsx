import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/gestao-eventos/admin/unmatched-events")({
  component: AdminUnmatchedEvents,
});

type ApiSource = "movias" | "yuv";

const SOURCE_LABEL: Record<ApiSource, string> = {
  movias: "Telemetria (Movias)",
  yuv: "Fadiga (YUV)",
};

function AdminUnmatchedEvents() {
  const { isPlatformAdmin } = useAuth();

  if (!isPlatformAdmin) {
    return <div className="text-muted-foreground">Apenas administradores da plataforma podem ver esta página.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Eventos sem cliente vinculado</h1>
        <p className="text-sm text-muted-foreground">
          Eventos cuja empresa não corresponde a nenhum cliente cadastrado. Habilite os tipos que devem ser
          armazenados temporariamente — eventos são retidos por <strong>24h</strong> e descartados automaticamente
          após esse período.
        </p>
      </div>
      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Tipos órfãos</TabsTrigger>
          <TabsTrigger value="events">Eventos retidos</TabsTrigger>
        </TabsList>
        <TabsContent value="types" className="pt-4">
          <UnmatchedTypesPanel />
        </TabsContent>
        <TabsContent value="events" className="pt-4">
          <UnmatchedEventsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UnmatchedTypesPanel() {
  const qc = useQueryClient();
  const queryKey = ["unmatched-event-type-settings"];

  const { data: rows, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_unmatched_event_type_settings")
        .select("*")
        .order("api_source")
        .order("event_type");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = async (apiSource: ApiSource, eventType: string, value: boolean) => {
    const { error } = await supabase
      .from("ge_unmatched_event_type_settings")
      .update({ is_enabled: value })
      .eq("api_source", apiSource)
      .eq("event_type", eventType);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey });
  };

  const bulk = async (apiSource: ApiSource, value: boolean) => {
    const { error } = await supabase
      .from("ge_unmatched_event_type_settings")
      .update({ is_enabled: value })
      .eq("api_source", apiSource);
    if (error) toast.error(error.message);
    else { void qc.invalidateQueries({ queryKey }); toast.success(value ? "Todos habilitados" : "Todos desabilitados"); }
  };

  const sources: ApiSource[] = ["movias", "yuv"];
  const grouped: Record<ApiSource, NonNullable<typeof rows>> = {
    movias: (rows ?? []).filter((r) => r.api_source === "movias"),
    yuv: (rows ?? []).filter((r) => r.api_source === "yuv"),
  };

  return (
    <Tabs defaultValue="movias">
      <TabsList>
        {sources.map((s) => (
          <TabsTrigger key={s} value={s}>
            {SOURCE_LABEL[s]} <Badge variant="outline" className="ml-2">{grouped[s].length}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {sources.map((s) => (
        <TabsContent key={s} value={s} className="space-y-3 pt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => bulk(s, true)} disabled={grouped[s].length === 0}>
              Habilitar todos
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk(s, false)} disabled={grouped[s].length === 0}>
              Desabilitar todos
            </Button>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : grouped[s].length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum tipo órfão detectado ainda. Quando a sincronização encontrar eventos de empresas não
              cadastradas, eles aparecerão aqui.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Última ocorrência</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped[s].map((r) => (
                  <TableRow key={`${r.api_source}-${r.event_type}`}>
                    <TableCell className="font-mono text-sm">{r.event_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.last_seen_at ? format(new Date(r.last_seen_at), "dd/MM/yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.occurrences}</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={r.is_enabled} onCheckedChange={(v) => toggle(s, r.event_type, v)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function UnmatchedEventsPanel() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | ApiSource>("all");
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["unmatched-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_unmatched_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const filtered = (events ?? []).filter((e) => {
    if (sourceFilter !== "all" && e.api_source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const fields = [e.company_name, e.event_type, e.license_plate, e.driver_name, e.external_account_id];
      if (!fields.some((f) => f && String(f).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retidos nas últimas 24h</CardTitle>
        <CardDescription>
          Eventos sem cliente vinculado cujo tipo está habilitado. Removidos automaticamente após 24h.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar por empresa, tipo, placa, motorista…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-1">
            {(["all", "movias", "yuv"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={sourceFilter === s ? "default" : "outline"}
                onClick={() => setSourceFilter(s)}
              >
                {s === "all" ? "Todas fontes" : SOURCE_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento retido.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Empresa detectada</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead className="text-right">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(e.event_time), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell><Badge variant="outline">{e.api_source}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                    <TableCell>{e.company_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{e.license_plate ?? "—"}</TableCell>
                    <TableCell>{e.driver_name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(e.event_data as Record<string, unknown>)}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Payload bruto</DialogTitle></DialogHeader>
            <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
              {viewing ? JSON.stringify(viewing, null, 2) : ""}
            </pre>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
