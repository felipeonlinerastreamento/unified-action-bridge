import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, BellOff, Plus, Repeat, History, ChevronDown, ChevronUp, Clock } from "lucide-react";

interface TicketReminderSectionProps {
  ticketId: string;
  userId: string | null;
}

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Sem recorrência" },
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

const RECURRENCE_LABEL: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  yearly: "Anual",
};

const WEEKDAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
];

export function TicketReminderSection({ ticketId, userId }: TicketReminderSectionProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [recurrence, setRecurrence] = useState<string>("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionComment, setCompletionComment] = useState("");
  const [showHistory, setShowHistory] = useState(false);

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

  const { data: history = [], refetch: refetchHistory } = useQuery({
    queryKey: ["ticket-reminder-history", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_reminder_history" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("completed_at", { ascending: false });
      if (error) {
        console.error("Error loading reminder history:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!ticketId,
  });

  const computeNextFromRecurrence = (rec: string): Date => {
    const d = new Date();
    switch (rec) {
      case "daily": d.setDate(d.getDate() + 1); break;
      case "weekly": d.setDate(d.getDate() + 7); break;
      case "biweekly": d.setDate(d.getDate() + 14); break;
      case "monthly": d.setMonth(d.getMonth() + 1); break;
      case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
  };

  const addReminder = async () => {
    const isRecurring = recurrence && recurrence !== "none";
    if (!date && !isRecurring) {
      toast.error("Selecione uma data para o lembrete");
      return;
    }
    // Sem data + recorrência: gera automaticamente a próxima ocorrência
    const finalDate = date ? new Date(date) : computeNextFromRecurrence(recurrence);

    const insertPayload: any = {
      ticket_id: ticketId,
      reminder_date: finalDate.toISOString(),
      reminder_note: note || "",
      created_by: userId,
    };
    if (isRecurring) {
      insertPayload.recurrence_type = recurrence;
      if (recurrenceEnd) insertPayload.recurrence_end_date = new Date(recurrenceEnd).toISOString();
    }

    const { error } = await supabase.from("ticket_reminders").insert(insertPayload);
    if (error) {
      toast.error("Erro ao criar lembrete: " + error.message);
      return;
    }
    await supabase
      .from("service_tickets")
      .update({ reminder_date: finalDate.toISOString(), reminder_note: note || null })
      .eq("id", ticketId);

    const recLabel = isRecurring ? ` (recorrência: ${RECURRENCE_LABEL[recurrence]})` : "";
    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content: `Lembrete definido para ${finalDate.toLocaleDateString("pt-BR")}${note ? `: ${note}` : ""}${recLabel}`,
      comment_type: "sistema",
    });

    setDate("");
    setNote("");
    setRecurrence("none");
    setRecurrenceEnd("");
    setShowForm(false);
    refetch();
    queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    toast.success("Lembrete criado");
  };

  const startComplete = (r: any) => {
    setCompletingId(r.id);
    setCompletionComment("");
  };

  const confirmComplete = async (r: any) => {
    if (r.recurrence_type && r.recurrence_type !== "none" && !completionComment.trim()) {
      toast.error("Comentário obrigatório para finalizar lembretes recorrentes");
      return;
    }
    const { error } = await supabase
      .from("ticket_reminders")
      .update({
        is_dismissed: true,
        completion_comment: completionComment || null,
        completed_at: new Date().toISOString(),
        completed_by: userId,
      } as any)
      .eq("id", r.id);
    if (error) {
      toast.error("Erro ao finalizar lembrete: " + error.message);
      return;
    }

    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content: `Lembrete de ${new Date(r.reminder_date).toLocaleDateString("pt-BR")} finalizado${
        completionComment ? `: ${completionComment}` : ""
      }${r.recurrence_type && r.recurrence_type !== "none" ? " — próximo lembrete reagendado automaticamente" : ""}`,
      comment_type: "sistema",
    });

    setCompletingId(null);
    setCompletionComment("");
    refetch();
    refetchHistory();
    queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    toast.success(
      r.recurrence_type && r.recurrence_type !== "none"
        ? "Lembrete finalizado e reagendado"
        : "Lembrete finalizado"
    );
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
            <label className="text-xs font-medium">
              Data do Lembrete {recurrence === "none" ? "*" : <span className="text-muted-foreground font-normal">(opcional — usará a próxima ocorrência)</span>}
            </label>
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
          <div className="space-y-1">
            <label className="text-xs font-medium flex items-center gap-1">
              <Repeat className="h-3 w-3" /> Recorrência
            </label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {recurrence !== "none" && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Encerrar recorrência em (opcional)</label>
              <Input
                type="datetime-local"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={addReminder} disabled={!date && recurrence === "none"} className="h-7 text-xs">
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
          const isRecurring = r.recurrence_type && r.recurrence_type !== "none";
          const isCompleting = completingId === r.id;
          return (
            <div
              key={r.id}
              className={`flex flex-col gap-2 p-2 rounded-md border text-sm ${
                isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border"
              }`}
            >
              <div className="flex items-start gap-2">
                <Bell className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isOverdue ? "text-destructive" : "text-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-xs">
                      {rDate.toLocaleDateString("pt-BR")}{" "}
                      {rDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 py-0">Vencido</Badge>}
                    {isRecurring && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                        <Repeat className="h-2.5 w-2.5" />
                        {RECURRENCE_LABEL[r.recurrence_type]}
                      </Badge>
                    )}
                  </div>
                  {r.reminder_note && <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.reminder_note}</p>}
                </div>
                {!isCompleting && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => startComplete(r)}
                    title="Finalizar lembrete"
                  >
                    <BellOff className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {isCompleting && (
                <div className="space-y-2 pl-5">
                  <Textarea
                    value={completionComment}
                    onChange={(e) => setCompletionComment(e.target.value)}
                    placeholder={
                      isRecurring
                        ? "Comentário obrigatório (será arquivado no histórico)..."
                        : "Comentário (opcional)..."
                    }
                    className="min-h-[50px] text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => confirmComplete(r)}
                      disabled={isRecurring && !completionComment.trim()}
                      className="h-7 text-xs"
                    >
                      Finalizar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCompletingId(null)}
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHistory(!showHistory)}
            className="h-7 gap-1 text-xs w-full justify-start"
          >
            <History className="h-3 w-3" />
            Histórico ({history.length})
            {showHistory ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </Button>
          {showHistory && (
            <div className="space-y-1.5 mt-2">
              {history.map((h: any) => (
                <div key={h.id} className="p-2 rounded-md border bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">
                      {new Date(h.scheduled_for).toLocaleDateString("pt-BR")}{" "}
                      {new Date(h.scheduled_for).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {h.recurrence_type && h.recurrence_type !== "none" && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
                        <Repeat className="h-2.5 w-2.5" />
                        {RECURRENCE_LABEL[h.recurrence_type] || h.recurrence_type}
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      Finalizado em {new Date(h.completed_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {h.reminder_note && (
                    <p className="text-muted-foreground break-words">📌 {h.reminder_note}</p>
                  )}
                  {h.completion_comment && (
                    <p className="break-words">💬 {h.completion_comment}</p>
                  )}
                  {h.next_scheduled_for && (
                    <p className="text-muted-foreground text-[11px]">
                      ↻ Reagendado para {new Date(h.next_scheduled_for).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
