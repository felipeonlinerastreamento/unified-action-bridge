import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SIDEBAR_COUNTERS_KEY } from "@/hooks/use-sidebar-counters";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { playForKind } from "@/lib/notification-sounds";

function playTone(kind: "message" | "forward") {
  playForKind(kind);
}


/**
 * Hook global montado no AppLayout. Inscreve em realtime para:
 *  1. Novas mensagens (zapi_messages) em chats assumidos pelo operador,
 *     tocando um som apenas para mensagens recebidas (from_me = false).
 *  2. Encaminhamentos via ticket_assignments (assigned_to = user.id).
 *  3. Encaminhamentos via zapi_chats (assigned_to alterado para user.id).
 */
export function useOperatorSoundNotifications() {
  const { user, isAuthenticated } = useAuth();
  const initRef = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Marca o momento de início para evitar tocar sons em eventos antigos no carregamento
    const startedAt = Date.now();

    // Cache local de "dono/status" das conversas, alimentado pelos próprios
    // eventos realtime de zapi_chats. Evita uma consulta ao banco por mensagem
    // recebida (antes: toda mensagem de cliente gerava 1 consulta por operador).
    const CHAT_CACHE_TTL = 60_000;
    const chatCache = new Map<string, { assigned_to: string | null; status: string | null; at: number }>();
    const isMineOpen = (c: { assigned_to: string | null; status: string | null } | undefined) =>
      !!c && c.assigned_to === user.id && c.status !== "finalizado" && c.status !== "aguardando_retorno";

    // Atualiza os contadores do menu na hora quando algo muda para mim
    // (agrupa rajadas de eventos em uma só consulta).
    let counterTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshCounters = () => {
      if (counterTimer) return;
      counterTimer = setTimeout(() => {
        counterTimer = null;
        qc.invalidateQueries({ queryKey: SIDEBAR_COUNTERS_KEY });
      }, 2000);
    };

    // 1) Mensagens novas em chats do operador
    const msgChannel = supabase
      .channel(`op-sound-msgs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "zapi_messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg) return;
          // Só notifica mensagens recebidas (cliente -> empresa)
          if (msg.from_me) return;
          if (msg.is_typing) return;
          // Ignora mensagens com mais de 30s (eventos atrasados após reconexão)
          const created = new Date(msg.created_at).getTime();
          if (Number.isFinite(created) && created < startedAt - 30000) return;

          // Verifica se o chat pertence ao usuário atual (cache realtime; consulta só se faltar)
          let chat = chatCache.get(msg.chat_id);
          if (!chat || Date.now() - chat.at > CHAT_CACHE_TTL) {
            const { data } = await supabase
              .from("zapi_chats")
              .select("assigned_to, status")
              .eq("id", msg.chat_id)
              .maybeSingle();
            if (!data) return;
            chat = { assigned_to: data.assigned_to ?? null, status: data.status ?? null, at: Date.now() };
            chatCache.set(msg.chat_id, chat);
          }
          if (chat.assigned_to !== user.id) return;
          if (chat.status === "finalizado") return;

          playTone("message");
        }
      )
      .subscribe();

    // 2) Encaminhamentos por ticket_assignments
    const assignChannel = supabase
      .channel(`op-sound-assign-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_assignments", filter: `assigned_to=eq.${user.id}` },
        () => {
          refreshCounters();
          playTone("forward");
          toast.info("Novo encaminhamento", {
            description: "Um atendimento foi encaminhado para você.",
            duration: 6000,
          });
        }
      )
      .subscribe();

    // 3) Encaminhamentos por chat (assigned_to alterado para o usuário)
    const chatChannel = supabase
      .channel(`op-sound-chats-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "zapi_chats" },
        (payload) => {
          const oldRow = payload.old as any;
          const newRow = payload.new as any;
          if (!newRow) return;
          if (newRow.id) {
            const prev = chatCache.get(newRow.id);
            const next = { assigned_to: newRow.assigned_to ?? null, status: newRow.status ?? null, at: Date.now() };
            chatCache.set(newRow.id, next);
            // Badge "Chat" do menu: muda quando a conversa entra/sai da minha fila.
            if (isMineOpen(prev) !== isMineOpen(next) || (!prev && isMineOpen(next))) refreshCounters();
          }
          if (newRow.assigned_to !== user.id) return;
          if (oldRow?.assigned_to === user.id) return; // já era do operador
          playTone("forward");
          toast.info("Novo chat encaminhado", {
            description: newRow.contact_name
              ? `Chat de ${newRow.contact_name} foi atribuído a você.`
              : "Um chat foi atribuído a você.",
            duration: 6000,
          });
        }
      )
      .subscribe();

    initRef.current = true;

    return () => {
      if (counterTimer) clearTimeout(counterTimer);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(assignChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [isAuthenticated, user?.id, qc]);
}
