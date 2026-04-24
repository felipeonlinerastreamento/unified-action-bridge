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
  Pencil,
  Check,
  X,
} from "lucide-react";
import { TicketReminderSection } from "./ticket-reminder-section";
import { TicketAgentsSection } from "./ticket-agents-section";
import { TicketTrackingSection } from "./ticket-tracking-section";
import {
  useTesteEquipamentoSettings,
  isTesteEquipamentoCategory,
} from "@/hooks/use-teste-equipamento-settings";
import { syncTicketToGsystem } from "@/lib/ticket-finalize.functions";
import { finalizeTicketWithFlow } from "@/lib/ticket-finalize-flow";
import { Cloud, RefreshCcw } from "lucide-react";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { data: teSettings } = useTesteEquipamentoSettings();

  // Load active sectors for forward dropdown
  const { data: sectors = [] } = useQuery({
    queryKey: ["active-sectors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["ticket-comments", ticket?.id],
    queryFn: async () => {
      if (!ticket?.id) return [];
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error loading comments:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!ticket?.id,
  });

  const userId = currentUser?.id ?? null;

  const addComment = async () => {
    if (!comment.trim() || !ticket?.id) return;
    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: ticket.id,
      user_id: userId,
      content: comment,
      comment_type: "comentario",
    });
    if (error) {
      console.error("Error adding comment:", error);
      toast.error("Erro ao adicionar comentário: " + error.message);
      return;
    }
    setComment("");
    refetchComments();
    toast.success("Comentário adicionado");
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setEditingContent(c.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent("");
  };

  const saveEdit = async (commentId: string) => {
    if (!editingContent.trim()) return;
    const { error } = await supabase
      .from("ticket_comments")
      .update({
        content: editingContent,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId);
    if (error) {
      toast.error("Erro ao editar comentário: " + error.message);
      return;
    }
    setEditingId(null);
    setEditingContent("");
    refetchComments();
    toast.success("Comentário atualizado");
  };

  const getAuthorName = (uid: string | null | undefined) => {
    if (!uid) return "Sistema";
    if (uid === userId) return "Você";
    const p = profiles.find((p) => p.user_id === uid);
    return p?.name || "Usuário";
  };

  const insertSystemComment = async (ticketId: string, content: string, type: string) => {
    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content,
      comment_type: type,
    });
    if (error) console.error("Error inserting system comment:", error);
  };

  const runGsystemSync = async (silent = false) => {
    if (!ticket?.id) return;
    setSyncing(true);
    try {
      const res = await syncTicketToGsystem({ data: { ticketId: ticket.id } });
      if ((res as any)?.ok) {
        await insertSystemComment(
          ticket.id,
          `Sincronizado com GSystem (pendência ${(res as any).pendenciaKey || "criada"})`,
          "sistema"
        );
        if (!silent) toast.success("Sincronizado com GSystem");
      } else {
        const errMsg = (res as any)?.error || "erro desconhecido";
        await insertSystemComment(
          ticket.id,
          `Falha ao sincronizar com GSystem: ${errMsg}. Tente novamente em Ações.`,
          "sistema"
        );
        if (!silent) toast.error("Falha ao sincronizar GSystem: " + errMsg);
      }
    } catch (e: any) {
      if (!silent) toast.error("Erro de sincronização: " + (e?.message || e));
    } finally {
      setSyncing(false);
      refetchComments();
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!ticket?.id) return;

    if (newStatus === "finalizado") {
      const res = await finalizeTicketWithFlow({ ticket, userId, teSettings });
      if (res.error) {
        toast.error("Erro ao finalizar: " + res.error);
        return;
      }
      refetchComments();
      onRefetch();
      if (res.routed && res.routedTo) {
        toast.success(`Encaminhado para ${res.routedTo.sector}`);
        if (res.syncError) toast.error("Falha GSystem: " + res.syncError);
        else if (res.syncedToGsystem) toast.success("Sincronizado com GSystem");
      } else {
        toast.success("Ticket finalizado");
      }
      return;
    }

    const baseUpdate = {
      status: newStatus as "aberto" | "em_andamento" | "finalizado" | "reaberto",
      updated_at: new Date().toISOString(),
      closed_at: null as string | null,
      reopened_at: ticket.reopened_at as string | null,
    };
    if (newStatus === "reaberto") baseUpdate.reopened_at = new Date().toISOString();

    const { error } = await supabase.from("service_tickets").update(baseUpdate).eq("id", ticket.id);
    if (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status: " + error.message);
      return;
    }

    await insertSystemComment(ticket.id, `Status alterado para ${newStatus}`, "status_change");
    refetchComments();
    onRefetch();
    toast.success(`Ticket ${newStatus === "reaberto" ? "reaberto" : "atualizado"}`);
  };

  const reprocessFlow = async () => {
    if (!ticket?.id) return;
    const res = await finalizeTicketWithFlow({
      ticket,
      userId,
      teSettings,
      registerStatusComment: false,
    });
    if (res.error) {
      toast.error("Erro ao reprocessar: " + res.error);
      return;
    }
    refetchComments();
    onRefetch();
    if (res.routed && res.routedTo) {
      toast.success(`Reprocessado: encaminhado para ${res.routedTo.sector}`);
      if (res.syncError) toast.error("Falha GSystem: " + res.syncError);
    } else {
      toast.message("Sem regra de encaminhamento aplicável");
    }
  };

  const updatePriority = async (priority: string) => {
    if (!ticket?.id) return;
    const { error } = await supabase
      .from("service_tickets")
      .update({ priority: priority as "baixa" | "media" | "alta" | "urgente", updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Erro ao atualizar prioridade: " + error.message);
      return;
    }
    await insertSystemComment(ticket.id, `Prioridade alterada para ${getPriorityLabel(priority)}`, "status_change");
    refetchComments();
    onRefetch();
    toast.success("Prioridade atualizada");
  };

  const forwardToSector = async () => {
    if (!forwardSector.trim() || !ticket?.id) return;
    const { error } = await supabase
      .from("service_tickets")
      .update({ sector: forwardSector, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Erro ao encaminhar: " + error.message);
      return;
    }
    await insertSystemComment(ticket.id, `Encaminhado para setor: ${forwardSector}`, "encaminhamento");
    await supabase.from("ticket_assignments").insert({
      ticket_id: ticket.id,
      assigned_by: userId,
      sector_name: forwardSector,
    });
    setForwardSector("");
    refetchComments();
    onRefetch();
    toast.success("Encaminhado para setor");
  };

  const forwardToUser = async () => {
    if (!forwardUser || !ticket?.id) return;
    const profile = profiles.find((p) => p.user_id === forwardUser);
    const { error } = await supabase
      .from("service_tickets")
      .update({ assigned_to: forwardUser, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Erro ao encaminhar: " + error.message);
      return;
    }
    await insertSystemComment(ticket.id, `Encaminhado para usuário: ${profile?.name || forwardUser}`, "encaminhamento");
    await supabase.from("ticket_assignments").insert({
      ticket_id: ticket.id,
      assigned_to: forwardUser,
      assigned_by: userId,
    });
    setForwardUser("");
    refetchComments();
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
            <DetailRow label="Responsável" value={
              ticket.assigned_to
                ? (profiles.find((p) => p.user_id === ticket.assigned_to)?.name || "Atribuído")
                : null
            } />
            <DetailRow label="Categoria" value={ticket.category} />
            <DetailRow label="Observações" value={ticket.notes} />
            <DetailRow label="Criado em" value={ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Finalizado em" value={ticket.closed_at ? new Date(ticket.closed_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Reaberto em" value={ticket.reopened_at ? new Date(ticket.reopened_at).toLocaleString("pt-BR") : null} />

            <TicketTrackingSection ticketId={ticket.id} trackingCode={ticket.tracking_code || null} />
          </TabsContent>

          <TabsContent value="comentarios" className="mt-3 space-y-3">
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
              ) : (
                comments.map((c: any) => {
                  const isOwn = c.user_id && c.user_id === userId;
                  const isEditable = isOwn && c.comment_type === "comentario";
                  const isEditing = editingId === c.id;
                  return (
                    <div key={c.id} className="flex gap-2 text-sm group">
                      {getCommentIcon(c.comment_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground/80">
                            {getAuthorName(c.user_id)}
                          </span>
                          {isEditable && !isEditing && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => startEdit(c)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-1 mt-1">
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="default" className="h-7 gap-1" onClick={() => saveEdit(c.id)} disabled={!editingContent.trim()}>
                                <Check className="h-3 w-3" /> Salvar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={cancelEdit}>
                                <X className="h-3 w-3" /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="break-words">{c.content}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(c.created_at).toLocaleString("pt-BR")}
                          {c.edited_at && (
                            <span className="ml-1 italic">(editado)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
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
              <div className="flex gap-2 flex-wrap">
                {ticket.status === "aberto" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus("em_andamento")} className="gap-1">
                    <Clock className="h-3.5 w-3.5" /> Iniciar Atendimento
                  </Button>
                )}
                {ticket.status === "reaberto" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus("em_andamento")} className="gap-1">
                    <Clock className="h-3.5 w-3.5" /> Iniciar Atendimento
                  </Button>
                )}
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
              </div>
              {ticket.status === "finalizado" &&
                isTesteEquipamentoCategory(ticket.category, teSettings) &&
                (!ticket.sector ||
                  ticket.sector !== (teSettings?.target_sector_name || "Administrativo")) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={reprocessFlow}
                    className="gap-1 mt-2"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" /> Reprocessar fluxo
                  </Button>
                )}
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

            {/* Linked agents */}
            <TicketAgentsSection ticketId={ticket.id} userId={userId} profiles={profiles} />

            {/* Reminders */}
            <TicketReminderSection ticketId={ticket.id} userId={userId} />

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

            {/* Manual GSystem sync */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-xs font-medium text-muted-foreground">Sincronização GSystem</label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runGsystemSync(false)}
                disabled={syncing}
                className="w-full gap-2"
              >
                <Cloud className="h-4 w-4" />
                {syncing ? "Sincronizando..." : "Sincronizar com GSystem"}
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Cria pendência no GSystem com toda a descrição do atendimento.
              </p>
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
