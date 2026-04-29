import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getTiposPendencia } from "@/lib/gsystem-api.functions";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Repeat,
} from "lucide-react";
import { TaskFormDialog } from "@/components/tarefas/task-form-dialog";
import { TicketReminderSection } from "./ticket-reminder-section";
import { TicketAgentsSection } from "./ticket-agents-section";
import { TicketTrackingSection } from "./ticket-tracking-section";
import { TicketLiberacaoSection } from "./ticket-liberacao-section";
import { TicketAttachmentsSection } from "./ticket-attachments-section";
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
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const { data: teSettings } = useTesteEquipamentoSettings();

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // GSystem categories (tipos de pendência) — same source used at ticket creation
  const { data: tiposPendencia = [], isLoading: tiposLoading } = useQuery({
    queryKey: ["tipos-pendencia-detail-panel"],
    queryFn: async () => {
      const result = await getTiposPendencia(await getAuthHeaders());
      return Array.isArray(result) ? result : [];
    },
    enabled: open && editingCategory,
    staleTime: 60_000,
  });

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
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

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

  const startEditCategory = () => {
    // categoryDraft passa a guardar a Key do GSystem (não o rótulo).
    setCategoryDraft(ticket?.pendencia_key || "");
    setEditingCategory(true);
  };

  // Quando os tipos carregarem e o ticket não tiver pendencia_key (ticket antigo),
  // tentamos resolver pela Descricao para que o Select já apareça selecionado.
  useEffect(() => {
    if (
      editingCategory &&
      !categoryDraft &&
      ticket?.category &&
      Array.isArray(tiposPendencia) &&
      tiposPendencia.length > 0
    ) {
      const match = tiposPendencia.find(
        (t: any) =>
          String(t.Descricao || "").trim().toLowerCase() ===
          String(ticket.category || "").trim().toLowerCase()
      );
      if (match?.Key) setCategoryDraft(String(match.Key));
    }
  }, [editingCategory, tiposPendencia, ticket?.category, categoryDraft]);

  const cancelEditCategory = () => {
    setEditingCategory(false);
    setCategoryDraft("");
  };

  const saveCategory = async () => {
    if (!ticket?.id) return;
    const newKey = categoryDraft.trim() || null;
    const tipo = newKey
      ? tiposPendencia.find((t: any) => String(t.Key) === newKey)
      : null;
    const newLabel = tipo?.Descricao || null;

    if (
      (newKey || "") === (ticket.pendencia_key || "") &&
      (newLabel || "") === (ticket.category || "")
    ) {
      setEditingCategory(false);
      return;
    }
    setSavingCategory(true);
    try {
      // 1) Atualiza a tabela local mantendo categoria + pendencia_key sincronizados
      const { error } = await supabase
        .from("service_tickets")
        .update({
          category: newLabel,
          pendencia_key: newKey,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);
      if (error) {
        toast.error("Erro ao alterar categoria: " + error.message);
        return;
      }

      // 2) Se já existe pendência criada no GSystem para esse ticket, atualiza lá também
      let gsyncMsg = "";
      try {
        const { data: link } = await supabase
          .from("entity_links")
          .select("external_id")
          .eq("entity_type", "pendencia")
          .eq("local_id", String(ticket.id))
          .maybeSingle();
        if (link?.external_id && newKey) {
          const { updatePendencia } = await import("@/lib/gsystem-api.functions");
          await updatePendencia({
            data: {
              key: String(link.external_id),
              body: { TipoPendencia: newKey, Tipo: newKey },
            },
          });
          gsyncMsg = " e sincronizada no GSystem";
        }
      } catch (gErr: any) {
        console.warn("[saveCategory] GSystem sync failed:", gErr?.message || gErr);
        gsyncMsg = " (falha ao sincronizar no GSystem)";
      }

      await supabase.from("ticket_comments").insert({
        ticket_id: ticket.id,
        user_id: userId,
        content: `Categoria alterada de "${ticket.category || "—"}" para "${newLabel || "—"}"${gsyncMsg}`,
        comment_type: "status_change",
      });
      toast.success("Categoria atualizada" + gsyncMsg);
      setEditingCategory(false);
      onRefetch();
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
    } finally {
      setSavingCategory(false);
    }
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

    // Pick least loaded agent in the sector
    let assignedAgentId: string | null = null;
    let assignedAgentName = "";
    try {
      const { data: agentId } = await supabase.rpc("pick_least_loaded_agent", {
        _sector: forwardSector,
      });
      if (agentId) {
        assignedAgentId = agentId as string;
        const profile = profiles.find((p) => p.user_id === assignedAgentId);
        assignedAgentName = profile?.name || "atendente";
      }
    } catch (e) {
      console.error("Error picking least loaded agent:", e);
    }

    const updatePayload: any = {
      sector: forwardSector,
      updated_at: new Date().toISOString(),
    };
    if (assignedAgentId) updatePayload.assigned_to = assignedAgentId;

    const { error } = await supabase
      .from("service_tickets")
      .update(updatePayload)
      .eq("id", ticket.id);
    if (error) {
      toast.error("Erro ao encaminhar: " + error.message);
      return;
    }

    const commentMsg = assignedAgentId
      ? `Encaminhado para setor: ${forwardSector} → atribuído a ${assignedAgentName} (menor carga)`
      : `Encaminhado para setor: ${forwardSector} (sem atendente disponível para atribuição automática)`;
    await insertSystemComment(ticket.id, commentMsg, "encaminhamento");

    await supabase.from("ticket_assignments").insert({
      ticket_id: ticket.id,
      assigned_by: userId,
      assigned_to: assignedAgentId,
      sector_name: forwardSector,
    });
    setForwardSector("");
    refetchComments();
    onRefetch();
    toast.success(
      assignedAgentId
        ? `Encaminhado para ${forwardSector} → ${assignedAgentName}`
        : `Encaminhado para ${forwardSector}`
    );
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
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}>
              <Repeat className="h-3.5 w-3.5 mr-1.5" /> Nova tarefa / recorrência
            </Button>
          </div>
        </SheetHeader>
        <TaskFormDialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} defaultTicketId={ticket.id} />

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
            <div className="flex gap-2 text-sm items-start">
              <span className="font-medium text-muted-foreground min-w-[120px] pt-1.5">Categoria:</span>
              <div className="flex-1 min-w-0">
                {editingCategory ? (
                  <div className="flex gap-1 items-center">
                    <Select value={categoryDraft} onValueChange={setCategoryDraft} disabled={tiposLoading || savingCategory}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={tiposLoading ? "Carregando..." : "Selecione..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {tiposPendencia.length === 0 && !tiposLoading ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma categoria encontrada.</div>
                        ) : (
                          tiposPendencia.map((t: any) => (
                            <SelectItem key={t.Key} value={String(t.Key)}>{t.Descricao}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveCategory} disabled={savingCategory}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditCategory} disabled={savingCategory}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span className="break-all">{ticket.category || "—"}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={startEditCategory}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DetailRow label="Observações" value={ticket.notes} />
            <DetailRow label="Criado em" value={ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Finalizado em" value={ticket.closed_at ? new Date(ticket.closed_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Reaberto em" value={ticket.reopened_at ? new Date(ticket.reopened_at).toLocaleString("pt-BR") : null} />

            <TicketTrackingSection ticketId={ticket.id} trackingCode={ticket.tracking_code || null} />
            <TicketLiberacaoSection ticket={ticket} userId={userId} onRefetch={onRefetch} />
            <TicketAttachmentsSection ticketId={ticket.id} userId={userId} />
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
                  <Button size="sm" variant="default" onClick={() => setConfirmFinalizeOpen(true)} className="gap-1">
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
                <Select value={forwardSector} onValueChange={setForwardSector}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Selecionar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={forwardToSector} disabled={!forwardSector.trim()}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                O ticket será atribuído automaticamente ao atendente do setor com menor número de chamados ativos.
              </p>
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
      <AlertDialog open={confirmFinalizeOpen} onOpenChange={setConfirmFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação encerrará o ticket. Você poderá reabri-lo depois, se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmFinalizeOpen(false);
                updateStatus("finalizado");
              }}
            >
              Sim, finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
