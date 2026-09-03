import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withBrazilianDdi } from "@/lib/chat-utils";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Search, Loader2, Pencil, Trash2, Wrench, RefreshCw, Plus, MessageSquare, Star, History, Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ContactChatActions } from "@/components/contatos/contact-chat-actions";

type Technician = {
  id: string;
  contact_phone: string;
  name: string;
  phone: string | null;
  address: string | null;
  city_state: string | null;
  is_city_default: boolean | null;
  notes: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  phone: string;
  address: string;
  city_state: string;
  is_city_default: boolean;
  notes: string;
  contact_phone: string;
};

const emptyForm: FormState = { name: "", phone: "", address: "", city_state: "", is_city_default: false, notes: "", contact_phone: "" };

type TechnicianNote = {
  id: string;
  technician_id: string;
  note: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

export function TechniciansAdmin() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Technician | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newNote, setNewNote] = useState("");

  const clearCityDefault = async (city: string, isDefault: boolean, ignoreId: string | null) => {
    const c = city.trim();
    if (!isDefault || !c) return;
    let q = supabase
      .from("chat_technicians" as any)
      .update({ is_city_default: false } as any)
      .ilike("city_state", c);
    if (ignoreId) q = q.neq("id", ignoreId);
    await q;
  };

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["technicians-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_technicians" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as Technician[];
    },
  });

  const filtered = useMemo(() => {
    const base = !search.trim()
      ? data
      : (() => {
          const term = search.toLowerCase().trim();
          const digits = term.replace(/\D/g, "");
          return data.filter(
            (t) =>
              t.name?.toLowerCase().includes(term) ||
              (t.phone || "").toLowerCase().includes(term) ||
              (digits && (t.contact_phone || "").includes(digits)) ||
              (t.address || "").toLowerCase().includes(term) ||
              (t.city_state || "").toLowerCase().includes(term),
          );
        })();
    return [...base].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }),
    );
  }, [data, search]);

  const startChatFromTechnician = async (t: Technician) => {
    const digits = (t.phone || t.contact_phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Telefone inválido para iniciar conversa.");
      return;
    }
    setStartingId(t.id);
    try {
      const uid = user?.id || null;
      const { data: existing } = await supabase
        .from("zapi_chats")
        .select("id, channel_id, status, assigned_to")
        .ilike("phone", `%${digits.slice(-10)}%`)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let chatId: string | null = null;
      let channelId: string | null = null;

      if (existing) {
        chatId = (existing as any).id;
        channelId = (existing as any).channel_id;
        const upd: any = {};
        if ((existing as any).status === "aguardando" || !(existing as any).assigned_to) {
          upd.status = "em_atendimento";
          if (uid) upd.assigned_to = uid;
        }
        if (Object.keys(upd).length > 0) {
          await supabase.from("zapi_chats").update(upd).eq("id", chatId!);
        }
      } else {
        const { data: channels } = await (supabase as any).rpc("list_channels_safe");
        const active = (channels || []).find((c: any) => c.is_active) || (channels || [])[0];
        if (!active) {
          toast.error("Nenhum canal disponível para iniciar conversa.");
          return;
        }
        channelId = active.id;
        const { data: created, error } = await supabase
          .from("zapi_chats")
          .insert({
            channel_id: channelId,
            phone: digits,
            contact_name: t.name || null,
            status: "em_atendimento",
            assigned_to: uid,
          } as any)
          .select("id")
          .single();
        if (error || !created) {
          toast.error("Falha ao criar conversa: " + (error?.message || ""));
          return;
        }
        chatId = (created as any).id;
      }
      toast.success("Conversa aberta na Central");
      navigate({ to: "/central", search: { chat: chatId!, channel: channelId! } as any });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar conversa");
    } finally {
      setStartingId(null);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setCreating(true);
  };

  const openEdit = (t: Technician) => {
    setEditing(t);
    setForm({
      name: t.name || "",
      phone: t.phone || "",
      address: t.address || "",
      city_state: t.city_state || "",
      is_city_default: !!t.is_city_default,
      notes: t.notes || "",
      contact_phone: t.contact_phone || "",
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error("Nome obrigatório");
      if (name.length > 120) throw new Error("Nome muito longo");
      const contactDigits = withBrazilianDdi(form.contact_phone || form.phone);
      if (!contactDigits) throw new Error("Informe o telefone do contato vinculado");
      await clearCityDefault(form.city_state, form.is_city_default, null);
      const { error } = await supabase.from("chat_technicians" as any).insert({
        contact_phone: contactDigits,
        name,
        phone: form.phone.trim() ? withBrazilianDdi(form.phone) : null,
        address: form.address.trim() || null,
        city_state: form.city_state.trim() || null,
        is_city_default: form.is_city_default && !!form.city_state.trim(),
        notes: form.notes.trim() || null,
        created_by: user?.id || null,
        created_by_name: profile?.name || user?.email || null,
        updated_by: user?.id || null,
        updated_by_name: profile?.name || user?.email || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Técnico cadastrado");
      setCreating(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["technicians-admin"] });
      queryClient.invalidateQueries({ queryKey: ["chat-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cadastrar"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sem técnico selecionado");
      const name = form.name.trim();
      if (!name) throw new Error("Nome obrigatório");
      if (name.length > 120) throw new Error("Nome muito longo");
      await clearCityDefault(form.city_state, form.is_city_default, editing.id);
      const { error } = await supabase
        .from("chat_technicians" as any)
        .update({
          name,
          phone: form.phone.trim() ? withBrazilianDdi(form.phone) : null,
          address: form.address.trim() || null,
          city_state: form.city_state.trim() || null,
          is_city_default: form.is_city_default && !!form.city_state.trim(),
          notes: form.notes.trim() || null,
          updated_by: user?.id || null,
          updated_by_name: profile?.name || user?.email || null,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Técnico atualizado");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["technicians-admin"] });
      queryClient.invalidateQueries({ queryKey: ["chat-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_technicians" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Técnico removido");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["technicians-admin"] });
      queryClient.invalidateQueries({ queryKey: ["chat-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["technician-notes", editing?.id],
    enabled: !!editing?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_notes" as any)
        .select("*")
        .eq("technician_id", editing!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TechnicianNote[];
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const text = newNote.trim();
      if (!text) throw new Error("Escreva uma observação");
      if (!editing) throw new Error("Sem técnico selecionado");
      const { error } = await supabase.from("technician_notes" as any).insert({
        technician_id: editing.id,
        note: text,
        created_by: user?.id || null,
        created_by_name: profile?.name || user?.email || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["technician-notes", editing?.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao adicionar observação"),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("technician_notes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["technician-notes", editing?.id] }),
    onError: (e: any) => toast.error(e?.message || "Erro ao remover observação"),
  });

  const FormFields = (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={120}
        />
      </div>
      <div>
        <Label className="text-xs">Telefone</Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          maxLength={40}
        />
      </div>
      <div>
        <Label className="text-xs">Endereço</Label>
        <Input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          maxLength={300}
        />
      </div>
      <div>
        <Label className="text-xs">Cidade/Estado</Label>
        <Input
          value={form.city_state}
          onChange={(e) => setForm((f) => ({ ...f, city_state: e.target.value }))}
          placeholder="Belo Horizonte/MG"
          maxLength={120}
        />
      </div>
      <label className="flex items-start gap-2 rounded-md border p-2">
        <Checkbox
          checked={form.is_city_default}
          disabled={!form.city_state.trim()}
          onCheckedChange={(v) => setForm((f) => ({ ...f, is_city_default: v === true }))}
        />
        <span className="text-xs leading-tight">
          Técnico padrão da cidade
          <span className="block text-[10px] text-muted-foreground">
            Somente um técnico pode ser o padrão de cada cidade/estado.
          </span>
        </span>
      </label>
      <div>
        <Label className="text-xs">Observação</Label>
        <Textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          maxLength={1000}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{filtered.length} técnico(s)</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo técnico
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, endereço, cidade..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade/Estado</TableHead>
                <TableHead>Padrão da cidade</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Tel. do contato</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum técnico cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-sm">{t.phone || "—"}</TableCell>
                    <TableCell className="max-w-[12rem] truncate" title={t.city_state || ""}>
                      {t.city_state || "—"}
                    </TableCell>
                    <TableCell>
                      {t.is_city_default ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          <Star className="h-3 w-3" /> Padrão
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={t.notes || ""}>
                      {t.notes || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.contact_phone}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startChatFromTechnician(t)}
                          disabled={startingId === t.id}
                          title="Encaminhar para conversa no chat"
                        >
                          {startingId === t.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(t.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo técnico</DialogTitle>
            <DialogDescription>
              Cadastre um técnico vinculado a um número de contato.
            </DialogDescription>
          </DialogHeader>
          <ContactChatActions
            phone={form.phone || form.contact_phone}
            name={form.name}
            onNavigate={() => { setCreating(false); setForm(emptyForm); }}
          />
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Telefone do contato vinculado *</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="Ex.: 5531999999999 (apenas dígitos)"
                maxLength={40}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Número do WhatsApp/contato onde o técnico aparecerá. Se vazio, usa o telefone abaixo.
              </p>
            </div>
            {FormFields}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar técnico</DialogTitle>
          </DialogHeader>
          <ContactChatActions
            phone={form.phone || form.contact_phone}
            name={form.name}
            onNavigate={() => setEditing(null)}
          />
          <Tabs defaultValue="dados">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="historico" className="flex-1 gap-1">
                <History className="h-4 w-4" /> Histórico
              </TabsTrigger>
            </TabsList>
            <TabsContent value="dados" className="mt-3">{FormFields}</TabsContent>
            <TabsContent value="historico" className="mt-3 space-y-3">
              <div className="flex items-start gap-2">
                <Textarea
                  rows={2}
                  placeholder="Adicionar observação sobre o técnico..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  maxLength={2000}
                />
                <Button
                  size="icon"
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  title="Adicionar"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="h-64 pr-2">
                {notesLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto my-6" />
                ) : notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma observação registrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">
                            {n.created_by_name || "Usuário"}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(n.created_at).toLocaleString("pt-BR")}
                            </span>
                            {n.created_by === user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => deleteNoteMutation.mutate(n.id)}
                                title="Remover"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap mt-1">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!form.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover técnico?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
