import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { History, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FullConversationHistoryDialog } from "@/components/central/full-conversation-history-dialog";

interface Props {
  phone: string;
  name?: string | null;
  onNavigate?: () => void;
}

export function ContactChatActions({ phone, name, onNavigate }: Props) {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyChannelId, setHistoryChannelId] = useState<string | null>(null);
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [starting, setStarting] = useState(false);

  const digits = (phone || "").replace(/\D/g, "");
  const disabled = digits.length < 10;

  const openHistory = async () => {
    if (disabled) return;
    setLoadingHistory(true);
    try {
      const { data: chat } = await supabase
        .from("zapi_chats")
        .select("id, channel_id, phone")
        .ilike("phone", `%${digits.slice(-10)}%`)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!chat) {
        toast.info("Nenhuma conversa encontrada para este número.");
        return;
      }
      setHistoryChannelId((chat as any).channel_id);
      setHistoryPhone((chat as any).phone || digits);
      setHistoryOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao consultar histórico");
    } finally {
      setLoadingHistory(false);
    }
  };

  const startChat = async () => {
    if (disabled) return;
    setStarting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || null;

      const { data: existing } = await supabase
        .from("zapi_chats")
        .select("id, channel_id, status, assigned_to")
        .ilike("phone", `%${digits.slice(-10)}%`)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let chatId: string | null = null;
      let channelId: string | null = null;

      if (existing) {
        chatId = (existing as any).id;
        channelId = (existing as any).channel_id;
        const upd: any = {};
        if ((existing as any).status === "aguardando" || !(existing as any).assigned_to) {
          upd.status = "em_atendimento";
          if (uid) upd.assigned_to = uid;
        }
        if (Object.keys(upd).length > 0) {
          await supabase.from("zapi_chats").update(upd).eq("id", chatId!);
        }
      } else {
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
            phone: digits,
            contact_name: name || null,
            status: "em_atendimento",
            assigned_to: uid,
          } as any)
          .select("id")
          .single();
        if (error || !created) {
          toast.error("Falha ao criar conversa: " + (error?.message || ""));
          return;
        }
        chatId = (created as any).id;
      }

      toast.success("Conversa aberta na Central");
      onNavigate?.();
      navigate({ to: "/central", search: { chat: chatId!, channel: channelId! } as any });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar conversa");
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 p-2 rounded-md bg-muted/40 border">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || loadingHistory}
          onClick={openHistory}
        >
          {loadingHistory ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <History className="h-4 w-4 mr-1" />}
          Histórico de conversa
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={disabled || starting}
          onClick={startChat}
        >
          {starting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Iniciar conversa
        </Button>
        {disabled && (
          <span className="text-[11px] text-muted-foreground self-center">
            Informe um telefone válido para habilitar.
          </span>
        )}
      </div>

      <FullConversationHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        channelId={historyChannelId}
        contactPhone={historyPhone}
        contactName={name || null}
      />
    </>
  );
}
