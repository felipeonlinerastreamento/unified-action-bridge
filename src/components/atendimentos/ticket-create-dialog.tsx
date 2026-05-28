import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2, AlertCircle, Maximize2, Minimize2 } from "lucide-react";
import { getClientes, getTiposPendencia } from "@/lib/gsystem-api.functions";
import { useTrackingSettings } from "@/hooks/use-tracking-settings";
import {
  useTesteEquipamentoSettings,
  isTesteEquipamentoCategory,
  buildTesteEquipamentoNotes,
  validateTesteEquipamento,
  EMPTY_TESTE_EQUIPAMENTO,
  type TesteEquipamentoData,
} from "@/hooks/use-teste-equipamento-settings";
import { TesteEquipamentoFields } from "./teste-equipamento-fields";
import {
  LiberacaoEquipamentoFields,
  validateLiberacaoItems,
  type LiberacaoLineItem,
} from "./liberacao-equipamento-fields";
import { isLiberacaoCategory } from "@/hooks/use-liberacao-equipamento";
import { isSuprimentoCategory } from "@/hooks/use-suprimento";
import {
  SuprimentoFields,
  validateSuprimentoItems,
  type SuprimentoLineItem,
} from "./suprimento-fields";
import { isCompraEquipamentoCategory } from "@/hooks/use-compra-equipamento";
import {
  CompraEquipamentoFields,
  validateCompraEquipamentoItems,
  type CompraEquipamentoLineItem,
} from "./compra-equipamento-fields";
import { isPerdidosCategory } from "@/hooks/use-perdidos";
import {
  PerdidosFields,
  validatePerdidosItems,
  type PerdidosLineItem,
} from "./perdidos-fields";
import { isPurchaseCategory } from "@/hooks/use-purchase-requests";
import {
  PurchaseFields,
  validatePurchaseItems,
  type PurchaseLineItem,
} from "./purchase-fields";
import { useAuth } from "@/hooks/use-auth";


interface TicketCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface GsystemCliente {
  Key?: string;
  key?: string;
  Nome?: string;
  nome?: string;
  RazaoSocial?: string;
  CpfCnpj?: string;
  cpf_cnpj?: string;
  Telefone?: string;
  telefone?: string;
}

