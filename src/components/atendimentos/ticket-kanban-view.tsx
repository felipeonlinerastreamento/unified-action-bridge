import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, User, Layers, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTesteEquipamentoSettings } from "@/hooks/use-teste-equipamento-settings";
import { useAuth } from "@/hooks/use-auth";
import { finalizeTicketWithFlow } from "@/lib/ticket-finalize-flow";
import { formatTicketProtocol } from "@/lib/protocol-format";
import { LiberacaoBadge } from "./liberacao-badge";

interface TicketKanbanViewProps {
  tickets: any[];
  onSelect: (ticket: any) => void;
  onRefetch: () => void;
}

const COLUMNS = [
  { key: "aberto", label: "Aberto", color: "border-t-amber-500" },
  { key: "em_andamento", label: "Em Andamento", color: "border-t-blue-500" },
  { key: "reaberto", label: "Reaberto", color: "border-t-orange-500" },
  { key: "finalizado", label: "Finalizado", color: "border-t-emerald-500" },
];

function getPriorityColor(p: string) {
  if (p === "urgente") return "bg-red-500";
  if (p === "alta") return "bg-orange-500";
  if (p === "media") return "bg-amber-500";
  return "bg-emerald-500";
}

export function TicketKanbanView({ tickets, onSelect, onRefetch }: TicketKanbanViewProps) {
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
  });
  const { data: teSettings } = useTesteEquipamentoSettings();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const t of tickets) {
      const s = t.status || "aberto";
      if (map[s]) map[s].push(t);
      else if (map["aberto"]) map["aberto"].push(t);
    }
    return map;
  }, [tickets]);

  const handleDrop = async (ticketId: string, newStatus: string) => {
    if (newStatus === "finalizado") {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      const { data: { user } } = await supabase.auth.getUser();
      const res = await finalizeTicketWithFlow({
        ticket,
        userId: user?.id || null,
        teSettings,
        bypassRouting: isAdmin,
      });
      if (res.error) {
        toast.error("Erro ao finalizar: " + res.error);
        return;
      }
      if (res.routed && res.routedTo) {
        toast.success(`Encaminhado para ${res.routedTo.sector}`);
        if (res.syncError) toast.error("Falha GSystem: " + res.syncError);
        else if (res.syncedToGsystem) toast.success("Sincronizado com GSystem");
      } else {
        toast.success("Ticket finalizado");
      }
      onRefetch();
      return;
    }

    const update: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "reaberto") {
      update.reopened_at = new Date().toISOString();
      update.closed_at = null;
    }
    if (newStatus === "aberto" || newStatus === "em_andamento") {
      update.closed_at = null;
    }

    const { error } = await supabase.from("service_tickets").update(update).eq("id", ticketId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      content: `Status alterado para ${newStatus}`,
      comment_type: "status_change",
    });

    toast.success("Status atualizado");
    onRefetch();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          className="space-y-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const ticketId = e.dataTransfer.getData("ticketId");
            if (ticketId) handleDrop(ticketId, col.key);
          }}
        >
          <Card className={`border-t-4 ${col.color}`}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center justify-between">
                {col.label}
                <Badge variant="secondary" className="text-xs">{grouped[col.key]?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-2 min-h-[100px]">
              {(grouped[col.key] || []).map((t: any) => (
                <Card
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("ticketId", t.id)}
                  className="cursor-grab hover:bg-accent/50 transition-colors active:cursor-grabbing"
                  onClick={() => onSelect(t)}
                >
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(t.priority || "media")}`} />
                      <span className="text-xs font-medium truncate flex-1">
                        {t.contact_name || t.attendance_id || "Ticket"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">#{formatTicketProtocol(t)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t.companies?.name && (
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3" /> {t.companies.name}
                        </span>
                      )}
                    </div>
                    {t.sector && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Layers className="h-3 w-3" /> {t.sector}
                      </span>
                    )}
                    {t.assigned_to && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> {profiles.find((p: any) => p.user_id === t.assigned_to)?.name || "Atribuído"}
                      </span>
                    )}
                    {t.created_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Criação">
                        <Clock className="h-3 w-3" />
                        {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Última interação">
                      <MessageSquare className="h-3 w-3" />
                      {t.last_comment_at
                        ? new Date(t.last_comment_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "Sem interações"}
                    </span>
                    <LiberacaoBadge ticket={t} />
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
