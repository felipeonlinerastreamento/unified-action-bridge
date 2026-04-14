import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Plus, Trash2 } from "lucide-react";

interface TicketReminderSectionProps {
  ticketId: string;
  userId: string | null;
}

export function TicketReminderSection({ ticketId, userId }: TicketReminderSectionProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const { data: reminders = [], refetch } = useQuery({
    queryKey: ["ticket-reminders", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_reminders")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("reminder_date", { ascending: true });
      if (error) {
        console.error("Error loading reminders:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!ticketId,
  });

  const addReminder = async () => {
    if (!date) {
      toast.error("Selecione uma data para o lembrete");
      return;
    }
    const { error } = await supabase.from("ticket_reminders").insert({
      ticket_id: ticketId,
      reminder_date: new Date(date).toISOString(),
      reminder_note: note || "",
      created_by: userId,
    });
    if (error) {
      toast.error("Erro ao criar lembrete: " + error.message);
      return;
    }
    // Also update reminder_date on ticket
    await supabase
      .from("service_tickets")
      .update({ reminder_date: new Date(date).toISOString(), reminder_note: note || null })
      .eq("id", ticketId);

    // Add system comment
    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content: `Lembrete definido para ${new Date(date).toLocaleDateString("pt-BR")}${note ? `: ${note}` : ""}`,
      comment_type: "sistema",
    });

    setDate("");
    setNote("");
    setShowForm(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    toast.success("Lembrete criado");
  };

  const dismissReminder = async (id: string) => {
    const { error } = await supabase
      .from("ticket_reminders")
      .update({ is_dismissed: true })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao dispensar lembrete");
      return;
    }
    refetch();
    toast.success("Lembrete dispensado");
  };

  const activeReminders = reminders.filter((r: any) => !r.is_dismissed);
  const now = new Date();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Bell className="h-3.5 w-3.5" /> Lembretes
        </label>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <div className="space-y-1">
            <label className="text-xs font-medium">Data do Lembrete *</label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Nota (opcional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Descrição do lembrete..."
              className="min-h-[50px] text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addReminder} disabled={!date} className="h-7 text-xs">
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-7 text-xs">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {activeReminders.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum lembrete ativo.</p>
      )}

      <div className="space-y-1.5">
        {activeReminders.map((r: any) => {
          const rDate = new Date(r.reminder_date);
          const isOverdue = rDate <= now;
          return (
            <div
              key={r.id}
              className={`flex items-start gap-2 p-2 rounded-md border text-sm ${
                isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border"
              }`}
            >
              <Bell className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isOverdue ? "text-destructive" : "text-amber-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-xs">
                    {rDate.toLocaleDateString("pt-BR")} {rDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 py-0">Vencido</Badge>}
                </div>
                {r.reminder_note && <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.reminder_note}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => dismissReminder(r.id)}>
                <BellOff className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
