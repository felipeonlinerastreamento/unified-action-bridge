import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Repeat, Calendar, User, Users, Link as LinkIcon } from "lucide-react";
import type { Task } from "@/hooks/use-tasks";
import { useTasks } from "@/hooks/use-tasks";

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const { updateTask } = useTasks();

  const isOverdue =
    task.due_date && task.status !== "completed" && new Date(task.due_date) < new Date();

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({ id: task.id, updates: { status: "completed" } });
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight line-clamp-2">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
            )}
          </div>
          {task.status !== "completed" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0"
              onClick={handleComplete}
              title="Concluir"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant={PRIORITY_VARIANT[task.priority]} className="text-[10px] py-0 h-5">
            {PRIORITY_LABEL[task.priority]}
          </Badge>
          {task.category_name && (
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-5"
              style={{ borderColor: task.category_color, color: task.category_color }}
            >
              {task.category_name}
            </Badge>
          )}
          {task.recurrence_type && (
            <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5">
              <Repeat className="h-2.5 w-2.5" />
              recorrente
            </Badge>
          )}
          {task.is_group_task && (
            <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5">
              <Users className="h-2.5 w-2.5" />
              grupo
            </Badge>
          )}
          {task.ticket_id && (
            <Badge variant="outline" className="text-[10px] py-0 h-5 gap-0.5">
              <LinkIcon className="h-2.5 w-2.5" />
              atendimento
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {task.due_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString("pt-BR")}
              </span>
            )}
            {task.assignee_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assignee_name}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
