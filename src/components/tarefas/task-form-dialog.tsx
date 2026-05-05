import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTasks, type Task, type TaskPriority, type TaskStatus } from "@/hooks/use-tasks";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Lock } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaultTicketId?: string | null;
};

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Sem recorrência" },
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "yearly", label: "Anual" },
];

export function TaskFormDialog({ open, onClose, task, defaultTicketId }: Props) {
  const { createTask, updateTask, categories, profiles } = useTasks();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [reminderAt, setReminderAt] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [recurrenceType, setRecurrenceType] = useState<string>("none");
  const [recurrenceEnd, setRecurrenceEnd] = useState<string>("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("none");
  const [dayOfMonth, setDayOfMonth] = useState<string>("");
  const [adminOnlyComplete, setAdminOnlyComplete] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || "");
        setStatus(task.status);
        setPriority(task.priority);
        setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
        setReminderAt(task.reminder_at ? task.reminder_at.slice(0, 16) : "");
        setCategoryId(task.category_id || "none");
        setAssignedTo(task.assigned_to || "none");
        setRecurrenceType(task.recurrence_type || "none");
        setRecurrenceEnd(task.recurrence_end_date ? task.recurrence_end_date.slice(0, 10) : "");
        setIsGroup(task.is_group_task);
        setParticipantIds((task.participants || []).map((p) => p.user_id));
      } else {
        setTitle("");
        setDescription("");
        setStatus("pending");
        setPriority("medium");
        setDueDate("");
        setReminderAt("");
        setCategoryId("none");
        setAssignedTo("none");
        setRecurrenceType("none");
        setRecurrenceEnd("");
        setIsGroup(false);
        setParticipantIds([]);
      }
    }
  }, [open, task]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const payload: Partial<Task> = {
      title: title.trim(),
      description,
      status,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      category_id: categoryId === "none" ? null : categoryId,
      assigned_to: assignedTo === "none" ? null : assignedTo,
      is_group_task: isGroup,
      recurrence_type: (recurrenceType === "none" ? null : recurrenceType) as Task["recurrence_type"],
      recurrence_end_date: recurrenceEnd ? new Date(recurrenceEnd).toISOString() : null,
    };

    if (task) {
      await updateTask.mutateAsync({ id: task.id, updates: payload });
    } else {
      (payload as any).ticket_id = defaultTicketId ?? null;
      await createTask.mutateAsync({ task: payload, participantIds: isGroup ? participantIds : [] });
    }
    onClose();
  };

  const toggleParticipant = (uid: string) => {
    setParticipantIds((curr) =>
      curr.includes(uid) ? curr.filter((x) => x !== uid) : [...curr, uid]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Verificar pendência..." />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de vencimento</Label>
                <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>Lembrete</Label>
                <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Recorrência</Label>
              <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recurrenceType !== "none" && (
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    Ao concluir esta tarefa, ela será reaberta automaticamente com a próxima data de vencimento.
                  </p>
                  <div>
                    <Label className="text-xs">Data final da recorrência (opcional)</Label>
                    <Input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Tarefa em grupo</Label>
                <p className="text-xs text-muted-foreground">Permite adicionar participantes</p>
              </div>
              <Switch checked={isGroup} onCheckedChange={setIsGroup} />
            </div>

            {isGroup && (
              <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
                <Label className="text-xs">Participantes</Label>
                {profiles.map((p) => (
                  <label key={p.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={participantIds.includes(p.user_id)}
                      onCheckedChange={() => toggleParticipant(p.user_id)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            )}

            {defaultTicketId && !task && (
              <p className="text-xs text-muted-foreground">
                Esta tarefa será vinculada ao atendimento atual.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            {task ? "Salvar" : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
