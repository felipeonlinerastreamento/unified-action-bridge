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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  listChats,
  getChatDetail,
  sendText,
  finalizeChat,
  listGSystemUsers,
  getChannelStatus,
} from "@/lib/gsystem.functions";
import { toast } from "sonner";
import {
  Send,
  Phone,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  User,
  Clock,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

export const Route = createFileRoute("/central")({
  component: CentralPage,
});

interface ChatItem {
  attendanceId: string;
  protocol?: string;
  status?: number;
  description?: string;
  secondaryDescription?: string;
  linkImage?: string;
  countUnreadMessages?: number;
  lastSeen?: string;
  utcDhStartChat?: string;
  contact?: {
    id?: string;
    name?: string;
    secondaryName?: string;
    number?: string;
    linkImage?: string;
    tags?: Array<{ name?: string }>;
  };
  channel?: {
    id?: string;
    type?: number;
    description?: string;
    identifier?: string;
  };
  lastMessage?: {
    id?: string;
    text?: string;
    sender?: {
      id?: string;
      name?: string;
      isMe?: boolean;
    };
  };
  sector?: {
    id?: string;
    name?: string;
  };
  user?: {
    id?: string;
    name?: string;
  };
}

function CentralPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // Get channel connection status
  const { data: channelStatus } = useQuery({
    queryKey: ["channel-status", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return null;
      try {
        const result = await getChannelStatus({
          data: { channelId: selectedChannelId },
          ...await getAuthHeaders(),
        });
        return result;
      } catch {
        return null;
      }
    },
    enabled: !!selectedChannelId && isAuthenticated,
    refetchInterval: 30000,
  });

  const isConnected = channelStatus?.status === "CONNECTED";

  // Fetch GSystem users (agents) — they contain currentAttendanceId
  const { data: gsystemUsers = [] } = useQuery({
    queryKey: ["gsystem-users", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return [];
      try {
        const result = await listGSystemUsers({
          data: { channelId: selectedChannelId },
          ...await getAuthHeaders(),
        });
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedChannelId && isAuthenticated,
    refetchInterval: 15000,
  });

  // Get active attendance IDs from all online users
  const activeAttendanceIds = gsystemUsers
    .filter((u: any) => u.currentAttendanceId)
    .map((u: any) => u.currentAttendanceId as string);

  // Fetch chat details for each active attendance
  const { data: activeChats = [], isLoading: chatsLoading, refetch: refetchChats } = useQuery({
    queryKey: ["active-chats", selectedChannelId, activeAttendanceIds],
    queryFn: async () => {
      if (!selectedChannelId || activeAttendanceIds.length === 0) return [];
      const authH = await getAuthHeaders();
      const chatPromises = activeAttendanceIds.map(async (id: string) => {
        try {
          const detail = await getChatDetail({
            data: { channelId: selectedChannelId, chatId: id },
            ...authH,
          });
          return detail as ChatItem;
        } catch {
          return null;
        }
      });
      const results = await Promise.all(chatPromises);
      return results.filter((c): c is ChatItem => c !== null && !!c.attendanceId);
    },
    enabled: !!selectedChannelId && activeAttendanceIds.length > 0 && isAuthenticated,
    refetchInterval: 10000,
  });

  // Also try the standard list endpoint (may work in the future)
  const { data: listedChats = [] } = useQuery({
    queryKey: ["listed-chats", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return [];
      try {
        const result = await listChats({
          data: { channelId: selectedChannelId, limit: 50 },
          ...await getAuthHeaders(),
        });
        const items = Array.isArray(result) ? result : (result as any)?.data || [];
        return items;
      } catch {
        return [];
      }
    },
    enabled: !!selectedChannelId && isAuthenticated,
    refetchInterval: 15000,
  });

  // Merge chats from both sources
  const allChats: ChatItem[] = (() => {
    const map = new Map<string, ChatItem>();
    for (const c of activeChats) {
      if (c.attendanceId) map.set(c.attendanceId, c);
    }
    for (const c of listedChats) {
      const id = (c as any).attendanceId || (c as any).id;
      if (id && !map.has(id)) map.set(id, c);
    }
    return Array.from(map.values());
  })();

  const filteredChats = allChats.filter((chat) => {
    if (!searchTerm) return true;
    const name = (chat.description || chat.contact?.name || chat.contact?.number || "").toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Fetch selected chat details
  const { data: chatDetail } = useQuery({
    queryKey: ["chat-detail", selectedChannelId, selectedChatId],
    queryFn: async () => {
      if (!selectedChannelId || !selectedChatId) return null;
      try {
        const result = await getChatDetail({
          data: { channelId: selectedChannelId, chatId: selectedChatId },
          ...await getAuthHeaders(),
        });
        return result as ChatItem;
      } catch {
        return null;
      }
    },
    enabled: !!selectedChannelId && !!selectedChatId && isAuthenticated,
    refetchInterval: 8000,
  });

  const activeChatDetail = chatDetail || selectedChat;

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
      toast.success("Mensagem enviada");
      queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
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

  const selectChat = (chat: ChatItem) => {
    setSelectedChatId(chat.attendanceId);
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
            {isConnected ? (
              <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700">
                <Wifi className="h-3 w-3" /> Conectado
              </Badge>
            ) : selectedChannelId ? (
              <Badge variant="outline" className="gap-1 border-destructive text-destructive">
                <WifiOff className="h-3 w-3" /> Desconectado
              </Badge>
            ) : null}
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
              onClick={() => {
                refetchChats();
                queryClient.invalidateQueries({ queryKey: ["gsystem-users"] });
              }}
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
                {chatsLoading && allChats.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center space-y-2">
                    <p>{allChats.length === 0 ? "Nenhum atendimento ativo" : "Nenhum resultado"}</p>
                    {allChats.length === 0 && gsystemUsers.length > 0 && (
                      <p className="text-xs">
                        {gsystemUsers.length} agente(s) online, sem atendimentos ativos no momento
                      </p>
                    )}
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const name = chat.description || chat.contact?.name || chat.contact?.number || `Chat ${chat.attendanceId?.slice(0, 6)}`;
                    const phone = chat.secondaryDescription || chat.contact?.secondaryName || chat.contact?.number;
                    const lastMsg = chat.lastMessage?.text;
                    const initials = name.substring(0, 2).toUpperCase();
                    const imgUrl = chat.linkImage || chat.contact?.linkImage;
                    const isDefaultAvatar = imgUrl?.includes("avatar-default");

                    return (
                      <button
                        key={chat.attendanceId}
                        onClick={() => selectChat(chat)}
                        className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                          selectedChatId === chat.attendanceId ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            {!isDefaultAvatar && imgUrl && <AvatarImage src={imgUrl} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate text-foreground">{name}</p>
                              {(chat.countUnreadMessages ?? 0) > 0 && (
                                <Badge variant="default" className="text-xs ml-1 shrink-0">
                                  {chat.countUnreadMessages}
                                </Badge>
                              )}
                            </div>
                            {lastMsg && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {chat.lastMessage?.sender?.isMe ? "Você: " : ""}
                                {lastMsg}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {chat.protocol && (
                                <span className="text-[10px] text-muted-foreground">
                                  #{chat.protocol}
                                </span>
                              )}
                              {chat.sector?.name && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {chat.sector.name}
                                </Badge>
                              )}
                              {chat.lastSeen && (
                                <span className="text-[10px] text-muted-foreground">
                                  {formatTime(chat.lastSeen)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
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
                        {activeChatDetail?.contact?.linkImage &&
                          !activeChatDetail.contact.linkImage.includes("avatar-default") && (
                            <AvatarImage src={activeChatDetail.contact.linkImage} />
                          )}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(activeChatDetail?.description || activeChatDetail?.contact?.name || "?")
                            .substring(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {activeChatDetail?.description || activeChatDetail?.contact?.name || "Contato"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeChatDetail?.contact?.number || activeChatDetail?.secondaryDescription}
                          {activeChatDetail?.protocol && ` • #${activeChatDetail.protocol}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Transferir"
                        onClick={() => toast.info("Transferência disponível em breve")}
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

                  {/* Chat body — shows last message info */}
                  <ScrollArea className="flex-1 p-4">
                    {activeChatDetail?.lastMessage ? (
                      <div className="space-y-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            Atendimento iniciado em{" "}
                            {activeChatDetail.utcDhStartChat
                              ? new Date(activeChatDetail.utcDhStartChat).toLocaleString("pt-BR")
                              : "—"}
                          </p>
                        </div>
                        <Separator />
                        {/* Last message */}
                        <div
                          className={`flex ${
                            activeChatDetail.lastMessage.sender?.isMe ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                              activeChatDetail.lastMessage.sender?.isMe
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            {activeChatDetail.lastMessage.sender?.name &&
                              !activeChatDetail.lastMessage.sender?.isMe && (
                                <p className="text-xs font-medium mb-1 opacity-70">
                                  {activeChatDetail.lastMessage.sender.name}
                                </p>
                              )}
                            <p className="whitespace-pre-wrap break-words">
                              {activeChatDetail.lastMessage.text}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-4">
                          O histórico completo de mensagens ficará disponível quando o endpoint de listagem da API estiver operacional.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
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
              {!activeChatDetail ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  <div className="text-center">
                    <User className="h-8 w-8 mx-auto mb-2" />
                    <p>Detalhes do contato</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4 overflow-auto">
                  <div className="text-center">
                    <Avatar className="h-16 w-16 mx-auto">
                      {activeChatDetail.contact?.linkImage &&
                        !activeChatDetail.contact.linkImage.includes("avatar-default") && (
                          <AvatarImage src={activeChatDetail.contact.linkImage} />
                        )}
                      <AvatarFallback className="text-lg bg-primary/10 text-primary">
                        {(activeChatDetail.description || activeChatDetail.contact?.name || "?")
                          .substring(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="mt-3 font-medium text-foreground">
                      {activeChatDetail.contact?.name || activeChatDetail.description || "Contato"}
                    </h3>
                    {activeChatDetail.contact?.number && (
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {activeChatDetail.contact.number}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {activeChatDetail.protocol && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Protocolo</p>
                        <p className="text-sm mt-1 font-mono text-foreground">#{activeChatDetail.protocol}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                      <Badge variant="outline" className="mt-1">
                        {activeChatDetail.status === 2 ? "Em andamento" : activeChatDetail.status === 1 ? "Aguardando" : `Status ${activeChatDetail.status}`}
                      </Badge>
                    </div>
                    {activeChatDetail.sector?.name && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Setor</p>
                        <p className="text-sm mt-1 text-foreground">{activeChatDetail.sector.name}</p>
                      </div>
                    )}
                    {activeChatDetail.user?.name && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Atendente</p>
                        <p className="text-sm mt-1 text-foreground">{activeChatDetail.user.name}</p>
                      </div>
                    )}
                    {activeChatDetail.channel?.identifier && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Canal</p>
                        <p className="text-sm mt-1 text-foreground">{activeChatDetail.channel.identifier}</p>
                      </div>
                    )}
                    {activeChatDetail.utcDhStartChat && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Início</p>
                        <p className="text-sm mt-1 flex items-center gap-1 text-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(activeChatDetail.utcDhStartChat).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    )}
                    {activeChatDetail.contact?.tags && activeChatDetail.contact.tags.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Tags</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeChatDetail.contact.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag.name || String(tag)}
                            </Badge>
                          ))}
                        </div>
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
