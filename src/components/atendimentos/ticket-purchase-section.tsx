import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  CheckCircle2,
  Truck,
  Plus,
  Trash2,
  Building2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  isPurchaseCategory,
  usePurchaseItems,
  usePurchaseSuppliers,
  usePurchaseSupplierContacts,
  usePurchaseFlowConfig,
  useTicketPurchaseRequest,
  useTicketPurchaseItems,
  useLastPurchaseForItem,
  type PurchaseRequestStatus,
} from "@/hooks/use-purchase-requests";

interface Props {
  ticket: any;
  userId: string | null;
  onRefetch: () => void;
}

const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  solicitado: "Solicitado",
  cotacao: "Em cotação",
  comprado: "Comprado",
  em_transporte: "Em transporte",
  entregue: "Entregue",
};

const STATUS_BADGE: Record<PurchaseRequestStatus, string> = {
  solicitado: "bg-slate-100 text-slate-800 border-slate-200",
  cotacao: "bg-blue-100 text-blue-800 border-blue-200",
  comprado: "bg-amber-100 text-amber-800 border-amber-200",
  em_transporte: "bg-indigo-100 text-indigo-800 border-indigo-200",
  entregue: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function TicketPurchaseSection({ ticket, userId, onRefetch }: Props) {
  const qc = useQueryClient();
  const isPurchase = isPurchaseCategory(ticket?.category);
  const { data: cfg } = usePurchaseFlowConfig();
  const { data: catalog = [] } = usePurchaseItems(true);
  const { data: suppliers = [] } = usePurchaseSuppliers(true);
  const { data: request, refetch: refetchReq } = useTicketPurchaseRequest(
    isPurchase ? ticket?.id : null
  );
  const { data: items = [], refetch: refetchItems } = useTicketPurchaseItems(
    isPurchase ? ticket?.id : null
  );
  const { data: contacts = [] } = usePurchaseSupplierContacts(request?.supplier_id);

  const [newItemId, setNewItemId] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);
  const [adding, setAdding] = useState(false);

  // Local form for header fields
  const [form, setForm] = useState<any>({
    supplier_id: "",
    supplier_contact_id: "",
    freight: 0,
    tracking_code: "",
    expected_delivery: "",
    seller_contact: "",
    status: "solicitado" as PurchaseRequestStatus,
  });

  useEffect(() => {
    if (request) {
      setForm({
        supplier_id: request.supplier_id || "",
        supplier_contact_id: request.supplier_contact_id || "",
        freight: Number(request.freight) || 0,
        tracking_code: request.tracking_code || "",
        expected_delivery: request.expected_delivery || "",
        seller_contact: request.seller_contact || "",
        status: request.status,
      });
    }
  }, [request?.id]);

  const ensureRequest = async (): Promise<string> => {
    if (request?.id) return request.id;
    const { data, error } = await supabase
      .from("ticket_purchase_requests" as any)
      .insert({ ticket_id: ticket.id, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    await refetchReq();
    return (data as any).id as string;
  };

  const saveHeader = useMutation({
    mutationFn: async (patch: Partial<typeof form>) => {
      const id = await ensureRequest();
      const payload: any = { ...patch };
      if (payload.expected_delivery === "") payload.expected_delivery = null;
      if (payload.supplier_id === "") payload.supplier_id = null;
      if (payload.supplier_contact_id === "") payload.supplier_contact_id = null;
      const { error } = await supabase
        .from("ticket_purchase_requests" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchReq();
      onRefetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ item, status }: { item: any; status: string }) => {
      const patch: any = { status };
      if (status === "entregue") {
        patch.delivered_at = new Date().toISOString();
        patch.delivered_by = userId;
      } else {
        patch.delivered_at = null;
        patch.delivered_by = null;
      }
      const { error } = await supabase
        .from("ticket_purchase_items" as any)
        .update(patch)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
      onRefetch();
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ticket_purchase_items" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
      onRefetch();
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase
        .from("ticket_purchase_items" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetchItems(),
  });

  const selectedCatalogItem = useMemo(
    () => catalog.find((c) => c.id === newItemId) || null,
    [catalog, newItemId]
  );
  const { data: lastPurchase } = useLastPurchaseForItem(
    selectedCatalogItem?.name || null,
    ticket?.id
  );

  const addItem = async () => {
    if (!newItemId || !selectedCatalogItem) return;
    setAdding(true);
    try {
      const requestId = await ensureRequest();
      const { error } = await supabase.from("ticket_purchase_items" as any).insert({
        ticket_id: ticket.id,
        request_id: requestId,
        item_id: selectedCatalogItem.id,
        item_name: selectedCatalogItem.name,
        quantity: Math.max(1, newQty),
        unit_price: Math.max(0, newPrice),
        status: "pendente",
      });
      if (error) throw error;
      setNewItemId("");
      setNewQty(1);
      setNewPrice(0);
      refetchItems();
      onRefetch();
      toast.success("Item adicionado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  if (!isPurchase) return null;

  const totalItems = items.reduce(
    (acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0),
    0
  );
  const total = totalItems + Number(form.freight || 0);
  const showPrice = cfg?.show_unit_price !== false;
  const showFreight = cfg?.show_freight !== false;
  const showSupplier = cfg?.show_supplier !== false;
  const showTracking = cfg?.show_tracking !== false;
  const showExpected = cfg?.show_expected_delivery !== false;
  const showSellerContact = cfg?.show_seller_contact !== false;

  return (
    <Card className="p-3 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Solicitação de Compra</span>
        </div>
        <Badge variant="outline" className={`text-xs ${STATUS_BADGE[form.status as PurchaseRequestStatus]}`}>
          {STATUS_LABELS[form.status as PurchaseRequestStatus]}
        </Badge>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <Label className="text-xs w-24">Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => {
            setForm({ ...form, status: v });
            saveHeader.mutate({ status: v as any });
          }}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Itens */}
      <div className="space-y-2">
        <Label className="text-xs">Itens</Label>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum item registrado.</p>
        ) : (
          <div className="space-y-1">
            {items.map((it) => {
              const lineTotal = Number(it.unit_price || 0) * Number(it.quantity || 0);
              const isDelivered = it.status === "entregue";
              const isBought = it.status === "comprado";
              return (
                <div
                  key={it.id}
                  className={`grid grid-cols-12 gap-1 items-center rounded-md border px-2 py-1.5 text-xs ${
                    isDelivered
                      ? "bg-emerald-50 border-emerald-200"
                      : isBought
                      ? "bg-amber-50 border-amber-200"
                      : "bg-background"
                  }`}
                >
                  <span className="col-span-4 truncate font-medium">{it.item_name}</span>
                  <Input
                    className="col-span-1 h-7 text-xs"
                    type="number"
                    min={1}
                    value={it.quantity || ""}
                    onChange={(e) => {
                      const r = e.target.value;
                      const n = r === "" ? 0 : parseInt(r, 10) || 0;
                      updateItem.mutate({ id: it.id, patch: { quantity: n } });
                    }}
                  />
                  {showPrice && (
                    <Input
                      className="col-span-2 h-7 text-xs"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Unit."
                      value={it.unit_price || ""}
                      onChange={(e) => {
                        const r = e.target.value;
                        const n = r === "" ? 0 : parseFloat(r) || 0;
                        updateItem.mutate({ id: it.id, patch: { unit_price: n } });
                      }}
                    />
                  )}
                  {showPrice && (
                    <span className="col-span-2 text-right tabular-nums">
                      {formatBRL(lineTotal)}
                    </span>
                  )}
                  <div className="col-span-3 flex justify-end items-center gap-1">
                    {!isBought && !isDelivered && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => setStatus.mutate({ item: it, status: "comprado" })}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    )}
                    {!isDelivered && (
                      <Button
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => setStatus.mutate({ item: it, status: "entregue" })}
                      >
                        <Truck className="h-3 w-3" />
                      </Button>
                    )}
                    {(isBought || isDelivered) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => setStatus.mutate({ item: it, status: "pendente" })}
                      >
                        Reverter
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => removeItem.mutate(it.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Adicionar item */}
        <div className="space-y-1 pt-1 border-t border-primary/20">
          <div className="grid grid-cols-12 gap-1 items-center">
            <Select
              value={newItemId}
              onValueChange={(v) => {
                setNewItemId(v);
                const cat = catalog.find((c) => c.id === v);
                if (cat?.default_quantity) setNewQty(cat.default_quantity);
              }}
            >
              <SelectTrigger className="col-span-5 h-8 text-xs">
                <SelectValue placeholder="Adicionar item..." />
              </SelectTrigger>
              <SelectContent>
                {catalog.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum item no catálogo.
                  </div>
                ) : (
                  catalog.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={newQty || ""}
              onChange={(e) => { const r = e.target.value; setNewQty(r === "" ? 0 : parseInt(r, 10) || 0); }}
              className="col-span-2 h-8 text-xs"
              placeholder="Qtd"
            />
            {showPrice && (
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newPrice || ""}
                onChange={(e) => { const r = e.target.value; setNewPrice(r === "" ? 0 : parseFloat(r) || 0); }}
                className="col-span-3 h-8 text-xs"
                placeholder="Valor unit."
              />
            )}
            <Button
              size="sm"
              variant="outline"
              className="col-span-2 h-8"
              onClick={addItem}
              disabled={!newItemId || adding}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          {selectedCatalogItem && lastPurchase && (
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 pl-1">
              <span>Última compra:</span>
              <span className="font-medium text-foreground">{formatBRL(Number(lastPurchase.unit_price))}</span>
              <span>em {new Date(lastPurchase.created_at).toLocaleDateString("pt-BR")}</span>
              {lastPurchase.supplier_name && <span>• {lastPurchase.supplier_name}</span>}
              {newPrice > 0 && lastPurchase.unit_price > 0 && (
                <PriceDeltaBadge current={newPrice} previous={Number(lastPurchase.unit_price)} threshold={cfg?.price_variation_threshold || 10} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/20">
        {showSupplier && (
          <>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Fornecedor
              </Label>
              <Select
                value={form.supplier_id || "none"}
                onValueChange={(v) => {
                  const val = v === "none" ? "" : v;
                  setForm({ ...form, supplier_id: val, supplier_contact_id: "" });
                  saveHeader.mutate({ supplier_id: val, supplier_contact_id: "" });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem fornecedor —</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.supplier_id && contacts.length > 0 && (
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Contato do fornecedor</Label>
                <Select
                  value={form.supplier_contact_id || "none"}
                  onValueChange={(v) => {
                    const val = v === "none" ? "" : v;
                    const ct = contacts.find((c) => c.id === val);
                    const sellerContact = ct
                      ? `${ct.name}${ct.phone ? " — " + ct.phone : ""}${ct.email ? " — " + ct.email : ""}`
                      : form.seller_contact;
                    setForm({ ...form, supplier_contact_id: val, seller_contact: sellerContact });
                    saveHeader.mutate({ supplier_contact_id: val, seller_contact: sellerContact });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.role ? ` (${c.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
        {showFreight && (
          <div className="space-y-1">
            <Label className="text-xs">Frete (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="h-8 text-xs"
              value={form.freight || ""}
              onChange={(e) =>
                setForm({ ...form, freight: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              onBlur={() => saveHeader.mutate({ freight: form.freight })}
            />
          </div>
        )}
        {showExpected && (
          <div className="space-y-1">
            <Label className="text-xs">Previsão de entrega</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={form.expected_delivery || ""}
              onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
              onBlur={() => saveHeader.mutate({ expected_delivery: form.expected_delivery })}
            />
          </div>
        )}
        {showTracking && (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Código de rastreio</Label>
            <Input
              className="h-8 text-xs"
              value={form.tracking_code || ""}
              onChange={(e) => setForm({ ...form, tracking_code: e.target.value })}
              onBlur={() => saveHeader.mutate({ tracking_code: form.tracking_code })}
            />
          </div>
        )}
        {showSellerContact && (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Contato vendedor</Label>
            <Input
              className="h-8 text-xs"
              value={form.seller_contact || ""}
              onChange={(e) => setForm({ ...form, seller_contact: e.target.value })}
              onBlur={() => saveHeader.mutate({ seller_contact: form.seller_contact })}
              placeholder="Nome / telefone / e-mail"
            />
          </div>
        )}
      </div>

      {/* Totais */}
      {showPrice && (
        <div className="flex justify-end gap-4 pt-2 border-t border-primary/20 text-xs">
          <span className="text-muted-foreground">Itens: <span className="font-medium text-foreground">{formatBRL(totalItems)}</span></span>
          {showFreight && (
            <span className="text-muted-foreground">Frete: <span className="font-medium text-foreground">{formatBRL(Number(form.freight) || 0)}</span></span>
          )}
          <span className="font-semibold">Total: {formatBRL(total)}</span>
        </div>
      )}
    </Card>
  );
}

function PriceDeltaBadge({
  current,
  previous,
  threshold,
}: {
  current: number;
  previous: number;
  threshold: number;
}) {
  const delta = ((current - previous) / previous) * 100;
  const abs = Math.abs(delta);
  const above = delta > 0;
  const exceeds = abs > threshold;
  const cls = !exceeds
    ? "bg-slate-100 text-slate-700 border-slate-200"
    : above
    ? "bg-red-100 text-red-800 border-red-200"
    : "bg-emerald-100 text-emerald-800 border-emerald-200";
  const Icon = above ? TrendingUp : TrendingDown;
  return (
    <Badge variant="outline" className={`text-[10px] ml-1 ${cls}`}>
      <Icon className="h-2.5 w-2.5 mr-0.5" />
      {above ? "+" : ""}
      {delta.toFixed(1)}%
    </Badge>
  );
}
