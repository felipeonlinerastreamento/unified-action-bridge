import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Minus, Maximize2, Minimize2, X, GripHorizontal, Loader2, ExternalLink, MessageSquare } from "lucide-react";
import { getChatDetail, getChatMessages, sendText, joinChatAsCoAgent } from "@/lib/gsystem.functions";
import { useAuth } from "@/hooks/use-auth";
import { UserPlus2 } from "lucide-react";
import { useFloatingChats, FloatingChatState } from "./floating-chats-context";
import { WhisperToggle } from "./whisper-toggle";
import { QuickRepliesPopover } from "./quick-replies-popover";
import { MessageStatusTicks } from "./message-status-ticks";
import { TypingIndicator } from "./typing-indicator";

interface Props {
  state: FloatingChatState;
  onOpenInPanel?: (chatId: string) => void;
}

interface GMessage {
  IdMessage?: string;
  senderName?: string;
  senderUserId?: string;
  senderFirstName?: string;
  senderFullName?: string;
  responsibleFirstName?: string;
  isCoAgent?: boolean;
  dhMessage?: string;
  text?: string;
  isSentByMe?: boolean;
  isSystemMessage?: boolean;
  isPrivate?: boolean;
  utcDhMessage?: string;
  unixTimeMessage?: number;
  _status?: string; // sent | delivered | read
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function FloatingChatWindow({ state, onOpenInPanel }: Props) {
  const { closeChat, minimize, toggleMaximize, bringToFront, updatePosition, updateMeta, setUnread } = useFloatingChats();
  const [input, setInput] = useState("");
  const [whisperMode, setWhisperMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCount = useRef(0);
  const isFocused = useRef(false);
  const queryClient = useQueryClient();

  const { chatId, channelId, meta, position, size, maximized, zIndex } = state;

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // Chat detail
  const { data: chatDetail } = useQuery({
    queryKey: ["floating-chat-detail", channelId, chatId],
    queryFn: async () => {
      try {
        return await getChatDetail({
          data: { channelId, chatId },
          ...await getAuthHeaders(),
        });
      } catch {
        return null;
      }
    },
    enabled: !!channelId && !!chatId,
    refetchInterval: 10000,
  });

  // Messages
  const { data: fullMessages } = useQuery({
    queryKey: ["floating-chat-messages", channelId, chatId],
    queryFn: async () => {
      try {
        const result = await getChatMessages({
          data: { channelId, chatId },
          ...await getAuthHeaders(),
        });
        const msgs = Array.isArray(result) ? result : (result?.data || result?.messages || []);
        return Array.isArray(msgs) ? (msgs as GMessage[]) : [];
      } catch {
        return [] as GMessage[];
      }
    },
    enabled: !!channelId && !!chatId,
    refetchInterval: 5000,
  });

  const messages = (fullMessages && fullMessages.length > 0) ? fullMessages : ((chatDetail?.messages as GMessage[]) || []);

  // Local Z-API chat row → drives typing indicator (bot_state.is_typing) updated by the webhook
  const phoneForLookup = meta.phone || chatDetail?.contact?.number;
  const { data: localZapiChat } = useQuery({
    queryKey: ["floating-zapi-chat-row", channelId, phoneForLookup],
    queryFn: async () => {
      if (!channelId || !phoneForLookup) return null;
      const { data } = await supabase
        .from("zapi_chats")
        .select("id, bot_state")
        .eq("channel_id", channelId)
        .eq("phone", phoneForLookup)
        .maybeSingle();
      return data;
    },
    enabled: !!channelId && !!phoneForLookup,
    refetchInterval: 5000,
  });
  const isContactTyping = !!(localZapiChat?.bot_state as any)?.is_typing;
  // Update meta from chat detail (name/avatar/sector)
  useEffect(() => {
    if (!chatDetail) return;
    const newMeta: any = {};
    const name = chatDetail.description || chatDetail.contact?.name || chatDetail.contact?.number;
    if (name && name !== meta.name) newMeta.name = name;
    const phone = chatDetail.contact?.number;
    if (phone && phone !== meta.phone) newMeta.phone = phone;
    const avatar = chatDetail.linkImage || chatDetail.contact?.linkImage;
    if (avatar && avatar !== meta.avatar) newMeta.avatar = avatar;
    const sectorName = chatDetail.currentSector?.description;
    if (sectorName && sectorName !== meta.sectorName) newMeta.sectorName = sectorName;
    if (Object.keys(newMeta).length > 0) updateMeta(chatId, newMeta);
  }, [chatDetail, meta.name, meta.phone, meta.avatar, meta.sectorName, chatId, updateMeta]);

  // Track unread when minimized
  useEffect(() => {
    const count = messages.length;
    if (count > lastMessageCount.current) {
      const latest = messages[messages.length - 1];
      if (latest && !latest.isSentByMe && state.minimized) {
        setUnread(chatId, state.unread + (count - lastMessageCount.current));
      }
    }
    lastMessageCount.current = count;
  }, [messages, state.minimized, state.unread, setUnread, chatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!state.minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, state.minimized]);

  // Drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    bringToFront(chatId);
    setIsDragging(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, [maximized, bringToFront, chatId]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(chatId, { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, chatId, updatePosition]);

  // Send (or whisper)
  const sendMutation = useMutation({
    mutationFn: async ({ text, whisper }: { text: string; whisper: boolean }) => {
      if (whisper) {
        const phone = meta.phone;
        if (!phone) throw new Error("Telefone do contato indisponível");
        const { data: chatRow } = await supabase
          .from("zapi_chats")
          .select("id")
          .eq("channel_id", channelId)
          .eq("phone", phone)
          .maybeSingle();
        if (!chatRow) throw new Error("Sussurro indisponível: chat ainda não vinculado ao Z-API local");
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.from("zapi_messages").insert({
          chat_id: chatRow.id,
          from_me: true,
          is_whisper: true,
          whisper_author: session?.user?.id || null,
          text,
          status: "sent",
        });
        if (error) throw error;
        return { whisper: true };
      }
      return await sendText({
        data: { channelId, chatId, text },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: (_data, vars) => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["floating-chat-messages", channelId, chatId] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", channelId, chatId] });
      queryClient.invalidateQueries({ queryKey: ["zapi-messages"] });
      if (vars.whisper) toast.success("Sussurro registrado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao enviar mensagem"),
  });

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ text: input.trim(), whisper: whisperMode });
  };

  if (state.minimized) return null;

  const name = meta.name || `Chat ${chatId.slice(0, 6)}`;
  const initials = name.substring(0, 2).toUpperCase();
  const isDefaultAvatar = meta.avatar?.includes("avatar-default");

  const windowStyle: React.CSSProperties = maximized
    ? { top: 0, left: 0, width: "100vw", height: "100vh", zIndex }
    : { top: position.y, left: position.x, width: size.w, height: size.h, zIndex };

  return (
    <div
      ref={windowRef}
      onMouseDown={() => bringToFront(chatId)}
      className={`fixed flex flex-col rounded-lg border bg-background shadow-2xl overflow-hidden ${maximized ? "rounded-none" : ""}`}
      style={{ ...windowStyle, userSelect: isDragging ? "none" : "auto" }}
    >
      {/* Title bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between gap-2 border-b bg-muted/60 px-2 py-1.5 ${maximized ? "" : "cursor-grab"} ${isDragging ? "cursor-grabbing" : ""}`}
        style={meta.slaColor ? { borderTop: `3px solid ${meta.slaColor}` } : undefined}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Avatar className="h-6 w-6 shrink-0">
            {!isDefaultAvatar && meta.avatar && <AvatarImage src={meta.avatar} />}
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">{name}</p>
            {meta.phone && <p className="text-[10px] text-muted-foreground truncate leading-tight">{meta.phone}</p>}
          </div>
          {meta.sectorName && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 hidden sm:inline-flex">
              {meta.sectorName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onOpenInPanel && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenInPanel(chatId); }}
              className="rounded p-1 hover:bg-muted"
              title="Abrir no painel principal"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); minimize(chatId); }} className="rounded p-1 hover:bg-muted" title="Minimizar">
            <Minus className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); toggleMaximize(chatId); }} className="rounded p-1 hover:bg-muted" title={maximized ? "Restaurar" : "Maximizar"}>
            {maximized ? <Minimize2 className="h-3 w-3 text-muted-foreground" /> : <Maximize2 className="h-3 w-3 text-muted-foreground" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); closeChat(chatId); }} className="rounded p-1 hover:bg-destructive/20" title="Fechar">
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20"
        onFocus={() => { isFocused.current = true; setUnread(chatId, 0); }}
        onClick={() => setUnread(chatId, 0)}
      >
        <div className="p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
              Sem mensagens ainda
            </div>
          ) : (
            messages.map((msg, i) => {
              const text = msg.text || "";
              if (!text && !msg.isSystemMessage) return null;
              if (msg.isSystemMessage) {
                return (
                  <div key={msg.IdMessage || i} className="text-center">
                    <span className="inline-block text-[10px] text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                      {text}
                    </span>
                  </div>
                );
              }
              const mine = !!msg.isSentByMe;
              return (
                <div key={msg.IdMessage || i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${
                    mine ? "bg-primary text-primary-foreground" : "bg-background border"
                  } ${msg.isPrivate ? "ring-1 ring-amber-400" : ""}`}>
                    {!mine && msg.senderName && (
                      <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.senderName}</p>
                    )}
                    <p>{text}</p>
                    <div className={`flex items-center justify-end gap-1 mt-0.5 opacity-70 ${mine ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      <span className="text-[9px]">{formatTime(msg.utcDhMessage || msg.dhMessage)}</span>
                      {mine && !msg.isPrivate && <MessageStatusTicks status={msg._status} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {isContactTyping && <TypingIndicator name={meta.name} className="mt-1" />}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-2 bg-background">
        <div className="flex gap-1.5">
          <QuickRepliesPopover size="sm" onPick={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)} />
          <WhisperToggle size="sm" active={whisperMode} onToggle={() => setWhisperMode((v) => !v)} />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={whisperMode ? "Sussurro interno..." : "Digite uma mensagem..."}
            className={`text-xs h-8 ${whisperMode ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sendMutation.isPending}
          />
          <Button
            size="icon"
            className={`h-8 w-8 shrink-0 ${whisperMode ? "bg-amber-500 hover:bg-amber-600" : ""}`}
            onClick={handleSend}
            disabled={sendMutation.isPending || !input.trim()}
          >
            {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
