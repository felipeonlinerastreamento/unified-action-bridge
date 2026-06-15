import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShoppingCart, Plus, Pencil, Trash2, Loader2, Building2, Settings2 } from "lucide-react";
import {
  usePurchaseItems,
  usePurchaseSuppliers,
  usePurchaseSupplierContacts,
  usePurchaseFlowConfig,
  type PurchaseItem,
  type PurchaseSupplier,
} from "@/hooks/use-purchase-requests";

export function PurchaseConfig() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Solicitação de Compra
        </CardTitle>
        <CardDescription>
          Catálogo de itens, cadastro de fornecedores e configuração do fluxo
          aplicado a chamados da categoria "Solicitação de Compra".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Itens</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
            <TabsTrigger value="flow">Fluxo</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="mt-4">
            <ItemsTab />
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            <SuppliersTab />
          </TabsContent>
          <TabsContent value="flow" className="mt-4">
            <FlowTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ITEMS TAB
// ============================================================================
function ItemsTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = usePurchaseItems(false);
  const { data: types = [] } = useQuery({
    queryKey: ["purchase-item-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_item_types" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return ((data || []) as unknown) as { id: string; name: string; is_active: boolean }[];
    },
  });
  const [open, setOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseItem | null>(null);
  const [name, setName] = useState("");
  const [defaultQty, setDefaultQty] = useState(1);
  const [itemType, setItemType] = useState<string>("none");
  const [isActive, setIsActive] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);


  const reset = () => {
    setEditing(null);
    setName("");
    setDefaultQty(1);
    setItemType("none");
    setIsActive(true);
  };
  const openCreate = () => {
    reset();
    setOpen(true);
  };
  const openEdit = (it: PurchaseItem) => {
    setEditing(it);
    setName(it.name);
    setDefaultQty(it.default_quantity || 1);
    setItemType(it.item_type || "none");
    setIsActive(it.is_active);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do item");
      const payload = {
        name: name.trim(),
        default_quantity: Math.max(1, defaultQty),
        item_type: itemType === "none" ? null : itemType,
        is_active: isActive,
      };
      if (editing) {
        const { error } = await supabase
          .from("purchase_items" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("purchase_items" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Item atualizado" : "Item criado");
      qc.invalidateQueries({ queryKey: ["purchase-items"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item excluído");
      qc.invalidateQueries({ queryKey: ["purchase-items"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo item
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Nenhum item cadastrado.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead className="w-[100px]">Qtd. Padrão</TableHead>
              <TableHead className="w-[80px]">Ativo</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize">
                  {it.item_type || "—"}
                </TableCell>
                <TableCell>{it.default_quantity}</TableCell>
                <TableCell>
                  {it.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      Sim
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Não</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(it.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle>
            <DialogDescription>
              Defina nome, tipo opcional e a quantidade padrão sugerida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Toner Preto HP / Rastreador X3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={itemType} onValueChange={setItemType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem tipo —</SelectItem>
                    <SelectItem value="suprimento">Suprimento</SelectItem>
                    <SelectItem value="equipamento">Equipamento</SelectItem>
                    <SelectItem value="chip">Chip</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantidade padrão</Label>
                <Input
                  type="number"
                  min={1}
                  value={defaultQty}
                  onChange={(e) =>
                    setDefaultQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Item ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              O item será removido do catálogo. Solicitações já registradas
              continuam preservadas pelo nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// SUPPLIERS TAB
// ============================================================================
function SuppliersTab() {
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = usePurchaseSuppliers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseSupplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [contacts, setContacts] = useState<
    { id?: string; name: string; role: string; phone: string; email: string }[]
  >([]);

  const { data: existingContacts = [] } = usePurchaseSupplierContacts(editing?.id);

  useEffect(() => {
    if (editing) {
      setContacts(
        existingContacts.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role || "",
          phone: c.phone || "",
          email: c.email || "",
        }))
      );
    }
  }, [editing, existingContacts]);

  const reset = () => {
    setEditing(null);
    setName("");
    setCnpj("");
    setNotes("");
    setIsActive(true);
    setContacts([]);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (s: PurchaseSupplier) => {
    setEditing(s);
    setName(s.name);
    setCnpj(s.cnpj || "");
    setNotes(s.notes || "");
    setIsActive(s.is_active);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do fornecedor");
      const payload = {
        name: name.trim(),
        cnpj: cnpj.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive,
      };
      let supplierId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("purchase_suppliers" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("purchase_suppliers" as any)
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        supplierId = (data as any)?.id;
      }
      if (!supplierId) throw new Error("Falha ao salvar fornecedor");

      // Sincroniza contatos: remove os que sumiram, atualiza, insere novos
      const incomingIds = contacts.filter((c) => c.id).map((c) => c.id!);
      if (editing) {
        const toDelete = existingContacts
          .filter((c) => !incomingIds.includes(c.id))
          .map((c) => c.id);
        if (toDelete.length > 0) {
          await supabase
            .from("purchase_supplier_contacts" as any)
            .delete()
            .in("id", toDelete);
        }
      }
      for (const c of contacts) {
        if (!c.name.trim()) continue;
        const cPayload = {
          supplier_id: supplierId,
          name: c.name.trim(),
          role: c.role.trim() || null,
          phone: c.phone.trim() || null,
          email: c.email.trim() || null,
        };
        if (c.id) {
          await supabase
            .from("purchase_supplier_contacts" as any)
            .update(cPayload)
            .eq("id", c.id);
        } else {
          await supabase.from("purchase_supplier_contacts" as any).insert(cPayload);
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Fornecedor atualizado" : "Fornecedor criado");
      qc.invalidateQueries({ queryKey: ["purchase-suppliers"] });
      qc.invalidateQueries({ queryKey: ["purchase-supplier-contacts"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_suppliers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor excluído");
      qc.invalidateQueries({ queryKey: ["purchase-suppliers"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo fornecedor
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          Nenhum fornecedor cadastrado.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[160px]">CNPJ</TableHead>
              <TableHead className="w-[80px]">Ativo</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {s.name}
                </TableCell>
                <TableCell className="text-xs">{s.cnpj || "—"}</TableCell>
                <TableCell>
                  {s.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      Sim
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Não</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar fornecedor" : "Novo fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Cadastre nome, CNPJ, observações e contatos do fornecedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nome / Razão social *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              </div>
              <div className="space-y-1 flex items-end gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Ativo</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições de pagamento, prazos, observações gerais..."
              />
            </div>
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Contatos</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setContacts([
                      ...contacts,
                      { name: "", role: "", phone: "", email: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar contato
                </Button>
              </div>
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum contato. Adicione vendedores, gerentes etc.
                </p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-start border rounded-md p-2"
                    >
                      <Input
                        className="col-span-3 h-8 text-xs"
                        placeholder="Nome *"
                        value={c.name}
                        onChange={(e) => {
                          const next = [...contacts];
                          next[idx].name = e.target.value;
                          setContacts(next);
                        }}
                      />
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="Cargo"
                        value={c.role}
                        onChange={(e) => {
                          const next = [...contacts];
                          next[idx].role = e.target.value;
                          setContacts(next);
                        }}
                      />
                      <Input
                        className="col-span-3 h-8 text-xs"
                        placeholder="Telefone"
                        value={c.phone}
                        onChange={(e) => {
                          const next = [...contacts];
                          next[idx].phone = e.target.value;
                          setContacts(next);
                        }}
                      />
                      <Input
                        className="col-span-3 h-8 text-xs"
                        placeholder="E-mail"
                        value={c.email}
                        onChange={(e) => {
                          const next = [...contacts];
                          next[idx].email = e.target.value;
                          setContacts(next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 col-span-1"
                        onClick={() =>
                          setContacts(contacts.filter((_, i) => i !== idx))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor e seus contatos serão removidos. Solicitações já
              vinculadas perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// FLOW CONFIG TAB
// ============================================================================
function FlowTab() {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = usePurchaseFlowConfig();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (cfg && !form) setForm(cfg);
  }, [cfg, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form?.id) throw new Error("Configuração não carregada");
      const payload = {
        show_unit_price: !!form.show_unit_price,
        show_freight: !!form.show_freight,
        show_supplier: !!form.show_supplier,
        show_tracking: !!form.show_tracking,
        show_expected_delivery: !!form.show_expected_delivery,
        show_seller_contact: !!form.show_seller_contact,
        require_unit_price: !!form.require_unit_price,
        require_supplier: !!form.require_supplier,
        require_tracking: !!form.require_tracking,
        require_expected_delivery: !!form.require_expected_delivery,
        price_variation_threshold: Number(form.price_variation_threshold) || 10,
      };
      const { error } = await supabase
        .from("purchase_flow_config" as any)
        .update(payload)
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["purchase-flow-config"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fieldRows: { key: string; reqKey?: string; label: string }[] = [
    { key: "show_unit_price", reqKey: "require_unit_price", label: "Valor unitário (e total automático)" },
    { key: "show_freight", label: "Frete" },
    { key: "show_supplier", reqKey: "require_supplier", label: "Fornecedor" },
    { key: "show_tracking", reqKey: "require_tracking", label: "Código de rastreio" },
    { key: "show_expected_delivery", reqKey: "require_expected_delivery", label: "Previsão de entrega" },
    { key: "show_seller_contact", label: "Contato do vendedor" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Settings2 className="h-4 w-4" /> Campos do fluxo
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo</TableHead>
              <TableHead className="w-[120px] text-center">Exibir</TableHead>
              <TableHead className="w-[120px] text-center">Obrigatório</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fieldRows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="text-sm">{r.label}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={!!form[r.key]}
                    onCheckedChange={(v) => setForm({ ...form, [r.key]: v })}
                  />
                </TableCell>
                <TableCell className="text-center">
                  {r.reqKey ? (
                    <Switch
                      checked={!!form[r.reqKey]}
                      disabled={!form[r.key]}
                      onCheckedChange={(v) => setForm({ ...form, [r.reqKey!]: v })}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="space-y-1 col-span-2">
          <Label>Limite de variação de preço aceitável (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.price_variation_threshold}
            onChange={(e) =>
              setForm({
                ...form,
                price_variation_threshold: Math.max(0, parseFloat(e.target.value) || 0),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Itens cuja variação de preço entre compras for superior a este
            percentual serão destacados nos relatórios.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
