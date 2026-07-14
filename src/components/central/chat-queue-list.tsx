import { useState, useMemo, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Bot, Clock, Headset, Users, Moon, ChevronDown, ChevronRight, MessageSquare, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { useFloatingChats } from "./floating-chats-context";
import { isGroupChat } from "@/lib/chat-utils";

// Meta de resposta: verde ≤2min, amarelo 2-5min, vermelho >5min (zumbi)
const WARN_MS = 2 * 60 * 1000;
const ZOMBIE_MS = 5 * 60 * 1000;

function formatWait(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${m}m`;
}

function waitColor(ms: number): { bg: string; label: string } {
  if (ms >= ZOMBIE_MS) return { bg: "#dc2626", label: "ZUMBI" };
  if (ms >= WARN_MS) return { bg: "#f59e0b", label: "atento" };
  return { bg: "#10b981", label: "ok" };
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
  channel?: { id?: string; type?: number; description?: string; identifier?: string };
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
  messages?: any[];
  timeInAutomatic?: number;
  timeInOutOfHour?: number;
  timeInWaiting?: number;
  timeInManual?: number;
}

interface ChatQueueListProps {
  chats: ChatItem[];
  selectedChatId: string;
  onSelectChat: (id: string) => void;
  isLoading: boolean;
  totalChats: number;
  onlineAgents: number;
  getSlaColor: (chat: ChatItem) => { bg: string; text: string; label: string };
  formatServiceTime: (chat: ChatItem) => string;
  currentAgentName?: string | null;
  onZombieCountChange?: (count: number) => void;
}

// Agent color palette
const AGENT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#d946ef", "#0ea5e9", "#84cc16", "#e11d48", "#7c3aed",
];

const agentColorMap = new Map<string, string>();
function getAgentColor(agentName: string): string {
  if (!agentName) return "#6b7280";
  if (!agentColorMap.has(agentName)) {
    agentColorMap.set(agentName, AGENT_COLORS[agentColorMap.size % AGENT_COLORS.length]);
  }
  return agentColorMap.get(agentName)!;
}

interface GroupConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  headerBg: string;
  headerText: string;
}

const GROUP_CONFIGS: GroupConfig[] = [
  { key: "automatic", label: "Automático", icon: <Bot className="h-4 w-4" />, headerBg: "bg-blue-50 dark:bg-blue-950/30", headerText: "text-blue-700 dark:text-blue-300" },
  { key: "waiting", label: "Aguardando", icon: <Clock className="h-4 w-4" />, headerBg: "bg-amber-50 dark:bg-amber-950/30", headerText: "text-amber-700 dark:text-amber-300" },
  { key: "outOfHour", label: "Fora de hora", icon: <Moon className="h-4 w-4" />, headerBg: "bg-purple-50 dark:bg-purple-950/30", headerText: "text-purple-700 dark:text-purple-300" },
  { key: "manual", label: "Manual", icon: <Headset className="h-4 w-4" />, headerBg: "bg-emerald-50 dark:bg-emerald-950/30", headerText: "text-emerald-700 dark:text-emerald-300" },
  { key: "group", label: "Grupos", icon: <Users className="h-4 w-4" />, headerBg: "bg-slate-50 dark:bg-slate-950/30", headerText: "text-slate-700 dark:text-slate-300" },
];

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatPhone(phone?: string): string {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return phone;
}

export function ChatQueueList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
  totalChats,
  onlineAgents,
  getSlaColor,
  formatServiceTime,
  currentAgentName,
  onZombieCountChange,
}: ChatQueueListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    automatic: true,
    waiting: true,
    outOfHour: true,
    manual: true,
    group: true,
  });

  // Tick a cada 15s para atualizar cronômetros/zumbis
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Reporta contagem de chats zumbis do operador logado
  useEffect(() => {
    if (!onZombieCountChange) return;
    const norm = (currentAgentName || "").trim().toLowerCase();
    let count = 0;
    for (const c of chats) {
      const mine = norm && (c._agentName || c.currentUser?.name || "").trim().toLowerCase() === norm;
      if (!mine) continue;
      const last = c.lastMessage;
      if (!last || last.sender?.isMe !== false) continue;
      const t = last.utcDhMessage ? new Date(last.utcDhMessage).getTime() : 0;
      if (t && nowTick - t >= ZOMBIE_MS) count += 1;
    }
    onZombieCountChange(count);
  }, [chats, nowTick, currentAgentName, onZombieCountChange]);


  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ChatItem[]> = {
      automatic: [],
      waiting: [],
      outOfHour: [],
      manual: [],
      group: [],
    };

    for (const chat of chats) {
      // Group chats always land in the "Grupos" bucket
      if (isGroupChat(chat)) {
        groups.group.push(chat);
        continue;
      }
      // Check out-of-hour first
      if ((chat.timeInOutOfHour || 0) > 0 && chat.status !== 2) {
        groups.outOfHour.push(chat);
      } else if (chat.status === 0) {
        groups.automatic.push(chat);
      } else if (chat.status === 1) {
        groups.waiting.push(chat);
      } else if (chat.status === 2) {
        groups.manual.push(chat);
      } else {
        // Fallback to manual
        groups.manual.push(chat);
      }
    }

    return groups;
  }, [chats]);

  if (isLoading && totalChats === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center space-y-2">
        <p>{totalChats === 0 ? "Nenhum atendimento ativo" : "Nenhum resultado"}</p>
        {totalChats === 0 && (
          <p className="text-xs flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> {onlineAgents} agente(s) online
          </p>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      {GROUP_CONFIGS.map((group) => {
        const items = grouped[group.key];
        if (!items || items.length === 0) return null;
        const isExpanded = expandedGroups[group.key] ?? true;

        return (
          <div key={group.key}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 ${group.headerBg} border-b sticky top-0 z-10 hover:opacity-90 transition-opacity`}
            >
              <span className={group.headerText}>{group.icon}</span>
              <span className={`text-xs font-semibold ${group.headerText} flex-1 text-left`}>
                {group.label}
              </span>
              <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
                {items.length}
              </Badge>
              {isExpanded ? (
                <ChevronDown className={`h-3.5 w-3.5 ${group.headerText}`} />
              ) : (
                <ChevronRight className={`h-3.5 w-3.5 ${group.headerText}`} />
              )}
            </button>

            {/* Chat items */}
            {isExpanded &&
              items.map((chat) => (
                <ChatListItem
                  key={chat.attendanceId}
                  chat={chat}
                  isSelected={selectedChatId === chat.attendanceId}
                  onSelect={() => onSelectChat(chat.attendanceId)}
                  getSlaColor={getSlaColor}
                  formatServiceTime={formatServiceTime}
                  nowTick={nowTick}
                />
              ))}
          </div>
        );
      })}
    </ScrollArea>
  );
}