export function TicketCreateDialog({ open, onClose, onCreated }: TicketCreateDialogProps) {
  const { user: currentUser } = useAuth();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<GsystemCliente | null>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("media");
  const [category, setCategory] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isCorreios = (category || "").toLowerCase().includes("correios");
  const showTracking = isCorreios || isSuprimentoCategory(category);
  const { data: trackingSettings } = useTrackingSettings();
  const { data: teSettings } = useTesteEquipamentoSettings();
  const isTesteEquip = isTesteEquipamentoCategory(category, teSettings);
  const [teData, setTeData] = useState<TesteEquipamentoData>(EMPTY_TESTE_EQUIPAMENTO);
  const isLiberacao = isLiberacaoCategory(category);
  const [liberacaoItems, setLiberacaoItems] = useState<LiberacaoLineItem[]>([]);
  const [liberacaoDate, setLiberacaoDate] = useState<string>("");
  const isSuprimento = isSuprimentoCategory(category);
  const [suprimentoItems, setSuprimentoItems] = useState<SuprimentoLineItem[]>([]);
  const isCompraEquip = isCompraEquipamentoCategory(category);
  const [compraEquipItems, setCompraEquipItems] = useState<CompraEquipamentoLineItem[]>([]);
  const isPerdidos = isPerdidosCategory(category);
  const [perdidosItems, setPerdidosItems] = useState<PerdidosLineItem[]>([]);
  const isPurchase = isPurchaseCategory(category);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([]);

  // Local company id resolved from selected GSystem client (by CNPJ or name)
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedCliente) {
        setResolvedCompanyId(null);
        return;
      }
      const name = (selectedCliente.Nome || selectedCliente.nome || selectedCliente.RazaoSocial || "").trim();
      const cnpj =
        (selectedCliente.CpfCnpj || selectedCliente.cpf_cnpj || "").replace(/\D/g, "") || null;
      let id: string | null = null;
      if (cnpj) {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .eq("cnpj", cnpj)
          .limit(1);
        if (data && data.length > 0) id = data[0].id;
      }
      if (!id && name) {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .eq("name", name)
          .limit(1);
        if (data && data.length > 0) id = data[0].id;
      }
      if (!cancelled) setResolvedCompanyId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCliente]);

  // Service templates of resolved company (only relevant for Liberação)
  const { data: serviceTemplates = [] } = useQuery({
    queryKey: ["company-service-templates", resolvedCompanyId],
    queryFn: async () => {
      if (!resolvedCompanyId) return [] as any[];
      const { data } = await supabase
        .from("company_service_templates" as any)
        .select("id, name, description, position")
        .eq("company_id", resolvedCompanyId)
        .order("position");
      return (data as any[]) || [];
    },
    enabled: open && isLiberacao && !!resolvedCompanyId,
  });

  // Auto-fill description with the single template when there is exactly one
  // and the description is still empty (never overwrite user-typed text).
  const [autoFilledTplKey, setAutoFilledTplKey] = useState<string | null>(null);
  useEffect(() => {
    if (!isLiberacao || serviceTemplates.length !== 1) return;
    const tpl = serviceTemplates[0];
    const key = `${resolvedCompanyId}:${tpl.id}`;
    if (autoFilledTplKey === key) return;
    if (notes.trim().length === 0 && tpl.description) {
      setNotes(tpl.description);
      setAutoFilledTplKey(key);
    }
  }, [isLiberacao, serviceTemplates, resolvedCompanyId, notes, autoFilledTplKey]);

  const insertTemplateDescription = (description: string) => {
    if (!description) return;
    setNotes((prev) => {
      if (!prev.trim()) return description;
      return `${prev.trimEnd()}\n\n${description}`;
    });
  };

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // GSystem clients (same source as Contatos)
  const {
    data: clientes = [],
    isLoading: clientesLoading,
    error: clientesError,
  } = useQuery({
    queryKey: ["gsystem-clientes"],
    queryFn: async () => {
      const result = await getClientes({ data: {}, ...(await getAuthHeaders()) });
      return Array.isArray(result) ? result : result?.data || result?.Data || [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  // GSystem categories (tipos de pendência)
  const { data: tiposPendencia = [], isLoading: tiposLoading } = useQuery({
    queryKey: ["tipos-pendencia-create-ticket"],
    queryFn: async () => {
      const result = await getTiposPendencia(await getAuthHeaders());
      return Array.isArray(result) ? result : [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  // Local active sectors (from Grupo de Setores config)
  const { data: localSectors = [] } = useQuery({
    queryKey: ["local-sectors-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const filteredClientes = useMemo(() => {
    const term = companySearch.trim().toLowerCase();
    if (!term) return clientes.slice(0, 50);
    return clientes
      .filter((c: GsystemCliente) => {
        const name = (c.Nome || c.nome || c.RazaoSocial || "").toLowerCase();
        const doc = (c.CpfCnpj || c.cpf_cnpj || "").toLowerCase();
        return name.includes(term) || doc.includes(term);
      })
      .slice(0, 50);
  }, [clientes, companySearch]);

  const selectedCompanyLabel = useMemo(() => {
    if (!selectedCliente) return "";
    return selectedCliente.Nome || selectedCliente.nome || selectedCliente.RazaoSocial || "";
  }, [selectedCliente]);

  // Auto-fill phone when client selected
  useEffect(() => {
    if (selectedCliente && !contactPhone) {
      const phone = selectedCliente.Telefone || selectedCliente.telefone || "";
      if (phone) setContactPhone(phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCliente]);

  const resetForm = () => {
    setSelectedCliente(null);
    setCompanySearch("");
    setContactName("");
    setContactPhone("");
    setPlate("");
    setNotes("");
    setPriority("media");
    setCategory("");
    setSectorId("");
    setTrackingCode("");
    setTeData(EMPTY_TESTE_EQUIPAMENTO);
    setLiberacaoItems([]);
    setLiberacaoDate("");
    setSuprimentoItems([]);
    setCompraEquipItems([]);
    setPerdidosItems([]);
    setPurchaseItems([]);
  };

  const ensureLocalCompany = async (cliente: GsystemCliente): Promise<string | null> => {
    const name = (cliente.Nome || cliente.nome || cliente.RazaoSocial || "").trim();
    const cnpj = (cliente.CpfCnpj || cliente.cpf_cnpj || "").replace(/\D/g, "") || null;
    if (!name) return null;

    if (cnpj) {
      const { data: byCnpj } = await supabase
        .from("companies")
        .select("id")
        .eq("cnpj", cnpj)
        .limit(1);
      if (byCnpj && byCnpj.length > 0) return byCnpj[0].id;
    }

    const { data: byName } = await supabase
      .from("companies")
      .select("id")
      .eq("name", name)
      .limit(1);
    if (byName && byName.length > 0) return byName[0].id;

    const { data: created, error } = await supabase
      .from("companies")
      .insert({ name, cnpj })
      .select("id")
      .single();
    if (error || !created) return null;
    return created.id;
  };

  const handleCreate = async () => {
    if (!selectedCliente) {
      toast.error("Selecione a empresa do cliente");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Informe o nome do contato");
      return;
    }
    // Validate tracking code (Correios required, Suprimento opcional)
    let trackCodeClean: string | null = null;
    if (showTracking) {
      const required = isCorreios && (trackingSettings?.require_tracking_code ?? true);
      const pattern = trackingSettings?.tracking_code_pattern || "^[A-Z]{2}\\d{9}[A-Z]{2}$";
      if (required && !trackingCode.trim()) {
        toast.error("Código de envio é obrigatório para Correios");
        return;
      }
      if (trackingCode.trim()) {
        trackCodeClean = trackingCode.trim().toUpperCase();
        try {
          if (!new RegExp(pattern).test(trackCodeClean)) {
            toast.error("Código de envio inválido. Use AA123456789BR");
            return;
          }
        } catch {
          if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackCodeClean)) {
            toast.error("Código de envio inválido. Use AA123456789BR");
            return;
          }
        }
      }
    }
    // Validate Teste de Equipamento fields
    if (isTesteEquip) {
      const err = validateTesteEquipamento(teData, teSettings);
      if (err) {
        toast.error(err);
        return;
      }
    }
    // Validate Liberação de Equipamento
    if (isLiberacao) {
      const err = validateLiberacaoItems(liberacaoItems);
      if (err) {
        toast.error(err);
        return;
      }
      if (!liberacaoDate) {
        toast.error("Informe a data de liberação.");
        return;
      }
    }
    // Validate Suprimento items
    if (isSuprimento) {
      const err = validateSuprimentoItems(suprimentoItems);
      if (err) {
        toast.error(err);
        return;
      }
    }
    // Validate Compra Equipamento/Chip items
    if (isCompraEquip) {
      const err = validateCompraEquipamentoItems(compraEquipItems);
      if (err) {
        toast.error(err);
        return;
      }
    }
    // Validate Perdidos items
    if (isPerdidos) {
      const err = validatePerdidosItems(perdidosItems);
      if (err) {
        toast.error(err);
        return;
      }
    }
    // Validate Purchase items
    if (isPurchase) {
      const err = validatePurchaseItems(purchaseItems);
      if (err) {
        toast.error(err);
        return;
      }
    }
    setLoading(true);
    try {
      const companyId = await ensureLocalCompany(selectedCliente);
      const sectorName = localSectors.find((s) => s.id === sectorId)?.name || null;
      const attendanceId = `MANUAL-${Date.now()}`;
      const finalNotes = isTesteEquip
        ? buildTesteEquipamentoNotes(teData, notes)
        : (notes || null);
      let creatorId: string | null = currentUser?.id ?? null;
      if (!creatorId) {
        const { data: { user: fallbackUser } } = await supabase.auth.getUser();
        creatorId = fallbackUser?.id ?? null;
      }
      if (!creatorId) {
        toast.error("Sessão expirada. Faça login novamente para abrir o chamado.");
        setLoading(false);
        return;
      }

      const { data: created, error } = await supabase.from("service_tickets").insert({
        attendance_id: attendanceId,
        contact_name: contactName,
        contact_phone: contactPhone || null,
        company_id: companyId,
        plate: plate || null,
        notes: finalNotes,
        priority: priority as any,
        category: category || null,
        sector: sectorName,
        status: "aberto",
        tracking_code: trackCodeClean,
        opened_by: creatorId,
        assigned_to: creatorId,
        ...(isLiberacao && liberacaoDate
          ? { liberacao_date: new Date(liberacaoDate).toISOString() }
          : {}),
      } as any).select("id").single();

      if (error) {
        toast.error("Erro ao criar ticket");
        return;
      }

      // Create tracking row if applicable
      if (created?.id && trackCodeClean) {
        await supabase.from("ticket_tracking").insert({
          ticket_id: created.id,
          tracking_code: trackCodeClean,
          carrier: "correios",
        });
      }

      // Insert liberação items
      if (created?.id && isLiberacao && liberacaoItems.length > 0) {
        const rows = liberacaoItems.map((it) => ({
          ticket_id: created.id,
          item_id: it.item_id,
          item_name: it.item_name,
          quantity: it.quantity,
          status: "pendente" as const,
        }));
        const { error: itemsErr } = await supabase
          .from("ticket_liberacao_items" as any)
          .insert(rows);
        if (itemsErr) {
          console.error("Erro ao salvar itens de liberação", itemsErr);
          toast.error("Ticket criado, mas falhou ao salvar itens de liberação.");
        }
      }

      // Insert suprimento items
      if (created?.id && isSuprimento && suprimentoItems.length > 0) {
        const rows = suprimentoItems.map((it) => ({
          ticket_id: created.id,
          item_id: it.item_id,
          item_name: it.item_name,
          quantity: it.quantity,
          status: "pendente",
        }));
        const { error: supErr } = await supabase
          .from("ticket_suprimento_items" as any)
          .insert(rows);
        if (supErr) {
          console.error("Erro ao salvar itens de suprimento", supErr);
          toast.error("Ticket criado, mas falhou ao salvar itens de compra.");
        }
      }

      // Insert compra equipamento/chip items
      if (created?.id && isCompraEquip && compraEquipItems.length > 0) {
        const rows = compraEquipItems.map((it) => ({
          ticket_id: created.id,
          item_id: it.item_id,
          item_name: it.item_name,
          quantity: it.quantity,
          status: "pendente",
        }));
        const { error: ceErr } = await supabase
          .from("ticket_compra_equipamento_items" as any)
          .insert(rows);
        if (ceErr) {
          console.error("Erro ao salvar itens de compra equipamento", ceErr);
          toast.error("Ticket criado, mas falhou ao salvar itens de compra equipamento.");
        }
      }

      // Insert perdidos items
      if (created?.id && isPerdidos && perdidosItems.length > 0) {
        const rows = perdidosItems.map((it) => ({
          ticket_id: created.id,
          item_id: it.item_id,
          item_name: it.item_name,
          quantity: it.quantity,
          unit_value: it.unit_value,
        }));
        const { error: pErr } = await supabase
          .from("ticket_perdidos_items" as any)
          .insert(rows);
        if (pErr) {
          console.error("Erro ao salvar itens perdidos", pErr);
          toast.error("Ticket criado, mas falhou ao salvar itens perdidos.");
        }
      }

      // Insert purchase request + items
      if (created?.id && isPurchase && purchaseItems.length > 0) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const { data: req, error: reqErr } = await supabase
          .from("ticket_purchase_requests" as any)
          .insert({ ticket_id: created.id, created_by: authUser?.id || null })
          .select("id")
          .single();
        if (reqErr) {
          console.error("Erro ao criar solicitação de compra", reqErr);
          toast.error("Ticket criado, mas falhou ao iniciar a solicitação de compra.");
        } else {
          const rows = purchaseItems.map((it) => ({
            ticket_id: created.id,
            request_id: (req as any)?.id || null,
            item_id: it.item_id,
            item_name: it.item_name,
            quantity: it.quantity,
            unit_price: it.unit_price || 0,
            status: "pendente",
          }));
          const { error: piErr } = await supabase
            .from("ticket_purchase_items" as any)
            .insert(rows);
          if (piErr) {
            console.error("Erro ao salvar itens da solicitação de compra", piErr);
            toast.error("Ticket criado, mas falhou ao salvar itens de compra.");
          }
        }
      }

      toast.success("Ticket criado com sucesso");
      resetForm();
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (resetForm(), onClose())}>
      <DialogContent
        className={cn(
          "overflow-y-auto transition-all",
          expanded
            ? "max-w-[95vw] w-[95vw] max-h-[95vh] sm:max-w-[1200px]"
            : "max-w-md max-h-[90vh]"
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle>Novo Ticket</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Reduzir" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5 mr-1" /> : <Maximize2 className="h-3.5 w-3.5 mr-1" />}
              {expanded ? "Reduzir" : "Expandir"}
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          {/* Company - first field, synced with GSystem (Contatos) */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome da Empresa *</label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  className="w-full justify-between h-9 font-normal"
                >
                  <span className="truncate">
                    {selectedCompanyLabel || "Selecione a empresa..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar empresa por nome ou CNPJ..."
                    value={companySearch}
                    onValueChange={setCompanySearch}
                  />
                  <CommandList>
                    {clientesLoading ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando empresas...
                      </div>
                    ) : clientesError ? (
                      <div className="p-4 flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" /> Erro ao carregar empresas
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {filteredClientes.map((c: GsystemCliente, idx: number) => {
                            const key = String(c.Key || c.key || idx);
                            const name = c.Nome || c.nome || c.RazaoSocial || "Sem nome";
                            const doc = c.CpfCnpj || c.cpf_cnpj || "";
                            const isSelected =
                              selectedCliente &&
                              String(selectedCliente.Key || selectedCliente.key) === key;
                            return (
                              <CommandItem
                                key={key}
                                value={`${name}-${key}`}
                                onSelect={() => {
                                  setSelectedCliente(c);
                                  setCompanyOpen(false);
                                  setCompanySearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm">{name}</span>
                                  {doc && (
                                    <span className="text-xs text-muted-foreground">{doc}</span>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Nome do Contato *</label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nome"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Telefone</label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Placa</label>
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/\s|-/g, ""))}
                placeholder="ABC1D23"
                maxLength={8}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Prioridade</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Setor</label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {localSectors.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Nenhum setor ativo. Cadastre em Configurações → Grupos de Setores.
                    </div>
                  ) : (
                    localSectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Categoria (GSystem)</label>
            <Select value={category} onValueChange={setCategory} disabled={tiposLoading}>
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={tiposLoading ? "Carregando categorias..." : "Selecione..."}
                />
              </SelectTrigger>
              <SelectContent>
                {tiposPendencia.length === 0 && !tiposLoading ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhuma categoria encontrada no GSystem.
                  </div>
                ) : (
                  tiposPendencia.map((t: any) => (
                    <SelectItem key={t.Key} value={t.Descricao}>
                      {t.Descricao}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {showTracking && (
            <div className="space-y-1">
              <label className="text-xs font-medium flex items-center gap-1">
                📦 Código de Envio (Sedex){" "}
                {isCorreios && trackingSettings?.require_tracking_code !== false ? "*" : "(opcional)"}
              </label>
              <Input
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                placeholder="AA123456789BR"
                maxLength={13}
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Formato Correios: 2 letras + 9 dígitos + 2 letras
              </p>
            </div>
          )}
          {isTesteEquip && (
            <TesteEquipamentoFields value={teData} onChange={setTeData} settings={teSettings} />
          )}
          {isLiberacao && (
            <LiberacaoEquipamentoFields
              items={liberacaoItems}
              onChange={setLiberacaoItems}
              liberacaoDate={liberacaoDate}
              onLiberacaoDateChange={setLiberacaoDate}
            />
          )}
          {isSuprimento && (
            <SuprimentoFields items={suprimentoItems} onChange={setSuprimentoItems} />
          )}
          {isCompraEquip && (
            <CompraEquipamentoFields items={compraEquipItems} onChange={setCompraEquipItems} />
          )}
          {isPerdidos && (
            <PerdidosFields items={perdidosItems} onChange={setPerdidosItems} />
          )}
          {isPurchase && (
            <PurchaseFields items={purchaseItems} onChange={setPurchaseItems} />
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium">Observações</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes do atendimento..."
            />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
