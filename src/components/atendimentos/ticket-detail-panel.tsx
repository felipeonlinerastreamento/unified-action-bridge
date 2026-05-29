import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getTiposPendencia } from "@/lib/gsystem-api.functions";
import { formatTicketProtocol } from "@/lib/protocol-format";
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
  ShieldAlert,
  Maximize2,
  Minimize2,
  Bell,
  CheckSquare,
} from "lucide-react";
import { TaskFormDialog } from "@/components/tarefas/task-form-dialog";
import { TicketReminderSection } from "./ticket-reminder-section";
import { TicketAgentsSection } from "./ticket-agents-section";
import { TicketTrackingSection } from "./ticket-tracking-section";
import { TicketLiberacaoSection } from "./ticket-liberacao-section";
import { TicketSuprimentoSection } from "./ticket-suprimento-section";
import { TicketCompraEquipamentoSection } from "./ticket-compra-equipamento-section";
import { TicketPurchaseSection } from "./ticket-purchase-section";
import { TicketPerdidosSection } from "./ticket-perdidos-section";
import { TicketAttachmentsSection } from "./ticket-attachments-section";
import { TicketActivitiesSection, getPendingActivities } from "./ticket-activities-section";
import { useSubcategoryEquipmentModels } from "@/hooks/use-liberacao-equipamento";
import {
  useTesteEquipamentoSettings,
  isTesteEquipamentoCategory,
} from "@/hooks/use-teste-equipamento-settings";
import { syncTicketToGsystem } from "@/lib/ticket-finalize.functions";
import { finalizeTicketWithFlow, finalizeTicketStandalone } from "@/lib/ticket-finalize-flow";
import { escalateToGestao as escalateToGestaoHelper } from "@/lib/escalate-gestao";
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
  if (type === "atividade") return <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />;
  return <MessageSquare className="h-3.5 w-3.5 text-primary" />;
}

