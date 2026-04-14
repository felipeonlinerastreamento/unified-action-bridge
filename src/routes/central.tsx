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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  sendText,
  finalizeChat,
  createChat,
  getChannelStatus,
  listSectors,
  listGSystemUsers,
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
} from "lucide-react";
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
  const { isAuthenticated, isLoading: authLoading, session } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [messageInput, setMessageInput] = useState("");
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
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [finalizeNotes, setFinalizeNotes] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

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

  // Filter chats
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

  const messages = chatDetail?.messages || [];

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
  }, [selectedChatId]);

  // Company lookup by contact phone
  const contactPhone = chatDetail?.contact?.number || chatDetail?.contact?.secondaryName || "";

  const { data: companyLookup } = useQuery({
    queryKey: ["company-lookup", contactPhone],
    queryFn: async () => {
      if (!contactPhone) return null;
      // Try to match phone number (last 10-11 digits)
      const cleanPhone = contactPhone.replace(/\D/g, "");
      const { data: phoneLinks } = await supabase
        .from("company_phones")
        .select("company_id, phone_number");

      if (!phoneLinks) return null;

      const match = phoneLinks.find((p) => {
        const clean = p.phone_number.replace(/\D/g, "");
        return clean === cleanPhone || cleanPhone.endsWith(clean) || clean.endsWith(cleanPhone);
      });

      if (!match) return null;

      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("id", match.company_id)
        .single();

      return company;
    },
    enabled: !!contactPhone && isAuthenticated,
  });

  // Sub-client lookup by phone
  const { data: subClientLookup } = useQuery({
    queryKey: ["sub-client-lookup", contactPhone],
    queryFn: async () => {
      if (!contactPhone) return null;
      const cleanPhone = contactPhone.replace(/\D/g, "");
      const { data: subClients } = await supabase
        .from("sub_clients")
        .select("*, companies(name)");
      if (!subClients) return null;
      const match = subClients.find((s: any) => {
        const clean = s.phone.replace(/\D/g, "");
        return clean === cleanPhone || cleanPhone.endsWith(clean) || clean.endsWith(cleanPhone);
      });
      return match || null;
    },
    enabled: !!contactPhone && !companyLookup && isAuthenticated,
  });

  // CRM contact lookup by phone
  const { data: crmContactLookup } = useQuery({
    queryKey: ["crm-contact-lookup", contactPhone],
    queryFn: async () => {
      if (!contactPhone) return null;
      const cleanPhone = contactPhone.replace(/\D/g, "");
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select("*, companies(name)");
      if (!contacts) return null;
      const match = contacts.find((c: any) => {
        const clean = c.phone.replace(/\D/g, "");
        return clean === cleanPhone || cleanPhone.endsWith(clean) || clean.endsWith(cleanPhone);
      });
      return match || null;
    },
    enabled: !!contactPhone && !companyLookup && !subClientLookup && isAuthenticated,
  });

  // Identification modal state
  const isUnidentified = !!chatDetail && !!contactPhone && !companyLookup && !subClientLookup && !crmContactLookup;
  const [identModalDismissed, setIdentModalDismissed] = useState<Record<string, boolean>>({});
  const showIdentModal = isUnidentified && !!selectedChatId && !identModalDismissed[selectedChatId];

  // Identification modal form state
  const [identTab, setIdentTab] = useState<"vincular" | "subcliente" | "crm">("vincular");
  const [identForm, setIdentForm] = useState({ name: "", phone: "", email: "", notes: "", companyId: "" });

  // Reset form when chat changes or chatDetail loads
  useEffect(() => {
    if (chatDetail) {
      setIdentForm({
        name: chatDetail?.contact?.name || chatDetail?.description || "",
        phone: contactPhone || "",
        email: "",
        notes: "",
        companyId: "",
      });
      setIdentTab("vincular");
    }
  }, [selectedChatId, chatDetail, contactPhone]);

  // Create sub-client mutation
  const createSubClientMutation = useMutation({
    mutationFn: async () => {
      if (!identForm.companyId || !identForm.name) throw new Error("Preencha nome e empresa");
      const { data: sess } = await supabase.auth.getSession();
      const { error } = await supabase.from("sub_clients").insert({
        name: identForm.name,
        phone: identForm.phone || contactPhone,
        email: identForm.email || null,
        notes: identForm.notes || "",
        company_id: identForm.companyId,
        created_by: sess.session?.user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-cliente cadastrado com sucesso");
      setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
      queryClient.invalidateQueries({ queryKey: ["sub-client-lookup"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao cadastrar sub-cliente"),
  });

  // Create CRM contact mutation
  const createCrmContactMutation = useMutation({
    mutationFn: async () => {
      if (!identForm.name) throw new Error("Preencha o nome");
      const { data: sess } = await supabase.auth.getSession();
      const { error } = await supabase.from("crm_contacts").insert({
        name: identForm.name,
        phone: identForm.phone || contactPhone,
        email: identForm.email || null,
        notes: identForm.notes || "",
        company_id: identForm.companyId || null,
        created_by: sess.session?.user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato CRM cadastrado com sucesso");
      setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
      queryClient.invalidateQueries({ queryKey: ["crm-contact-lookup"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao cadastrar contato CRM"),
  });

  // Link company directly (for "vincular" tab)
  const linkCompanyDirectMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const phone = contactPhone.replace(/\D/g, "");
      if (phone) {
        await supabase.from("company_phones").insert({
          company_id: companyId,
          phone_number: phone,
        });
      }
    },
    onSuccess: () => {
      toast.success("Número vinculado à empresa");
      setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true }));
      queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao vincular"),
  });

  // Service ticket for this attendance
  const { data: currentTicket, refetch: refetchTicket } = useQuery({
    queryKey: ["service-ticket", selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return null;
      const { data } = await supabase
        .from("service_tickets")
        .select("*")
        .eq("attendance_id", selectedChatId)
        .order("created_at", { ascending: false })
        .limit(1);
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!selectedChatId && isAuthenticated,
  });

  // Auto-create ticket when chat is selected and no ticket exists
  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChatId || !chatDetail) return;
      const { data: existing } = await supabase
        .from("service_tickets")
        .select("id")
        .eq("attendance_id", selectedChatId)
        .limit(1);
      if (existing && existing.length > 0) return;

      const { data: sess } = await supabase.auth.getSession();
      await supabase.from("service_tickets").insert({
        attendance_id: selectedChatId,
        channel_id: selectedChannelId || null,
        company_id: companyLookup?.id || null,
        contact_phone: contactPhone || null,
        contact_name: chatDetail.contact?.name || chatDetail.description || null,
        plate: ticketPlate || null,
        status: "aberto" as const,
        opened_by: sess.session?.user?.id || null,
      });
    },
    onSuccess: () => refetchTicket(),
  });

  // Auto-create ticket on chat selection
  useEffect(() => {
    if (chatDetail && selectedChatId && !currentTicket && !createTicketMutation.isPending) {
      createTicketMutation.mutate();
    }
  }, [chatDetail, selectedChatId, currentTicket]);

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

  // All companies for linking
  const { data: allCompanies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
    enabled: isAuthenticated,
  });

  // Link company to ticket
  const linkCompanyMutation = useMutation({
    mutationFn: async (companyId: string) => {
      if (!currentTicket) return;
      await supabase
        .from("service_tickets")
        .update({ company_id: companyId })
        .eq("id", currentTicket.id);
    },
    onSuccess: () => {
      refetchTicket();
      queryClient.invalidateQueries({ queryKey: ["company-lookup"] });
      toast.success("Empresa vinculada ao chamado");
    },
  });

  // Auto-scroll
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
    mutationFn: async (notes?: string) => {
      if (currentTicket) {
        await supabase
          .from("service_tickets")
          .update({
            status: "finalizado" as const,
            closed_at: new Date().toISOString(),
            notes: notes || currentTicket.notes || null,
          })
          .eq("id", currentTicket.id);
      }
      return finalizeChat({
        data: { channelId: selectedChannelId, chatId: selectedChatId },
        ...await getAuthHeaders(),
      });
    },
    onSuccess: () => {
      toast.success("Atendimento finalizado");
      setSelectedChatId("");
      setShowFinalizeConfirm(false);
      setFinalizeNotes("");
      refetchChats();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao finalizar"),
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
      toast.success("Nova conversa criada");
      setShowNewChatModal(false);
      setNewChatPhone("");
      setNewChatMessage("");
      setNewChatSector("");
      refetchChats();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao criar conversa"),
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

  // AI Assistant send
  const handleAiSend = async (autoMessage?: string) => {
    const msg = autoMessage || aiInput.trim();
    if (!msg || aiLoading) return;
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
              <div className="p-3 border-b space-y-2">
                <div className="flex items-center gap-2">
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

            {/* Chat area */}
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
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {chatDetail?.contact?.secondaryName || chatDetail?.contact?.number}
                            {chatDetail?.protocol && ` • #${chatDetail.protocol}`}
                          </p>
                          {companyLookup && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Building2 className="h-2.5 w-2.5" />
                              {companyLookup.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {statusInfo && (
                        <Badge variant="outline" className={`text-xs mr-2 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                      )}
                      {detectedPlates.length > 0 && (
                        <Badge variant="outline" className="text-xs mr-2 border-blue-300 text-blue-700">
                          🚗 {detectedPlates[detectedPlates.length - 1]}
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
                        variant="outline"
                        size="sm"
                        title="Finalizar"
                        onClick={() => setShowFinalizeConfirm(true)}
                        disabled={finalizeMutation.isPending}
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Finalizar
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

            {/* Right panel with tabs */}
            <div className="col-span-3 border rounded-lg bg-card overflow-hidden flex flex-col">
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
                    <TabsTrigger value="ia" className="flex-1 text-xs">
                      <Bot className="h-3 w-3 mr-1" /> IA
                    </TabsTrigger>
                  </TabsList>

                  {/* Empresa Tab */}
                  <TabsContent value="empresa" className="flex-1 overflow-auto m-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 space-y-4">
                        {companyLookup ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold text-foreground">{companyLookup.name}</h3>
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
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <AlertCircle className="h-4 w-4" />
                              <p className="text-sm">Cliente não identificado</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              O número {contactPhone || "deste contato"} não está vinculado a nenhuma empresa.
                            </p>
                            <Separator />
                            <p className="text-xs font-medium text-foreground">Vincular a uma empresa:</p>
                            <Select
                              onValueChange={(companyId) => linkCompanyMutation.mutate(companyId)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecionar empresa..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allCompanies.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                </Tabs>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Identification Modal */}
      <Dialog open={showIdentModal} onOpenChange={(open) => { if (!open) setIdentModalDismissed((prev) => ({ ...prev, [selectedChatId]: true })); }}>
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
              <TabsTrigger value="subcliente" className="flex-1 text-xs">
                <Users className="h-3 w-3 mr-1" /> Sub-cliente
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
              {companiesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...
                </div>
              ) : allCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>
              ) : (
                <Select onValueChange={(companyId) => linkCompanyDirectMutation.mutate(companyId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {linkCompanyDirectMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Vinculando...
                </div>
              )}
            </TabsContent>

            {/* Criar sub-cliente */}
            <TabsContent value="subcliente" className="space-y-3 mt-3">
              <p className="text-sm text-muted-foreground">
                Cadastre como sub-cliente de uma empresa existente.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Empresa pai *</Label>
                  {companiesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...
                    </div>
                  ) : allCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma empresa cadastrada.</p>
                  ) : (
                    <Select value={identForm.companyId} onValueChange={(v) => setIdentForm((f) => ({ ...f, companyId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar empresa..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allCompanies.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {identForm.companyId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Empresa: <strong>{allCompanies.find((c: any) => c.id === identForm.companyId)?.name}</strong>
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
      <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar este atendimento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nota de encerramento (opcional)</Label>
            <Textarea
              rows={3}
              placeholder="Ex: Cliente solicitou suporte para instalação..."
              value={finalizeNotes}
              onChange={(e) => setFinalizeNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finalizeMutation.mutate(finalizeNotes || undefined)}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Chat Modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Conversa
            </DialogTitle>
            <DialogDescription>
              Inicie uma nova conversa informando o telefone do contato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Telefone *</Label>
              <Input
                placeholder="5531999999999"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Formato: código do país + DDD + número</p>
            </div>
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
