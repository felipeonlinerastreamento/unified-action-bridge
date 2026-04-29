import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Trash2, Send, Repeat } from "lucide-react";
import { useTasks, useTaskComments, type Task } from "@/hooks/use-tasks";
import { useAuth } from "@/hooks/use-auth";
import { TaskFormDialog } from "./task-form-dialog";

export function TaskDetailPanel({
  task,
  open,
  onClose,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { updateTask, deleteTask, addComment, profiles } = useTasks();
  const { data: comments = [] } = useTaskComments(task?.id ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

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

  const canDelete = user?.id === task.created_by;

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
                    {task.recurrence_type}
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
                  Recorrência <strong>{task.recurrence_type}</strong>
                  {task.recurrence_end_date && <> até {new Date(task.recurrence_end_date).toLocaleDateString("pt-BR")}</>}.
                  Ao concluir, a tarefa será reaberta com a próxima data automaticamente.
                </div>
              )}

              <Separator />

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
                  onClick={() => updateTask.mutate({ id: task.id, updates: { status: "completed" } })}
                  className="flex-1"
                >
                  Concluir
                </Button>
              )}
              {canDelete && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TaskFormDialog open={editOpen} onClose={() => setEditOpen(false)} task={task} />
    </>
  );
}