export function TicketDetailPanel({ ticket, open, onClose, onRefetch, profiles }: TicketDetailPanelProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const goToChat = useCallback(async () => {
    if (!ticket?.contact_phone) {
      toast.error("Ticket sem telefone vinculado.");
      return;
    }
    const phone = String(ticket.contact_phone).replace(/\D/g, "");
    const { data: chat } = await supabase
      .from("zapi_chats")
      .select("id, channel_id")
      .ilike("phone", `%${phone.slice(-10)}%`)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chat) {
      toast.error("Conversa não encontrada na Central.");
      return;
    }
    onClose();
    navigate({ to: "/central", search: { chat: (chat as any).id, channel: (chat as any).channel_id } });
  }, [ticket?.contact_phone, navigate, onClose]);

  const startChatFromTicket = useCallback(async () => {
    if (!ticket?.contact_phone) {
      toast.error("Ticket sem telefone vinculado.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id || null;
    const phoneDigits = String(ticket.contact_phone).replace(/\D/g, "");

    // 1) tenta achar chat existente
    const { data: existing } = await supabase
      .from("zapi_chats")
      .select("id, channel_id, status, assigned_to")
      .ilike("phone", `%${phoneDigits.slice(-10)}%`)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let chatId: string | null = null;
    let channelId: string | null = null;

    if (existing) {
      chatId = (existing as any).id;
      channelId = (existing as any).channel_id;
      const upd: any = {
        pending_resolve_ticket_id: ticket.id,
        pending_resolve_at: new Date().toISOString(),
      };
      if ((existing as any).status === "aguardando" || !(existing as any).assigned_to) {
        upd.status = "em_atendimento";
        if (uid) {
          upd.assigned_to = uid;
          upd.pending_resolve_user_id = uid;
        }
      }
      const { error } = await supabase.from("zapi_chats").update(upd).eq("id", chatId!);
      if (error) {
        toast.error("Falha ao vincular conversa: " + error.message);
        return;
      }
    } else {
      // 2) seleciona canal ativo
      const { data: channels } = await (supabase as any).rpc("list_channels_safe");
      const active = (channels || []).find((c: any) => c.is_active) || (channels || [])[0];
      if (!active) {
        toast.error("Nenhum canal disponível para iniciar conversa.");
        return;
      }
      channelId = active.id;
      const { data: created, error } = await supabase
        .from("zapi_chats")
        .insert({
          channel_id: channelId,
          phone: phoneDigits,
          contact_name: ticket.contact_name || null,
          status: "em_atendimento",
          assigned_to: uid,
          pending_resolve_ticket_id: ticket.id,
          pending_resolve_user_id: uid,
          pending_resolve_at: new Date().toISOString(),
        } as any)
        .select("id")
        .single();
      if (error || !created) {
        toast.error("Falha ao criar conversa: " + (error?.message || ""));
        return;
      }
      chatId = (created as any).id;
    }

    toast.success(`Atendimento iniciado vinculado ao protocolo ${formatTicketProtocol(ticket as any, ticket.id)}`);
    onClose();
    navigate({ to: "/central", search: { chat: chatId!, channel: channelId! } });
  }, [ticket, navigate, onClose]);

  const [comment, setComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [forwardSector, setForwardSector] = useState("");
  const [forwardSectorUser, setForwardSectorUser] = useState<string>("__auto__");
  const [forwardUser, setForwardUser] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [subcategoryDraft, setSubcategoryDraft] = useState<string>("");
  const [equipmentModelDraft, setEquipmentModelDraft] = useState<string>("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [finalizeObservation, setFinalizeObservation] = useState("");
  const [editingField, setEditingField] = useState<null | "priority" | "contact_name" | "contact_phone" | "company_id" | "plate">(null);
  const [fieldDraft, setFieldDraft] = useState<string>("");
  const [savingField, setSavingField] = useState(false);
  const { data: teSettings } = useTesteEquipamentoSettings();

  const { data: companiesList = [] } = useQuery({
    queryKey: ["companies-edit-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      return (data || []) as { id: string; name: string }[];
    },
    enabled: open && editingField === "company_id",
    staleTime: 60_000,
  });

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

  // Sub-items cadastrados para a categoria atualmente selecionada no editor
  const { data: subcategoriesAll = [] } = useQuery({
    queryKey: ["ticket-subcategories-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_subcategories")
        .select("id, name, category_key, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  // Padrão de Serviços cadastrado na empresa do chamado
  const { data: serviceTemplates = [] } = useQuery({
    queryKey: ["ticket-company-service-templates", ticket?.company_id],
    queryFn: async () => {
      if (!ticket?.company_id) return [] as any[];
      const { data } = await supabase
        .from("company_service_templates" as any)
        .select("id, name, description, position")
        .eq("company_id", ticket.company_id)
        .order("position");
      return (data as any[]) || [];
    },
    enabled: open && !!ticket?.company_id,
    staleTime: 60_000,
  });

  const appendTemplateToNotes = async (description: string) => {
    if (!description || !ticket?.id) return;
    const current = (ticket.notes || "").trim();
    const next = current ? `${current}\n\n${description}` : description;
    const { error } = await supabase
      .from("service_tickets")
      .update({ notes: next, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Falha ao inserir nas observações");
      return;
    }
    toast.success("Padrão inserido nas observações");
    onRefetch();
    queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
  };

  const subcategoryOptions = (subcategoriesAll as any[]).filter(
    (s) => s.category_key === categoryDraft
  );

  const { data: equipmentModels = [] } = useSubcategoryEquipmentModels(subcategoryDraft || null);

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

  // Users assigned to the currently selected forward sector
  const { data: forwardSectorUsers = [] } = useQuery({
    queryKey: ["sector-users", forwardSector],
    enabled: !!forwardSector,
    queryFn: async () => {
      const sector = (sectors as any[]).find(
        (s: any) => String(s.name).toLowerCase() === forwardSector.toLowerCase(),
      );
      if (!sector) return [] as Array<{ user_id: string; name: string | null }>;
      const { data } = await supabase
        .from("user_sector_assignments")
        .select("user_id")
        .eq("sector_id", sector.id);
      const ids = (data ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      return ids
        .map((uid: string) => {
          const p = profiles.find((pp) => pp.user_id === uid);
          return { user_id: uid, name: p?.name ?? null };
        })
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
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
    setCategoryDraft(ticket?.pendencia_key || "");
    setSubcategoryDraft((ticket as any)?.subcategory_id || "");
    setEditingCategory(true);
  };

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
    setSubcategoryDraft("");
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
      const subId = subcategoryDraft || null;
      const subName = subId
        ? (subcategoriesAll as any[]).find((s) => s.id === subId)?.name || null
        : null;
      const { error } = await supabase
        .from("service_tickets")
        .update({
          category: newLabel,
          pendencia_key: newKey,
          subcategory_id: subId,
          subcategory_name: subName,
          updated_at: new Date().toISOString(),
        } as any)
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

  const startEditNotes = () => {
    setNotesDraft(ticket?.notes || "");
    setEditingNotes(true);
  };
  const cancelEditNotes = () => {
    setEditingNotes(false);
    setNotesDraft("");
  };
  const saveNotes = async () => {
    if (!ticket?.id) return;
    const newNotes = notesDraft.trim() || null;
    if ((newNotes || "") === (ticket.notes || "")) {
      setEditingNotes(false);
      return;
    }
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("service_tickets")
        .update({ notes: newNotes, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (error) {
        toast.error("Erro ao atualizar observações: " + error.message);
        return;
      }
      await supabase.from("ticket_comments").insert({
        ticket_id: ticket.id,
        user_id: userId,
        content: `Observações atualizadas`,
        comment_type: "status_change",
      });
      toast.success("Observações atualizadas");
      setEditingNotes(false);
      onRefetch();
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
    } finally {
      setSavingNotes(false);
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

  const updateStatus = async (newStatus: string, observation?: string) => {
    if (!ticket?.id) return;

    if (newStatus === "finalizado") {
      // Ticket recorrente: NÃO finaliza. Reagenda para a próxima ocorrência (mesmo ticket).
      if (ticket.is_recurring) {
        if (!observation || !observation.trim()) {
          toast.error("Observação obrigatória para concluir a ocorrência recorrente");
          return;
        }
        const { data: activeRec } = await supabase
          .from("ticket_reminders")
          .select("id, recurrence_type")
          .eq("ticket_id", ticket.id)
          .eq("is_dismissed", false)
          .not("recurrence_type", "is", null)
          .neq("recurrence_type", "none");

        if (!activeRec || activeRec.length === 0) {
          toast.error("Nenhum lembrete recorrente ativo para reagendar");
          return;
        }

        for (const r of activeRec) {
          await supabase
            .from("ticket_reminders")
            .update({
              is_dismissed: true,
              completion_comment: observation,
              completed_at: new Date().toISOString(),
              completed_by: userId,
            } as any)
            .eq("id", r.id);
        }

        // O trigger handle_reminder_completion cria o próximo ticket_reminders
        // e espelha service_tickets.reminder_date para a nova data.
        await supabase
          .from("service_tickets")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", ticket.id);

        // Reler a próxima data já gravada pelo trigger
        const { data: next } = await supabase
          .from("service_tickets")
          .select("reminder_date")
          .eq("id", ticket.id)
          .maybeSingle();
        const nextDate = next?.reminder_date
          ? new Date(next.reminder_date as string)
          : null;
        const nextLabel = nextDate
          ? `${nextDate.toLocaleDateString("pt-BR")} ${nextDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : "data a definir";

        await insertSystemComment(
          ticket.id,
          `Ocorrência concluída e reagendada para ${nextLabel}. Observação: ${observation}`,
          "sistema"
        );

        refetchComments();
        onRefetch();
        queryClient.invalidateQueries({ queryKey: ["ticket-reminders", ticket.id] });
        queryClient.invalidateQueries({ queryKey: ["ticket-reminder-history", ticket.id] });
        queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
        toast.success(`Ocorrência concluída — próxima notificação em ${nextLabel}`);
        return;
      }

      const pending = await getPendingActivities(ticket.id);
      if (pending.length > 0) {
        toast.error(
          `Conclua todas as atividades antes de finalizar: ${pending.join(", ")}`,
          { duration: 6000 }
        );
        return;
      }

      const res = await finalizeTicketStandalone({ ticket, userId });
      if (!res.ok) {
        toast.error("Erro ao finalizar: " + (res.error || "desconhecido"));
        return;
      }
      refetchComments();
      onRefetch();
      await queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
      await queryClient.refetchQueries({ queryKey: ["service-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-reminders", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["ticket-reminder-history", ticket.id] });
      toast.success("Ticket finalizado");
      return;
    }

    const baseUpdate: any = {
      status: newStatus as "aberto" | "em_andamento" | "finalizado" | "reaberto",
      updated_at: new Date().toISOString(),
      closed_at: null as string | null,
      reopened_at: ticket.reopened_at as string | null,
    };
    if (newStatus === "reaberto") baseUpdate.reopened_at = new Date().toISOString();
    if (newStatus === "finalizado") {
      baseUpdate.closed_at = new Date().toISOString();
      baseUpdate.closed_by = userId;
    }

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

  const fieldLabels: Record<string, string> = {
    priority: "Prioridade",
    contact_name: "Contato",
    contact_phone: "Telefone",
    company_id: "Empresa",
    plate: "Placa",
  };

  const startEditField = (field: NonNullable<typeof editingField>) => {
    if (!ticket) return;
    if (field === "company_id") setFieldDraft(ticket.company_id || "");
    else if (field === "priority") setFieldDraft(ticket.priority || "media");
    else setFieldDraft(((ticket as any)[field] as string) || "");
    setEditingField(field);
  };

  const cancelEditField = () => {
    setEditingField(null);
    setFieldDraft("");
  };

  const saveField = async () => {
    if (!ticket?.id || !editingField) return;
    const field = editingField;
    let newValue: any = fieldDraft.trim();
    if (field === "plate") newValue = newValue ? newValue.toUpperCase() : null;
    if (field === "contact_phone") newValue = newValue ? newValue.replace(/\D/g, "") : null;
    if (field === "company_id") newValue = newValue || null;
    if (!newValue && (field === "contact_name" || field === "priority")) {
      toast.error(`${fieldLabels[field]} não pode ficar vazio`);
      return;
    }
    if (field !== "company_id" && field !== "priority" && !newValue) newValue = null;

    const currentValue = field === "company_id" ? (ticket.company_id || null) : ((ticket as any)[field] ?? null);
    if ((currentValue || "") === (newValue || "")) {
      cancelEditField();
      return;
    }

    setSavingField(true);
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      payload[field] = newValue;
      const { error } = await supabase.from("service_tickets").update(payload).eq("id", ticket.id);
      if (error) {
        toast.error("Erro ao atualizar: " + error.message);
        return;
      }
      let displayOld = currentValue || "—";
      let displayNew = newValue || "—";
      if (field === "company_id") {
        displayOld = ticket.companies?.name || "—";
        displayNew = companiesList.find((c) => c.id === newValue)?.name || "—";
      }
      if (field === "priority") {
        displayOld = getPriorityLabel(currentValue || "media");
        displayNew = getPriorityLabel(newValue);
      }
      await insertSystemComment(
        ticket.id,
        `${fieldLabels[field]} alterado de "${displayOld}" para "${displayNew}"`,
        "status_change"
      );
      toast.success(`${fieldLabels[field]} atualizado`);
      cancelEditField();
      refetchComments();
      onRefetch();
      queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
    } finally {
      setSavingField(false);
    }
  };

  const forwardToSector = async () => {
    if (!forwardSector.trim() || !ticket?.id) return;

    let assignedAgentId: string | null = null;
    let assignedAgentName = "";
    let routingMode: "manual" | "online" | "any" | "none" = "none";

    // 1) If operator explicitly chosen, use it.
    if (forwardSectorUser && forwardSectorUser !== "__auto__") {
      assignedAgentId = forwardSectorUser;
      const profile = profiles.find((p) => p.user_id === assignedAgentId);
      assignedAgentName = profile?.name || "atendente";
      routingMode = "manual";
    } else {
      // 2) Auto-routing: try online+available first.
      try {
        const { data: agentId } = await supabase.rpc("pick_least_loaded_agent", {
          _sector: forwardSector,
        });
        if (agentId) {
          assignedAgentId = agentId as string;
          routingMode = "online";
        }
      } catch (e) {
        console.error("Error picking least loaded agent (online):", e);
      }
      // 3) Fallback: any agent of the sector, ignoring presence.
      if (!assignedAgentId) {
        try {
          const { data: agentId } = await supabase.rpc("pick_least_loaded_agent_any", {
            _sector: forwardSector,
          });
          if (agentId) {
            assignedAgentId = agentId as string;
            routingMode = "any";
          }
        } catch (e) {
          console.error("Error picking least loaded agent (any):", e);
        }
      }
      if (assignedAgentId) {
        const profile = profiles.find((p) => p.user_id === assignedAgentId);
        assignedAgentName = profile?.name || "atendente";
      }
    }

    // Always set assigned_to (including null) so the previous responsible is
    // released when the sector has no available agents.
    const updatePayload: any = {
      sector: forwardSector,
      assigned_to: assignedAgentId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("service_tickets")
      .update(updatePayload)
      .eq("id", ticket.id);
    if (error) {
      toast.error("Erro ao encaminhar: " + error.message);
      return;
    }

    let commentMsg: string;
    switch (routingMode) {
      case "manual":
        commentMsg = `Encaminhado para setor: ${forwardSector} → atribuído a ${assignedAgentName}`;
        break;
      case "online":
        commentMsg = `Encaminhado para setor: ${forwardSector} → atribuído a ${assignedAgentName} (menor carga, online)`;
        break;
      case "any":
        commentMsg = `Encaminhado para setor: ${forwardSector} → atribuído a ${assignedAgentName} (menor carga, agente offline)`;
        break;
      default:
        commentMsg = `Encaminhado para setor: ${forwardSector} (sem atendentes cadastrados — responsável removido)`;
    }
    await insertSystemComment(ticket.id, commentMsg, "encaminhamento");

    await supabase.from("ticket_assignments").insert({
      ticket_id: ticket.id,
      assigned_by: userId,
      assigned_to: assignedAgentId,
      sector_name: forwardSector,
    });
    setForwardSector("");
    setForwardSectorUser("__auto__");
    refetchComments();
    onRefetch();
    toast.success(
      assignedAgentId
        ? `Encaminhado para ${forwardSector} → ${assignedAgentName}`
        : `Encaminhado para ${forwardSector} (sem atendente)`,
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
      <SheetContent className={expanded ? "w-full sm:max-w-[95vw] lg:max-w-[1400px] overflow-y-auto" : "w-full sm:max-w-lg overflow-y-auto"}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {ticket.contact_name || ticket.attendance_id || "Ticket"}
            <Badge variant="outline" className="text-xs">#{formatTicketProtocol(ticket)}</Badge>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto mr-8 h-7 px-2"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Reduzir" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </SheetTitle>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}>
              <Repeat className="h-3.5 w-3.5 mr-1.5" /> Nova tarefa / recorrência
            </Button>
            {ticket.reminder_date && (
              <Badge
                variant="outline"
                className="text-xs gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
              >
                <Bell className="h-3 w-3" />
                Próxima notificação:{" "}
                {new Date(ticket.reminder_date).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Badge>
            )}
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
            <DetailRow label="Protocolo" value={`#${formatTicketProtocol(ticket)}`} />
            <DetailRow label="Status" value={ticket.status} />
            <EditableRow
              label="Prioridade"
              field="priority"
              displayValue={getPriorityLabel(ticket.priority || "media")}
              editable={ticket.status !== "finalizado"}
              editingField={editingField}
              fieldDraft={fieldDraft}
              setFieldDraft={setFieldDraft}
              onStart={startEditField}
              onCancel={cancelEditField}
              onSave={saveField}
              saving={savingField}
              companies={companiesList}
            />
            <EditableRow
              label="Contato"
              field="contact_name"
              displayValue={ticket.contact_name}
              editable={ticket.status !== "finalizado"}
              editingField={editingField}
              fieldDraft={fieldDraft}
              setFieldDraft={setFieldDraft}
              onStart={startEditField}
              onCancel={cancelEditField}
              onSave={saveField}
              saving={savingField}
              companies={companiesList}
            />
            <EditableRow
              label="Telefone"
              field="contact_phone"
              displayValue={ticket.contact_phone}
              editable={ticket.status !== "finalizado"}
              editingField={editingField}
              fieldDraft={fieldDraft}
              setFieldDraft={setFieldDraft}
              onStart={startEditField}
              onCancel={cancelEditField}
              onSave={saveField}
              saving={savingField}
              companies={companiesList}
            />
            <EditableRow
              label="Empresa"
              field="company_id"
              displayValue={ticket.companies?.name}
              editable={ticket.status !== "finalizado"}
              editingField={editingField}
              fieldDraft={fieldDraft}
              setFieldDraft={setFieldDraft}
              onStart={startEditField}
              onCancel={cancelEditField}
              onSave={saveField}
              saving={savingField}
              companies={companiesList}
            />
            <EditableRow
              label="Placa"
              field="plate"
              displayValue={ticket.plate}
              editable={ticket.status !== "finalizado"}
              editingField={editingField}
              fieldDraft={fieldDraft}
              setFieldDraft={setFieldDraft}
              onStart={startEditField}
              onCancel={cancelEditField}
              onSave={saveField}
              saving={savingField}
              companies={companiesList}
            />
            <DetailRow label="Setor" value={ticket.sector} />
            <div className="flex gap-2 text-sm items-start">
              <span className="font-medium text-muted-foreground min-w-[120px] pt-0.5">Responsável:</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="font-medium">
                  {(() => {
                    const p = profiles.find((pp) => pp.user_id === ticket.assigned_to);
                    return p?.name || (ticket.assigned_to ? ticket.assigned_to.substring(0, 8) : "Sem operador");
                  })()}
                </div>
                {(() => {
                  const agentIds: string[] = Array.isArray((ticket as any).agent_user_ids) ? (ticket as any).agent_user_ids : [];
                  const extras = agentIds.filter((id) => id && id !== ticket.assigned_to);
                  if (!extras.length) return null;
                  return (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Atendentes vinculados:</span>
                      {extras.map((id) => {
                        const p = profiles.find((pp) => pp.user_id === id);
                        return (
                          <Badge key={id} variant="outline" className="text-[10px]">
                            {p?.name || id.substring(0, 8)}
                          </Badge>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-2 text-sm items-start">
              <span className="font-medium text-muted-foreground min-w-[120px] pt-1.5">Categoria:</span>
              <div className="flex-1 min-w-0">
                {editingCategory ? (
                  <div className="space-y-2">
                    <div className="flex gap-1 items-center">
                      <Select value={categoryDraft} onValueChange={(v) => { setCategoryDraft(v); setSubcategoryDraft(""); }} disabled={tiposLoading || savingCategory}>
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
                    {categoryDraft && subcategoryOptions.length > 0 && (
                      <div className="flex gap-1 items-center">
                        <Select value={subcategoryDraft || "__none__"} onValueChange={(v) => setSubcategoryDraft(v === "__none__" ? "" : v)} disabled={savingCategory}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Sub-item..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Sem sub-item —</SelectItem>
                            {subcategoryOptions.map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group">
                    <span className="break-all">
                      {ticket.category || "—"}
                      {(ticket as any).subcategory_name && (
                        <Badge variant="outline" className="ml-2 text-[10px]">{(ticket as any).subcategory_name}</Badge>
                      )}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={startEditCategory}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2 items-start text-sm">
              <span className="text-muted-foreground">Observações</span>
              <div className="min-w-0">
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={4}
                      placeholder="Adicione observações..."
                      disabled={savingNotes}
                    />
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditNotes} disabled={savingNotes}>
                        <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1 group">
                    <span className="whitespace-pre-wrap break-words flex-1">{ticket.notes || "—"}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={startEditNotes}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {serviceTemplates.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Padrão de Serviços do cliente
                  </h4>
                </div>
                <div className="space-y-2">
                  {(serviceTemplates as any[]).map((tpl) => (
                    <div
                      key={tpl.id}
                      className="rounded border border-amber-200/70 dark:border-amber-900/60 bg-background/60 p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                          {tpl.name || "Padrão"}
                        </p>
                        {tpl.description && ticket.status !== "finalizado" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => appendTemplateToNotes(tpl.description)}
                          >
                            Inserir nas observações
                          </Button>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="mt-1 text-sm whitespace-pre-wrap break-words text-foreground/90">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DetailRow label="Criado em" value={ticket.created_at ? new Date(ticket.created_at).toLocaleString("pt-BR") : null} />
            <DetailRow label="Criado por" value={ticket.opened_by ? (profiles.find((p) => p.user_id === ticket.opened_by)?.name || "—") : "—"} />
            <DetailRow label="Finalizado em" value={ticket.closed_at ? new Date(ticket.closed_at).toLocaleString("pt-BR") : null} />
            {(ticket as any).closed_by ? (
              <DetailRow label="Finalizado por" value={profiles.find((p) => p.user_id === (ticket as any).closed_by)?.name || "—"} />
            ) : null}
            <DetailRow label="Reaberto em" value={ticket.reopened_at ? new Date(ticket.reopened_at).toLocaleString("pt-BR") : null} />

            <TicketTrackingSection ticketId={ticket.id} trackingCode={ticket.tracking_code || null} />
            <TicketLiberacaoSection ticket={ticket} userId={userId} onRefetch={onRefetch} />
            <TicketPurchaseSection ticket={ticket} userId={userId} onRefetch={onRefetch} />
            <TicketSuprimentoSection ticket={ticket} userId={userId} onRefetch={onRefetch} />
            <TicketCompraEquipamentoSection ticket={ticket} userId={userId} onRefetch={onRefetch} />
            <TicketPerdidosSection ticket={ticket} userId={userId} onRefetch={onRefetch} />
            <TicketAttachmentsSection ticketId={ticket.id} userId={userId} />
            <TicketActivitiesSection ticketId={ticket.id} profiles={profiles} />
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
                          <p className="break-words whitespace-pre-wrap">{c.content}</p>
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
                {ticket.contact_phone && (
                  <Button size="sm" variant="outline" onClick={goToChat} className="gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Voltar à conversa
                  </Button>
                )}
                {ticket.contact_phone && ticket.status !== "finalizado" && (
                  <Button size="sm" variant="default" onClick={startChatFromTicket} className="gap-1">
                    <Send className="h-3.5 w-3.5" /> Iniciar conversa
                  </Button>
                )}
                {isAdmin && ticket.status !== "finalizado" && !ticket.escalated_to_gestao && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const protocolBase = formatTicketProtocol(ticket as any, ticket.id);
                      const res = await escalateToGestaoHelper({
                        channelId: ticket.channel_id || null,
                        companyId: ticket.company_id || null,
                        contactPhone: ticket.contact_phone || null,
                        contactName: ticket.contact_name || null,
                        plate: ticket.plate || null,
                        protocolBase,
                        sourceTicketId: ticket.id,
                        openedBy: userId,
                      });
                      if (res.success) {
                        toast.success(`Chamado aberto para o setor ${res.sectorName}`);
                        queryClient.invalidateQueries({ queryKey: ["service-tickets"] });
                        onRefetch();
                      } else {
                        toast.error(res.error || "Falha ao abrir chamado de Gestão");
                      }
                    }}
                    className="gap-1"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Gestão
                  </Button>
                )}
                {canFinalize && (
                  <Button size="sm" variant="default" onClick={() => setConfirmFinalizeOpen(true)} className="gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {ticket.is_recurring ? "Concluir ocorrência" : "Finalizar"}
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
                <Select
                  value={forwardSector}
                  onValueChange={(v) => {
                    setForwardSector(v);
                    setForwardSectorUser("__auto__");
                  }}
                >
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
              {forwardSector && (
                <Select value={forwardSectorUser} onValueChange={setForwardSectorUser}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Operador específico (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">— Roteamento automático —</SelectItem>
                    {forwardSectorUsers.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.name || u.user_id.substring(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                Sem operador selecionado: o sistema atribui ao atendente do setor com menor carga (online; senão, qualquer um do setor). Se ninguém estiver cadastrado, o responsável anterior é removido.
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
      <AlertDialog open={confirmFinalizeOpen} onOpenChange={(o) => { setConfirmFinalizeOpen(o); if (!o) setFinalizeObservation(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ticket.is_recurring ? "Concluir ocorrência?" : "Finalizar atendimento?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ticket.is_recurring
                ? "O ticket permanecerá aberto e a próxima notificação será criada automaticamente conforme a recorrência. Informe uma observação — ficará no histórico."
                : "Esta ação encerrará o ticket. Você poderá reabri-lo depois, se necessário."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {ticket.is_recurring && (
            <Textarea
              value={finalizeObservation}
              onChange={(e) => setFinalizeObservation(e.target.value)}
              placeholder="Observação obrigatória..."
              className="min-h-[80px] text-sm"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ticket.is_recurring && !finalizeObservation.trim()}
              onClick={(e) => {
                if (ticket.is_recurring && !finalizeObservation.trim()) {
                  e.preventDefault();
                  return;
                }
                setConfirmFinalizeOpen(false);
                const obs = finalizeObservation;
                setFinalizeObservation("");
                updateStatus("finalizado", obs);
              }}
            >
              {ticket.is_recurring ? "Concluir e reagendar" : "Sim, finalizar"}
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

type EditableField = "priority" | "contact_name" | "contact_phone" | "company_id" | "plate";

function EditableRow(props: {
  label: string;
  field: EditableField;
  displayValue: any;
  editable: boolean;
  editingField: EditableField | null;
  fieldDraft: string;
  setFieldDraft: (v: string) => void;
  onStart: (field: EditableField) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  companies: { id: string; name: string }[];
}) {
  const { label, field, displayValue, editable, editingField, fieldDraft, setFieldDraft, onStart, onCancel, onSave, saving, companies } = props;
  const isEditing = editingField === field;
  return (
    <div className="flex gap-2 text-sm items-start">
      <span className="font-medium text-muted-foreground min-w-[120px] pt-1.5">{label}:</span>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex gap-1 items-center">
            {field === "priority" ? (
              <Select value={fieldDraft} onValueChange={setFieldDraft} disabled={saving}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            ) : field === "company_id" ? (
              <Select value={fieldDraft} onValueChange={setFieldDraft} disabled={saving}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={fieldDraft}
                onChange={(e) => setFieldDraft(e.target.value)}
                className="h-8 text-xs"
                disabled={saving}
                onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
                autoFocus
              />
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSave} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} disabled={saving}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <span className="break-all">{displayValue || "—"}</span>
            {editable && (
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onStart(field)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
