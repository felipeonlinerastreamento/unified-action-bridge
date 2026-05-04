import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Star, Save } from "lucide-react";

const DEFAULT_MESSAGE =
  "Seu atendimento foi finalizado, obrigado!\n\nDigite uma nota para atendimento:\n[ 1 ] - Ruim 😒\n\n[ 2 ] - Bom 😊\n\n[ 3 ] - Ótimo 😍";

export function CsatConfig() {
  const qc = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [thanksMessage, setThanksMessage] = useState("Obrigado pela sua avaliação!");

  const { data: settings } = useQuery({
    queryKey: ["csat-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("csat_settings" as any).select("*").maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (!settings) return;
    setIsEnabled(!!settings.is_enabled);
    setMessage(settings.message || DEFAULT_MESSAGE);
    setThanksMessage(settings.thanks_message || "Obrigado pela sua avaliação!");
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        is_enabled: isEnabled,
        message,
        thanks_message: thanksMessage,
        updated_by: session?.user.id,
      };
      if (settings?.id) {
        const { error } = await supabase
          .from("csat_settings" as any)
          .update(payload)
          .eq("id", settings.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("csat_settings" as any).insert(payload);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Configuração de CSAT salva");
      qc.invalidateQueries({ queryKey: ["csat-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-4 w-4" /> CSAT — Satisfação do cliente
        </CardTitle>
        <CardDescription>
          Após finalizar o atendimento, envia automaticamente uma pesquisa de
          satisfação. As respostas (1, 2 ou 3) são registradas no relatório de CSAT.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded border p-3 bg-muted/30">
          <div>
            <Label className="text-sm font-semibold">Pesquisa CSAT ativa</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativada, a mensagem abaixo é enviada após a mensagem de finalização.
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Mensagem da pesquisa</Label>
          <Textarea
            rows={9}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Mensagem de agradecimento (após resposta)</Label>
          <Textarea
            rows={2}
            value={thanksMessage}
            onChange={(e) => setThanksMessage(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
