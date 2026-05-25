import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageCircle, Lock, Search, ChevronDown, ChevronRight } from "lucide-react";
import { OperatorChatPanel } from "@/components/operator-chat/operator-chat-panel";
import { NewOperatorChatDialog } from "@/components/operator-chat/new-operator-chat-dialog";

type ChatSearch = { chat?: string };

export const Route = createFileRoute("/chat-operadores")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: ChatOperadoresPage,
});

function ChatOperadoresPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <ChatOperadoresContent />
    </AppLayout>
  );
}

function ChatOperadoresContent() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: "/chat-operadores" });
  const { chat: selectedChatId } = useSearch({ from: "/chat-operadores" });
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: chats = [] } = useQuery({
    queryKey: ["operator-chats-list", userId, showClosed ? "all" : "open"],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase
        .from("operator_chats")
        .select("id, subject, created_by, created_by_name, recipient_user_id, is_locked, last_message_at, closed_at")
        .or(`created_by.eq.${userId},recipient_user_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (!showClosed) q = q.is("closed_at", null);
      const { data: rows } = await q;
      const list = rows || [];

      const ids = list.map((c) => c.id);
      const unreadMap: Record<string, number> = {};
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
      const otherIds = Array.from(
        new Set(
          list
            .filter((c) => c.created_by === userId)
            .map((c) => c.recipient_user_id)
        )
      );
      const nameMap: Record<string, string> = {};
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
    if (!userId) return;
    const ch = supabase
      .channel(`op-chats-full-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "operator_chats" },
        () => qc.invalidateQueries({ queryKey: ["operator-chats-list"] })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "operator_chat_messages" },
        () => qc.invalidateQueries({ queryKey: ["operator-chats-list"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (c: any) =>
        c.subject?.toLowerCase().includes(q) ||
        c.otherName?.toLowerCase().includes(q)
    );
  }, [chats, query]);

  const openChats = filtered.filter((c: any) => !c.closed_at);
  const closedChats = filtered.filter((c: any) => !!c.closed_at);

  const selectChat = (id: string) => {
    navigate({ search: { chat: id }, replace: true });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" /> Chat com operadores
        </h1>
        <p className="text-sm text-muted-foreground">
          Converse em tempo real com outros operadores, setores ou grupos.
        </p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3">
        {/* Lista */}
        <div className="border rounded-lg bg-card flex flex-col min-h-0">
          <div className="p-3 border-b space-y-2">
            <NewOperatorChatDialog onCreated={(id) => selectChat(id)} />
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conversa..."
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {openChats.length === 0 && !showClosed && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Nenhuma conversa em aberto.
              </p>
            )}
            {openChats.map((c: any) => (
              <ChatRow
                key={c.id}
                chat={c}
                active={c.id === selectedChatId}
                isRecipient={c.recipient_user_id === userId}
                onClick={() => selectChat(c.id)}
              />
            ))}

            <Collapsible open={showClosed} onOpenChange={setShowClosed}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-1 rounded-none border-t text-xs h-9"
                >
                  {showClosed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Conversas encerradas {showClosed && closedChats.length > 0 && `(${closedChats.length})`}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {closedChats.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma encerrada.</p>
                ) : (
                  closedChats.map((c: any) => (
                    <ChatRow
                      key={c.id}
                      chat={c}
                      active={c.id === selectedChatId}
                      isRecipient={c.recipient_user_id === userId}
                      onClick={() => selectChat(c.id)}
                      muted
                    />
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Painel */}
        <div className="border rounded-lg bg-card min-h-0 overflow-hidden">
          <OperatorChatPanel chatId={selectedChatId ?? null} />
        </div>
      </div>
    </div>
  );
}

function ChatRow({
  chat,
  active,
  isRecipient,
  onClick,
  muted,
}: {
  chat: any;
  active: boolean;
  isRecipient: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
        active ? "bg-accent" : chat.unread > 0 ? "bg-accent/20" : ""
      } ${muted ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <MessageCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium truncate flex-1">{chat.subject}</p>
            {chat.is_locked && isRecipient && (
              <Lock className="h-3 w-3 text-amber-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{chat.otherName}</p>
          <p className="text-[10px] text-muted-foreground">
            {chat.last_message_at
              ? new Date(chat.last_message_at).toLocaleString("pt-BR")
              : "—"}
          </p>
        </div>
        {chat.unread > 0 && (
          <Badge className="text-[10px] h-5 min-w-[20px] px-1">{chat.unread}</Badge>
        )}
      </div>
    </button>
  );
}
