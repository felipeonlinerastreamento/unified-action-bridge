import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Loader2, Users, Building2, Plus, MessageSquare, Pencil } from "lucide-react";

const OPERATIONAL_ROLES = ["cliente", "funcionario", "tecnico", "outro"];

const ROLE_LABELS: Record<string, string> = {
  cliente: "Cliente",
  funcionario: "Funcionário",
  tecnico: "Técnico",
  outro: "Outro",
  lead: "Lead",
  comercial: "Comercial",
  parceiro: "Parceiro",
  fornecedor: "Fornecedor",
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  contact_role: "tecnico",
  contact_type: "PF",
  company_id: "none",
};

export function BaseContactsAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [startingId, setStartingId] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["base-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("*, companies(id, name)")
        .order("name");
      return (data || []).filter((c: any) =>
        OPERATIONAL_ROLES.includes(c.contact_role || "cliente"),
      );
    },
  });

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contacts as any[]) {
      if (c.companies?.id) map.set(c.companies.id, c.companies.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [contacts]);

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("crm_contacts").update({ contact_role: role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classificação atualizada");
      queryClient.invalidateQueries({ queryKey: ["base-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const { data: allCompanies = [] } = useQuery({
    queryKey: ["companies-min-base-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name").limit(1000);
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const phone = form.phone.replace(/\D/g, "");
      if (!name) throw new Error("Informe o nome");
      if (phone.length < 10) throw new Error("Informe um telefone válido");
      const { error } = await supabase.from("crm_contacts").insert({
        name,
        phone,
        email: form.email.trim() || null,
        contact_role: form.contact_role,
        contact_type: form.contact_type,
        company_id: form.company_id === "none" ? null : form.company_id,
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato cadastrado");
      setCreating(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["base-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-picker-all"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cadastrar"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sem contato selecionado");
      const name = form.name.trim();
      if (!name) throw new Error("Informe o nome");
      const { error } = await supabase
        .from("crm_contacts")
        .update({
          name,
          phone: form.phone.replace(/\D/g, ""),
          email: form.email.trim() || null,
          contact_role: form.contact_role,
          contact_type: form.contact_type,
          company_id: form.company_id === "none" ? null : form.company_id,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato atualizado");
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["base-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-picker-all"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const startChat = async (c: any) => {
    const digits = (c.phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Telefone inválido para iniciar conversa.");
      return;
    }
    setStartingId(c.id);
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
        const active = (channels || []).find((ch: any) => ch.is_active) || (channels || [])[0];
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
            contact_name: c.name || null,
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


  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return (contacts as any[]).filter((c) => {
      if (roleFilter !== "all" && (c.contact_role || "cliente") !== roleFilter) return false;
      if (typeFilter !== "all" && (c.contact_type || "PF") !== typeFilter) return false;
      if (companyFilter !== "all") {
        if (companyFilter === "none" ? !!c.companies?.id : c.companies?.id !== companyFilter) return false;
      }
      if (!s) return true;
      return (
        c.name?.toLowerCase().includes(s) ||
        (c.phone || "").includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.companies?.name?.toLowerCase().includes(s)
      );
    });
  }, [contacts, search, roleFilter, typeFilter, companyFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Base operacional de contatos (clientes, funcionários, técnicos e outros). Leads,
          parceiros e fornecedores ficam no menu CRM.
        </p>
        <Button size="sm" className="shrink-0" onClick={() => { setForm(emptyForm); setCreating(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo contato
        </Button>
      </div>


      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, telefone, e-mail..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue placeholder="Classificação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as classificações</SelectItem>
              {OPERATIONAL_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
              <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
              <SelectItem value="FORN">Fornecedor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              <SelectItem value="none">Sem empresa vinculada</SelectItem>
              {companies.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classificação</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="w-44">Reclassificar</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum contato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="text-[10px] w-fit">
                          {ROLE_LABELS[c.contact_role || "cliente"]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] w-fit">
                          {c.contact_type || "PF"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>
                      {c.companies?.name ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Building2 className="h-3 w-3" /> {c.companies.name}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.contact_role || "cliente"}
                        onValueChange={(v) => roleMutation.mutate({ id: c.id, role: v })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.keys(ROLE_LABELS).map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar contato"
                          onClick={() => {
                            setEditing(c);
                            setForm({
                              name: c.name || "",
                              phone: (c.phone || "").replace(/\D/g, ""),
                              email: c.email || "",
                              contact_role: c.contact_role || "tecnico",
                              contact_type: c.contact_type || "PF",
                              company_id: c.companies?.id || "none",
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Iniciar conversa"
                          disabled={startingId === c.id}
                          onClick={() => startChat(c)}
                        >
                          {startingId === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
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

      <p className="text-xs text-muted-foreground">{filtered.length} contato(s)</p>

      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo contato</DialogTitle>
            <DialogDescription>
              Cadastre um contato operacional (técnico, cliente, funcionário ou outro).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.name} maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Telefone *</Label>
              <Input value={form.phone} maxLength={40} placeholder="Ex.: 5531999999999"
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                onPaste={(e) => {
                  e.preventDefault();
                  const t = e.clipboardData.getData("text").replace(/\D/g, "");
                  setForm((f) => ({ ...f, phone: t }));
                }} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={form.email} maxLength={160}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Classificação</Label>
                <Select value={form.contact_role}
                  onValueChange={(v) => setForm((f) => ({ ...f, contact_role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.contact_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, contact_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                    <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                    <SelectItem value="FORN">Fornecedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <Select value={form.company_id}
                onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem empresa vinculada</SelectItem>
                  {(allCompanies as any[]).map((co) => (
                    <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
