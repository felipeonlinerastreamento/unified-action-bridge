import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, CheckSquare, Loader2 } from "lucide-react";

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface ActivityRow {
  id: string;
  ticket_id: string;
  catalog_id: string | null;
  name_snapshot: string;
  description_snapshot: string | null;
  is_completed: boolean;
  completion_note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  added_by: string | null;
  created_at: string;
}

export function TicketActivitiesSection({
  ticketId,
  profiles,
}: {
  ticketId: string;
  profiles: any[];
}) {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const userId = user?.id || null;

  const [selectedCatalog, setSelectedCatalog] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [dialog, setDialog] = useState<{
    row: ActivityRow;
    nextCompleted: boolean;
  } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: catalog = [] } = useQuery({
    queryKey: ["ticket-activity-catalog", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_activity_catalog" as any)
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CatalogItem[];
    },
  });

  const { data: activities = [], refetch } = useQuery({
    queryKey: ["ticket-activities", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_activities" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ActivityRow[];
    },
    enabled: !!ticketId,
  });

  const getName = (uid: string | null) =>
    uid ? profiles.find((p) => p.user_id === uid)?.name || "Usuário" : "—";

  const addActivity = async () => {
    if (!selectedCatalog) return;
    const item = catalog.find((c) => c.id === selectedCatalog);
    if (!item) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("ticket_activities" as any).insert({
        ticket_id: ticketId,
        catalog_id: item.id,
        name_snapshot: item.name,
        description_snapshot: item.description,
        added_by: userId,
      });
      if (error) throw error;
      await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        user_id: userId,
        content: `📝 Atividade adicionada: "${item.name}"`,
        comment_type: "atividade",
      });
      setSelectedCatalog("");
      refetch();
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
      toast.success("Atividade adicionada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const openCheckboxDialog = (row: ActivityRow, nextCompleted: boolean) => {
    setNote("");
    setDialog({ row, nextCompleted });
  };

  const confirmCheckbox = async () => {
    if (!dialog) return;
    setSaving(true);
    try {
      const { row, nextCompleted } = dialog;
      const { error } = await supabase
        .from("ticket_activities" as any)
        .update({
          is_completed: nextCompleted,
          completion_note: note.trim() || null,
          completed_at: nextCompleted ? new Date().toISOString() : null,
          completed_by: nextCompleted ? userId : null,
        })
        .eq("id", row.id);
      if (error) throw error;

      const prefix = nextCompleted ? "✅ Atividade concluída" : "↩️ Atividade reaberta";
      const obs = note.trim() ? ` — ${note.trim()}` : "";
      await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        user_id: userId,
        content: `${prefix}: "${row.name_snapshot}"${obs}`,
        comment_type: "atividade",
      });

      setDialog(null);
      setNote("");
      refetch();
      qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const removeActivity = async (row: ActivityRow) => {
    if (!isAdmin) {
      toast.error("Somente administradores podem remover atividades.");
      return;
    }
    if (!confirm(`Remover atividade "${row.name_snapshot}"?`)) return;
    const { error } = await supabase
      .from("ticket_activities" as any)
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content: `🗑️ Atividade removida: "${row.name_snapshot}"`,
      comment_type: "atividade",
    });
    refetch();
    qc.invalidateQueries({ queryKey: ["ticket-comments", ticketId] });
    toast.success("Atividade removida");
  };

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Atividades</span>
      </div>

      <div className="flex gap-2">
        <Select value={selectedCatalog} onValueChange={setSelectedCatalog}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione uma atividade..." />
          </SelectTrigger>
          <SelectContent>
            {catalog.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Nenhuma atividade cadastrada
              </div>
            ) : (
              catalog.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={addActivity} disabled={!selectedCatalog || adding}>
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {activities.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhuma atividade vinculada.</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="flex gap-2 items-start p-2 rounded border bg-background">
              <Checkbox
                checked={a.is_completed}
                onCheckedChange={(v) => openCheckboxDialog(a, !!v)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-sm font-medium ${
                      a.is_completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {a.name_snapshot}
                  </span>
                </div>
                {a.description_snapshot && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
                    {a.description_snapshot}
                  </p>
                )}
                {a.is_completed && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Concluída por {getName(a.completed_by)}{" "}
                    {a.completed_at &&
                      `em ${new Date(a.completed_at).toLocaleString("pt-BR")}`}
                    {a.completion_note ? ` — ${a.completion_note}` : ""}
                  </p>
                )}
              </div>
              {isAdmin && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeActivity(a)}
                  title="Remover (apenas admin)"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && !saving && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.nextCompleted ? "Concluir atividade" : "Reabrir atividade"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.row.name_snapshot} — adicione uma observação (opcional). Ela ficará
              registrada nos comentários do chamado.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação..."
            rows={3}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirmCheckbox} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Verifica se há atividades pendentes (não concluídas) no chamado.
 * Retorna a lista de nomes pendentes (vazia = pode finalizar).
 */
export async function getPendingActivities(ticketId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("ticket_activities" as any)
    .select("name_snapshot, is_completed")
    .eq("ticket_id", ticketId)
    .eq("is_completed", false);
  if (error) {
    console.error("Error checking pending activities:", error);
    return [];
  }
  return ((data || []) as any[]).map((r) => r.name_snapshot);
}
