import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, List, LayoutGrid, CalendarDays, Loader2 } from "lucide-react";
import { useTasks, type Task } from "@/hooks/use-tasks";
import { TaskCard } from "./task-card";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskDetailPanel } from "./task-detail-panel";

export function TarefasContent() {
  const { tasks, isLoading } = useTasks();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [view, setView] = useState<"lista" | "kanban" | "calendario">("lista");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.title.toLowerCase().includes(s) && !t.description?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    recurring: tasks.filter((t) => t.recurrence_type).length,
  }), [tasks]);

  const byStatus = useMemo(() => ({
    pending: filtered.filter((t) => t.status === "pending"),
    in_progress: filtered.filter((t) => t.status === "in_progress"),
    completed: filtered.filter((t) => t.status === "completed"),
  }), [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Tarefas do time com recorrências automáticas</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova tarefa
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total" value={stats.total} />
        <KpiCard label="Pendentes" value={stats.pending} />
        <KpiCard label="Em andamento" value={stats.in_progress} />
        <KpiCard label="Concluídas" value={stats.completed} />
        <KpiCard label="Recorrentes" value={stats.recurring} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-card">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefas..."
            className="pl-7 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="completed">Concluídas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="lista" className="gap-1"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
          <TabsTrigger value="kanban" className="gap-1"><LayoutGrid className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1"><CalendarDays className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <Card className="mt-4">
            <CardContent className="p-6 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando tarefas...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="lista" className="mt-4 grid gap-2">
              {filtered.length === 0 ? (
                <EmptyState />
              ) : (
                filtered.map((t) => <TaskCard key={t.id} task={t} onClick={() => setSelected(t)} />)
              )}
            </TabsContent>

            <TabsContent value="kanban" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(["pending", "in_progress", "completed"] as const).map((col) => (
                  <div key={col} className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="font-medium text-sm">
                        {col === "pending" ? "Pendentes" : col === "in_progress" ? "Em andamento" : "Concluídas"}
                      </h3>
                      <span className="text-xs text-muted-foreground">{byStatus[col].length}</span>
                    </div>
                    <div className="space-y-2 min-h-[200px] p-2 rounded-lg bg-muted/30">
                      {byStatus[col].map((t) => (
                        <TaskCard key={t.id} task={t} onClick={() => setSelected(t)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="calendario" className="mt-4">
              <CalendarView tasks={filtered} onSelect={setSelected} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <TaskFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <TaskDetailPanel task={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma tarefa encontrada. Clique em "Nova tarefa" para começar.
      </CardContent>
    </Card>
  );
}

function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const today = new Date();
  const [month, setMonth] = useState({ year: today.getFullYear(), m: today.getMonth() });

  const first = new Date(month.year, month.m, 1);
  const last = new Date(month.year, month.m + 1, 0);
  const startDayOfWeek = first.getDay();
  const totalDays = last.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(month.year, month.m, d));

  const tasksByDay: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (!t.due_date) continue;
    const d = new Date(t.due_date);
    if (d.getFullYear() === month.year && d.getMonth() === month.m) {
      const key = String(d.getDate());
      if (!tasksByDay[key]) tasksByDay[key] = [];
      tasksByDay[key].push(t);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Button size="sm" variant="outline" onClick={() => setMonth((m) => ({ year: m.m === 0 ? m.year - 1 : m.year, m: m.m === 0 ? 11 : m.m - 1 }))}>
            ‹
          </Button>
          <p className="font-medium text-sm">
            {first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <Button size="sm" variant="outline" onClick={() => setMonth((m) => ({ year: m.m === 11 ? m.year + 1 : m.year, m: m.m === 11 ? 0 : m.m + 1 }))}>
            ›
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
            <div key={d} className="text-center font-medium text-muted-foreground py-1">{d}</div>
          ))}
          {cells.map((c, i) => (
            <div key={i} className="min-h-[70px] p-1 rounded border bg-card">
              {c && (
                <>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{c.getDate()}</p>
                  <div className="space-y-0.5">
                    {(tasksByDay[String(c.getDate())] || []).slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t)}
                        className="block w-full text-left text-[10px] truncate px-1 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
