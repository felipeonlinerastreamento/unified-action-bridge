import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Hourglass } from "lucide-react";

type Rule = {
  id: string;
  name: string;
  is_enabled: boolean;
  target: "customer" | "operator";
  idle_minutes: number;
  message_template: string;
  cooldown_minutes: number;
  max_sends_per_ticket: number;
  apply_to_groups: boolean;
};

const DEFAULTS: Omit<Rule, "id"> = {
  name: "",
  is_enabled: true,
  target: "customer",
  idle_minutes: 5,
  message_template:
    "{{contactName}} ainda está aí? Preciso de uma interação para que o chamado não seja finalizado por inatividade.",
  cooldown_minutes: 30,
  max_sends_per_ticket: 2,
  apply_to_groups: false,
};

export function ChatIdleAutoMessagesConfig() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<Omit<Rule, "id">>(DEFAULTS);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["chat-idle-auto-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_idle_auto_messages" as any)
        .select("*")
        .order("target")
        .order("idle_minutes");
      if (error) throw error;
      return (data || []) as unknown as Rule[];
    },
  });

  const reset = () => { setEditing(null); setForm(DEFAULTS); };

  const openCreate = () => { reset(); setDialogOpen(true); };
  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      name: r.name, is_enabled: r.is_enabled, target: r.target,
      idle_minutes: r.idle_minutes, message_template: r.message_template,
      cooldown_minutes: r.cooldown_minutes, max_sends_per_ticket: r.max_sends_per_ticket,
      apply_to_groups: r.apply_to_groups,
    });
    setDialogOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.message_template.trim()) {
        throw new Error("Preencha nome e mensagem");
      }
      if (editing) {
        const { error } = await supabase
          .from("chat_idle_auto_messages" as any)
          .update(form as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("chat_idle_auto_messages" as any)
          .insert(form as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Regra atualizada" : "Regra criada");
      qc.invalidateQueries({ queryKey: ["chat-idle-auto-messages"] });
      setDialogOpen(false); reset();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_idle_auto_messages" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra excluída");
      qc.invalidateQueries({ queryKey: ["chat-idle-auto-messages"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: boolean }) => {
      const { error } = await supabase
        .from("chat_idle_auto_messages" as any)
        .update({ is_enabled: v } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-idle-auto-messages"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="h-5 w-5" /> Mensagens automáticas por ociosidade
          </CardTitle>
          <CardDescription>
            Envia uma mensagem ao WhatsApp quando o cliente ou o operador ficam sem responder no chat.
            Variáveis: <code>{"{{contactName}}"}</code>, <code>{"{{operatorName}}"}</code>.
          </CardDescription>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Nova Regra
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            Nenhuma regra configurada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Ociosidade</TableHead>
                <TableHead>Cooldown</TableHead>
                <TableHead>Máx/atendimento</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.target === "customer" ? "outline" : "secondary"}>
                      {r.target === "customer" ? "Cliente" : "Operador"}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.idle_minutes} min</TableCell>
                  <TableCell>{r.cooldown_minutes} min</TableCell>
                  <TableCell>{r.max_sends_per_ticket}</TableCell>
                  <TableCell>
                    <Switch
                      checked={r.is_enabled}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, v })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); reset(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Regra" : "Nova Regra de Ociosidade"}</DialogTitle>
            <DialogDescription>
              Defina quando e qual mensagem enviar ao WhatsApp em caso de inatividade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Alvo (quem está ocioso)</Label>
              <RadioGroup
                value={form.target}
                onValueChange={(v) => setForm({ ...form, target: v as "customer" | "operator" })}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="customer" id="t-customer" />
                  <Label htmlFor="t-customer" className="font-normal">Cliente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="operator" id="t-operator" />
                  <Label htmlFor="t-operator" className="font-normal">Operador</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Ociosidade (min)</Label>
                <Input
                  type="number" min={1}
                  value={form.idle_minutes}
                  onChange={(e) => setForm({ ...form, idle_minutes: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cooldown (min)</Label>
                <Input
                  type="number" min={0}
                  value={form.cooldown_minutes}
                  onChange={(e) => setForm({ ...form, cooldown_minutes: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máx/atendimento</Label>
                <Input
                  type="number" min={1}
                  value={form.max_sends_per_ticket}
                  onChange={(e) => setForm({ ...form, max_sends_per_ticket: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                rows={4}
                value={form.message_template}
                onChange={(e) => setForm({ ...form, message_template: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code>{"{{contactName}}"}</code>, <code>{"{{operatorName}}"}</code>.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.apply_to_groups}
                onCheckedChange={(v) => setForm({ ...form, apply_to_groups: v })}
              />
              <Label>Aplicar também a grupos</Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_enabled}
                onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
              />
              <Label>Regra ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
