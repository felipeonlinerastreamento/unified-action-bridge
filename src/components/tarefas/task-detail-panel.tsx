import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Send, Repeat, Lock, CheckCircle2, History } from "lucide-react";
import { useTasks, useTaskComments, type Task } from "@/hooks/use-tasks";
import { useAuth } from "@/hooks/use-auth";
import { TaskFormDialog } from "./task-form-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function TaskDetailPanel({
  task,
  open,
  onClose,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { updateTask, deleteTask, addComment, profiles } = useTasks();
  const { data: comments = [] } = useTaskComments(task?.id ?? null);
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeComment, setCompleteComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["task-completion-history", task?.id],
    enabled: !!task?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completion_history" as any)
        .select("*")
        .eq("task_id", task!.id)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    if (!completeOpen) setCompleteComment("");
  }, [completeOpen]);

  if (!task) return null;

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({
      taskId: task.id,
      content: newComment.trim(),
      currentStatus: task.status,
    });
    setNewComment("");
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta tarefa?")) return;
    await deleteTask.mutateAsync(task.id);
    onClose();
  };

  const canDelete = user?.id === task.created_by || isAdmin;
  const adminLocked = !!task.admin_only_complete;
  const canComplete = !adminLocked || isAdmin;

  const handleConfirmComplete = async () => {
    if (!completeComment.trim()) {
      toast.error("Comentário obrigatório para concluir");
      return;
    }
    if (!user?.id) return;
    setSubmitting(true);
    try {
      // Insert history BEFORE completing (trigger will roll the date forward)
      const { error: histErr } = await supabase.from("task_completion_history" as any).insert({
        task_id: task.id,
        completed_by: user.id,
        comment: completeComment.trim(),
        scheduled_for: task.due_date,
        recurrence_type: task.recurrence_type,
      } as any);
      if (histErr) throw histErr;

      await updateTask.mutateAsync({
        id: task.id,
        updates: { status: "completed", completed_at: new Date().toISOString() } as any,
      });

      qc.invalidateQueries({ queryKey: ["task-completion-history", task.id] });
      toast.success(
        task.recurrence_type
          ? "Concluído. Tarefa reagendada para o próximo ciclo."
          : "Tarefa concluída."
      );
      setCompleteOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao concluir");
    } finally {
      setSubmitting(false);
    }
  };

  const recurrenceLabel = (t?: string | null) => {
    switch (t) {
      case "daily": return "Diária";
      case "weekly": return "Semanal";
      case "biweekly": return "Quinzenal";
      case "monthly": return "Mensal";
      case "yearly": return "Anual";
      default: return t || "—";
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col">
          <SheetHeader>
            <SheetTitle className="pr-8">{task.title}</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{task.status === "pending" ? "Pendente" : task.status === "in_progress" ? "Em andamento" : "Concluída"}</Badge>
                <Badge variant="secondary">{task.priority}</Badge>
                {task.recurrence_type && (
                  <Badge variant="outline" className="gap-1">
                    <Repeat className="h-3 w-3" />
                    {recurrenceLabel(task.recurrence_type)}
                  </Badge>
                )}
                {adminLocked && (
                  <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
                    <Lock className="h-3 w-3" />
                    Conclusão restrita ao Admin
                  </Badge>
                )}
              </div>

              {task.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p>{task.due_date ? new Date(task.due_date).toLocaleString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lembrete</p>
                  <p>{task.reminder_at ? new Date(task.reminder_at).toLocaleString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criador</p>
                  <p>{task.creator_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p>{task.assignee_name || "—"}</p>
                </div>
              </div>

              {task.is_group_task && task.participants && task.participants.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Participantes</p>
                  <div className="flex flex-wrap gap-1">
                    {task.participants.map((p) => (
                      <Badge key={p.user_id} variant="secondary" className="text-xs">{p.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {task.recurrence_type && (
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Recorrência <strong>{recurrenceLabel(task.recurrence_type)}</strong>
                  {task.recurrence_day_of_week != null && (
                    <> · dia {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][task.recurrence_day_of_week]}</>
                  )}
                  {task.recurrence_day_of_month != null && <> · dia {task.recurrence_day_of_month} do mês</>}
                  {task.recurrence_end_date && <> · até {new Date(task.recurrence_end_date).toLocaleDateString("pt-BR")}</>}.
                  Ao concluir, a tarefa será reaberta com a próxima data automaticamente.
                </div>
              )}

              <Separator />

              {history.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <History className="h-3.5 w-3.5" /> Histórico de conclusões ({history.length})
                  </p>
                  <div className="space-y-2">
                    {history.map((h) => {
                      const author = profiles.find((p) => p.user_id === h.completed_by);
                      return (
                        <div key={h.id} className="rounded-lg border bg-muted/30 p-2">
                          <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                            <span className="font-medium">{author?.name || "Usuário"}</span>
                            <span>{new Date(h.completed_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{h.comment}</p>
                          {h.scheduled_for && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Vencimento original: {new Date(h.scheduled_for).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Separator className="mt-3" />
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Comentários ({comments.length})</p>
                <div className="space-y-2">
                  {comments.map((c) => {
                    const author = profiles.find((p) => p.user_id === c.user_id);
                    return (
                      <div key={c.id} className="rounded-lg bg-muted/50 p-2">
                        <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                          <span className="font-medium">{author?.name || "Usuário"}</span>
                          <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      </div>
                    );
                  })}
                  {comments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário ainda</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                rows={2}
                className="text-sm"
              />
              <Button size="icon" onClick={handleSendComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="flex-1">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              {task.status !== "completed" && (
                <Button
                  size="sm"
                  onClick={() => setCompleteOpen(true)}
                  disabled={!canComplete}
                  title={!canComplete ? "Apenas administradores podem concluir" : undefined}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Concluir agora
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {!canComplete && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Esta tarefa só pode ser concluída por um administrador.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TaskFormDialog open={editOpen} onClose={() => setEditOpen(false)} task={task} />

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir tarefa</DialogTitle>
            <DialogDescription>
              {task.recurrence_type
                ? "Ao concluir, a tarefa será reagendada para o próximo ciclo. Um comentário é obrigatório e ficará no histórico."
                : "Um comentário é obrigatório e ficará registrado no histórico."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Comentário de conclusão *</Label>
            <Textarea
              value={completeComment}
              onChange={(e) => setCompleteComment(e.target.value)}
              rows={4}
              placeholder="Descreva o que foi feito..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmComplete} disabled={submitting || !completeComment.trim()}>
              {submitting ? "Concluindo..." : "Confirmar conclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
