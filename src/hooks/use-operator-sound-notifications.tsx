import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Reproduz dois bipes diferentes:
 *  - "message": som curto agudo para nova mensagem do cliente em chat assumido pelo operador
 *  - "forward": som duplo grave para encaminhamentos (chat ou ticket atribuído ao operador)
 */
function playTone(kind: "message" | "forward") {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    const beep = (freq: number, start: number, duration: number, gainVal = 0.12) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = gainVal;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    if (kind === "message") {
      beep(880, 0, 0.18);
    } else {
      // Encaminhamento — dois bipes graves descendentes
      beep(520, 0, 0.18, 0.14);
      beep(380, 0.22, 0.25, 0.14);
    }

    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // ignora
  }
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

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Marca o momento de início para evitar tocar sons em eventos antigos no carregamento
    const startedAt = Date.now();

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

          // Verifica se o chat pertence ao usuário atual
          const { data: chat } = await supabase
            .from("zapi_chats")
            .select("assigned_to, contact_name, contact_phone, status")
            .eq("id", msg.chat_id)
            .maybeSingle();
          if (!chat || chat.assigned_to !== user.id) return;
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
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(assignChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [isAuthenticated, user?.id]);
}
