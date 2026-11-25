import { useQuery, useQueryClient } from "@tanstack/react-query";
import { geDb as supabase } from "@/lib/ge/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Liberação de funcionalidades por cliente (somente ADM da plataforma).
 * A gravação é validada no banco: apenas admin_platform consegue alterar.
 */
export function ClientFeaturesDialog({
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
  const queryKey = ["admin-client-features", clientId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const [catalog, config] = await Promise.all([
        supabase.from("ge_feature_catalog").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("ge_client_features").select("feature_key,is_enabled").eq("client_id", clientId),
      ]);
      if (catalog.error) throw catalog.error;
      if (config.error) throw config.error;
      const enabled = new Map((config.data ?? []).map((r) => [r.feature_key, r.is_enabled]));
      return (catalog.data ?? []).map((f) => ({ ...f, is_enabled: enabled.get(f.key) ?? false }));
    },
  });

  const toggle = async (featureKey: string, value: boolean) => {
    const { error } = await supabase
      .from("ge_client_features")
      .upsert({ client_id: clientId, feature_key: featureKey, is_enabled: value }, { onConflict: "client_id,feature_key" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(value ? "Funcionalidade liberada" : "Funcionalidade bloqueada");
    void qc.invalidateQueries({ queryKey });
    void qc.invalidateQueries({ queryKey: ["client-features"] });
  };

  const roots = (data ?? []).filter((f) => !f.parent_key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Funcionalidades — {clientName}</DialogTitle>
          <DialogDescription>
            Libere apenas o que já foi implementado, testado e validado. Funcionalidades desabilitadas ficam
            inacessíveis para o cliente também por API e URL.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {roots.map((root) => {
            const children = (data ?? []).filter((f) => f.parent_key === root.key);
            return (
              <div key={root.key} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{root.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">{root.key}</div>
                  </div>
                  <Switch checked={root.is_enabled} onCheckedChange={(v) => toggle(root.key, v)} />
                </div>
                {children.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-3 pl-3">
                    {children.map((c) => (
                      <div key={c.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{c.label}</span>
                          {!c.is_enabled && <Badge variant="outline">Em desenvolvimento / bloqueada</Badge>}
                        </div>
                        <Switch checked={c.is_enabled} onCheckedChange={(v) => toggle(c.key, v)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
