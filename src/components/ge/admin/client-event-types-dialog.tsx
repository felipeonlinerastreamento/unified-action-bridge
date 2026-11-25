import { useQuery, useQueryClient } from "@tanstack/react-query";
import { geDb as supabase } from "@/lib/ge/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ApiSource = "movias" | "yuv";

const SOURCE_LABEL: Record<ApiSource, string> = {
  movias: "Telemetria (Movias)",
  yuv: "Fadiga (YUV)",
};

export function ClientEventTypesDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const queryKey = ["client-event-type-settings", clientId];

  const { data: rows, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_client_event_type_settings")
        .select("*")
        .eq("client_id", clientId)
        .order("api_source")
        .order("event_type");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const toggle = async (apiSource: ApiSource, eventType: string, value: boolean) => {
    const { data, error } = await supabase
      .from("ge_client_event_type_settings")
      .update({ is_enabled: value })
      .eq("client_id", clientId)
      .eq("api_source", apiSource)
      .eq("event_type", eventType)
      .select("event_type");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Não foi possível salvar (sem permissão ou linha não encontrada).");
      return;
    }
    toast.success(value ? `"${eventType}" habilitado` : `"${eventType}" desabilitado`);
    void qc.invalidateQueries({ queryKey });
  };

  const bulk = async (apiSource: ApiSource, value: boolean) => {
    const { data, error } = await supabase
      .from("ge_client_event_type_settings")
      .update({ is_enabled: value })
      .eq("client_id", clientId)
      .eq("api_source", apiSource)
      .select("event_type");
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Nada foi atualizado (sem permissão ou sem tipos).");
      return;
    }
    void qc.invalidateQueries({ queryKey });
    toast.success(`${data.length} tipo(s) ${value ? "habilitados" : "desabilitados"}`);
  };

  const sources: ApiSource[] = ["movias", "yuv"];
  const grouped: Record<ApiSource, NonNullable<typeof rows>> = {
    movias: (rows ?? []).filter((r) => r.api_source === "movias"),
    yuv: (rows ?? []).filter((r) => r.api_source === "yuv"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Tipos de evento — {clientName}</DialogTitle>
          <DialogDescription>
            Tipos não habilitados são descartados na próxima sincronização. Novos tipos aparecem aqui
            automaticamente quando detectados na API.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="movias">
            <TabsList>
              {sources.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {SOURCE_LABEL[s]}{" "}
                  <Badge variant="outline" className="ml-2">{grouped[s].length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {sources.map((s) => (
              <TabsContent key={s} value={s} className="space-y-3 mt-2">
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
                    Nenhum tipo detectado ainda. Execute uma sincronização para popular esta lista.
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
                            {r.last_seen_at ? new Date(r.last_seen_at).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-right">{r.occurrences}</TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={r.is_enabled}
                              onCheckedChange={(v) => toggle(s, r.event_type, v)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
