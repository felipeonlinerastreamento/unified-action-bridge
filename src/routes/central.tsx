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
  listAllOpenChats,
  getChatDetail,
  sendText,
  finalizeChat,
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
  Users,
} from "lucide-react";

export const Route = createFileRoute("/central")({
  component: CentralPage,
});

interface GMessage {
  IdMessage?: string;
  senderName?: string;
  dhMessage?: string;
  unixTimeMessage?: number;
  text?: string;
  isSentByMe?: boolean;
  isSystemMessage?: boolean;
  isPrivate?: boolean;
  isDeleted?: boolean;
  typeMessage?: number;
}

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
  utcDhEndChat?: string;
  _agentName?: string;
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
    sender?: { id?: string; name?: string; isMe?: boolean };
    utcDhMessage?: string;
  };
  currentSector?: { id?: string; description?: string };
  currentOrganization?: { id?: string; description?: string };
  currentUser?: { id?: string; name?: string };
  finalizadoPor?: { id?: string; name?: string };
  messages?: GMessage[];
  timeInAutomatic?: number;
  timeInOutOfHour?: number;
  timeInWaiting?: number;
  timeInManual?: number;
}

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Automático", color: "bg-blue-100 text-blue-800 border-blue-200" },
  1: { label: "Aguardando", color: "bg-amber-100 text-amber-800 border-amber-200" },
  2: { label: "Em atendimento", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  3: { label: "Finalizado", color: "bg-muted text-muted-foreground border-border" },
};

function CentralPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedChatId, setSelectedChatId] = useState<string>("");
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

  useEffect(() => {
    if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // Channel connection status
  const { data: channelStatus } = useQuery({
    queryKey: ["channel-status", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return null;
      try {
        return await getChannelStatus({
          data: { channelId: selectedChannelId },
          ...await getAuthHeaders(),
        });
      } catch {
        return null;
      }
    },
    enabled: !!selectedChannelId && isAuthenticated,
    refetchInterval: 30000,
  });

  const isConnected = channelStatus?.status === "CONNECTED";

  // Fetch ALL open chats from all agents
  const { data: openChatsData, isLoading: chatsLoading, refetch: refetchChats } = useQuery({
    queryKey: ["all-open-chats", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return { chats: [], users: [], total: 0 };
      return await listAllOpenChats({
        data: { channelId: selectedChannelId },
        ...await getAuthHeaders(),
      }) as { chats: ChatItem[]; users: any[]; total: number };
    },
    enabled: !!selectedChannelId && isAuthenticated,
    refetchInterval: 10000,
  });

  const allChats = openChatsData?.chats || [];
  const gsystemUsers = openChatsData?.users || [];
  const onlineAgents = gsystemUsers.filter((u: any) => u.status === "ONLINE").length;

  const filteredChats = allChats.filter((chat) => {
    if (!searchTerm) return true;
    const name = (chat.description || chat.contact?.name || chat.contact?.number || "").toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Fetch selected chat details with messages (polling for new messages)
  const { data: chatDetail } = useQuery({
    queryKey: ["chat-detail", selectedChannelId, selectedChatId],
    queryFn: async () => {
      if (!selectedChannelId || !selectedChatId) return null;
      try {
        return await getChatDetail({
          data: { channelId: selectedChannelId, chatId: selectedChatId },
          ...await getAuthHeaders(),
        }) as ChatItem;
      } catch {
        return null;
      }
    },
    enabled: !!selectedChannelId && !!selectedChatId && isAuthenticated,
    refetchInterval: 5000,
  });

  const messages = chatDetail?.messages || [];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedChatId]);

  // Send message
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
    onError: (err: any) => toast.error(err?.message || "Erro ao enviar mensagem"),
  });

  // Finalize chat
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

  if (authLoading || !isAuthenticated) return null;

  const noChannels = channels.length === 0;
  const statusInfo = chatDetail ? STATUS_MAP[chatDetail.status ?? -1] || { label: `Status ${chatDetail.status}`, color: "" } : null;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Atendimento</h1>
            <p className="text-sm text-muted-foreground">
              {allChats.length} atendimento(s) ativo(s) • {onlineAgents} agente(s) online
            </p>
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
                    <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
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
                {chatsLoading && allChats.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center space-y-2">
                    <p>{allChats.length === 0 ? "Nenhum atendimento ativo" : "Nenhum resultado"}</p>
                    {allChats.length === 0 && (
                      <p className="text-xs flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" /> {onlineAgents} agente(s) online
                      </p>
                    )}
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const name = chat.description || chat.contact?.name || chat.contact?.number || `Chat ${chat.attendanceId?.slice(0, 6)}`;
                    const initials = name.substring(0, 2).toUpperCase();
                    const imgUrl = chat.linkImage || chat.contact?.linkImage;
                    const isDefaultAvatar = imgUrl?.includes("avatar-default");
                    const lastMsg = chat.lastMessage?.text;
                    const st = STATUS_MAP[chat.status ?? -1];
                    const agentName = chat._agentName || chat.currentUser?.name;

                    return (
                      <button
                        key={chat.attendanceId}
                        onClick={() => setSelectedChatId(chat.attendanceId)}
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
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {st && (
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.color}`}>
                                  {st.label}
                                </Badge>
                              )}
                              {chat.currentSector?.description && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {chat.currentSector.description}
                                </Badge>
                              )}
                              {agentName && (
                                <span className="text-[10px] text-muted-foreground">• {agentName}</span>
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

            {/* Chat area — full messages */}
            <div className="col-span-6 border rounded-lg flex flex-col bg-card overflow-hidden">
              {!selectedChatId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MessageSquare className="h-12 w-12" />
                  <p className="text-sm">Selecione uma conversa para visualizar</p>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {chatDetail?.contact?.linkImage &&
                          !chatDetail.contact.linkImage.includes("avatar-default") && (
                            <AvatarImage src={chatDetail.contact.linkImage} />
                          )}
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(chatDetail?.description || chatDetail?.contact?.name || "?").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {chatDetail?.description || chatDetail?.contact?.name || "Contato"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {chatDetail?.contact?.secondaryName || chatDetail?.contact?.number}
                          {chatDetail?.protocol && ` • #${chatDetail.protocol}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {statusInfo && (
                        <Badge variant="outline" className={`text-xs mr-2 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                      )}
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

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-2">
                      {chatDetail?.utcDhStartChat && (
                        <div className="text-center mb-4">
                          <Badge variant="secondary" className="text-xs">
                            Atendimento iniciado em {new Date(chatDetail.utcDhStartChat).toLocaleString("pt-BR")}
                          </Badge>
                        </div>
                      )}

                      {messages.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-8">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Carregando mensagens...
                        </div>
                      )}

                      {messages.map((msg, idx) => {
                        if (msg.isDeleted) return null;

                        const isSystem = msg.isSystemMessage;
                        const isMe = msg.isSentByMe;
                        const isPrivate = msg.isPrivate;

                        if (isSystem) {
                          return (
                            <div key={msg.IdMessage || idx} className="text-center my-2">
                              <Badge variant="secondary" className="text-xs font-normal">
                                {msg.text}
                              </Badge>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.IdMessage || idx}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                                isPrivate
                                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : isMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {!isMe && msg.senderName && (
                                <p className="text-xs font-medium mb-1 opacity-70">{msg.senderName}</p>
                              )}
                              {isPrivate && (
                                <p className="text-[10px] font-medium mb-1 opacity-60">🔒 Nota privada</p>
                              )}
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                              {msg.dhMessage && (
                                <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                  {formatTime(msg.dhMessage)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-3 border-t flex gap-2">
                    <Input
                      placeholder="Digite uma mensagem..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sendMutation.isPending || chatDetail?.status === 3}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!messageInput.trim() || sendMutation.isPending || chatDetail?.status === 3}
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

            {/* Contact details panel */}
            <div className="col-span-3 border rounded-lg bg-card overflow-hidden flex flex-col">
              {!chatDetail ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  <div className="text-center">
                    <User className="h-8 w-8 mx-auto mb-2" />
                    <p>Detalhes do contato</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    <div className="text-center">
                      <Avatar className="h-16 w-16 mx-auto">
                        {chatDetail.contact?.linkImage &&
                          !chatDetail.contact.linkImage.includes("avatar-default") && (
                            <AvatarImage src={chatDetail.contact.linkImage} />
                          )}
                        <AvatarFallback className="text-lg bg-primary/10 text-primary">
                          {(chatDetail.description || chatDetail.contact?.name || "?").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="mt-3 font-medium text-foreground">
                        {chatDetail.contact?.name || chatDetail.description || "Contato"}
                      </h3>
                      {chatDetail.contact?.number && (
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {chatDetail.contact.secondaryName || chatDetail.contact.number}
                        </p>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {chatDetail.protocol && (
                        <DetailRow label="Protocolo" value={`#${chatDetail.protocol}`} mono />
                      )}
                      {statusInfo && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                          <Badge variant="outline" className={`mt-1 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      )}
                      {chatDetail.currentSector?.description && (
                        <DetailRow label="Setor" value={chatDetail.currentSector.description} />
                      )}
                      {chatDetail.currentUser?.name && (
                        <DetailRow label="Atendente" value={chatDetail.currentUser.name} />
                      )}
                      {chatDetail.currentOrganization?.description && (
                        <DetailRow label="Organização" value={chatDetail.currentOrganization.description} />
                      )}
                      {chatDetail.channel?.identifier && (
                        <DetailRow label="Canal" value={chatDetail.channel.identifier} />
                      )}
                      {chatDetail.utcDhStartChat && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Início</p>
                          <p className="text-sm mt-1 flex items-center gap-1 text-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(chatDetail.utcDhStartChat).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      )}
                      {chatDetail.utcDhEndChat && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Finalizado em</p>
                          <p className="text-sm mt-1 text-foreground">
                            {new Date(chatDetail.utcDhEndChat).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      )}
                      {chatDetail.finalizadoPor?.name && (
                        <DetailRow label="Finalizado por" value={chatDetail.finalizadoPor.name} />
                      )}

                      {/* Time metrics */}
                      {(chatDetail.timeInWaiting || chatDetail.timeInManual || chatDetail.timeInAutomatic) && (
                        <>
                          <Separator />
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Tempos</p>
                          <div className="grid grid-cols-2 gap-2">
                            {chatDetail.timeInWaiting !== undefined && chatDetail.timeInWaiting > 0 && (
                              <TimeMetric label="Espera" seconds={chatDetail.timeInWaiting} />
                            )}
                            {chatDetail.timeInManual !== undefined && chatDetail.timeInManual > 0 && (
                              <TimeMetric label="Atendimento" seconds={chatDetail.timeInManual} />
                            )}
                            {chatDetail.timeInAutomatic !== undefined && chatDetail.timeInAutomatic > 0 && (
                              <TimeMetric label="Automático" seconds={chatDetail.timeInAutomatic} />
                            )}
                            {chatDetail.timeInOutOfHour !== undefined && chatDetail.timeInOutOfHour > 0 && (
                              <TimeMetric label="Fora do horário" seconds={chatDetail.timeInOutOfHour} />
                            )}
                          </div>
                        </>
                      )}

                      {chatDetail.contact?.tags && chatDetail.contact.tags.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Tags</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {chatDetail.contact.tags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag.name || String(tag)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Messages count */}
                      <Separator />
                      <DetailRow label="Mensagens" value={`${messages.length} mensagem(ns) neste atendimento`} />
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm mt-1 text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function TimeMetric({ label, seconds }: { label: string; seconds: number }) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return (
    <div className="bg-muted/50 rounded p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">
        {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
      </p>
    </div>
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
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
