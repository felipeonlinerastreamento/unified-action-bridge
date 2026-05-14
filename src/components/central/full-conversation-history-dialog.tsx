import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare } from "lucide-react";
import { MessageMediaContent } from "@/components/central/message-media";
import { MessageStatusTicks } from "@/components/central/message-status-ticks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelId: string | null;
  contactPhone: string | null;
  contactName?: string | null;
  contactAvatar?: string | null;
}

interface MsgRow {
  id: string;
  chat_id: string;
  from_me: boolean;
  is_whisper: boolean;
  text: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string;
  created_at: string;
  participant_name: string | null;
  reply_to_text: string | null;
  reply_to_author: string | null;
  sent_by_user_id: string | null;
}

interface ChatRow {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  contact_name: string | null;
  contact_avatar: string | null;
}

const PAGE_SIZE = 300;

function dayLabel(d: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function timeLabel(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function FullConversationHistoryDialog({
  open,
  onOpenChange,
  channelId,
  contactPhone,
  contactName,
  contactAvatar,
}: Props) {
  const [olderMsgs, setOlderMsgs] = useState<MsgRow[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset when dialog re-opens or contact changes
  useEffect(() => {
    if (!open) return;
    setOlderMsgs([]);
    setHasMore(true);
  }, [open, channelId, contactPhone]);

  // Fetch chats for this contact (same channel + same phone)
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["full-history-chats", channelId, contactPhone],
    enabled: open && !!channelId && !!contactPhone,
    queryFn: async (): Promise<ChatRow[]> => {
      // Normalize via DB to ensure same logic as the table's generated column
      const { data: norm } = await supabase.rpc("normalize_zapi_phone" as any, { raw: contactPhone! });
      const normalized = (norm as unknown as string) || contactPhone!;
      const { data, error } = await supabase
        .from("zapi_chats")
        .select("id, status, created_at, closed_at, contact_name, contact_avatar")
        .eq("channel_id", channelId!)
        .eq("phone_normalized", normalized)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ChatRow[];
    },
  });

  const chatIds = useMemo(() => chats.map((c) => c.id), [chats]);

  // Initial messages page (most recent PAGE_SIZE across all chats)
  const { data: initialMsgs = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["full-history-msgs", chatIds.join(",")],
    enabled: open && chatIds.length > 0,
    queryFn: async (): Promise<MsgRow[]> => {
      const { data, error } = await supabase
        .from("zapi_messages")
        .select(
          "id, chat_id, from_me, is_whisper, text, media_url, media_type, status, created_at, participant_name, reply_to_text, reply_to_author, sent_by_user_id"
        )
        .in("chat_id", chatIds)
        .eq("is_whisper", false)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const rows = (data || []) as MsgRow[];
      setHasMore(rows.length === PAGE_SIZE);
      return rows;
    },
  });

  const allMsgs = useMemo(() => {
    // initial is desc; older is desc fetched after; merge then sort asc
    const merged = [...initialMsgs, ...olderMsgs];
    return merged.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [initialMsgs, olderMsgs]);

  // Auto-scroll to bottom when initial loads
  useEffect(() => {
    if (!open || msgsLoading) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [open, msgsLoading, initialMsgs.length]);

  const loadOlder = async () => {
    if (loadingMore || !hasMore || allMsgs.length === 0) return;
    setLoadingMore(true);
    const oldest = allMsgs[0];
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight || 0;
    try {
      const { data, error } = await supabase
        .from("zapi_messages")
        .select(
          "id, chat_id, from_me, is_whisper, text, media_url, media_type, status, created_at, participant_name, reply_to_text, reply_to_author, sent_by_user_id"
        )
        .in("chat_id", chatIds)
        .eq("is_whisper", false)
        .lt("created_at", oldest.created_at)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const rows = (data || []) as MsgRow[];
      setOlderMsgs((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      // Preserve scroll position
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // Strip nickname prefix (*Nome:* ...) from outbound text for display
  const stripNickname = (txt: string | null) => {
    if (!txt) return txt;
    const m = txt.match(/^\*([^*\n]+):\*\s+/);
    return m ? txt.slice(m[0].length) : txt;
  };

  // Build display rows with day separators and chat-protocol separators
  const rendered = useMemo(() => {
    const items: Array<
      | { kind: "day"; key: string; label: string }
      | { kind: "chat-sep"; key: string; chatId: string; startedAt: string }
      | { kind: "msg"; key: string; msg: MsgRow }
    > = [];
    let lastDay = "";
    let lastChatId = "";
    for (const m of allMsgs) {
      const d = new Date(m.created_at);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (dayKey !== lastDay) {
        items.push({ kind: "day", key: `day-${dayKey}-${m.id}`, label: dayLabel(d) });
        lastDay = dayKey;
        lastChatId = ""; // force chat sep at start of each day
      }
      if (m.chat_id !== lastChatId) {
        const chat = chats.find((c) => c.id === m.chat_id);
        items.push({
          kind: "chat-sep",
          key: `chat-${m.chat_id}-${m.id}`,
          chatId: m.chat_id,
          startedAt: chat?.created_at || m.created_at,
        });
        lastChatId = m.chat_id;
      }
      items.push({ kind: "msg", key: m.id, msg: m });
    }
    return items;
  }, [allMsgs, chats]);

  const initials = (contactName || "?").substring(0, 2).toUpperCase();
  const showAvatar = !!contactAvatar && !contactAvatar.includes("avatar-default");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {showAvatar && <AvatarImage src={contactAvatar!} />}
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{contactName || "Contato"}</p>
              <p className="text-[11px] text-muted-foreground truncate font-normal flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {contactPhone}
                {chats.length > 0 && (
                  <span> · {allMsgs.length} mensagens em {chats.length} atendimento{chats.length > 1 ? "s" : ""}</span>
                )}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/20 px-4 py-3">
          {(chatsLoading || msgsLoading) && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          )}

          {!chatsLoading && !msgsLoading && chats.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma conversa anterior encontrada.
            </p>
          )}

          {!msgsLoading && allMsgs.length > 0 && (
            <>
              {hasMore && (
                <div className="flex justify-center mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadOlder}
                    disabled={loadingMore}
                    className="h-7 text-xs"
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Carregando…</>
                    ) : (
                      "Carregar mensagens mais antigas"
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                {rendered.map((it) => {
                  if (it.kind === "day") {
                    return (
                      <div key={it.key} className="flex justify-center my-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-background border rounded-full px-3 py-0.5 text-muted-foreground">
                          {it.label}
                        </span>
                      </div>
                    );
                  }
                  if (it.kind === "chat-sep") {
                    const dt = new Date(it.startedAt);
                    return (
                      <div key={it.key} className="flex justify-center my-2">
                        <span className="text-[10px] text-muted-foreground/80 italic">
                          — Atendimento iniciado em {dt.toLocaleDateString("pt-BR")} {timeLabel(dt)} —
                        </span>
                      </div>
                    );
                  }
                  const m = it.msg;
                  const isMe = m.from_me;
                  const displayText = isMe ? stripNickname(m.text) : m.text;
                  return (
                    <div
                      key={it.key}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border"
                        }`}
                      >
                        {!isMe && m.participant_name && (
                          <p className="text-[10px] font-semibold opacity-80 mb-0.5">
                            {m.participant_name}
                          </p>
                        )}
                        {m.reply_to_text && (
                          <div
                            className={`text-[11px] border-l-2 pl-2 mb-1 opacity-80 ${
                              isMe ? "border-primary-foreground/40" : "border-primary/40"
                            }`}
                          >
                            {m.reply_to_author && (
                              <p className="font-semibold">{m.reply_to_author}</p>
                            )}
                            <p className="line-clamp-2">{m.reply_to_text}</p>
                          </div>
                        )}
                        {m.media_type && (
                          <div className="mb-1">
                            <MessageMediaContent
                              mediaUrl={m.media_url}
                              mediaType={m.media_type}
                              compact
                            />
                          </div>
                        )}
                        {displayText && (
                          <p className="whitespace-pre-wrap break-words">{displayText}</p>
                        )}
                        <div
                          className={`flex items-center gap-1 justify-end mt-0.5 text-[10px] ${
                            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          <span>{timeLabel(new Date(m.created_at))}</span>
                          {isMe && <MessageStatusTicks status={m.status as any} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
