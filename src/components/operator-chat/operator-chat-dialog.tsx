import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Lock, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true: render as fullscreen lock modal (cannot be dismissed) */
  locked?: boolean;
}

export function OperatorChatDialog({ chatId, open, onOpenChange, locked }: Props) {
  const qc = useQueryClient();
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", uid)
        .maybeSingle();
      setMe({ id: uid, name: prof?.name || data.user?.email || "Usuário" });
    });
  }, []);

  const { data: chat } = useQuery({
    queryKey: ["operator-chat", chatId],
    enabled: !!chatId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_chats")
        .select("*")
        .eq("id", chatId)
        .maybeSingle();
      return data;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["operator-chat-messages", chatId],
    enabled: !!chatId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!chatId || !open) return;
    const ch = supabase
      .channel(`op-chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_chat_messages", filter: `chat_id=eq.${chatId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["operator-chat-messages", chatId] });
          qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "operator_chats", filter: `id=eq.${chatId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["operator-chat", chatId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [chatId, open, qc]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!me || !open) return;
    const unread = messages.filter((m: any) => !m.read_at && m.sender_user_id !== me.id);
    if (unread.length === 0) return;
    const ids = unread.map((m: any) => m.id);
    supabase
      .from("operator_chat_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
      });
  }, [messages, me, open, qc]);

  const send = async () => {
    if (!body.trim() || !me || !chat) return;
    setSending(true);
    try {
      const { error } = await supabase.from("operator_chat_messages").insert({
        chat_id: chatId,
        sender_user_id: me.id,
        sender_name: me.name,
        body: body.trim(),
      });
      if (error) throw error;
      setBody("");
      qc.invalidateQueries({ queryKey: ["operator-chat-messages", chatId] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const closeChat = async () => {
    if (!chat) return;
    const { error } = await supabase
      .from("operator_chats")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", chatId);
    if (error) return toast.error(error.message);
    toast.success("Conversa encerrada");
    qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
    onOpenChange(false);
  };

  const otherName =
    chat && me
      ? me.id === chat.created_by
        ? `Destinatário`
        : chat.created_by_name || "Atendimento"
      : "";

  return (
    <Dialog open={open} onOpenChange={locked ? undefined : onOpenChange}>
      <DialogContent
        className={locked ? "sm:max-w-2xl" : "sm:max-w-lg"}
        onPointerDownOutside={locked ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={locked ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {locked && <Lock className="h-4 w-4 text-amber-500" />}
            {chat?.subject || "Conversa"}
            {locked && (
              <Badge variant="destructive" className="ml-auto text-[10px]">
                Resposta obrigatória
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {locked
              ? "Esta tela ficará bloqueada até você enviar uma resposta."
              : `Conversa com ${otherName}`}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="border rounded-md bg-muted/30 p-3 h-72 overflow-y-auto space-y-2"
        >
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center pt-12">Sem mensagens ainda.</p>
          ) : (
            messages.map((m: any) => {
              const mine = me?.id === m.sender_user_id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-background border"
                    }`}
                  >
                    {!mine && (
                      <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_name}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="text-[10px] opacity-60 mt-1 text-right">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Digite sua mensagem..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          {!locked && me && chat && me.id === chat.created_by && !chat.closed_at && (
            <Button variant="outline" size="sm" onClick={closeChat} className="gap-1">
              <X className="h-3.5 w-3.5" /> Encerrar
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            {!locked && (
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
            <Button onClick={send} disabled={sending || !body.trim()} size="sm" className="gap-1">
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
