import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hourglass, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_INACTIVITY_MESSAGE } from "@/lib/inactivity-message";

export function InactivityMessageConfig() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(DEFAULT_INACTIVITY_MESSAGE);

  const { data: settings } = useQuery({
    queryKey: ["inactivity-message-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("inactivity_message_settings").select("*").eq("id", "default").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    setEnabled(!!settings.is_enabled);
    setMessage(settings.message || DEFAULT_INACTIVITY_MESSAGE);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (enabled && !message.trim()) throw new Error("Escreva a mensagem antes de ativar.");
      const { error } = await supabase.from("inactivity_message_settings").upsert({
        id: "default", is_enabled: enabled, message: message.trim() || DEFAULT_INACTIVITY_MESSAGE, updated_by: user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Mensagem de inatividade salva");
      qc.invalidateQueries({ queryKey: ["inactivity-message-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Hourglass className="h-4 w-4" /> Inatividade</CardTitle>
        <CardDescription>
          Quando ativada, toda conversa nova recebe esta mensagem automaticamente, uma única vez, logo após as boas-vindas/menu do bot.
          Grupos de WhatsApp ficam de fora e, fora do horário de atendimento, vale só o aviso de ausência.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded border p-3 bg-muted/30">
          <div>
            <Label htmlFor="inactivity-enabled" className="text-sm font-semibold">{enabled ? "Ativada" : "Desativada"}</Label>
            <p className="text-xs text-muted-foreground">Desativada: as conversas seguem o fluxo normal.</p>
          </div>
          <Switch id="inactivity-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inactivity-message" className="text-sm font-semibold">Mensagem</Label>
          <Textarea id="inactivity-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
