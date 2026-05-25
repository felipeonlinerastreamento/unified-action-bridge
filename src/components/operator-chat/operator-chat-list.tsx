import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Lock } from "lucide-react";
import { OperatorChatDialog } from "./operator-chat-dialog";
import { Badge } from "@/components/ui/badge";

interface Props {
  onUnreadChange?: (count: number) => void;
}

export function OperatorChatList({ onUnreadChange }: Props) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: chats = [] } = useQuery({
    queryKey: ["operator-chats-list", userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!userId) return [];
      const { data: rows } = await supabase
        .from("operator_chats")
        .select("id, subject, created_by, created_by_name, recipient_user_id, is_locked, last_message_at, closed_at")
        .or(`created_by.eq.${userId},recipient_user_id.eq.${userId}`)
        .is("closed_at", null)
        .order("last_message_at", { ascending: false })
        .limit(30);
      const list = rows || [];
      // Fetch unread counts (messages not from me, with no read_at)
      const ids = list.map((c) => c.id);
      let unreadMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from("operator_chat_messages")
          .select("chat_id, sender_user_id, read_at")
          .in("chat_id", ids)
          .is("read_at", null);
        (msgs || []).forEach((m: any) => {
          if (m.sender_user_id !== userId) {
            unreadMap[m.chat_id] = (unreadMap[m.chat_id] || 0) + 1;
          }
        });
      }
      // Resolve other-party names for chats where I'm the creator
      const otherIds = Array.from(
        new Set(
          list
            .filter((c) => c.created_by === userId)
            .map((c) => c.recipient_user_id)
        )
      );
      let nameMap: Record<string, string> = {};
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", otherIds);
        (profs || []).forEach((p: any) => {
          nameMap[p.user_id] = p.name;
        });
      }
      return list.map((c) => ({
        ...c,
        unread: unreadMap[c.id] || 0,
        otherName:
          c.created_by === userId
            ? nameMap[c.recipient_user_id] || "Operador"
            : c.created_by_name || "Atendimento",
      }));
    },
  });

  useEffect(() => {
    const total = chats.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
    onUnreadChange?.(total);
  }, [chats, onUnreadChange]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`op-chats-list-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_chats" },
        () => qc.invalidateQueries({ queryKey: ["operator-chats-list", userId] })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "operator_chat_messages" },
        () => qc.invalidateQueries({ queryKey: ["operator-chats-list", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  if (chats.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma conversa em aberto.
      </p>
    );
  }

  return (
    <>
      <div className="max-h-96 overflow-y-auto">
        {chats.map((c: any) => (
          <button
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
              c.unread > 0 ? "bg-accent/20" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium truncate flex-1">{c.subject}</p>
                  {c.is_locked && c.recipient_user_id === userId && (
                    <Lock className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.otherName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(c.last_message_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {c.unread > 0 && (
                <Badge className="text-[10px] h-5 min-w-[20px] px-1">{c.unread}</Badge>
              )}
            </div>
          </button>
        ))}
      </div>
      {openId && (
        <OperatorChatDialog
          chatId={openId}
          open={!!openId}
          onOpenChange={(o) => !o && setOpenId(null)}
        />
      )}
    </>
  );
}
