import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bell, Clock, History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Settings {
  id: string;
  sla_band_change_enabled: boolean;
  sla_band_change_sound: boolean;
  daily_review_enabled: boolean;
  daily_review_time: string;
  daily_review_message: string;
  daily_review_sound: boolean;
}

export function AttendanceEventsConfig() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["attendance-event-settings-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_event_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      return (data as any) as Settings | null;
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Settings) => {
      const { error } = await supabase
        .from("attendance_event_settings" as any)
        .update({
          sla_band_change_enabled: payload.sla_band_change_enabled,
          sla_band_change_sound: payload.sla_band_change_sound,
          daily_review_enabled: payload.daily_review_enabled,
          daily_review_time: payload.daily_review_time,
          daily_review_message: payload.daily_review_message,
          daily_review_sound: payload.daily_review_sound,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["attendance-event-settings"] });
      qc.invalidateQueries({ queryKey: ["attendance-event-settings-admin"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["attendance-event-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_event_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
    refetchInterval: 30000,
  });

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Mudança de faixa de SLA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Pop-up para o responsável</Label>
              <p className="text-xs text-muted-foreground">
                Notifica o operador quando o atendimento muda de cor (verde →
                amarelo → laranja → vermelho).
              </p>
            </div>
            <Switch
              checked={form.sla_band_change_enabled}
              onCheckedChange={(v) =>
                setForm({ ...form, sla_band_change_enabled: v })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Tocar som ao exibir pop-up</Label>
            <Switch
              checked={form.sla_band_change_sound}
              onCheckedChange={(v) =>
                setForm({ ...form, sla_band_change_sound: v })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Lembrete diário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Ativar lembrete diário</Label>
            <Switch
              checked={form.daily_review_enabled}
              onCheckedChange={(v) =>
                setForm({ ...form, daily_review_enabled: v })
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Horário</Label>
              <Input
                type="time"
                value={form.daily_review_time}
                onChange={(e) =>
                  setForm({ ...form, daily_review_time: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={form.daily_review_message}
                onChange={(e) =>
                  setForm({ ...form, daily_review_message: e.target.value })
                }
                rows={2}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Tocar som ao exibir pop-up</Label>
            <Switch
              checked={form.daily_review_sound}
              onCheckedChange={(v) =>
                setForm({ ...form, daily_review_sound: v })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => form && saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          Salvar configurações
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de eventos (50 últimos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="text-xs border rounded p-2 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-medium">
                      {l.event_type === "sla_band_change"
                        ? "Mudança de faixa SLA"
                        : "Lembrete diário"}
                    </div>
                    <div className="text-muted-foreground">{l.message}</div>
                    {l.from_band && l.to_band && (
                      <div className="text-muted-foreground">
                        {l.from_band} → {l.to_band}
                      </div>
                    )}
                  </div>
                  <div className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(l.created_at), "dd/MM HH:mm", {
                      locale: ptBR,
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
