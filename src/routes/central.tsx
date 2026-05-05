import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listAllOpenChats,
  getChatDetail,
  getChatMessages,
  sendText,
  sendMedia,
  finalizeChat,
  createChat,
  getChannelStatus,
  listSectors,
  listGSystemUsers,
  transferChat,
  joinChatAsCoAgent,
  deleteMessage,
} from "@/lib/gsystem.functions";
import {
  createPendenciaFromAtendimento,
  concluirPendencia,
  getClientes,
  getTiposPendencia,
} from "@/lib/gsystem-api.functions";
import { SubClientLinker } from "@/components/central/sub-client-linker";
import { ContactPicker, type PickedContact } from "@/components/central/contact-picker";
import { ReferralPicker } from "@/components/crm/referral-picker";
import {
  createCrmContactWithCompany,
  createSubClientWithParentCompany,
  linkPhoneToCompany,
} from "@/lib/company-sync.functions";
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
  Building2,
  FileText,
  History,
  AlertCircle,
  Link as LinkIcon,
  UserPlus,
  Mail,
  Plus,
  Filter,
  X,
  Bot,
  Timer,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MoreVertical,
  Check,
  CheckCheck,
  Pencil,
  Paperclip,
  Zap,
  EyeOff,
  AtSign,
  Tag,
  Trash2,
  UserCircle2,
  Reply,
  CornerDownRight,
  ShieldAlert,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChatQueueList } from "@/components/central/chat-queue-list";
import { MyAttendanceKpis } from "@/components/central/my-attendance-kpis";
import { FloatingChatsProvider } from "@/components/central/floating-chats-context";
import { FloatingChatsLayer } from "@/components/central/floating-chats-layer";
import { useIsMobile } from "@/hooks/use-mobile";
import { WhisperToggle } from "@/components/central/whisper-toggle";
import { QuickRepliesPopover } from "@/components/central/quick-replies-popover";
import { applyQuickReplyVars } from "@/lib/quick-reply-vars";
import { formatTicketProtocol } from "@/lib/protocol-format";
import { ChatTags, type ChatTag } from "@/components/central/chat-tags";
import { MessageStatusTicks } from "@/components/central/message-status-ticks";
import { TypingIndicator } from "@/components/central/typing-indicator";
import { MessageMediaContent } from "@/components/central/message-media";
import { AudioRecorderButton } from "@/components/central/audio-recorder-button";
import { EmojiPickerButton } from "@/components/central/emoji-picker-button";
import { useZapiRealtime } from "@/hooks/use-zapi-realtime";
import { isGroupChat } from "@/lib/chat-utils";
import {
  useTesteEquipamentoSettings,
  isTesteEquipamentoCategory,
  EMPTY_TESTE_EQUIPAMENTO,
  buildTesteEquipamentoNotes,
  validateTesteEquipamento,
  type TesteEquipamentoData,
} from "@/hooks/use-teste-equipamento-settings";
import { TesteEquipamentoFields } from "@/components/atendimentos/teste-equipamento-fields";
import {
  LiberacaoEquipamentoFields,
  validateLiberacaoItems,
  type LiberacaoLineItem,
} from "@/components/atendimentos/liberacao-equipamento-fields";
import { isLiberacaoCategory } from "@/hooks/use-liberacao-equipamento";
import { finalizeTicketWithFlow } from "@/lib/ticket-finalize-flow";
import { useAttendanceEventSettings, useSlaBandChangeNotifier } from "@/hooks/use-attendance-events";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/central")({
  component: CentralPageWithFloating,
});