function ChatListItem({
  chat,
  isSelected,
  onSelect,
  getSlaColor,
  formatServiceTime,
  nowTick,
}: {
  chat: ChatItem;
  isSelected: boolean;
  onSelect: () => void;
  getSlaColor: (chat: ChatItem) => { bg: string; text: string; label: string };
  formatServiceTime: (chat: ChatItem) => string;
  nowTick: number;
}) {
  const name = chat.description || chat.contact?.name || chat.contact?.number || `Chat ${chat.attendanceId?.slice(0, 6)}`;
  const initials = name.substring(0, 2).toUpperCase();
  const imgUrl = chat.linkImage || chat.contact?.linkImage;
  const isDefaultAvatar = imgUrl?.includes("avatar-default");
  const agentName = chat._agentName || chat.currentUser?.name;
  const sla = getSlaColor(chat);
  const time = formatServiceTime(chat);
  const phone = chat.contact?.number || chat.contact?.secondaryName || "";
  const lastMsgText = chat.lastMessage?.text;
  const lastMsgSender = chat.lastMessage?.sender?.name;
  const lastMsgTime = formatTime(chat.lastMessage?.utcDhMessage);
  const tags = chat.contact?.tags || [];
  const sectorName = chat.currentSector?.description;
  const lastMsgIsMe = chat.lastMessage?.sender?.isMe;
  const hasLastMsg = !!chat.lastMessage;
  const unread = chat.countUnreadMessages ?? 0;
  const clientWaiting = hasLastMsg && lastMsgIsMe === false;
  const waitMs = useMemo(() => {
    if (!clientWaiting || !chat.lastMessage?.utcDhMessage) return 0;
    return Math.max(0, nowTick - new Date(chat.lastMessage.utcDhMessage).getTime());
  }, [clientWaiting, chat.lastMessage?.utcDhMessage, nowTick]);
  const isZombie = waitMs >= ZOMBIE_MS;
  const wc = waitMs > 0 ? waitColor(waitMs) : null;
  const { openChat } = useFloatingChats();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", chat.attendanceId);
      e.dataTransfer.setData("application/x-gsystem-chat", chat.attendanceId);
    } catch {
      // ignore
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.dropEffect === "none") {
      openChat({
        chatId: chat.attendanceId,
        channelId: chat.channel?.id || "",
        meta: {
          name,
          phone,
          avatar: imgUrl,
          slaColor: sla.bg,
          agentName: agentName || undefined,
          sectorName: sectorName || undefined,
        },
        position: { x: e.clientX, y: e.clientY },
      });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={`w-full text-left px-3 py-2.5 border-b hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing ${
        isSelected ? "bg-accent" : ""
      } ${clientWaiting ? "animate-name-blink" : ""}`}
      title="Clique para abrir no painel ou arraste para fora para janela flutuante"
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar with WhatsApp indicator */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {!isDefaultAvatar && imgUrl && <AvatarImage src={imgUrl} />}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* WhatsApp icon */}
          <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5">
            <MessageSquare className="h-2.5 w-2.5 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + time/unread */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {hasLastMsg && (
                lastMsgIsMe ? (
                  <ArrowUp
                    className="h-3.5 w-3.5 shrink-0 text-blue-500"
                    aria-label="Última mensagem do operador"
                  />
                ) : (
                  <ArrowDown
                    className="h-3.5 w-3.5 shrink-0 text-blue-500"
                    aria-label="Última mensagem do cliente"
                  />
                )
              )}
              <p className={`text-sm truncate ${clientWaiting ? "font-bold animate-name-blink" : "font-medium"}`} style={{ color: sla.bg }}>
                {name}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {lastMsgTime && (
                <span className="text-[10px] text-muted-foreground">{lastMsgTime}</span>
              )}
              {unread > 0 && (
                <Badge variant="default" className="text-[10px] h-4 min-w-[16px] px-1 justify-center">
                  {unread}
                </Badge>
              )}
            </div>
          </div>

          {/* Row 2: Phone + sector + agent */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {phone && (
              <span className="text-[10px] text-muted-foreground truncate">
                {formatPhone(phone)}
              </span>
            )}
            {sectorName && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0 border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
                {sectorName}
              </Badge>
            )}
          </div>

          {/* Operator row: same hierarchy as client name */}
          {agentName && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getAgentColor(agentName) }}
                aria-hidden
              />
              <p
                className="text-sm font-medium truncate"
                style={{ color: getAgentColor(agentName) }}
                title={`Operador: ${agentName}`}
              >
                {agentName}
              </p>
            </div>
          )}
          {/* Row 3: SLA time badge */}
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-[10px] font-semibold px-1.5 py-0 rounded-full text-white leading-4"
              style={{ backgroundColor: sla.bg }}
            >
              ⏱ {time}
            </span>
          </div>

          {/* Row 4: Last message */}
          {lastMsgText && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {lastMsgSender ? `${lastMsgSender}: ` : ""}
              {lastMsgText}
            </p>
          )}

          {/* Row 5: Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {tags.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                  {tag.name || String(tag)}
                </Badge>
              ))}
              {tags.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
