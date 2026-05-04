import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, CheckCircle2, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { upsertCrmTask, completeCrmTask } from "@/lib/crm.functions";

export function CrmTasksTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"open" | "done">("open");
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    contact_id: null,
    task_type: "followup",
    priority: "media",
    due_date: "",
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm-tasks", filter],
    queryFn: async () => {
      const q = supabase.from("crm_tasks").select("*, crm_contacts(name), companies(name)").order("due_date", { nullsFirst: false });
      const { data } = filter === "open" ? await q.in("status", ["pending"]) : await q.eq("status", "done").limit(100);
      return data || [];
    },
    refetchInterval: 30000,
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts-min"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_contacts").select("id, name").order("name").limit(500);
      return data || [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await upsertCrmTask({
        data: {
          title: form.title,
          description: form.description,
          contact_id: form.contact_id || undefined,
          task_type: form.task_type,
          priority: form.priority,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Tarefa criada");
      setOpen(false);
      setForm({ title: "", description: "", contact_id: null, task_type: "followup", priority: "media", due_date: "" });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const doneMut = useMutation({
    mutationFn: async (id: string) => completeCrmTask({ data: { id, note: "" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
  });

  const priorityColor: any = { urgente: "destructive", alta: "default", media: "secondary", baixa: "outline" };
  const typeIcon: any = { birthday: "🎂", renewal: "📄", postsale: "📞", recurring: "🔁", followup: "✉️", churn: "⚠️", nps: "⭐" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button variant={filter === "open" ? "default" : "outline"} size="sm" onClick={() => setFilter("open")}>Pendentes</Button>
          <Button variant={filter === "done" ? "default" : "outline"} size="sm" onClick={() => setFilter("done")}>Concluídas</Button>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova tarefa</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListTodo className="h-4 w-4" /> {tasks.length} tarefa(s)</CardTitle></CardHeader>
        <CardContent className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" /> : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Sem tarefas.</p>
          ) : tasks.map((t: any) => (
            <div key={t.id} className="flex items-start gap-2 p-2 hover:bg-accent/30 rounded text-sm border-b">
              <span className="text-lg">{typeIcon[t.task_type] ?? "📌"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  <Badge variant={priorityColor[t.priority] || "secondary"} className="text-[9px]">{t.priority}</Badge>
                </div>
                {t.description && <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
                <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                  {t.crm_contacts?.name && <span>👤 {t.crm_contacts.name}</span>}
                  {t.companies?.name && <span>🏢 {t.companies.name}</span>}
                  {t.due_date && <span>📅 {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              {filter === "open" && (
                <Button size="sm" variant="ghost" onClick={() => doneMut.mutate(t.id)} disabled={doneMut.isPending}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa CRM</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="postsale">Pós-venda</SelectItem>
                    <SelectItem value="birthday">Aniversário</SelectItem>
                    <SelectItem value="renewal">Renovação</SelectItem>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                    <SelectItem value="churn">Resgate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Contato</Label>
              <Select value={form.contact_id || "none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nenhum —</SelectItem>
                  {contacts.slice(0, 200).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Vencimento</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <Button className="w-full" disabled={!form.title || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar tarefa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
