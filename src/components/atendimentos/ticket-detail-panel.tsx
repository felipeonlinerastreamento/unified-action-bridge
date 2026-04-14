import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  RotateCcw,
  Send,
  ArrowRight,
  Clock,
  MessageSquare,
  User,
  Building2,
} from "lucide-react";

interface TicketDetailPanelProps {
  ticket: any | null;
  open: boolean;
  onClose: () => void;
  onRefetch: () => void;
  profiles: any[];
}

function getPriorityLabel(p: string) {
  const map: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };
  return map[p] || "Média";
}

function getCommentIcon(type: string) {
  if (type === "encaminhamento") return <ArrowRight className="h-3.5 w-3.5 text-blue-500" />;
  if (type === "status_change") return <RotateCcw className="h-3.5 w-3.5 text-amber-500" />;
  if (type === "sistema") return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  return <MessageSquare className="h-3.5 w-3.5 text-primary" />;
}

export function TicketDetailPanel({ ticket, open, onClose, onRefetch, profiles }: TicketDetailPanelProps) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [forwardSector, setForwardSector] = useState("");
  const [forwardUser, setForwardUser] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["ticket-comments", ticket?.id],
    queryFn: async () => {
      if (!ticket?.id) return [];
      const { data } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!ticket?.id,
  });

  const addComment = async () => {
    if (!comment.trim() || !ticket?.id) return;
    await supabase.from("ticket_comments").insert({
      ticket_id: ticket.id,
      content: comment,
      comment_type: "comentario",
    });
    setComment("");
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    toast.success("Comentário adicionado");
  };

  const updateStatus = async (newStatus: string) => {
    if (!ticket?.id) return;
    const update: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "finalizado") update.closed_at = new Date().toISOString();
    if (newStatus === "reaberto") {
      update.reopened_at = new Date().toISOString();
      update.closed_at = null;
    }

    await supabase.from("service_tickets").update(update).eq("id", ticket.id);
    await supabase.from("ticket_comments").insert({
      ticket_id: ticket.id,
      content: `Status alterado para ${newStatus}`,
      comment_type: "status_change",
    });

    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    onRefetch();
    toast.success(`Ticket ${newStatus === "finalizado" ? "finalizado" : "reaberto"}`);
  };

  const updatePriority = async (priority: string) => {
    if (!ticket?.id) return;
    await supabase.from("service_tickets").update({ priority: priority as "baixa" | "media" | "alta" | "urgente", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    await supabase.from("ticket_comments").insert({
      ticket_id: ticket.id,
      content: `Prioridade alterada para ${getPriorityLabel(priority)}`,
      comment_type: "status_change",
    });
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    onRefetch();
    toast.success("Prioridade atualizada");
  };

  const forwardToSector = async () => {
    if (!forwardSector.trim() || !ticket?.id) return;
    await supabase.from("service_tickets").update({ sector: forwardSector, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    await supabase.from("ticket_comments").insert({
      ticket_id: ticket.id,
      content: `Encaminhado para setor: ${forwardSector}`,
      comment_type: "encaminhamento",
    });
    await supabase.from("ticket_assignments").insert({
      ticket_id: ticket.id,
      sector_name: forwardSector,
    });
    setForwardSector("");
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    onRefetch();
    toast.success("Encaminhado para setor");
  };

  const forwardToUser = async () => {
    if (!forwardUser || !ticket?.id) return;
    const profile = profiles.find((p) => p.user_id === forwardUser);
    await supabase.from("service_tickets").update({ assigned_to: forwardUser, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    await supabase.from("ticket_comments").insert({
      ticket_id: ticket.id,
      content: `Encaminhado para usuário: ${profile?.name || forwardUser}`,
      comment_type: "encaminhamento",
    });
    await supabase.from("ticket_assignments").insert({
      ticket_id: ticket.id,
      assigned_to: forwardUser,
    });
    setForwardUser("");
    queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
    onRefetch();
    toast.success("Encaminhado para usuário");
  };

  if (!ticket) return null;

  const canFinalize = ticket.status !== "finalizado";
  const canReopen = ticket.status === "finalizado";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {ticket.contact_name || ticket.attendance_id || "Ticket"}
            <Badge variant="outline" className="text-xs">#{ticket.id?.substring(0, 8)}</Badge>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="detalhes" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="detalhes" className="flex-1">Detalhes</TabsTrigger>
            <TabsTrigger value="comentarios" className="flex-1">Comentários</TabsTrigger>
            <TabsTrigger value="acoes" className="flex-1">Ações</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-3 mt-3">
            <DetailRow label="Status" value={ticket.status} />
            <DetailRow label="Prioridade" value={getPriorityLabel(ticket.priority || "media")} />
            <DetailRow label="Contato" value={ticket.contact_name} />
            <DetailRow label="Telefone" value={ticket.contact_phone} />
            <DetailRow label="Empresa" value={ticket.companies?.name} />
            <DetailRow label="Placa" value={ticket.plate} />
            <DetailRow label="Setor" value={ticket.sector} />
            <DetailRow label="Categoria" value={ticket.category} />
            <DetailRow label="Observações" value={ticket.notes} />
            <DetailRow label="Criado em" value={ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Finalizado em" value={ticket.closed_at ? new Date(ticket.closed_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Reaberto em" value={ticket.reopened_at ? new Date(ticket.reopened_at).toLocaleString("pt-BR") : null} />
          </TabsContent>

          <TabsContent value="comentarios" className="mt-3 space-y-3">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="flex gap-2 text-sm">
                    {getCommentIcon(c.comment_type)}
                    <div className="flex-1">
                      <p className="break-words">{c.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(c.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[60px]"
              />
              <Button size="icon" onClick={addComment} disabled={!comment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="acoes" className="mt-3 space-y-4">
            {/* Status actions */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <div className="flex gap-2">
                {canFinalize && (
                  <Button size="sm" variant="default" onClick={() => updateStatus("finalizado")} className="gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Finalizar
                  </Button>
                )}
                {canReopen && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus("reaberto")} className="gap-1">
                    <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                  </Button>
                )}
                {ticket.status === "aberto" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus("em_andamento")} className="gap-1">
                    <Clock className="h-3.5 w-3.5" /> Iniciar
                  </Button>
                )}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
              <Select value={ticket.priority || "media"} onValueChange={updatePriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Forward to sector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Encaminhar para Setor</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do setor"
                  value={forwardSector}
                  onChange={(e) => setForwardSector(e.target.value)}
                  className="h-9"
                />
                <Button size="sm" onClick={forwardToSector} disabled={!forwardSector.trim()}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Forward to user */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Encaminhar para Usuário</label>
              <div className="flex gap-2">
                <Select value={forwardUser} onValueChange={setForwardUser}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Selecionar usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.user_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={forwardToUser} disabled={!forwardUser}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-muted-foreground min-w-[120px]">{label}:</span>
      <span className="break-all">{value || "—"}</span>
    </div>
  );
}