function CentralPageWithFloating() {
  return (
    <FloatingChatsProvider>
      <CentralPage />
    </FloatingChatsProvider>
  );
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
  utcDhMessage?: string;
  unixTimeMessage?: number;
  text?: string;
  isSentByMe?: boolean;
  isSystemMessage?: boolean;
  isPrivate?: boolean;
  isDeleted?: boolean;
  typeMessage?: number;
  mediaUrl?: string | null;
  mediaType?: string | null;
  _status?: string; // "sent" | "delivered" | "read" (from zapi_messages.status)
  replyTo?: { id: string; text: string; author: string } | null;
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

// Brazilian plate regex: ABC-1234 or ABC1D23 (Mercosul)
const PLATE_REGEX = /\b([A-Z]{3}[-\s]?\d{4}|[A-Z]{3}\d[A-Z]\d{2})\b/gi;

function detectPlates(messages: GMessage[]): string[] {
  const plates = new Set<string>();
  for (const msg of messages) {
    if (!msg.text) continue;
    const matches = msg.text.match(PLATE_REGEX);
    if (matches) {
      for (const m of matches) {
        plates.add(m.replace(/[-\s]/g, "").toUpperCase());
      }
    }
  }
  return Array.from(plates);
}

function CentralPage() {
  const { isAuthenticated, isLoading: authLoading, session, user, hasRole, profile } = useAuth();
  const isAdmin = hasRole("admin");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [messageInput, setMessageInput] = useState("");
  const [whisperMode, setWhisperMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    text: string;
    author: string;
  } | null>(null);
  const [nicknameMode, setNicknameMode] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [ticketPlate, setTicketPlate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");
  const [newChatSector, setNewChatSector] = useState("");
  const [newChatTab, setNewChatTab] = useState<"saved" | "manual">("saved");
  const [newChatPickedContact, setNewChatPickedContact] = useState<PickedContact | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [finalizeNotes, setFinalizeNotes] = useState("");
  const [skipClosingMessage, setSkipClosingMessage] = useState(false);
  const [escalateToGestao, setEscalateToGestao] = useState(false);
  const [finalizeStatus, setFinalizeStatus] = useState<string>("A resolver");
  const [finalizeTipoPendencia, setFinalizeTipoPendencia] = useState<string>("");
  const [showTeDialog, setShowTeDialog] = useState(false);
  const [teData, setTeData] = useState<TesteEquipamentoData>(EMPTY_TESTE_EQUIPAMENTO);
  const [showLiberacaoDialog, setShowLiberacaoDialog] = useState(false);
  const [liberacaoItems, setLiberacaoItems] = useState<LiberacaoLineItem[]>([]);
  const [liberacaoDate, setLiberacaoDate] = useState<string>("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSectorId, setTransferSectorId] = useState<string>("");
  const [transferUserId, setTransferUserId] = useState<string>("");
  const [changingCompany, setChangingCompany] = useState(false);
  const isMobile = useIsMobile();
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const lastIdentFormSeedRef = useRef<string>("");
  const queryClient = useQueryClient();

  // Auto-collapse side panels on mobile, expand right panel on desktop when a chat is opened
  useEffect(() => {
    if (isMobile) {
      // On small screens, hide the right panel by default to give chat full width
      setShowRightPanel(false);
    }
  }, [isMobile]);

  // On mobile, auto-close the chat list when a chat is selected so the chat takes full width
  useEffect(() => {
    if (isMobile && selectedChatId) {
      setShowLeftPanel(false);
    }
  }, [isMobile, selectedChatId]);

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);

  // Load AI assistant enabled flag and subscribe to realtime changes,
  // so we can hide the IA panel and skip API calls when disabled.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("ai_assistant_config")
        .select("is_enabled")
        .limit(1)
        .maybeSingle();
      if (active) setAiEnabled(((data as any)?.is_enabled ?? true) as boolean);
    })();
    const channel = supabase
      .channel("central-ai-assistant-flag")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_assistant_config" },
        (payload: any) => {
          const next = payload?.new?.is_enabled;
          if (typeof next === "boolean") setAiEnabled(next);
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Fetch SLA rules for time-based coloring
  const { data: slaRules = [] } = useQuery({
    queryKey: ["sla-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_sla_rules")
        .select("*")
        .eq("is_active", true);
      return data || [];
    },
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  // Helper to get SLA color based on total service time in minutes
  const getSlaColor = useCallback((chat: ChatItem) => {
    const totalSeconds = (chat.timeInManual || 0) + (chat.timeInWaiting || 0) + (chat.timeInAutomatic || 0) + (chat.timeInOutOfHour || 0);
    const totalMinutes = totalSeconds / 60;

    // Find matching SLA rule for the chat's sector
    const sectorName = chat.currentSector?.description || "";
    const rule = slaRules.find((r) => r.sector_name === sectorName) || slaRules[0];

    if (!rule) {
      // Default colors if no rule configured
      if (totalMinutes <= 5) return { bg: "#22c55e", text: "text-green-700", label: "green" };
      if (totalMinutes <= 15) return { bg: "#eab308", text: "text-yellow-700", label: "yellow" };
      if (totalMinutes <= 30) return { bg: "#f97316", text: "text-orange-700", label: "orange" };
      return { bg: "#ef4444", text: "text-red-700", label: "red" };
    }

    if (totalMinutes <= rule.green_limit_minutes) return { bg: rule.green_color, text: "", label: "green" };
    if (totalMinutes <= rule.yellow_limit_minutes) return { bg: rule.yellow_color, text: "", label: "yellow" };
    if (totalMinutes <= rule.orange_limit_minutes) return { bg: rule.orange_color, text: "", label: "orange" };
    return { bg: rule.red_color, text: "", label: "red" };
  }, [slaRules]);

  // ===== Attendance Events: SLA band-change pop-up for the responsible operator =====
  const { data: eventSettings } = useAttendanceEventSettings();
  const { data: myGsystemLink } = useQuery({
    queryKey: ["my-gsystem-link", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_gsystem_links" as any)
        .select("gsystem_user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any) || null;
    },
    enabled: !!user?.id,
    staleTime: 300000,
  });

  const slaItems = useMemo(() => {
    return allChats.map((c: any) => {
      const band = getSlaColor(c).label;
      const assignedGsystemId = c.assignedUserId ? String(c.assignedUserId) : null;
      const isMine = !!assignedGsystemId && !!myGsystemLink?.gsystem_user_id &&
        String(myGsystemLink.gsystem_user_id) === assignedGsystemId;
      return {
        chatId: String(c.attendanceId),
        assignedUserId: assignedGsystemId,
        currentUserIsResponsible: isMine,
        band,
        contactName: c.description || c.secondaryDescription || "",
      };
    });
  }, [allChats, getSlaColor, myGsystemLink?.gsystem_user_id]);

  useSlaBandChangeNotifier(
    slaItems,
    !!eventSettings?.sla_band_change_enabled,
    !!eventSettings?.sla_band_change_sound,
  );

  const formatServiceTime = (chat: ChatItem) => {
    const totalSeconds = (chat.timeInManual || 0) + (chat.timeInWaiting || 0) + (chat.timeInAutomatic || 0) + (chat.timeInOutOfHour || 0);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h${remMins > 0 ? ` ${remMins}m` : ""}`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Fetch sectors for filters
  const { data: sectorsData } = useQuery({
    queryKey: ["gsystem-sectors", selectedChannelId],
    queryFn: async () => {
      if (!selectedChannelId) return [];
      const result = await listSectors({
        data: { channelId: selectedChannelId },
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : [];
    },
    enabled: !!selectedChannelId && isAuthenticated,
    staleTime: 60000,
  });
  const sectors = sectorsData || [];

  // Fetch tipos de pendência from GSystem
  const { data: tiposPendencia = [], isError: tiposPendenciaError } = useQuery({
    queryKey: ["tipos-pendencia"],
    queryFn: async () => {
      const result = await getTiposPendencia({
        ...await getAuthHeaders(),
      });
      console.log("[central] tiposPendencia result:", result);
      if (!Array.isArray(result)) {
        console.warn("[central] tiposPendencia não retornou array:", result);
        return [];
      }
      return result;
    },
    enabled: isAuthenticated,
    staleTime: 300000,
  });

  const { data: teSettings } = useTesteEquipamentoSettings();


  const { data: gsystemUsersList = [] } = useQuery({
    queryKey: ["gsystem-users-list", selectedChannelId],
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
    staleTime: 60000,
  });

  const filteredChats = allChats.filter((chat) => {
    // Search filter (name + phone)
    if (searchTerm) {
      const name = (chat.description || chat.contact?.name || chat.contact?.number || "").toLowerCase();
      const phone = (chat.contact?.number || chat.contact?.secondaryName || "").toLowerCase();
      if (!name.includes(searchTerm.toLowerCase()) && !phone.includes(searchTerm.toLowerCase())) return false;
    }
    // Status filter
    if (statusFilter !== "all") {
      const statusNum = parseInt(statusFilter);
      if (chat.status !== statusNum) return false;
    }
    // Sector filter
    if (sectorFilter !== "all") {
      if (chat.currentSector?.id !== sectorFilter && chat.currentSector?.description !== sectorFilter) return false;
    }
    // Agent filter
    if (agentFilter !== "all") {
      if (chat.currentUser?.id !== agentFilter && chat._agentName !== agentFilter) return false;
    }
    return true;
  });

  // Fetch selected chat details with messages (polling)
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

  // Fetch ALL messages via dedicated messages endpoint
  const { data: fullMessages } = useQuery({
    queryKey: ["chat-messages", selectedChannelId, selectedChatId],
    queryFn: async () => {
      if (!selectedChannelId || !selectedChatId) return [];
      try {
        const result = await getChatMessages({
          data: { channelId: selectedChannelId, chatId: selectedChatId },
          ...await getAuthHeaders(),
        });
        // API may return { data: [...] }, { messages: [...] }, or array directly
        const msgs = Array.isArray(result) ? result : (result?.data || result?.messages || []);
        return Array.isArray(msgs) ? msgs as GMessage[] : [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedChannelId && !!selectedChatId && isAuthenticated,
    refetchInterval: 5000,
  });

  // Use dedicated messages endpoint; fall back to chatDetail.messages
  const messages = (fullMessages && fullMessages.length > 0)
    ? fullMessages
    : (chatDetail?.messages || []);

  // Detect plates in messages
  const detectedPlates = useMemo(() => detectPlates(messages), [messages]);

  // Auto-set plate from detection
  useEffect(() => {
    if (detectedPlates.length > 0 && !ticketPlate) {
      setTicketPlate(detectedPlates[detectedPlates.length - 1]);
    }
  }, [detectedPlates, ticketPlate]);

  // Reset plate when changing chat
  useEffect(() => {
    setTicketPlate("");
    setReplyingTo(null);
  }, [selectedChatId]);

  // Company lookup by contact phone
  const contactPhone = chatDetail?.contact?.number || chatDetail?.contact?.secondaryName || "";

  // Local Z-API chat row for this conversation (used for tags + whisper persistence + typing indicator)
  const { data: localZapiChat } = useQuery({
    queryKey: ["zapi-chat-row", selectedChannelId, contactPhone],
    queryFn: async () => {
      if (!selectedChannelId || !contactPhone) return null;
      const { data } = await supabase
        .from("zapi_chats")
        .select("id, tags, bot_state, assigned_to")
        .eq("channel_id", selectedChannelId)
        .eq("phone", contactPhone)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedChannelId && !!contactPhone && isAuthenticated,
    refetchInterval: 5000,
  });

  // Contact "typing..." indicator from Z-API presence webhook (stored in zapi_chats.bot_state)
  const isContactTyping = !!(localZapiChat?.bot_state as any)?.is_typing;

  // Nome do operador atualmente atribuído ao chat (exibido no header)
  const assignedOperatorId = (localZapiChat as any)?.assigned_to || null;
  const { data: assignedOperator } = useQuery({
    queryKey: ["assigned-operator-name", assignedOperatorId],
    queryFn: async () => {
      if (!assignedOperatorId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", assignedOperatorId)
        .maybeSingle();
      return data?.name || null;
    },
    enabled: !!assignedOperatorId,
    staleTime: 60_000,
  });

  // Wire realtime updates for chat list and current chat messages
  useZapiRealtime({ channelId: selectedChannelId, chatId: localZapiChat?.id });

  // Helper: normalize phone to last 10-11 digits for reliable matching
  const normalizePhone = useCallback((phone: string) => {
    const digits = phone.replace(/\D/g, "");
    // Brazilian phones: 10 or 11 digits (DDD + number), possibly prefixed with country code 55
    return digits.length > 11 ? digits.slice(-11) : digits;
  }, []);

  const phonesMatch = useCallback((a: string, b: string) => {
    const na = normalizePhone(a);
    const nb = normalizePhone(b);
    if (!na || !nb) return false;
    return na === nb || na.endsWith(nb) || nb.endsWith(na);
  }, [normalizePhone]);

  const { data: companyLookup, isFetched: companyLookupFetched } = useQuery({
    queryKey: ["company-lookup", contactPhone],
    queryFn: async () => {
      if (!contactPhone) return null;
      const cleanPhone = normalizePhone(contactPhone);

      // 1. Check company_phones table
      const { data: phoneLinks } = await supabase
        .from("company_phones")
        .select("company_id, phone_number");

      const phoneMatch = phoneLinks?.find((p) => phonesMatch(p.phone_number, contactPhone));

      // 2. If no phone link, check previous tickets with same contact_phone that have a company_id
      let companyId = phoneMatch?.company_id;

      if (!companyId) {
        const { data: prevTickets } = await supabase
          .from("service_tickets")
          .select("company_id, contact_phone")
          .not("company_id", "is", null)
          .not("contact_phone", "is", null)
          .order("created_at", { ascending: false })
          .limit(200);

        const ticketMatch = prevTickets?.find((t) =>
          t.contact_phone && t.company_id && phonesMatch(t.contact_phone, contactPhone)
        );
        companyId = ticketMatch?.company_id ?? undefined;
      }

      if (!companyId) return null;

      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      return company;
    },
    enabled: !!contactPhone && isAuthenticated,
  });

  // Sub-client lookup by phone
  const { data: subClientLookup, isFetched: subClientLookupFetched } = useQuery({
    queryKey: ["sub-client-lookup", contactPhone],
    queryFn: async () => {
      if (!contactPhone) return null;
      const { data: subClients } = await supabase
        .from("sub_clients")
        .select("*, companies(name)");
      if (!subClients) return null;
      const match = subClients.find((s: any) => phonesMatch(s.phone, contactPhone));
      return match || null;
    },
    enabled: !!contactPhone && !companyLookup && isAuthenticated,
  });

  // Identification modal explicit open state
  const [identModalDismissed, setIdentModalDismissed] = useState<Record<string, boolean>>({});
  const [identModalOpen, setIdentModalOpen] = useState(false);


  // Identification modal form state
  const [identTab, setIdentTab] = useState<"vincular" | "subcliente" | "vincular-sub" | "crm">("vincular");
  type IdentContractItem = { categoryId: string; quantity: number; activationValue: number; monthlyValue: number };
  const [identForm, setIdentForm] = useState<{ name: string; phone: string; email: string; notes: string; companyId: string; contactType: "PF" | "PJ"; categoryId: string; cnpj: string; companyNameInput: string; items: IdentContractItem[]; referralId: string }>({ name: "", phone: "", email: "", notes: "", companyId: "", contactType: "PF", categoryId: "", cnpj: "", companyNameInput: "", items: [], referralId: "" });
  const [companySearch, setCompanySearch] = useState("");
  const [subClientSearch, setSubClientSearch] = useState("");
  const [crmCategoryDraft, setCrmCategoryDraft] = useState("");
  const [editingCrmCategoryId, setEditingCrmCategoryId] = useState<string | null>(null);
  const [editingCrmCategoryName, setEditingCrmCategoryName] = useState("");

  // Inline edit for contact name in the "Contato" tab
  const [editingContactName, setEditingContactName] = useState(false);
  const [contactNameDraft, setContactNameDraft] = useState("");
  const [savingContactName, setSavingContactName] = useState(false);

  const handleSaveContactName = async () => {
    if (!selectedChatId) return;
    const newName = contactNameDraft.trim();
    if (!newName) {
      toast.error("O nome não pode ficar vazio");
      return;
    }
    if (newName.length > 120) {
      toast.error("Nome muito longo (máx. 120 caracteres)");
      return;
    }
    setSavingContactName(true);
    try {
      const { error } = await supabase
        .from("zapi_chats")
        .update({ contact_name: newName })
        .eq("id", selectedChatId);
      if (error) throw error;
      toast.success("Nome do contato atualizado");
      setEditingContactName(false);
      queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ["all-open-chats", selectedChannelId] });
      queryClient.invalidateQueries({ queryKey: ["zapi-chats", selectedChannelId] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar nome");
    } finally {
      setSavingContactName(false);
    }
  };

  // Seed identification form only once per selected chat to avoid resets during polling
  useEffect(() => {
    if (!selectedChatId || !chatDetail) return;

    const seedKey = `${selectedChatId}:${contactPhone}`;
    if (lastIdentFormSeedRef.current === seedKey) return;

    setIdentForm({
      name: chatDetail.contact?.name || chatDetail.description || "",
      phone: contactPhone || "",
      email: "",
      notes: "",
      companyId: "",
      contactType: "PF",
      categoryId: "",
      cnpj: "",
      companyNameInput: "",
      items: [],
      referralId: "",
    });
    setIdentTab("vincular");
    setChangingCompany(false);
    lastIdentFormSeedRef.current = seedKey;
  }, [selectedChatId, chatDetail, contactPhone]);

  const getSelectedCompany = (selectedValue: string) => {
    return allCompanies.find((company: any) => company.value === selectedValue) ?? null;
  };

  // Create sub-client mutation
  const createSubClientMutation = useMutation({
    mutationFn: async () => {
      if (!identForm.companyId || !identForm.name) throw new Error("Preencha nome e empresa");
      const selectedCompany = getSelectedCompany(identForm.companyId);
      if (!selectedCompany) throw new Error("Empresa pai não encontrada");

      await createSubClientWithParentCompany({
        data: {
          companyName: selectedCompany.name,
          companyCnpj: selectedCompany.cnpj || undefined,
          name: identForm.name,
          phone: identForm.phone || contactPhone,
          email: identForm.email || undefined,
          notes: identForm.notes || undefined,
          ticketId: currentTicket?.id,
          originalPhone: contactPhone || undefined,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: async () => {
      toast.success("Sub-cliente cadastrado com sucesso");
      setIdentModalOpen(false);
      setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
      queryClient.invalidateQueries({ queryKey: ["sub-client-lookup"] });
      queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
      await refetchTicket();
      retryPendenciaCreation();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao cadastrar sub-cliente"),
  });

  // CRM categories (for PJ)
  const { data: crmCategories = [] } = useQuery({
    queryKey: ["crm-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_categories").select("id, name").order("name");
      return data || [];
    },
    staleTime: 60_000,
  });

  const createCrmCategoryMutation = useMutation({
    mutationFn: async () => {
      const name = crmCategoryDraft.trim();
      if (!name) throw new Error("Informe o nome da categoria");
      const { error } = await supabase.from("crm_categories").insert({ name, description: "" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      setCrmCategoryDraft("");
      queryClient.invalidateQueries({ queryKey: ["crm-categories"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar categoria"),
  });

  const updateCrmCategoryMutation = useMutation({
    mutationFn: async () => {
      const name = editingCrmCategoryName.trim();
      if (!editingCrmCategoryId || !name) throw new Error("Informe o nome da categoria");
      const { error } = await supabase.from("crm_categories").update({ name }).eq("id", editingCrmCategoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria atualizada");
      setEditingCrmCategoryId(null);
      setEditingCrmCategoryName("");
      queryClient.invalidateQueries({ queryKey: ["crm-categories"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar categoria"),
  });

  const deleteCrmCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_categories").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Categoria removida");
      if (identForm.categoryId === id) setIdentForm((f) => ({ ...f, categoryId: "" }));
      queryClient.invalidateQueries({ queryKey: ["crm-categories"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover categoria"),
  });

  // Create CRM contact mutation
  const createCrmContactMutation = useMutation({
    mutationFn: async () => {
      if (!identForm.name) throw new Error("Preencha o nome");
      const selectedCompany = identForm.companyId ? getSelectedCompany(identForm.companyId) : null;

      await createCrmContactWithCompany({
        data: {
          companyName: selectedCompany?.name || identForm.companyNameInput || undefined,
          companyCnpj: selectedCompany?.cnpj || identForm.cnpj || undefined,
          name: identForm.name,
          phone: identForm.phone || contactPhone,
          email: identForm.email || undefined,
          notes: identForm.notes || undefined,
          ticketId: currentTicket?.id,
          contactType: identForm.contactType,
          categoryId: identForm.contactType === "PJ" ? (identForm.categoryId || undefined) : undefined,
          contractItems: identForm.contactType === "PJ" ? identForm.items.filter(i => i.categoryId) : undefined,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: async () => {
      toast.success("Contato CRM cadastrado com sucesso");
      setIdentModalOpen(false);
      setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
      queryClient.invalidateQueries({ queryKey: ["crm-contact-lookup"] });
      queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
      await refetchTicket();
      retryPendenciaCreation();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao cadastrar contato CRM"),
  });

  // Link company directly (for "vincular" tab)
  const linkCompanyDirectMutation = useMutation({
    mutationFn: async (selectedValue: string) => {
      const selectedCompany = getSelectedCompany(selectedValue);
      if (!selectedCompany) throw new Error("Empresa não encontrada");

      await linkPhoneToCompany({
        data: {
          companyName: selectedCompany.name,
          companyCnpj: selectedCompany.cnpj || undefined,
          phone: contactPhone,
          ticketId: currentTicket?.id,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: async () => {
      toast.success("Número vinculado à empresa");
      setIdentModalOpen(false);
      setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
      queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
      await refetchTicket();
      retryPendenciaCreation();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao vincular"),
  });

  // Service ticket for this attendance
  const { data: currentTicket, refetch: refetchTicket, isFetched: currentTicketFetched } = useQuery({
    queryKey: ["service-ticket", selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return null;
      const { data } = await supabase
        .from("service_tickets")
        .select("*")
        .eq("attendance_id", selectedChatId)
        .neq("status", "finalizado")
        .order("created_at", { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!selectedChatId && isAuthenticated,
  });

// CRM contact lookup by phone (also checks ticket's corrected phone)
  const { data: crmContactLookup, isFetched: crmContactLookupFetched } = useQuery({
    queryKey: ["crm-contact-lookup", contactPhone, currentTicket?.contact_phone],
    queryFn: async () => {
      const phones = [contactPhone, currentTicket?.contact_phone].filter(Boolean) as string[];
      if (phones.length === 0) return null;
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select("*, companies(name)");
      if (!contacts) return null;
      const match = contacts.find((c: any) =>
        phones.some((p) => phonesMatch(c.phone, p))
      );
      return match || null;
    },
    enabled: (!!contactPhone || !!currentTicket?.contact_phone) && !companyLookup && !subClientLookup && isAuthenticated,
  });

  // Group chats never require client identification
  const isGroup = isGroupChat(chatDetail);

  // Identification modal — only for contacts without any existing link (and not groups).
  // Wait for ALL lookups to settle before deciding (otherwise modal flashes open while data loads).
  const lookupsReady = companyLookupFetched && subClientLookupFetched && crmContactLookupFetched && currentTicketFetched;
  const isUnidentified = lookupsReady && !isGroup && !!chatDetail && !!contactPhone && !companyLookup && !subClientLookup && !crmContactLookup && !currentTicket?.company_id;

  // Auto-open identification modal when contact is unidentified
  useEffect(() => {
    if (isUnidentified && selectedChatId && !identModalDismissed[selectedChatId]) {
      setIdentModalOpen(true);
    }
  }, [isUnidentified, selectedChatId, identModalDismissed]);

  const retryPendenciaCreation = useCallback(async () => {
    const ticket = currentTicket;
    if (!ticket || ticket.pendencia_key || !selectedChatId) return;
    try {
      const authHeaders = await getAuthHeaders();
      const { data: freshTicket } = await supabase
        .from("service_tickets")
        .select("*")
        .eq("id", ticket.id)
        .single();
      if (!freshTicket || freshTicket.pendencia_key) return;

      const pendResult = await createPendenciaFromAtendimento({
        data: {
          attendanceId: selectedChatId,
          contactPhone: contactPhone || undefined,
          contactName: chatDetail?.contact?.name || chatDetail?.description || undefined,
          companyId: freshTicket.company_id || undefined,
          plate: freshTicket.plate || ticketPlate || undefined,
        },
        ...authHeaders,
      });

      if (pendResult?.success && pendResult.pendenciaKey) {
        await supabase
          .from("service_tickets")
          .update({ pendencia_key: pendResult.pendenciaKey } as any)
          .eq("id", ticket.id);
        console.log("[Retry] Pendência created:", pendResult.pendenciaKey);
        toast.success("Pendência criada no GSystem");
        refetchTicket();
      } else {
        console.warn("[Retry] Pendência creation failed:", pendResult?.message);
      }
    } catch (err: any) {
      console.error("[Retry] Error creating pendência:", err.message);
    }
  }, [currentTicket, selectedChatId, contactPhone, chatDetail, ticketPlate, getAuthHeaders, refetchTicket]);


  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChatId || !chatDetail) return;
      const { data: existing } = await supabase
        .from("service_tickets")
        .select("id")
        .eq("attendance_id", selectedChatId)
        .neq("status", "finalizado")
        .limit(1);
      if (existing && existing.length > 0) return;

      const { data: sess } = await supabase.auth.getSession();
      const { data: ticket, error } = await supabase.from("service_tickets").insert({
        attendance_id: selectedChatId,
        channel_id: selectedChannelId || null,
        company_id: companyLookup?.id || null,
        contact_phone: contactPhone || null,
        contact_name: chatDetail.contact?.name || chatDetail.description || null,
        plate: ticketPlate || null,
        status: "aberto" as const,
        opened_by: sess.session?.user?.id || null,
      }).select("id").single();

      if (error) {
        console.error("[Ticket] Error creating ticket:", error.message);
        return;
      }

      // Create pendência in GSystem
      try {
        const authHeaders = await getAuthHeaders();
        const pendResult = await createPendenciaFromAtendimento({
          data: {
            attendanceId: selectedChatId,
            contactPhone: contactPhone || undefined,
            contactName: chatDetail.contact?.name || chatDetail.description || undefined,
            companyId: companyLookup?.id || undefined,
            subClientId: subClientLookup?.id || undefined,
            crmContactId: crmContactLookup?.id || undefined,
            plate: ticketPlate || undefined,
          },
          ...authHeaders,
        });

        if (pendResult?.success && pendResult.pendenciaKey && ticket?.id) {
          await supabase
            .from("service_tickets")
            .update({ pendencia_key: pendResult.pendenciaKey } as any)
            .eq("id", ticket.id);
          console.log("[Ticket] Pendência created:", pendResult.pendenciaKey);
        } else {
          console.warn("[Ticket] Pendência creation failed:", pendResult?.message);
        }
      } catch (err: any) {
        console.error("[Ticket] Error creating pendência:", err.message);
      }
    },
    onSuccess: () => refetchTicket(),
  });

  // NOTE: Tickets are no longer auto-created when a chat is opened.
  // The atendimento (service_ticket) is created on demand only when the chat
  // is finalized (see finalizeMutation around line ~1349). This keeps the
  // "Atendimentos" list clean of in-progress conversations.
  // The createTicketMutation above is still available if a manual trigger is added later.

  // Update ticket plate
  const updatePlateMutation = useMutation({
    mutationFn: async (plate: string) => {
      if (!currentTicket) return;
      await supabase
        .from("service_tickets")
        .update({ plate: plate || null })
        .eq("id", currentTicket.id);
    },
    onSuccess: () => {
      refetchTicket();
      toast.success("Placa atualizada");
    },
  });

  // Plate history: other tickets with same plate
  const activePlate = currentTicket?.plate || ticketPlate;
  const { data: plateHistory = [] } = useQuery({
    queryKey: ["plate-history", activePlate],
    queryFn: async () => {
      if (!activePlate) return [];
      const { data } = await supabase
        .from("service_tickets")
        .select("*, companies(name)")
        .eq("plate", activePlate)
        .neq("attendance_id", selectedChatId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!activePlate && isAuthenticated,
  });

  // All companies: GSystem clients (synced with Contatos menu)
  const { data: allCompanies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["gsystem-clientes-for-linking"],
    queryFn: async () => {
      // Fetch GSystem clients and local companies in parallel
      const [gsystemResult, localResult] = await Promise.all([
        getClientes({
          data: {},
          ...await getAuthHeaders(),
        }).catch(() => null),
        supabase.from("companies").select("id, name, cnpj").order("name"),
      ]);

      const gsystemClients = Array.isArray(gsystemResult)
        ? gsystemResult
        : gsystemResult?.data || gsystemResult?.Data || [];

      const fromGsystem = gsystemClients
        .map((c: any) => {
          const name = String(c.Nome || c.nome || c.RazaoSocial || c.razaoSocial || c.NomeFantasia || c.nomeFantasia || "").trim();
          const cnpj = String(c.CpfCnpj || c.cpfCnpj || c.CNPJ || c.cnpj || "").replace(/\D/g, "");
          const fantasia = String(c.NomeFantasia || c.nomeFantasia || "").trim();
          const value = cnpj ? `cnpj:${cnpj}` : name ? `nome:${name.toLowerCase()}` : "";

          return {
            value,
            name: name || fantasia,
            cnpj,
            fantasia,
            source: "gsystem" as const,
          };
        })
        .filter((c: any) => c.value && c.name);

      const fromLocal = (localResult.data || []).map((c: any) => {
        const name = String(c.name || "").trim();
        const cnpj = String(c.cnpj || "").replace(/\D/g, "");
        const value = cnpj ? `cnpj:${cnpj}` : name ? `nome:${name.toLowerCase()}` : "";
        return {
          value,
          name,
          cnpj,
          fantasia: "",
          source: "local" as const,
        };
      }).filter((c: any) => c.value && c.name);

      // Dedupe — by value AND by normalized name (catches duplicates without CNPJ)
      const merged: any[] = [];
      const seenValues = new Set<string>();
      const seenNames = new Set<string>();
      const normName = (n: string) =>
        n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

      for (const c of [...fromGsystem, ...fromLocal]) {
        const nameKey = normName(c.name);
        if (seenValues.has(c.value)) continue;
        if (nameKey && seenNames.has(nameKey)) continue;
        seenValues.add(c.value);
        if (nameKey) seenNames.add(nameKey);
        merged.push(c);
      }

      return merged;
    },
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  // Link company to ticket
  const linkCompanyMutation = useMutation({
    mutationFn: async (selectedValue: string) => {
      const selectedCompany = getSelectedCompany(selectedValue);
      if (!selectedCompany) throw new Error("Empresa não encontrada");

      await linkPhoneToCompany({
        data: {
          companyName: selectedCompany.name,
          companyCnpj: selectedCompany.cnpj || undefined,
          phone: contactPhone,
          ticketId: currentTicket?.id,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      refetchTicket();
      queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
      toast.success("Empresa vinculada ao chamado");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao vincular empresa"),
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedChatId]);

  // Send message (or whisper)
  const sendMutation = useMutation({
    mutationFn: async ({
      text,
      whisper,
      replyToMessageId,
    }: { text: string; whisper: boolean; replyToMessageId?: string | null }) => {
      if (whisper) {
        // Whisper: persist locally only, never sent to client via Z-API
        const { data: chatRow } = await supabase
          .from("zapi_chats")
          .select("id")
          .eq("channel_id", selectedChannelId)
          .eq("phone", contactPhone)
          .maybeSingle();
        if (!chatRow) {
          throw new Error("Sussurro indisponível: este chat ainda não está vinculado a um chat Z-API local.");
        }
        // Snapshot da citação (se houver)
        let replyToText: string | null = null;
        let replyToAuthor: string | null = null;
        if (replyToMessageId) {
          const { data: orig } = await supabase
            .from("zapi_messages")
            .select("text, media_type, from_me, sent_by_user_id, participant_name")
            .eq("id", replyToMessageId)
            .maybeSingle();
          if (orig) {
            replyToText = (orig as any).text
              ? String((orig as any).text).slice(0, 200)
              : (orig as any).media_type
                ? `[${(orig as any).media_type}]`
                : "[mídia]";
            replyToAuthor = (orig as any).from_me
              ? "Você"
              : (orig as any).participant_name || null;
          }
        }
        const { error } = await supabase.from("zapi_messages").insert({
          chat_id: chatRow.id,
          from_me: true,
          is_whisper: true,
          whisper_author: session?.user?.id || null,
          text,
          status: "sent",
          reply_to_message_id: replyToMessageId || null,
          reply_to_text: replyToText,
          reply_to_author: replyToAuthor,
        });
        if (error) throw error;
        return { whisper: true };
      }
      return sendText({
        data: {
          channelId: selectedChannelId,
          chatId: selectedChatId,
          message: text,
          replyToMessageId: replyToMessageId || undefined,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: (_data, vars) => {
      setMessageInput("");
      setReplyingTo(null);
      toast.success(vars.whisper ? "Sussurro registrado" : "Mensagem enviada");
      queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ["zapi-messages"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao enviar mensagem"),
  });

  // Delete a sent message for everyone (Z-API)
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return deleteMessage({
        data: { messageId },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      toast.success("Mensagem apagada para todos");
      queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ["zapi-messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao apagar mensagem"),
  });

  // Send media (audio / image / video / document)
  const mediaMutation = useMutation({
    mutationFn: async (input: {
      kind: "audio" | "image" | "video" | "document";
      dataUrl: string;
      fileName?: string;
      caption?: string;
      extension?: string;
    }) => {
      if (!selectedChatId) throw new Error("Selecione uma conversa");
      return sendMedia({
        data: { chatId: selectedChatId, ...input },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: (_d, vars) => {
      const labels: Record<string, string> = {
        audio: "Áudio enviado",
        image: "Imagem enviada",
        video: "Vídeo enviado",
        document: "Documento enviado",
      };
      toast.success(labels[vars.kind] || "Mídia enviada");
      queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ["zapi-messages"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao enviar mídia"),
  });

  // File picker handler (attach button) — adds to preview queue instead of sending directly
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachmentCaption, setAttachmentCaption] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  const queueAttachment = (file: File) => {
    if (!file) return false;
    if (file.size > 15 * 1024 * 1024) {
      toast.error(`"${file.name}" excede o limite de 15 MB`);
      return false;
    }
    setPendingAttachments((prev) => [...prev, file]);
    return true;
  };

  const handleFilePicked = (file: File) => {
    queueAttachment(file);
  };

  const removePendingAttachment = (idx: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearPendingAttachments = () => {
    setPendingAttachments([]);
    setAttachmentCaption("");
  };

  const sendPendingAttachments = async () => {
    if (pendingAttachments.length === 0) return;
    const files = [...pendingAttachments];
    const caption = attachmentCaption.trim();
    // Close preview immediately for snappy UX; toast on errors per file
    clearPendingAttachments();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const kind: "image" | "video" | "audio" | "document" =
          file.type.startsWith("image/") ? "image" :
          file.type.startsWith("video/") ? "video" :
          file.type.startsWith("audio/") ? "audio" :
          "document";
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onerror = () => reject(r.error);
          r.onload = () => resolve(String(r.result || ""));
          r.readAsDataURL(file);
        });
        await mediaMutation.mutateAsync({
          kind,
          dataUrl,
          fileName: file.name,
          extension: ext,
          // Apply caption only on the first attachment to avoid repetition
          caption: i === 0 && caption ? caption : undefined,
        });
      } catch (err: any) {
        toast.error(err?.message || `Erro ao enviar "${file.name}"`);
      }
    }
  };

  // Finalize chat
  const finalizeMutation = useMutation({
    mutationFn: async ({ notes, status, tipoPendencia, skipClosingMessage: skipMsg, escalateGestao }: { notes?: string; status?: string; tipoPendencia?: string; skipClosingMessage?: boolean; escalateGestao?: boolean } = {}) => {
      // Resolve category label antecipadamente para inserir já com a categoria correta
      let resolvedCategoryLabel: string | null = null;
      if (tipoPendencia) {
        const found = tiposPendencia.find((t) => t.Key === tipoPendencia);
        resolvedCategoryLabel = found?.Descricao || tipoPendencia;
      }

      let ticketForProtocol = currentTicket;
      if (!ticketForProtocol && selectedChatId && chatDetail) {
        const { data: existing } = await supabase
          .from("service_tickets")
          .select("*")
          .eq("attendance_id", selectedChatId)
          .neq("status", "finalizado")
          .order("created_at", { ascending: false })
          .limit(1);
        if (existing && existing.length > 0) {
          ticketForProtocol = existing[0] as any;
        } else {
          // IMPORTANTE: criar o ticket já como finalizado para evitar que conversas
          // em andamento (que não chegaram a clicar em "Finalizar") apareçam na
          // lista de Atendimentos como "aberto". O ticket só é persistido ao
          // confirmar a finalização — nunca antes.
          const { data: sess } = await supabase.auth.getSession();
          const nowIso = new Date().toISOString();
          const { data: created, error: createErr } = await supabase
            .from("service_tickets")
            .insert({
              attendance_id: selectedChatId,
              channel_id: selectedChannelId || null,
              company_id: companyLookup?.id || null,
              contact_phone: contactPhone || null,
              contact_name: chatDetail.contact?.name || chatDetail.description || null,
              plate: ticketPlate || null,
              status: "finalizado" as const,
              category: resolvedCategoryLabel,
              notes: notes || null,
              opened_by: sess.session?.user?.id || null,
              closed_at: nowIso,
            })
            .select("*")
            .single();
          if (createErr) console.error("[Finalize] Failed to create protocol ticket:", createErr.message);
          else ticketForProtocol = created as any;
        }
      }
      // Wrap all pre-finalization steps so that failures (pendência, ticket update,
      // routing rules, etc.) NEVER block the actual chat finalization. The user
      // clicked "Finalizar" — the chat MUST be closed regardless of side-effects.
      try {
      const activeTicket = currentTicket || ticketForProtocol;
      if (activeTicket) {
        let pendenciaKey = activeTicket.pendencia_key;

        // If no pendência exists yet, create one now before finalizing
        if (!pendenciaKey) {
          try {
            const authHeaders = await getAuthHeaders();
            const pendResult = await createPendenciaFromAtendimento({
              data: {
                attendanceId: selectedChatId,
                contactPhone: contactPhone || undefined,
                contactName: chatDetail?.contact?.name || chatDetail?.description || undefined,
                companyId: activeTicket.company_id || undefined,
                plate: activeTicket.plate || ticketPlate || undefined,
                notes: notes || undefined,
                tipoPendencia: tipoPendencia || undefined,
                status: status || undefined,
              },
              ...authHeaders,
            });
            if (pendResult?.success && pendResult.pendenciaKey) {
              pendenciaKey = pendResult.pendenciaKey;
              await supabase
                .from("service_tickets")
                .update({ pendencia_key: pendenciaKey } as any)
                .eq("id", activeTicket.id);
              console.log("[Finalize] Created missing pendência:", pendenciaKey);
            } else {
              console.warn("[Finalize] Could not create pendência:", pendResult?.message);
            }
          } catch (err: any) {
            console.error("[Finalize] Error creating pendência on finalize:", err.message);
          }
        }

        // Conclude pendência in GSystem if status is "Resolvido"
        if (pendenciaKey && status === "Resolvido") {
          try {
            const authHeaders = await getAuthHeaders();
            await concluirPendencia({
              data: {
                pendenciaKey: pendenciaKey,
                notes: notes || undefined,
              },
              ...authHeaders,
            });
            console.log("[Finalize] Pendência concluded:", pendenciaKey);
          } catch (err: any) {
            console.warn("[Finalize] Error concluding pendência:", err.message);
          }
        }

        // O ticket recém-criado já foi inserido como "finalizado" com categoria.
        // Aqui só atualizamos quando havia um ticket pré-existente (currentTicket
        // ou existing), garantindo que ele transite corretamente para finalizado.
        const wasJustCreated =
          ticketForProtocol && ticketForProtocol.id === activeTicket.id && activeTicket.status === "finalizado";
        if (!wasJustCreated) {
          await supabase
            .from("service_tickets")
            .update({
              status: "finalizado" as const,
              closed_at: new Date().toISOString(),
              notes: notes || activeTicket.notes || null,
              category: resolvedCategoryLabel || activeTicket.category || null,
            })
            .eq("id", activeTicket.id);
        }
      }
      // Check if this category triggers a service flow
      if (tipoPendencia) {
        try {
          const { data: matchingFlows } = await supabase
            .from("service_flows")
            .select("id, name")
            .eq("is_active", true)
            .contains("trigger_categories", [tipoPendencia]);

          if (matchingFlows && matchingFlows.length > 0) {
            const flow = matchingFlows[0];
            // Get the first step of this flow
            const { data: steps } = await supabase
              .from("service_flow_steps")
              .select("id, step_name, sector_name")
              .eq("flow_id", flow.id)
              .order("step_order", { ascending: true })
              .limit(1);

            const firstStep = steps?.[0];

            // Create flow instance
            const { data: instance } = await supabase
              .from("attendance_flow_instances")
              .insert({
                flow_id: flow.id,
                attendance_id: selectedChatId,
                current_step_id: firstStep?.id || null,
                status: "em_andamento" as const,
              })
              .select("id")
              .single();

            // Create history entry
            if (instance) {
              await supabase.from("attendance_flow_history").insert({
                attendance_flow_instance_id: instance.id,
                to_step_id: firstStep?.id || null,
                movement_reason: `Fluxo ativado automaticamente pela categoria "${tipoPendencia}"`,
              });
            }

            toast.success(
              `Fluxo "${flow.name}" ativado — encaminhado para ${firstStep?.sector_name || "próximo setor"}`,
              { duration: 5000 }
            );
          }
        } catch (err: any) {
          console.error("[Finalize] Error checking/creating flow:", err.message);
        }
      }

      // Check category routing rules for auto-forwarding
      if (tipoPendencia) {
        try {
          const { data: routingRules } = await supabase
            .from("category_routing_rules")
            .select("*")
            .eq("category_key", tipoPendencia)
            .eq("is_active", true);

          if (routingRules && routingRules.length > 0) {
            const rule = routingRules[0];
            const phone = contactPhone?.replace(/\D/g, "") || "";
            const isGSystemSector = !rule.target_sector_id.includes("-"); // UUIDs have dashes, GSystem IDs don't

            if (rule.target_sector_id) {
              try {
                let newAttendanceId: string | null = null;

                // Only create GSystem chat for individual contacts with phone.
                // Groups have no single contact phone — skip GSystem chat creation
                // but still create the local routed ticket below.
                if (isGSystemSector && phone && !isGroup) {
                  const authH = await getAuthHeaders();
                  const newChat = await createChat({
                    data: {
                      channelId: selectedChannelId,
                      contactPhone: phone,
                      message: `Encaminhamento automático — Categoria: ${rule.category_label || tipoPendencia}`,
                      sectorId: rule.target_sector_id,
                    },
                    ...authH,
                  });
                  newAttendanceId = newChat?.attendanceId || null;
                }

                // Create service ticket for the routed attendance (works for both
                // individual contacts and groups).
                if (rule.auto_create_ticket) {
                  await supabase.from("service_tickets").insert({
                    attendance_id: newAttendanceId || `auto-${Date.now()}`,
                    contact_phone: phone || null,
                    contact_name: chatDetail?.contact?.name || chatDetail?.description || null,
                    company_id: currentTicket?.company_id || null,
                    channel_id: selectedChannelId,
                    opened_by: session?.user?.id || null,
                    status: "aberto",
                    sector: rule.target_sector_name || null,
                    category: rule.category_label || tipoPendencia || null,
                    notes: `Encaminhado automaticamente do ${isGroup ? "grupo" : "atendimento"} ${selectedChatId} — ${rule.category_label}`,
                  });
                }

                toast.success(
                  `Atendimento encaminhado para o setor ${rule.target_sector_name || rule.target_sector_id}`,
                  { duration: 5000 }
                );
              } catch (routeErr: any) {
                console.error("[Finalize] Error creating routed chat:", routeErr.message);
                toast.error(`Erro ao encaminhar para ${rule.target_sector_name}: ${routeErr.message}`);
              }
            }
          }
        } catch (err: any) {
          console.error("[Finalize] Error checking routing rules:", err.message);
        }
      }

      // Send closing message with protocol number before finalizing
      // Admins can opt out via skipClosingMessage to silently close.
      if (!skipMsg) {
        const protocolNumber = formatTicketProtocol(ticketForProtocol, chatDetail?.protocol || selectedChatId);
        // Busca template editável; cai para o padrão se ainda não houver registro
        let templateContent = `Seu atendimento foi finalizado e desde já agradecemos pela atenção.\n\nSe você precisar de suporte no futuro, fique à vontade para falar conosco.\n\nTenha um ótimo dia!\n\nProtocolo desse atendimento: {protocolo}\n\nEsta é uma mensagem automática e não precisa responder.`;
        try {
          const { data: tpl } = await supabase
            .from("zapi_message_templates" as any)
            .select("content")
            .eq("key", "finalizacao")
            .maybeSingle();
          if (tpl && (tpl as any).content) templateContent = (tpl as any).content;
        } catch (e) {
          console.warn("[Finalize] Failed to load template, using default", e);
        }
        const closingMessage = applyQuickReplyVars(templateContent, {
          operatorName: profile?.name,
          contactName: chatDetail?.contact?.name || chatDetail?.description,
          protocol: String(protocolNumber),
        });
        try {
          const authH = await getAuthHeaders();
          await sendText({
            data: {
              channelId: selectedChannelId,
              chatId: selectedChatId,
              message: closingMessage,
            },
            ...authH,
          });
          console.log("[Finalize] Closing message sent successfully");
        } catch (err: any) {
          console.warn("[Finalize] Error sending closing message:", err.message);
        }
      } else {
        console.log("[Finalize] Skipping closing message (admin opt-out)");
      }

      // CSAT — pesquisa de satisfação após finalização
      // Respeita o opt-out do admin: se "Finalizar sem enviar mensagem" foi marcado,
      // não envia nem a mensagem de encerramento nem a pesquisa CSAT.
      if (skipMsg) {
        console.log("[Finalize] Skipping CSAT (admin opt-out)");
      } else {
      try {
        const { data: csat } = await supabase
          .from("csat_settings" as any)
          .select("is_enabled, message")
          .maybeSingle();
        if (csat && (csat as any).is_enabled && (csat as any).message && contactPhone) {
          const csatMsg = (csat as any).message as string;
          const phoneOnly = String(contactPhone).replace(/\D/g, "");
          const authH2 = await getAuthHeaders();
          await sendText({
            data: {
              channelId: selectedChannelId,
              chatId: selectedChatId,
              message: csatMsg,
            },
            ...authH2,
          });
          // registra pendência para o webhook capturar a resposta
          await supabase.from("csat_pending" as any).insert({
            channel_id: selectedChannelId,
            chat_id: selectedChatId,
            phone: phoneOnly,
            contact_name: chatDetail?.contact?.name || chatDetail?.description || null,
            ticket_id: ticketForProtocol?.id || null,
            protocol: ticketForProtocol ? formatTicketProtocol(ticketForProtocol, chatDetail?.protocol || selectedChatId) : null,
            operator_user_id: user?.id || null,
            operator_name: profile?.name || null,
          });
        }
      } catch (csatErr: any) {
        console.warn("[Finalize] CSAT step failed:", csatErr?.message);
      }
      }
      } catch (preErr: any) {
        console.error("[Finalize] pre-finalization step failed (continuing to close chat):", preErr?.message);
      }

      // Always finalize the Z-API chat at the end, regardless of any prior errors.
      // The user clicked "Finalizar" — the chat MUST leave the Central de Atendimento.
      try {
        await finalizeChat({
          data: { channelId: selectedChannelId, chatId: selectedChatId },
          ...await getAuthHeaders(),
        });
      } catch (err: any) {
        console.error("[Finalize] finalizeChat failed, forcing local close:", err?.message);
        // Hard fallback: close the chat row directly so it disappears from the list
        try {
          await supabase
            .from("zapi_chats")
            .update({ status: "finalizado", assigned_to: null })
            .eq("id", selectedChatId);
        } catch (e: any) {
          console.error("[Finalize] direct close also failed:", e?.message);
        }
      }
      return { success: true, ticketId: ticketForProtocol?.id || null, escalateGestao: !!escalateGestao };
    },
    onSuccess: async (result) => {
      // Ensure a local ticket exists (covers groups / race conditions where
      // auto-create didn't finish before the user clicked "Finalizar").
      // IMPORTANT: do NOT filter by status here — the mutationFn just set it
      // to "finalizado", and we want to re-route THAT same ticket.
      let ticketRef = currentTicket;
      if (result?.ticketId) {
        const { data } = await supabase
          .from("service_tickets")
          .select("*")
          .eq("id", result.ticketId)
          .maybeSingle();
        if (data) ticketRef = data as any;
      }
      if (!ticketRef && selectedChatId) {
        try {
          const { data: existing } = await supabase
            .from("service_tickets")
            .select("*")
            .eq("attendance_id", selectedChatId)
            .order("created_at", { ascending: false })
            .limit(1);
          if (existing && existing.length > 0) {
            ticketRef = existing[0] as any;
          } else {
            // Fallback: o ticket NÃO foi criado pela mutation principal (race
            // ou cenário de grupo). Cria já como "finalizado" para evitar deixar
            // tickets "aberto" sem categoria na lista de Atendimentos.
            const { data: sess } = await supabase.auth.getSession();
            const nowIso = new Date().toISOString();
            const { data: created, error: createErr } = await supabase
              .from("service_tickets")
              .insert({
                attendance_id: selectedChatId,
                channel_id: selectedChannelId || null,
                company_id: companyLookup?.id || null,
                contact_phone: contactPhone || null,
                contact_name: chatDetail?.contact?.name || chatDetail?.description || null,
                plate: ticketPlate || null,
                status: "finalizado" as const,
                opened_by: sess.session?.user?.id || null,
                closed_at: nowIso,
              })
              .select("*")
              .single();
            if (createErr) {
              console.error("[Finalize] Failed to create fallback ticket:", createErr.message);
            } else {
              ticketRef = created as any;
              console.log("[Finalize] Created fallback ticket:", (created as any)?.id);
            }
          }
        } catch (e: any) {
          console.error("[Finalize] Fallback ticket creation error:", e?.message);
        }
      }

      // Apply auto-routing flow (TE / category rules) on the local ticket
      if (ticketRef) {
        try {
          const fresh = await supabase
            .from("service_tickets")
            .select("*")
            .eq("id", ticketRef.id)
            .single();
          const ticket = fresh.data || ticketRef;
          const res = await finalizeTicketWithFlow({
            ticket,
            userId: session?.user?.id || null,
            teSettings,
            registerStatusComment: false,
            // Sempre aplicar encaminhamento configurado, inclusive para admins
            bypassRouting: false,
          });
          if (res.routed && res.routedTo) {
            toast.success(`Encaminhado para ${res.routedTo.sector}`);
            if (res.syncError) toast.error("Falha GSystem: " + res.syncError);
            else if (res.syncedToGsystem) toast.success("Sincronizado com GSystem");
          }
        } catch (e: any) {
          console.warn("[Finalize] post-flow error:", e?.message);
        }
      }
      // Save Liberação items if applicable
      if (ticketRef && liberacaoItems.length > 0) {
        try {
          const rows = liberacaoItems.map((it) => ({
            ticket_id: ticketRef!.id,
            item_id: it.item_id,
            item_name: it.item_name,
            quantity: it.quantity,
            status: "pendente" as const,
          }));
          await supabase.from("ticket_liberacao_items" as any).insert(rows);
          if (liberacaoDate) {
            await supabase
              .from("service_tickets")
              .update({ liberacao_date: new Date(liberacaoDate).toISOString() } as any)
              .eq("id", ticketRef.id);
          }
        } catch (e: any) {
          console.error("[Finalize] error saving liberacao items:", e?.message);
        }
      }

      // Escalonamento para Gestão (admin)
      if (result?.escalateGestao) {
        try {
          const { data: cfg } = await supabase
            .from("escalation_gestao_settings" as any)
            .select("*")
            .limit(1)
            .maybeSingle();
          const sectorName = (cfg as any)?.target_sector_name || "Gestão";
          const defaultNotes = (cfg as any)?.default_notes || "Atendimento escalado para análise da Gestão";
          const defaultCategory = (cfg as any)?.default_category || "Escalado para Gestão";
          const sourceTicket = ticketRef;
          const protocolBase = sourceTicket
            ? formatTicketProtocol(sourceTicket as any, chatDetail?.protocol || selectedChatId)
            : (chatDetail?.protocol || selectedChatId);

          const { error: insErr } = await supabase.from("service_tickets").insert({
            attendance_id: `gestao-${Date.now()}`,
            channel_id: selectedChannelId || null,
            company_id: sourceTicket?.company_id || companyLookup?.id || null,
            contact_phone: contactPhone || null,
            contact_name: chatDetail?.contact?.name || chatDetail?.description || null,
            plate: sourceTicket?.plate || ticketPlate || null,
            status: "aberto" as const,
            opened_by: session?.user?.id || null,
            sector: sectorName,
            category: defaultCategory,
            notes: `${defaultNotes}\n\nProtocolo de origem: ${protocolBase}`,
            escalated_to_gestao: true,
            escalated_from_ticket_id: sourceTicket?.id || null,
          } as any);
          if (insErr) {
            console.error("[Escalonar] erro ao criar ticket de gestão:", insErr.message);
            toast.error("Falha ao escalar para Gestão: " + insErr.message);
          } else {
            // marca o ticket de origem
            if (sourceTicket?.id) {
              await supabase
                .from("service_tickets")
                .update({ escalated_to_gestao: true } as any)
                .eq("id", sourceTicket.id);
            }
            toast.success(`Atendimento escalado para o setor ${sectorName}`);
          }
        } catch (e: any) {
          console.error("[Escalonar] exceção:", e?.message);
          toast.error("Erro ao escalar para Gestão");
        }
      }

      toast.success("Atendimento finalizado");
      setSelectedChatId("");
      setShowFinalizeConfirm(false);
      setFinalizeNotes("");
      setFinalizeStatus("A resolver");
      setFinalizeTipoPendencia("");
      setTeData(EMPTY_TESTE_EQUIPAMENTO);
      setLiberacaoItems([]);
      setLiberacaoDate("");
      setSkipClosingMessage(false);
      setEscalateToGestao(false);
      refetchChats();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao finalizar"),
  });

  // Transfer chat mutation
  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChatId || (!transferSectorId && !transferUserId)) {
        throw new Error("Selecione um setor ou usuário para transferir");
      }
      return transferChat({
        data: {
          channelId: selectedChannelId,
          chatId: selectedChatId,
          sectorId: transferSectorId || undefined,
          userId: transferUserId || undefined,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      toast.success("Chat transferido com sucesso");
      setShowTransferModal(false);
      setTransferSectorId("");
      setTransferUserId("");
      refetchChats();
      queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao transferir"),
  });

  // Create new chat
  const createChatMutation = useMutation({
    mutationFn: async () => {
      return createChat({
        data: {
          channelId: selectedChannelId,
          contactPhone: newChatPhone.replace(/\D/g, ""),
          message: newChatMessage || undefined,
          sectorId: newChatSector || undefined,
        },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      const who = newChatPickedContact?.name;
      toast.success(who ? `Conversa iniciada com ${who}` : "Nova conversa criada");
      setShowNewChatModal(false);
      setNewChatPhone("");
      setNewChatMessage("");
      setNewChatSector("");
      setNewChatPickedContact(null);
      setNewChatTab("saved");
      refetchChats();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar conversa"),
  });

  const handleSend = () => {
    if (!messageInput.trim() || !selectedChatId) return;
    const operatorName = profile?.name?.trim();
    const text =
      nicknameMode && !whisperMode && operatorName
        ? `*${operatorName}:* ${messageInput.trim()}`
        : messageInput.trim();
    sendMutation.mutate({
      text,
      whisper: whisperMode,
      replyToMessageId: replyingTo?.id || null,
    });
  };

  // Quick replies disponíveis para expansão de atalhos digitados (ex: /bd)
  const { data: quickRepliesAll = [] } = useQuery({
    queryKey: ["zapi-quick-replies"],
    queryFn: async () => {
      const { data } = await supabase.from("zapi_quick_replies").select("*").order("shortcut");
      return data || [];
    },
  });

  const expandShortcutInText = (text: string): string | null => {
    // Detecta um atalho /xxx isolado (no fim ou seguido de espaço) e substitui pelo conteúdo
    const match = text.match(/(^|\s)(\/[A-Za-z0-9_-]+)\s*$/);
    if (!match) return null;
    const shortcut = match[2].toLowerCase();
    const reply = quickRepliesAll.find((r: any) => (r.shortcut || "").toLowerCase() === shortcut);
    if (!reply) return null;
    const resolved = applyQuickReplyVars(reply.content || "", {
      operatorName: profile?.name,
      contactName: chatDetail?.contact?.name || chatDetail?.description,
      protocol: currentTicket?.protocol_number != null ? formatTicketProtocol(currentTicket) : "",
    });
    return text.slice(0, match.index! + match[1].length) + resolved;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === " " || e.key === "Tab") && messageInput.trim().startsWith("/")) {
      const expanded = expandShortcutInText(messageInput);
      if (expanded !== null) {
        e.preventDefault();
        setMessageInput(expanded);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Tenta expandir um atalho pendente antes de enviar
      const expanded = expandShortcutInText(messageInput);
      if (expanded !== null) {
        setMessageInput(expanded);
        return;
      }
      handleSend();
    }
  };

  // AI Assistant send
  const handleAiSend = async (autoMessage?: string) => {
    const msg = autoMessage || aiInput.trim();
    if (!msg || aiLoading) return;
    if (!aiEnabled) {
      // Assistant is disabled in admin settings — silently skip to avoid
      // the recurring "Assistente desativado" toast on every chat open.
      return;
    }
    const userMsg = { role: "user" as const, content: msg };
    const newMsgs = [...aiMessages, userMsg];
    setAiMessages(newMsgs);
    if (!autoMessage) setAiInput("");
    setAiLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            chatMessages: messages,
            contactPhone,
            contactName: chatDetail?.contact?.name || chatDetail?.description || "",
            attendanceStartTime: chatDetail?.utcDhStartChat || null,
            userMessage: msg,
          }),
        }
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const ct = parsed.choices?.[0]?.delta?.content;
            if (ct) {
              assistantContent += ct;
              setAiMessages([...newMsgs, { role: "assistant", content: assistantContent }]);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      if (!assistantContent) {
        setAiMessages([...newMsgs, { role: "assistant", content: "Sem resposta." }]);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar IA");
      setAiMessages([...newMsgs, { role: "assistant", content: `Erro: ${err.message}` }]);
    }
    setAiLoading(false);
  };

  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Auto-trigger AI supervisor analysis when chat changes and has messages
  const lastAutoAnalyzedChat = useRef<string>("");
  useEffect(() => {
    if (
      selectedChatId &&
      messages.length > 0 &&
      !aiLoading &&
      aiEnabled &&
      lastAutoAnalyzedChat.current !== selectedChatId
    ) {
      lastAutoAnalyzedChat.current = selectedChatId;
      setAiMessages([]);
      handleAiSend("Analise a conversa atual e dê instruções diretas sobre como o operador deve proceder agora.");
    }
  }, [selectedChatId, messages.length > 0, aiEnabled]);

  const serviceTimeMinutes = chatDetail?.utcDhStartChat
    ? Math.round((Date.now() - new Date(chatDetail.utcDhStartChat).getTime()) / 60000)
    : null;

  if (authLoading || !isAuthenticated) return null;

  const noChannels = channels.length === 0;
  const statusInfo = chatDetail ? STATUS_MAP[chatDetail.status ?? -1] || { label: `Status ${chatDetail.status}`, color: "" } : null;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex items-center gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Central de Atendimento</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {allChats.length} atendimento(s) ativo(s) • {onlineAgents} agente(s) online
              </p>
            </div>
            <MyAttendanceKpis />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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
          <div className="flex gap-2 sm:gap-3 h-[calc(100vh-12rem)] relative">
            {/* Toggle left panel button (when collapsed) */}
            {!showLeftPanel && (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-8 w-8 self-start mt-1"
                onClick={() => setShowLeftPanel(true)}
                title="Mostrar lista de conversas"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}

            {/* Mobile backdrop when left panel is open */}
            {showLeftPanel && isMobile && (
              <div
                className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30 md:hidden"
                onClick={() => setShowLeftPanel(false)}
              />
            )}

            {/* Chat list */}
            {showLeftPanel && (
            <div className="w-[85vw] max-w-sm md:w-72 lg:w-80 shrink-0 border rounded-lg flex flex-col bg-card overflow-hidden relative max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-xl max-md:rounded-none">
              <div className="p-3 border-b space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7"
                    onClick={() => setShowLeftPanel(false)}
                    title="Ocultar lista de conversas"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar nome ou telefone..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className={showFilters ? "bg-accent" : ""}>
                    <Filter className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={() => setShowNewChatModal(true)} title="Nova conversa">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {showFilters && (
                  <div className="space-y-2 pt-1">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="0">Automático</SelectItem>
                        <SelectItem value="1">Aguardando</SelectItem>
                        <SelectItem value="2">Em atendimento</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sectorFilter} onValueChange={setSectorFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Setor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os setores</SelectItem>
                        {sectors.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name || s.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={agentFilter} onValueChange={setAgentFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Agente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os agentes</SelectItem>
                        {gsystemUsers.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(statusFilter !== "all" || sectorFilter !== "all" || agentFilter !== "all") && (
                      <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => { setStatusFilter("all"); setSectorFilter("all"); setAgentFilter("all"); }}>
                        <X className="h-3 w-3 mr-1" /> Limpar filtros
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <ChatQueueList
                chats={filteredChats}
                selectedChatId={selectedChatId}
                onSelectChat={setSelectedChatId}
                isLoading={chatsLoading}
                totalChats={allChats.length}
                onlineAgents={onlineAgents}
                getSlaColor={getSlaColor}
                formatServiceTime={formatServiceTime}
              />
            </div>
            )}

            {/* Chat area */}
            <div
              className="flex-1 min-w-0 border rounded-lg flex flex-col bg-card overflow-hidden relative"
              onDragEnter={(e) => {
                if (!selectedChatId || whisperMode || chatDetail?.status === 3) return;
                if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
                e.preventDefault();
                dragCounterRef.current += 1;
                setIsDraggingFile(true);
              }}
              onDragOver={(e) => {
                if (!selectedChatId || whisperMode || chatDetail?.status === 3) return;
                if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                if (!isDraggingFile) return;
                e.preventDefault();
                dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
                if (dragCounterRef.current === 0) setIsDraggingFile(false);
              }}
              onDrop={(e) => {
                if (!selectedChatId || whisperMode || chatDetail?.status === 3) return;
                const files = Array.from(e.dataTransfer?.files || []);
                if (files.length === 0) return;
                e.preventDefault();
                dragCounterRef.current = 0;
                setIsDraggingFile(false);
                files.forEach((f) => queueAttachment(f));
              }}
            >
              {isDraggingFile && selectedChatId && !whisperMode && chatDetail?.status !== 3 && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Paperclip className="h-10 w-10" />
                    <p className="text-sm font-semibold">Solte para anexar</p>
                    <p className="text-xs text-muted-foreground">Você poderá revisar antes de enviar</p>
                  </div>
                </div>
              )}
              {!selectedChatId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MessageSquare className="h-12 w-12" />
                  <p className="text-sm">Selecione uma conversa para visualizar</p>
                </div>
              ) : (
                <>
                  {/* Chat header — barra essencial + cascata expansível */}
                  <div className="border-b bg-muted/30">
                    {/* Linha 1: identidade + ações primárias */}
                    <div className="p-2 sm:p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {!showLeftPanel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-7 w-7 md:hidden"
                            onClick={() => setShowLeftPanel(true)}
                            title="Mostrar lista"
                          >
                            <PanelLeftOpen className="h-4 w-4" />
                          </Button>
                        )}
                        <Avatar className="h-9 w-9 shrink-0">
                          {chatDetail?.contact?.linkImage &&
                            !chatDetail.contact.linkImage.includes("avatar-default") && (
                              <AvatarImage src={chatDetail.contact.linkImage} />
                            )}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(chatDetail?.description || chatDetail?.contact?.name || "?").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {chatDetail?.description || chatDetail?.contact?.name || "Contato"}
                          </p>
                          {assignedOperator && (
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <UserCircle2 className="h-3 w-3" />
                              <span>Operador: <span className="font-medium text-foreground">{assignedOperator}</span></span>
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground truncate">
                              {chatDetail?.contact?.secondaryName || chatDetail?.contact?.number}
                              {currentTicket?.protocol_number != null && ` • #${formatTicketProtocol(currentTicket)}`}
                            </p>
                            {companyLookup && (
                              <Badge variant="secondary" className="text-[10px] gap-1 max-w-[160px]">
                                <Building2 className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{companyLookup.name}</span>
                              </Badge>
                            )}
                            {/* Resumo dos controles quando recolhido */}
                            {!headerExpanded && statusInfo && (
                              <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                                {statusInfo.label}
                              </Badge>
                            )}
                            {!headerExpanded && detectedPlates.length > 0 && (
                              <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700">
                                🚗 {detectedPlates[detectedPlates.length - 1]}
                              </Badge>
                            )}
                          </div>
                          {localZapiChat?.id && (
                            <div className="mt-1.5">
                              <ChatTags
                                chatRowId={localZapiChat.id}
                                initialTags={(localZapiChat.tags as unknown as ChatTag[]) || []}
                                size="xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && (
                          <Button
                            variant={escalateToGestao ? "default" : "outline"}
                            size="sm"
                            title={
                              escalateToGestao
                                ? "Ao finalizar, abrirá novo atendimento para o setor Gestão (clique para desativar)"
                                : "Marcar para escalar este atendimento para o setor Gestão ao finalizar"
                            }
                            onClick={() => {
                              setEscalateToGestao((v) => {
                                const next = !v;
                                if (next) toast.info("Ao finalizar, será aberto um chamado para o setor Gestão.");
                                else toast.message("Escalonamento para Gestão cancelado.");
                                return next;
                              });
                            }}
                            className={`gap-1 h-8 ${escalateToGestao ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                          >
                            <ShieldAlert className="h-4 w-4" />
                            <span className="hidden sm:inline">Gestão</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          title={isUnidentified ? "Identifique o contato antes de finalizar" : "Finalizar atendimento"}
                          onClick={() => {
                            if (isUnidentified) {
                              toast.error("É obrigatório identificar o contato antes de finalizar o atendimento.");
                              return;
                            }
                            if (!finalizeTipoPendencia) {
                              toast.error("Selecione a categoria do atendimento antes de finalizar.");
                              setHeaderExpanded(true);
                              return;
                            }
                            const tipoLabel = tiposPendencia.find((t) => t.Key === finalizeTipoPendencia)?.Descricao || "";
                            if (isTesteEquipamentoCategory(tipoLabel, teSettings)) {
                              setShowTeDialog(true);
                              return;
                            }
                            if (isLiberacaoCategory(tipoLabel)) {
                              setShowLiberacaoDialog(true);
                              return;
                            }
                            setShowFinalizeConfirm(true);
                          }}
                          disabled={finalizeMutation.isPending}
                          className="gap-1 h-8"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Finalizar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2"
                          onClick={() => setHeaderExpanded((v) => !v)}
                          title={headerExpanded ? "Recolher controles" : "Mostrar controles"}
                          aria-expanded={headerExpanded}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          {headerExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Linha 2: controles secundários em cascata */}
                    {headerExpanded && (
                      <div className="px-2 sm:px-3 pb-2 pt-0 flex items-center gap-1 flex-wrap border-t border-border/40">
                        {/* Operador responsável */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] gap-1"
                              title="Clique para alterar o operador responsável"
                            >
                              <UserPlus className="h-3 w-3" />
                              <span className="text-muted-foreground">Resp.:</span>
                              <strong className="font-bold">
                                {(chatDetail as any)?.assignedFirstName || "atribuir"}
                              </strong>
                              <ChevronsUpDown className="ml-0.5 h-3 w-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[240px] p-0" align="end">
                            <Command>
                              <CommandInput placeholder="Buscar operador..." className="text-xs h-8" />
                              <CommandList>
                                <CommandEmpty className="text-xs py-3 text-center">
                                  Nenhum operador encontrado
                                </CommandEmpty>
                                <CommandGroup heading="Atribuir responsável">
                                  {gsystemUsersList.map((op: any) => {
                                    const isCurrent = (chatDetail as any)?.assignedUserId === op.id;
                                    return (
                                      <CommandItem
                                        key={op.id}
                                        value={op.name || op.id}
                                        onSelect={async () => {
                                          if (isCurrent) return;
                                          try {
                                            await transferChat({
                                              data: {
                                                channelId: selectedChannelId,
                                                chatId: selectedChatId!,
                                                userId: op.id,
                                              },
                                              ...(await getAuthHeaders()),
                                            });
                                            toast.success(`Atendimento atribuído a ${op.name}`);
                                            queryClient.invalidateQueries({
                                              queryKey: ["chat-detail", selectedChannelId, selectedChatId],
                                            });
                                            refetchChats();
                                          } catch (e: any) {
                                            toast.error(e?.message || "Erro ao alterar responsável");
                                          }
                                        }}
                                        className="text-xs"
                                      >
                                        <Check
                                          className={`mr-2 h-3 w-3 ${isCurrent ? "opacity-100" : "opacity-0"}`}
                                        />
                                        {op.name || "Sem nome"}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {(() => {
                          const detail = chatDetail as any;
                          const respId = detail?.assignedUserId;
                          const coAgents: Array<{ userId: string }> = detail?.coAgents || [];
                          const canJoin = !!user?.id && !!respId && respId !== user.id && !coAgents.some((a) => a.userId === user.id);
                          if (!canJoin) return null;
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={async () => {
                                try {
                                  await joinChatAsCoAgent({ data: { chatId: selectedChatId! }, ...(await getAuthHeaders()) });
                                  toast.success("Você entrou na conversa como co-atendente");
                                  queryClient.invalidateQueries({ queryKey: ["chat-detail", selectedChannelId, selectedChatId] });
                                } catch (e: any) {
                                  toast.error(e?.message || "Erro ao entrar");
                                }
                              }}
                            >
                              <UserPlus className="h-3 w-3 mr-1" /> Entrar
                            </Button>
                          );
                        })()}
                        {statusInfo && (
                          <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        )}
                        {detectedPlates.length > 0 && (
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                            🚗 {detectedPlates[detectedPlates.length - 1]}
                          </Badge>
                        )}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-[180px] h-7 text-xs justify-between">
                              {finalizeTipoPendencia
                                ? (() => {
                                    const found = tiposPendencia.find((t) => t.Key === finalizeTipoPendencia);
                                    return found ? (found.Descricao || "Sem nome") : "Categoria...";
                                  })()
                                : (tiposPendenciaError ? "Erro ao carregar" : "Categoria...")}
                              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[220px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar categoria..." className="text-xs h-8" />
                              <CommandList>
                                <CommandEmpty className="text-xs py-3 text-center">Nenhuma categoria encontrada</CommandEmpty>
                                <CommandGroup>
                                  {tiposPendencia.map((tipo) => {
                                    const key = tipo.Key || "";
                                    const label = tipo.Descricao || "Sem nome";
                                    return (
                                      <CommandItem
                                        key={key}
                                        value={label}
                                        onSelect={() => setFinalizeTipoPendencia(key)}
                                        className="text-xs"
                                      >
                                        <Check className={`mr-2 h-3 w-3 ${finalizeTipoPendencia === key ? "opacity-100" : "opacity-0"}`} />
                                        {label}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          title="Transferir"
                          onClick={() => setShowTransferModal(true)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Transferir
                        </Button>
                      </div>
                    )}
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
                        const isErased = msg.text === "🚫 Mensagem apagada";
                        const canDelete =
                          isMe && !isPrivate && !isErased && !!(msg as any).zapiMessageId;

                        if (isSystem) {
                          return (
                            <div key={msg.IdMessage || idx} className="text-center my-2">
                              <Badge variant="secondary" className="text-xs font-normal">
                                {msg.text}
                              </Badge>
                            </div>
                          );
                        }

                        const canReply = !isErased && !!msg.IdMessage;

                        return (
                          <div
                            key={msg.IdMessage || idx}
                            id={msg.IdMessage ? `msg-${msg.IdMessage}` : undefined}
                            className={`group flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            {(canReply || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                                    title="Opções da mensagem"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isMe ? "end" : "start"}>
                                  {canReply && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const snippet = (msg.text || (msg.mediaType ? `[${msg.mediaType}]` : "[mídia]")).slice(0, 200);
                                        const author = isMe
                                          ? (msg.senderFirstName || "Você")
                                          : (msg.senderName || chatDetail?.contact?.name || chatDetail?.description || "");
                                        setReplyingTo({
                                          id: msg.IdMessage as string,
                                          text: snippet,
                                          author,
                                        });
                                      }}
                                    >
                                      <Reply className="h-4 w-4 mr-2" />
                                      Responder
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        if (confirm("Apagar esta mensagem para todos? Esta ação não pode ser desfeita."))
                                          deleteMessageMutation.mutate(msg.IdMessage as string);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Apagar para todos
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <div
                              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                                isErased
                                  ? "bg-muted/50 text-muted-foreground italic border border-dashed"
                                  : isPrivate
                                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : isMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {msg.replyTo && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!msg.replyTo?.id) return;
                                    const el = document.getElementById(`msg-${msg.replyTo.id}`);
                                    if (el) {
                                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                                      el.classList.add("ring-2", "ring-primary");
                                      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
                                    }
                                  }}
                                  className={`block w-full text-left mb-1.5 rounded border-l-2 px-2 py-1 text-xs hover:opacity-80 transition-opacity ${
                                    isMe
                                      ? "border-primary-foreground/60 bg-primary-foreground/10"
                                      : "border-primary bg-background/60"
                                  }`}
                                >
                                  <div className="flex items-center gap-1 font-semibold opacity-80">
                                    <CornerDownRight className="h-3 w-3" />
                                    {msg.replyTo.author || "Mensagem"}
                                  </div>
                                  <div className="opacity-70 truncate whitespace-pre-wrap line-clamp-2">
                                    {msg.replyTo.text || "[mensagem]"}
                                  </div>
                                </button>
                              )}
                              {!isMe && msg.senderName && (
                                <p className="text-xs font-medium mb-1 opacity-70">{msg.senderName}</p>
                              )}
                              {isMe && (msg.senderFirstName || !isPrivate) && (
                                <p className="text-xs mb-1">
                                  <strong className="font-bold">{msg.senderFirstName || "Você"}</strong>
                                  {msg.isCoAgent && msg.responsibleFirstName && (
                                    <span className="opacity-80 font-normal"> · via co-atendimento (responsável: {msg.responsibleFirstName})</span>
                                  )}
                                </p>
                              )}
                              {isPrivate && (
                                <p className="text-[10px] font-medium mb-1 opacity-60">🔒 Nota privada</p>
                              )}
                              {msg.mediaUrl && (
                                <div className="mb-1">
                                  <MessageMediaContent mediaUrl={msg.mediaUrl} mediaType={msg.mediaType} />
                                </div>
                              )}
                              {msg.text && (
                                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                              )}
                              <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                {msg.dhMessage || msg.utcDhMessage ? (
                                  <span className="text-[10px]">
                                    {formatTime(msg.dhMessage || msg.utcDhMessage)}
                                  </span>
                                ) : null}
                                {isMe && !isPrivate && (
                                  <MessageStatusTicks status={msg._status} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {isContactTyping && (
                        <TypingIndicator name={chatDetail?.contact?.name || chatDetail?.description} />
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-3 border-t space-y-2">
                    {replyingTo && (
                      <div className="flex items-start gap-2 rounded-md border-l-4 border-primary bg-muted/60 px-3 py-2">
                        <Reply className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-primary">
                            Respondendo a {replyingTo.author || "mensagem"}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
                            {replyingTo.text}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setReplyingTo(null)}
                          title="Cancelar resposta"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="shrink-0"
                            title="Opções de mensagem"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuLabel>Opções de envio</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                            checked={whisperMode}
                            onCheckedChange={(v) => {
                              setWhisperMode(!!v);
                              if (v) setNicknameMode(false);
                            }}
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Enviar sussurro
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setQuickRepliesOpen(true); }}>
                            <Zap className="h-4 w-4 mr-2" />
                            Respostas rápidas
                          </DropdownMenuItem>
                          <DropdownMenuCheckboxItem
                            checked={nicknameMode}
                            onCheckedChange={(v) => {
                              setNicknameMode(!!v);
                              if (v) setWhisperMode(false);
                            }}
                            disabled={!profile?.name}
                          >
                            <AtSign className="h-4 w-4 mr-2" />
                            Interagir com apelido
                          </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <QuickRepliesPopover
                        hideTrigger
                        open={quickRepliesOpen}
                        onOpenChange={setQuickRepliesOpen}
                        onPick={(text) => {
                          const resolved = applyQuickReplyVars(text, {
                            operatorName: profile?.name,
                            contactName: chatDetail?.contact?.name || chatDetail?.description,
                            protocol: currentTicket?.protocol_number != null ? formatTicketProtocol(currentTicket) : "",
                          });
                          setMessageInput((prev) => prev ? `${prev} ${resolved}` : resolved);
                        }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFilePicked(f);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        type="button"
                        title="Anexar arquivo"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={mediaMutation.isPending || chatDetail?.status === 3 || whisperMode}
                      >
                        {mediaMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Paperclip className="h-4 w-4" />
                        )}
                      </Button>
                      <AudioRecorderButton
                        disabled={mediaMutation.isPending || chatDetail?.status === 3 || whisperMode}
                        onRecorded={async (dataUrl) =>
                          mediaMutation.mutateAsync({ kind: "audio", dataUrl })
                        }
                      />
                      <EmojiPickerButton
                        disabled={sendMutation.isPending || chatDetail?.status === 3}
                        onPick={(emoji: string) => setMessageInput((prev) => `${prev}${emoji}`)}
                      />
                      <Textarea
                        placeholder={whisperMode ? "Sussurro interno (não vai para o cliente). Shift+Enter para nova linha." : "Digite uma mensagem... (Shift+Enter para nova linha, Ctrl+V para colar arquivos)"}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={(e) => {
                          if (whisperMode || chatDetail?.status === 3) return;
                          const items = e.clipboardData?.items;
                          if (!items || items.length === 0) return;
                          const files: File[] = [];
                          for (let i = 0; i < items.length; i++) {
                            const it = items[i];
                            if (it.kind === "file") {
                              const f = it.getAsFile();
                              if (f) files.push(f);
                            }
                          }
                          if (files.length === 0) return;
                          e.preventDefault();
                          files.forEach((f) => queueAttachment(f));
                        }}
                        disabled={sendMutation.isPending || chatDetail?.status === 3}
                        rows={1}
                        className={`flex-1 min-h-[36px] resize-none py-2 overflow-y-auto ${whisperMode ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
                      />
                      <Button
                        onClick={handleSend}
                        disabled={!messageInput.trim() || sendMutation.isPending || chatDetail?.status === 3}
                        size="icon"
                        className={whisperMode ? "bg-amber-500 hover:bg-amber-600" : ""}
                      >
                        {sendMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile backdrop when right panel is open */}
            {showRightPanel && isMobile && (
              <div
                className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30 md:hidden"
                onClick={() => setShowRightPanel(false)}
              />
            )}

            {/* Right panel with tabs */}
            {showRightPanel ? (
            <div className="w-[85vw] max-w-sm md:w-72 xl:w-80 shrink-0 border rounded-lg bg-card overflow-hidden flex flex-col relative max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:shadow-xl max-md:rounded-none">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 z-10 h-7 w-7"
                onClick={() => setShowRightPanel(false)}
                title="Ocultar painel de detalhes"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
              {!chatDetail ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  <div className="text-center">
                    <User className="h-8 w-8 mx-auto mb-2" />
                    <p>Detalhes do contato</p>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="empresa" className="flex flex-col flex-1 overflow-hidden">
                  <TabsList className="w-full rounded-none border-b shrink-0">
                    <TabsTrigger value="empresa" className="flex-1 text-xs">
                      <Building2 className="h-3 w-3 mr-1" /> Empresa
                    </TabsTrigger>
                    <TabsTrigger value="contato" className="flex-1 text-xs">
                      <User className="h-3 w-3 mr-1" /> Contato
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="flex-1 text-xs">
                      <History className="h-3 w-3 mr-1" /> Histórico
                    </TabsTrigger>
                    {aiEnabled && (
                      <TabsTrigger value="ia" className="flex-1 text-xs">
                        <Bot className="h-3 w-3 mr-1" /> Supervisor IA
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {/* Empresa Tab */}
                  <TabsContent value="empresa" className="flex-1 overflow-auto m-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        {companyLookup && !changingCompany ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold text-foreground">{companyLookup.name}</h3>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7"
                                onClick={() => setChangingCompany(true)}
                              >
                                <ArrowRightLeft className="h-3 w-3 mr-1" /> Alterar
                              </Button>
                            </div>

                            {companyLookup.cnpj && (
                              <DetailRow label="CNPJ" value={companyLookup.cnpj} />
                            )}

                            {companyLookup.instructions && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Instruções de Atendimento
                                </p>
                                <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                  <p className="text-sm text-amber-900 whitespace-pre-wrap">
                                    {companyLookup.instructions}
                                  </p>
                                </div>
                              </div>
                            )}

                            {companyLookup.emails && (companyLookup.emails as string[]).length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">E-mails</p>
                                <div className="mt-1 space-y-1">
                                  {(companyLookup.emails as string[]).map((email: string, i: number) => (
                                    <p key={i} className="text-sm text-foreground">{email}</p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {companyLookup.contacts && (companyLookup.contacts as any[]).length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Contatos da Empresa</p>
                                <div className="mt-1 space-y-2">
                                  {(companyLookup.contacts as any[]).map((c: any, i: number) => (
                                    <div key={i} className="text-sm bg-muted/50 rounded p-2">
                                      <p className="font-medium text-foreground">{c.name}</p>
                                      {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {companyLookup.phone && (
                              <DetailRow label="Telefone principal" value={companyLookup.phone} />
                            )}

                            {companyLookup.notes && (
                              <DetailRow label="Observações" value={companyLookup.notes} />
                            )}
                          </>
                        ) : (
                          <div className="space-y-3">
                            {changingCompany && companyLookup ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    <p className="text-sm font-medium">Alterar empresa</p>
                                  </div>
                                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setChangingCompany(false)}>
                                    <X className="h-3 w-3 mr-1" /> Cancelar
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Atualmente vinculado a <strong>{companyLookup.name}</strong>. Selecione outra empresa:
                                </p>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <AlertCircle className="h-4 w-4" />
                                  <p className="text-sm">Cliente não identificado</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  O número {contactPhone || "deste contato"} não está vinculado a nenhuma empresa.
                                </p>
                              </>
                            )}
                            <Separator />
                            <p className="text-xs font-medium text-foreground">Vincular a uma empresa:</p>
                            <Select
                              onValueChange={(companyId) => {
                                linkCompanyMutation.mutate(companyId);
                                setChangingCompany(false);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecionar empresa..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allCompanies.map((c: any) => (
                                  <SelectItem key={c.value} value={c.value}>{c.name}{c.fantasia && c.fantasia !== c.name ? ` (${c.fantasia})` : ""}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button variant="outline" size="sm" className="w-full" asChild>
                              <a href="/empresas">
                                <Building2 className="h-3 w-3 mr-1" /> Cadastrar nova empresa
                              </a>
                            </Button>
                          </div>
                        )}

                        {/* Plate field */}
                        <Separator />
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Placa do Veículo</p>
                          <div className="flex gap-2">
                            <Input
                              value={ticketPlate}
                              onChange={(e) => setTicketPlate(e.target.value.toUpperCase())}
                              placeholder="ABC1D23"
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updatePlateMutation.mutate(ticketPlate)}
                              disabled={updatePlateMutation.isPending}
                            >
                              Salvar
                            </Button>
                          </div>
                          {detectedPlates.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-[10px] text-muted-foreground">Detectadas:</span>
                              {detectedPlates.map((p) => (
                                <Badge
                                  key={p}
                                  variant="outline"
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => setTicketPlate(p)}
                                >
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Contato Tab */}
                  <TabsContent value="contato" className="flex-1 overflow-auto m-0">
                    <ScrollArea className="h-full">
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
                          {editingContactName ? (
                            <div className="mt-3 flex items-center gap-1 justify-center">
                              <Input
                                value={contactNameDraft}
                                onChange={(e) => setContactNameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveContactName();
                                  if (e.key === "Escape") setEditingContactName(false);
                                }}
                                placeholder="Nome do contato"
                                maxLength={120}
                                autoFocus
                                className="h-8 text-sm max-w-[220px]"
                                disabled={savingContactName}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={handleSaveContactName}
                                disabled={savingContactName}
                                title="Salvar"
                              >
                                {savingContactName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setEditingContactName(false)}
                                disabled={savingContactName}
                                title="Cancelar"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-3 flex items-center gap-1 justify-center group">
                              <h3 className="font-medium text-foreground">
                                {chatDetail.contact?.name || chatDetail.description || "Contato"}
                              </h3>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-60 hover:opacity-100"
                                onClick={() => {
                                  setContactNameDraft(chatDetail.contact?.name || chatDetail.description || "");
                                  setEditingContactName(true);
                                }}
                                title="Alterar nome do contato"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {chatDetail.contact?.number && (
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {chatDetail.contact.secondaryName || chatDetail.contact.number}
                            </p>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          {currentTicket?.protocol_number != null && (
                            <DetailRow label="Protocolo" value={`#${formatTicketProtocol(currentTicket)}`} mono />
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
                          {chatDetail.utcDhStartChat && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Início</p>
                              <p className="text-sm mt-1 flex items-center gap-1 text-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(chatDetail.utcDhStartChat).toLocaleString("pt-BR")}
                              </p>
                            </div>
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

                          <Separator />
                          <DetailRow label="Mensagens" value={`${messages.length} mensagem(ns)`} />
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Histórico Tab */}
                  <TabsContent value="historico" className="flex-1 overflow-auto m-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium text-foreground">
                            Histórico de Atendimentos
                          </p>
                        </div>

                        {activePlate ? (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Chamados com a placa <Badge variant="outline" className="text-xs">{activePlate}</Badge>
                            </p>
                            {plateHistory.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">
                                Nenhum atendimento anterior para esta placa.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {plateHistory.map((ticket: any) => (
                                  <div key={ticket.id} className="border rounded-md p-3 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-foreground">
                                        {ticket.contact_name || "Sem nome"}
                                      </p>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] ${
                                          ticket.status === "finalizado"
                                            ? "border-muted text-muted-foreground"
                                            : ticket.status === "em_andamento"
                                            ? "border-emerald-300 text-emerald-700"
                                            : "border-amber-300 text-amber-700"
                                        }`}
                                      >
                                        {ticket.status}
                                      </Badge>
                                    </div>
                                    {ticket.companies?.name && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Building2 className="h-3 w-3" /> {ticket.companies.name}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(ticket.created_at).toLocaleDateString("pt-BR")} — {ticket.plate}
                                    </p>
                                    {ticket.notes && (
                                      <p className="text-xs text-foreground mt-1">{ticket.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">Nenhuma placa identificada</p>
                            <p className="text-xs mt-1">
                              Informe uma placa na aba "Empresa" ou aguarde a detecção automática nas mensagens.
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* IA Tab */}
                  <TabsContent value="ia" className="flex-1 overflow-hidden m-0 flex flex-col">
                    {/* Service time badge */}
                    {serviceTimeMinutes !== null && (
                      <div className={`px-3 py-2 border-b flex items-center gap-2 text-xs ${serviceTimeMinutes > 15 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>
                        <Timer className="h-3 w-3" />
                        <span className="font-medium">Tempo de atendimento: {serviceTimeMinutes} min</span>
                        {serviceTimeMinutes > 15 && <span>⚠️ Acima do ideal</span>}
                      </div>
                    )}

                    {/* AI Messages */}
                    <ScrollArea className="flex-1">
                      <div className="p-3 space-y-3">
                        {aiMessages.length === 0 && !aiLoading && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-medium">Supervisor IA</p>
                            <p className="text-[10px] mt-1">
                              A IA analisa automaticamente a conversa e instrui você sobre como proceder.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 text-xs"
                              onClick={() => handleAiSend("Analise a conversa atual e dê instruções diretas sobre como devo proceder agora.")}
                              disabled={aiLoading || messages.length === 0}
                            >
                              <Bot className="h-3 w-3 mr-1" /> Analisar Conversa
                            </Button>
                          </div>
                        )}
                        {aiMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              {msg.role === "assistant" ? (
                                <div className="prose prose-xs max-w-none dark:prose-invert [&_p]:text-xs [&_li]:text-xs [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              ) : (
                                <p>{msg.content}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {aiLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted rounded-lg px-3 py-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                            </div>
                          </div>
                        )}
                        <div ref={aiChatEndRef} />
                      </div>
                    </ScrollArea>

                    {/* AI Input */}
                    <div className="border-t p-2 shrink-0 space-y-1">
                      <div className="flex gap-1">
                        <Input
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          placeholder="Pergunte à IA..."
                          className="text-xs h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleAiSend();
                            }
                          }}
                        />
                        <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleAiSend()} disabled={aiLoading || !aiInput.trim()}>
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-[10px] h-6"
                        onClick={() => handleAiSend("Reavalie a conversa atualizada e dê novas instruções diretas sobre como proceder.")}
                        disabled={aiLoading || messages.length === 0}
                      >
                        <Bot className="h-3 w-3 mr-1" /> Reanalisar conversa
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-8 w-8 self-start mt-1"
                onClick={() => setShowRightPanel(true)}
                title="Mostrar painel de detalhes"
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Identification Modal */}
      <Dialog open={identModalOpen} onOpenChange={(open) => { if (!open) { setIdentModalOpen(false); setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true })); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Cliente não identificado
            </DialogTitle>
            <DialogDescription>
              O número <strong>{contactPhone}</strong> não está vinculado a nenhum cliente. Escolha uma ação ou feche para continuar sem identificar.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={identTab} onValueChange={(v) => setIdentTab(v as any)} className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="vincular" className="flex-1 text-xs">
                <LinkIcon className="h-3 w-3 mr-1" /> Vincular
              </TabsTrigger>
              <TabsTrigger value="vincular-sub" className="flex-1 text-xs">
                <LinkIcon className="h-3 w-3 mr-1" /> Vincular Sub
              </TabsTrigger>
              <TabsTrigger value="subcliente" className="flex-1 text-xs">
                <UserPlus className="h-3 w-3 mr-1" /> Novo Sub
              </TabsTrigger>
              <TabsTrigger value="crm" className="flex-1 text-xs">
                <UserPlus className="h-3 w-3 mr-1" /> CRM
              </TabsTrigger>
            </TabsList>

            {/* Vincular a empresa existente */}
            <TabsContent value="vincular" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Vincule este número a uma empresa já cadastrada.
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa por nome..."
                  className="pl-8"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
              </div>
              {companiesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...
                </div>
              ) : (() => {
                const filtered = allCompanies.filter((c: any) => {
                  if (!companySearch) return true;
                  const term = companySearch.toLowerCase();
                  return c.name?.toLowerCase().includes(term) || c.fantasia?.toLowerCase().includes(term) || c.cnpj?.includes(term);
                });
                return filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma empresa encontrada.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                    {filtered.slice(0, 50).map((c: any) => (
                      <button
                        key={c.value}
                        onClick={() => linkCompanyDirectMutation.mutate(c.value)}
                        disabled={linkCompanyDirectMutation.isPending}
                        className="w-full text-left p-2 rounded text-sm hover:bg-accent/50 transition-colors"
                      >
                        <p className="font-medium">{c.name}</p>
                        {c.fantasia && c.fantasia !== c.name && (
                          <p className="text-xs text-muted-foreground">{c.fantasia}</p>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {linkCompanyDirectMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Vinculando...
                </div>
              )}
            </TabsContent>


            {/* Vincular a sub-cliente existente */}
            <TabsContent value="vincular-sub" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Vincule este número a um sub-cliente já cadastrado.
              </p>
              <SubClientLinker
                contactPhone={contactPhone}
                ticketId={currentTicket?.id}
                onSuccess={async () => {
                  setIdentModalOpen(false);
                  setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
                  queryClient.invalidateQueries({ queryKey: ["sub-client-lookup"] });
                  queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
                  await refetchTicket();
                  retryPendenciaCreation();
                }}
              />
            </TabsContent>

            {/* Criar sub-cliente */}
            <TabsContent value="subcliente" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Cadastre como sub-cliente de uma empresa existente.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Empresa pai *</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa..."
                      className="pl-8"
                      value={identForm.companyId ? (allCompanies.find((c: any) => c.value === identForm.companyId)?.name || "") : companySearch}
                      onChange={(e) => {
                        setCompanySearch(e.target.value);
                        if (identForm.companyId) setIdentForm((f) => ({ ...f, companyId: "" }));
                      }}
                    />
                  </div>
                  {!identForm.companyId && companySearch && !companiesLoading && (
                    <div className="max-h-32 overflow-y-auto space-y-0.5 border rounded-md p-1 mt-1">
                      {allCompanies
                        .filter((c: any) => {
                          const term = companySearch.toLowerCase();
                          return c.name?.toLowerCase().includes(term) || c.fantasia?.toLowerCase().includes(term);
                        })
                        .slice(0, 30)
                        .map((c: any) => (
                          <button
                            key={c.value}
                            onClick={() => {
                              setIdentForm((f) => ({ ...f, companyId: c.value }));
                              setCompanySearch("");
                            }}
                            className="w-full text-left p-1.5 rounded text-xs hover:bg-accent/50 transition-colors"
                          >
                            {c.name}{c.fantasia && c.fantasia !== c.name ? ` (${c.fantasia})` : ""}
                          </button>
                        ))}
                    </div>
                  )}
                  {identForm.companyId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ✓ <strong>{allCompanies.find((c: any) => c.value === identForm.companyId)?.name}</strong>
                      <button className="ml-2 text-xs underline" onClick={() => setIdentForm((f) => ({ ...f, companyId: "" }))}>trocar</button>
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={identForm.name} onChange={(e) => setIdentForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome do contato" />
                </div>
                <div>
                  <Label className="text-xs">Contato (Telefone)</Label>
                  <Input value={identForm.phone} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={identForm.email} onChange={(e) => setIdentForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea rows={2} value={identForm.notes} onChange={(e) => setIdentForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createSubClientMutation.mutate()}
                disabled={!identForm.name || !identForm.companyId || createSubClientMutation.isPending}
              >
                {createSubClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Cadastrar Sub-cliente
              </Button>
            </TabsContent>

            {/* Cadastrar no CRM */}
            <TabsContent value="crm" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Cadastre como novo contato no CRM.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Tipo de pessoa *</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={identForm.contactType === "PF" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setIdentForm((f) => ({ ...f, contactType: "PF", categoryId: "" }))}
                    >
                      PF · Pessoa Física
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={identForm.contactType === "PJ" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setIdentForm((f) => ({ ...f, contactType: "PJ" }))}
                    >
                      PJ · Pessoa Jurídica
                    </Button>
                  </div>
                </div>
                {identForm.contactType === "PJ" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Categoria (PJ)</Label>
                    <Select
                      value={identForm.categoryId || "none"}
                      onValueChange={(v) => setIdentForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {crmCategories.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Nenhuma categoria cadastrada
                          </div>
                        ) : (
                          crmCategories.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <div className="rounded-md border border-border p-2 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={crmCategoryDraft}
                          onChange={(e) => setCrmCategoryDraft(e.target.value)}
                          placeholder="Nova categoria PJ"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => createCrmCategoryMutation.mutate()}
                          disabled={!crmCategoryDraft.trim() || createCrmCategoryMutation.isPending}
                          title="Criar categoria"
                        >
                          {createCrmCategoryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {crmCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 py-1">
                            <Tag className="h-3 w-3" /> Nenhuma categoria cadastrada
                          </p>
                        ) : (
                          crmCategories.map((c: any) => (
                            <div key={c.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent/50">
                              {editingCrmCategoryId === c.id ? (
                                <>
                                  <Input
                                    value={editingCrmCategoryName}
                                    onChange={(e) => setEditingCrmCategoryName(e.target.value)}
                                    className="h-7 text-xs"
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => updateCrmCategoryMutation.mutate()}
                                    disabled={!editingCrmCategoryName.trim() || updateCrmCategoryMutation.isPending}
                                    title="Salvar categoria"
                                  >
                                    {updateCrmCategoryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => { setEditingCrmCategoryId(null); setEditingCrmCategoryName(""); }}
                                    title="Cancelar edição"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="flex-1 truncate text-left text-xs py-1"
                                    onClick={() => setIdentForm((f) => ({ ...f, categoryId: c.id }))}
                                  >
                                    {identForm.categoryId === c.id ? "✓ " : ""}{c.name}
                                  </button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => { setEditingCrmCategoryId(c.id); setEditingCrmCategoryName(c.name || ""); }}
                                    title="Editar categoria"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => { if (confirm("Remover esta categoria?")) deleteCrmCategoryMutation.mutate(c.id); }}
                                    disabled={deleteCrmCategoryMutation.isPending}
                                    title="Excluir categoria"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Nome *</Label>
                  <Input value={identForm.name} onChange={(e) => setIdentForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nome do contato" />
                </div>
                <div>
                  <Label className="text-xs">Contato (Telefone)</Label>
                  <Input value={identForm.phone} onChange={(e) => setIdentForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Telefone do contato" />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={identForm.email} onChange={(e) => setIdentForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                {identForm.contactType === "PJ" && (
                  <>
                    <div>
                      <Label className="text-xs">Nome da empresa</Label>
                      <Input value={identForm.companyNameInput} onChange={(e) => setIdentForm((f) => ({ ...f, companyNameInput: e.target.value }))} placeholder="Razão social / fantasia" />
                    </div>
                    <div>
                      <Label className="text-xs">CNPJ</Label>
                      <Input value={identForm.cnpj} onChange={(e) => setIdentForm((f) => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Itens contratados</Label>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setIdentForm((f) => ({ ...f, items: [...f.items, { categoryId: f.categoryId || "", quantity: 1, activationValue: 0, monthlyValue: 0 }] }))}>
                          <Plus className="h-3 w-3 mr-1" /> Adicionar
                        </Button>
                      </div>
                      {identForm.items.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">Nenhum item.</p>
                      ) : identForm.items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-1 items-end rounded-md border border-border bg-background p-1.5">
                          <div className="col-span-12 sm:col-span-4">
                            <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                            <Select value={it.categoryId} onValueChange={(v) => setIdentForm((f) => ({
                              ...f, items: f.items.map((x, i) => i === idx ? { ...x, categoryId: v } : x)
                            }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                {crmCategories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                            <Input type="number" min={1} className="h-7 text-xs" value={it.quantity}
                              onChange={(e) => setIdentForm((f) => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x) }))} />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Ativ.</Label>
                            <Input type="number" min={0} step="0.01" className="h-7 text-xs" value={it.activationValue}
                              onChange={(e) => setIdentForm((f) => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, activationValue: Number(e.target.value) || 0 } : x) }))} />
                          </div>
                          <div className="col-span-3 sm:col-span-3">
                            <Label className="text-[10px] text-muted-foreground">Mens.</Label>
                            <Input type="number" min={0} step="0.01" className="h-7 text-xs" value={it.monthlyValue}
                              onChange={(e) => setIdentForm((f) => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, monthlyValue: Number(e.target.value) || 0 } : x) }))} />
                          </div>
                          <div className="col-span-1">
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setIdentForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}>
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea rows={2} value={identForm.notes} onChange={(e) => setIdentForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createCrmContactMutation.mutate()}
                disabled={!identForm.name || createCrmContactMutation.isPending}
              >
                {createCrmContactMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Cadastrar no CRM
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Finalize Confirmation Dialog */}
      <Dialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Finalizar atendimento
            </DialogTitle>
            <DialogDescription>
              Defina o status da pendência e finalize o atendimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Status da pendência</Label>
              <Select value={finalizeStatus} onValueChange={setFinalizeStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A resolver">A resolver</SelectItem>
                  <SelectItem value="Resolvido">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Tipo de pendência <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {finalizeTipoPendencia
                      ? (() => {
                          const found = tiposPendencia.find((t) => t.Key === finalizeTipoPendencia);
                          return found ? (found.Descricao || "Sem nome") : "Selecione o tipo...";
                        })()
                      : "Selecione o tipo..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar tipo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum tipo encontrado</CommandEmpty>
                      <CommandGroup>
                        {tiposPendencia.map((tipo) => (
                          <CommandItem
                            key={tipo.Key}
                            value={tipo.Descricao || ""}
                            onSelect={() => setFinalizeTipoPendencia(tipo.Key)}
                          >
                            <Check className={`mr-2 h-4 w-4 ${finalizeTipoPendencia === tipo.Key ? "opacity-100" : "opacity-0"}`} />
                            {tipo.Descricao || "Sem nome"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Placa do veículo (Modelo AAA1111 - Não digitar hífen)</Label>
              <Input
                placeholder="Ex: ABC1D23"
                value={ticketPlate}
                onChange={(e) => setTicketPlate(e.target.value.toUpperCase().replace(/\s|-/g, ""))}
                maxLength={8}
              />
            </div>

            {(() => {
              const tipoLabel = tiposPendencia.find((t) => t.Key === finalizeTipoPendencia)?.Descricao || "";
              const isNaoCategorizar = /n[aã]o\s*categorizar/i.test(tipoLabel);
              const obsRequired = isNaoCategorizar && !isAdmin;
              return (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Observação {obsRequired ? <span className="text-destructive">*</span> : "(opcional)"}
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder={obsRequired ? "Obrigatório para a categoria \"Não categorizar\"..." : "Ex: Cliente solicitou suporte..."}
                    value={finalizeNotes}
                    onChange={(e) => setFinalizeNotes(e.target.value)}
                  />
                  {obsRequired && (
                    <p className="text-[11px] text-muted-foreground">
                      Descreva o motivo do atendimento — observação obrigatória quando a categoria for "Não categorizar".
                    </p>
                  )}
                </div>
              );
            })()}

            {isAdmin && (
              <div className="flex items-start gap-2 rounded-md border border-dashed p-3 bg-muted/30">
                <Checkbox
                  id="skip-closing-message"
                  checked={skipClosingMessage}
                  onCheckedChange={(c) => setSkipClosingMessage(c === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="skip-closing-message" className="text-xs font-medium cursor-pointer">
                    Finalizar sem enviar mensagem ao cliente
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Encerra silenciosamente — apenas administradores.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowFinalizeConfirm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!finalizeTipoPendencia) {
                  toast.error("Selecione o tipo de pendência antes de finalizar.");
                  return;
                }
                const tipoLabel = tiposPendencia.find((t) => t.Key === finalizeTipoPendencia)?.Descricao || "";
                const isNaoCategorizar = /n[aã]o\s*categorizar/i.test(tipoLabel);
                if (isNaoCategorizar && !isAdmin && !finalizeNotes.trim()) {
                  toast.error('Observação é obrigatória quando a categoria for "Não categorizar".');
                  return;
                }
                let notesToSend = finalizeNotes || "";
                if (isTesteEquipamentoCategory(tipoLabel, teSettings)) {
                  notesToSend = buildTesteEquipamentoNotes(teData, notesToSend);
                }
                // Persist plate if changed
                if (currentTicket && ticketPlate !== (currentTicket.plate || "")) {
                  updatePlateMutation.mutate(ticketPlate);
                }
                finalizeMutation.mutate({
                  notes: notesToSend || undefined,
                  status: finalizeStatus,
                  tipoPendencia: finalizeTipoPendencia,
                  skipClosingMessage: isAdmin && skipClosingMessage,
                  escalateGestao: isAdmin && escalateToGestao,
                });
              }}
              disabled={!finalizeTipoPendencia || finalizeMutation.isPending}
            >
              {finalizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Finalizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teste de Equipamento Fields Dialog (gate before finalize) */}
      <Dialog
        open={showTeDialog}
        onOpenChange={(open) => {
          setShowTeDialog(open);
          if (!open) setTeData(EMPTY_TESTE_EQUIPAMENTO);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Dados do Teste de Equipamento
            </DialogTitle>
            <DialogDescription>
              Preencha os campos obrigatórios antes de finalizar o atendimento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TesteEquipamentoFields
              value={teData}
              onChange={setTeData}
              settings={teSettings}
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowTeDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const err = validateTesteEquipamento(teData, teSettings);
                if (err) {
                  toast.error(err);
                  return;
                }
                setShowTeDialog(false);
                setShowFinalizeConfirm(true);
              }}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liberação de Equipamento Dialog (gate before finalize) */}
      <Dialog
        open={showLiberacaoDialog}
        onOpenChange={(open) => {
          setShowLiberacaoDialog(open);
          if (!open) {
            setLiberacaoItems([]);
            setLiberacaoDate("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Liberação de Equipamento
            </DialogTitle>
            <DialogDescription>
              Adicione os itens e a data de liberação antes de finalizar.
            </DialogDescription>
          </DialogHeader>
          <LiberacaoEquipamentoFields
            items={liberacaoItems}
            onChange={setLiberacaoItems}
            liberacaoDate={liberacaoDate}
            onLiberacaoDateChange={setLiberacaoDate}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowLiberacaoDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const err = validateLiberacaoItems(liberacaoItems);
                if (err) { toast.error(err); return; }
                if (!liberacaoDate) { toast.error("Informe a data de liberação."); return; }
                setShowLiberacaoDialog(false);
                setShowFinalizeConfirm(true);
              }}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transferir atendimento
            </DialogTitle>
            <DialogDescription>
              Transfira este chat para outro setor ou usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Setor</Label>
              <Select value={transferSectorId} onValueChange={(v) => { setTransferSectorId(v); setTransferUserId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor..." />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Usuário (opcional)</Label>
              <Select value={transferUserId} onValueChange={setTransferUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {gsystemUsersList.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.status === "ONLINE" ? "🟢" : "⚪"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowTransferModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={transferMutation.isPending || (!transferSectorId && !transferUserId)}
            >
              {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Transferir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Chat Modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Conversa
            </DialogTitle>
            <DialogDescription>
              Selecione um contato salvo ou informe o telefone manualmente.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={newChatTab} onValueChange={(v) => setNewChatTab(v as "saved" | "manual")} className="mt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="saved" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Contato salvo
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Telefone manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="saved" className="space-y-3 mt-3">
              <ContactPicker
                selectedId={newChatPickedContact?.id}
                onSelect={(c) => {
                  setNewChatPickedContact(c);
                  setNewChatPhone(c.phone);
                }}
              />
              {newChatPickedContact && (
                <div className="rounded-md border bg-accent/40 px-3 py-2 text-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{newChatPickedContact.name}</p>
                    <p className="font-mono text-muted-foreground">{newChatPickedContact.phone}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => { setNewChatPickedContact(null); setNewChatPhone(""); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="manual" className="space-y-3 mt-3">
              <div>
                <Label className="text-xs">Telefone *</Label>
                <Input
                  placeholder="5531999999999"
                  value={newChatPhone}
                  onChange={(e) => { setNewChatPhone(e.target.value); setNewChatPickedContact(null); }}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Formato: código do país + DDD + número</p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-3 mt-4">
            <div>
              <Label className="text-xs">Mensagem inicial (opcional)</Label>
              <Textarea
                rows={3}
                placeholder="Olá, como posso ajudar?"
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Setor (opcional)</Label>
              <Select value={newChatSector} onValueChange={setNewChatSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar setor..." />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name || s.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => createChatMutation.mutate()}
              disabled={!newChatPhone || newChatPhone.replace(/\D/g, "").length < 10 || createChatMutation.isPending}
            >
              {createChatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Iniciar Conversa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachment preview dialog (drag, paste, or attach button) */}
      <Dialog
        open={pendingAttachments.length > 0}
        onOpenChange={(open) => { if (!open) clearPendingAttachments(); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Enviar {pendingAttachments.length > 1 ? `${pendingAttachments.length} arquivos` : "arquivo"}
            </DialogTitle>
            <DialogDescription>
              Revise os anexos antes de enviar para o contato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {pendingAttachments.map((file, idx) => {
              const isImage = file.type.startsWith("image/");
              const isVideo = file.type.startsWith("video/");
              const isAudio = file.type.startsWith("audio/");
              const url = URL.createObjectURL(file);
              const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
              return (
                <div key={`${file.name}-${idx}`} className="flex items-start gap-3 rounded-md border p-2 bg-muted/30">
                  <div className="shrink-0 w-20 h-20 rounded overflow-hidden bg-background flex items-center justify-center">
                    {isImage ? (
                      <img src={url} alt={file.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                    ) : isVideo ? (
                      <video src={url} className="w-full h-full object-cover" muted />
                    ) : isAudio ? (
                      <Paperclip className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Paperclip className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-muted-foreground">{sizeMb} MB · {file.type || "arquivo"}</p>
                    {isAudio && <audio src={url} controls className="mt-1 w-full h-8" />}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removePendingAttachment(idx)}
                    title="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="attachment-caption" className="text-xs">Legenda (opcional)</Label>
            <Textarea
              id="attachment-caption"
              value={attachmentCaption}
              onChange={(e) => setAttachmentCaption(e.target.value)}
              placeholder="Adicione uma mensagem para acompanhar o(s) arquivo(s)..."
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaMutation.isPending}
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Adicionar mais
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={clearPendingAttachments} disabled={mediaMutation.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={sendPendingAttachments}
                disabled={mediaMutation.isPending || pendingAttachments.length === 0}
              >
                {mediaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating chat windows layer */}
      <FloatingChatsLayer onOpenInPanel={(id) => setSelectedChatId(id)} />
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

function formatTime(dateStr?: string): string {
  if (!dateStr) return "";
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
