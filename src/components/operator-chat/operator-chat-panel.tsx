import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Lock, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chatId: string | null;
  className?: string;
}

export function OperatorChatPanel({ chatId, className }: Props) {
  const qc = useQueryClient();
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [lockOnSend, setLockOnSend] = useState(false);
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
    enabled: !!chatId,
    queryFn: async () => {
      if (!chatId) return null;
      const { data } = await supabase
        .from("operator_chats")
        .select("*")
        .eq("id", chatId)
        .maybeSingle();
      return data;
    },
  });

  const { data: otherName } = useQuery({
    queryKey: ["operator-chat-other-name", chatId, me?.id],
    enabled: !!chat && !!me,
    queryFn: async () => {
      if (!chat || !me) return "";
      if ((chat as any).is_group) {
        const { data } = await supabase
          .from("operator_chat_participants")
          .select("user_id, user_name")
          .eq("chat_id", chat.id);
        const names = (data || [])
          .filter((p: any) => p.user_id !== me.id)
          .map((p: any) => p.user_name || "Operador");
        return `Grupo · ${names.length ? names.join(", ") : "sem participantes"}`;
      }
      if (me.id === chat.created_by) {
        const { data } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", chat.recipient_user_id)
          .maybeSingle();
        return data?.name || "Operador";
      }
      return chat.created_by_name || "Atendimento";
    },
  });

  const { data: myParticipation } = useQuery({
    queryKey: ["operator-chat-my-participation", chatId, me?.id],
    enabled: !!chatId && !!me?.id && !!(chat as any)?.is_group,
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_chat_participants")
        .select("user_id")
        .eq("chat_id", chatId!)
        .eq("user_id", me!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const isMember = !chat
    ? false
    : (chat as any).is_group
      ? !!myParticipation || chat.created_by === me?.id
      : chat.created_by === me?.id || chat.recipient_user_id === me?.id;

  const { data: messages = [] } = useQuery({

    queryKey: ["operator-chat-messages", chatId],
    enabled: !!chatId,
    queryFn: async () => {
      if (!chatId) return [];
      const { data } = await supabase
        .from("operator_chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!chatId) return;
    const ch = supabase
      .channel(`op-chat-panel-${chatId}`)
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
        () => qc.invalidateQueries({ queryKey: ["operator-chat", chatId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [chatId, qc]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, chatId]);

  useEffect(() => {
    if (!me || !chatId || !isMember) return;
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
  }, [messages, me, chatId, qc, isMember]);

  const send = async () => {
    if (!body.trim() || !me || !chat || !chatId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("operator_chat_messages").insert({
        chat_id: chatId,
        sender_user_id: me.id,
        sender_name: me.name,
        body: body.trim(),
      });
      if (error) throw error;

      if (lockOnSend) {
        let lockErr: any = null;
        if ((chat as any).is_group) {
          const res = await supabase
            .from("operator_chat_participants")
            .update({ is_locked: true })
            .eq("chat_id", chatId)
            .neq("user_id", me.id);
          lockErr = res.error;
        } else {
          const other = me.id === chat.created_by ? chat.recipient_user_id : chat.created_by;
          const res = await supabase
            .from("operator_chats")
            .update({
              created_by: me.id,
              created_by_name: me.name,
              recipient_user_id: other,
              lock_until_reply: true,
              is_locked: true,
            })
            .eq("id", chatId);
          lockErr = res.error;
        }
        if (lockErr) toast.error("Mensagem enviada, mas não foi possível bloquear a tela.");
        else toast.success("Tela do destinatário bloqueada até a resposta.");
        setLockOnSend(false);
        qc.invalidateQueries({ queryKey: ["operator-chat", chatId] });
      }

      setBody("");
      qc.invalidateQueries({ queryKey: ["operator-chat-messages", chatId] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const closeChat = async () => {
    if (!chat || !chatId) return;
    const { error } = await supabase
      .from("operator_chats")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", chatId);
    if (error) return toast.error(error.message);
    toast.success("Conversa encerrada");
    qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
    qc.invalidateQueries({ queryKey: ["operator-chat", chatId] });
  };

  if (!chatId) {
    return (
      <div className={`flex flex-col items-center justify-center text-center p-8 text-muted-foreground ${className || ""}`}>
        <MessageCircle className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm">Selecione uma conversa à esquerda</p>
        <p className="text-xs mt-1">ou inicie uma nova conversa</p>
      </div>
    );
  }

  const isClosed = !!chat?.closed_at;

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{chat?.subject || "Conversa"}</h3>
            {chat?.is_locked && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <Lock className="h-3 w-3" /> Bloqueado
              </Badge>
            )}
            {isClosed && (
              <Badge variant="secondary" className="text-[10px]">Encerrada</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{otherName}</p>
        </div>
        {!isClosed && me && chat && me.id === chat.created_by && (
          <Button variant="outline" size="sm" onClick={closeChat} className="gap-1">
            <X className="h-3.5 w-3.5" /> Encerrar
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center pt-12">Sem mensagens ainda.</p>
        ) : (
          messages.map((m: any) => {
            const mine = me?.id === m.sender_user_id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
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

      {!isClosed && !isMember && (
        <div className="border-t p-3 text-xs text-muted-foreground bg-background">
          Visualização de administrador — você não participa desta conversa.
        </div>
      )}

      {!isClosed && isMember && (

        <div className="border-t p-3 space-y-2 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              rows={2}
              className="flex-1 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={sending || !body.trim()} className="gap-1">
              <Send className="h-4 w-4" /> Enviar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="lock-on-send" checked={lockOnSend} onCheckedChange={setLockOnSend} />
            <Label htmlFor="lock-on-send" className="text-xs flex items-center gap-1 cursor-pointer">
              <Lock className="h-3.5 w-3.5" /> Bloquear tela do destinatário até a resposta
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
