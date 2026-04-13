import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { listChats, getChatMessages, sendText, finalizeChat, transferChat } from "@/lib/gsystem.functions";
import { toast } from "sonner";
import {
  Send,
  Phone,
  Search,
  MoreVertical,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  User,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/central")({
  component: CentralPage,
});

interface Chat {
  id: string;
  contactName?: string;
  contactPhone?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  status?: string;
  unreadCount?: number;
  sectorName?: string;
  userName?: string;
  [key: string]: unknown;
}

interface Message {
  id: string;
  body?: string;
  text?: string;
  content?: string;
  type?: string;
  fromMe?: boolean;
  timestamp?: number;
  createdAt?: string;
  senderName?: string;
  [key: string]: unknown;
}

function CentralPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Load channels from DB
  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("id, name, platform, is_active")
        .eq("is_active", true);
      return data || [];
    },
    enabled: isAuthenticated,
  });

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  // Get auth token for server fn calls
  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      headers: { authorization: `Bearer ${session?.access_token}` },
    };
  }, []);

  // Fetch chats list with polling
  const {
    data: chatsResponse,
    isLoading: chatsLoading,
    refetch: refetchChats,
  } = useQuery({
    queryKey: ["gsystem-chats", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return null;
      try {
        const result = await listChats({
          data: { channelId: selectedChannelId, limit: 50 },
          ...await getAuthHeaders(),
        });
        return result;
      } catch (err: any) {
        console.error("[Central] listChats error:", err);
        return null;
      }
    },
    enabled: !!selectedChannelId && isAuthenticated,
    refetchInterval: 8000, // Poll every 8s
  });

  const chats: Chat[] = Array.isArray(chatsResponse)
    ? chatsResponse
    : (chatsResponse as any)?.data || (chatsResponse as any)?.chats || [];

  const filteredChats = chats.filter((chat) => {
    if (!searchTerm) return true;
    const name = (chat.contactName || chat.contactPhone || "").toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Fetch messages for selected chat
  const {
    data: messagesResponse,
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: ["gsystem-messages", selectedChannelId, selectedChatId],
    queryFn: async () => {
      if (!selectedChannelId || !selectedChatId) return null;
      try {
        const result = await getChatMessages({
          data: { channelId: selectedChannelId, chatId: selectedChatId },
          ...await getAuthHeaders(),
        });
        return result;
      } catch (err: any) {
        console.error("[Central] getChatMessages error:", err);
        return null;
      }
    },
    enabled: !!selectedChannelId && !!selectedChatId && isAuthenticated,
    refetchInterval: 5000, // Poll every 5s for active chat
  });

  const messages: Message[] = Array.isArray(messagesResponse)
    ? messagesResponse
    : (messagesResponse as any)?.data || (messagesResponse as any)?.messages || [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      return sendText({
        data: { channelId: selectedChannelId, chatId: selectedChatId, message: text },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["gsystem-messages", selectedChannelId, selectedChatId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao enviar mensagem");
    },
  });

  // Finalize chat mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      return finalizeChat({
        data: { channelId: selectedChannelId, chatId: selectedChatId },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      toast.success("Atendimento finalizado");
      setSelectedChatId("");
      setSelectedChat(null);
      refetchChats();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao finalizar"),
  });

  const handleSend = () => {
    if (!messageInput.trim() || !selectedChatId) return;
    sendMutation.mutate(messageInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectChat = (chat: Chat) => {
    setSelectedChatId(chat.id);
    setSelectedChat(chat);
  };

  if (authLoading || !isAuthenticated) return null;

  const noChannels = channels.length === 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Atendimento</h1>
            <p className="text-sm text-muted-foreground">Chat bidirecional via WhatsApp</p>
          </div>
          <div className="flex items-center gap-3">
            {channels.length > 1 && (
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Selecionar canal" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchChats()}
              disabled={chatsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${chatsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {noChannels ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-foreground">Nenhum canal configurado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vá em Configurações → Canais para adicionar seu token do GSystem
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/configuracoes">Ir para Configurações</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-12 gap-3 h-[calc(100vh-12rem)]">
            {/* Chat list */}
            <div className="col-span-3 border rounded-lg flex flex-col bg-card overflow-hidden">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar conversa..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {chatsLoading && chats.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    {chats.length === 0 ? "Nenhum atendimento encontrado" : "Nenhum resultado"}
                  </div>
                ) : (
                  filteredChats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => selectChat(chat)}
                      className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                        selectedChatId === chat.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(chat.contactName || chat.contactPhone || "?")
                              .substring(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate text-foreground">
                              {chat.contactName || chat.contactPhone || `Chat ${chat.id.slice(0, 6)}`}
                            </p>
                            {chat.unreadCount && chat.unreadCount > 0 && (
                              <Badge variant="default" className="text-xs ml-1 shrink-0">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {chat.lastMessage || "Sem mensagens"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {chat.status && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {chat.status}
                              </Badge>
                            )}
                            {chat.lastMessageAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatTime(chat.lastMessageAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>

            {/* Chat area */}
            <div className="col-span-6 border rounded-lg flex flex-col bg-card overflow-hidden">
              {!selectedChatId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MessageSquare className="h-12 w-12" />
                  <p className="text-sm">Selecione uma conversa para iniciar</p>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(selectedChat?.contactName || selectedChat?.contactPhone || "?")
                            .substring(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {selectedChat?.contactName || selectedChat?.contactPhone || "Contato"}
                        </p>
                        {selectedChat?.contactPhone && selectedChat?.contactName && (
                          <p className="text-xs text-muted-foreground">{selectedChat.contactPhone}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Transferir"
                        onClick={() => toast.info("Transferência em breve")}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Finalizar"
                        onClick={() => finalizeMutation.mutate()}
                        disabled={finalizeMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    {messagesLoading && messages.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma mensagem
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg, idx) => {
                          const text = msg.body || msg.text || msg.content || "";
                          const isFromMe = msg.fromMe === true;
                          const time = msg.timestamp
                            ? new Date(msg.timestamp * 1000).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";

                          return (
                            <div
                              key={msg.id || idx}
                              className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                                  isFromMe
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                {msg.senderName && !isFromMe && (
                                  <p className="text-xs font-medium mb-1 opacity-70">
                                    {msg.senderName}
                                  </p>
                                )}
                                <p className="whitespace-pre-wrap break-words">{text}</p>
                                {time && (
                                  <p
                                    className={`text-[10px] mt-1 ${
                                      isFromMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                    }`}
                                  >
                                    {time}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-3 border-t flex gap-2">
                    <Input
                      placeholder="Digite uma mensagem..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sendMutation.isPending}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sendMutation.isPending}
                      size="icon"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Contact panel */}
            <div className="col-span-3 border rounded-lg bg-card overflow-hidden flex flex-col">
              {!selectedChat ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  <div className="text-center">
                    <User className="h-8 w-8 mx-auto mb-2" />
                    <p>Detalhes do contato</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="text-center">
                    <Avatar className="h-16 w-16 mx-auto">
                      <AvatarFallback className="text-lg bg-primary/10 text-primary">
                        {(selectedChat.contactName || selectedChat.contactPhone || "?")
                          .substring(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="mt-3 font-medium text-foreground">
                      {selectedChat.contactName || "Contato"}
                    </h3>
                    {selectedChat.contactPhone && (
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {selectedChat.contactPhone}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                      <Badge variant="outline" className="mt-1">
                        {selectedChat.status || "—"}
                      </Badge>
                    </div>
                    {selectedChat.sectorName && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Setor</p>
                        <p className="text-sm mt-1 text-foreground">{selectedChat.sectorName}</p>
                      </div>
                    )}
                    {selectedChat.userName && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Atendente</p>
                        <p className="text-sm mt-1 text-foreground">{selectedChat.userName}</p>
                      </div>
                    )}
                    {selectedChat.lastMessageAt && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Última mensagem</p>
                        <p className="text-sm mt-1 flex items-center gap-1 text-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(selectedChat.lastMessageAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 24) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}
