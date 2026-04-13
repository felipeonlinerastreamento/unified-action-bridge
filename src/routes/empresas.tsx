import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  FileText,
  Trash2,
  Pencil,
  X,
} from "lucide-react";

export const Route = createFileRoute("/empresas")({
  component: EmpresasPage,
});

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  emails: string[];
  contacts: any[];
  instructions: string;
  notes: string;
  created_at: string;
}

interface CompanyPhone {
  id: string;
  company_id: string;
  phone_number: string;
}

function EmpresasPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formCnpj, setFormCnpj] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmails, setFormEmails] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formPhones, setFormPhones] = useState<string[]>([""]);
  const [formContacts, setFormContacts] = useState<{ name: string; role: string; phone: string }[]>([
    { name: "", role: "", phone: "" },
  ]);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as Company[];
    },
    enabled: isAuthenticated,
  });

  const { data: companyPhones = [] } = useQuery({
    queryKey: ["company-phones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_phones").select("*");
      if (error) throw error;
      return (data || []) as CompanyPhone[];
    },
    enabled: isAuthenticated,
  });

  const resetForm = () => {
    setFormName("");
    setFormCnpj("");
    setFormPhone("");
    setFormEmails("");
    setFormInstructions("");
    setFormNotes("");
    setFormPhones([""]);
    setFormContacts([{ name: "", role: "", phone: "" }]);
    setEditingCompany(null);
  };

  const openEdit = (company: Company) => {
    const phones = companyPhones
      .filter((p) => p.company_id === company.id)
      .map((p) => p.phone_number);
    setEditingCompany(company);
    setFormName(company.name);
    setFormCnpj(company.cnpj || "");
    setFormPhone(company.phone || "");
    setFormEmails((company.emails || []).join(", "));
    setFormInstructions(company.instructions || "");
    setFormNotes(company.notes || "");
    setFormPhones(phones.length > 0 ? phones : [""]);
    setFormContacts(
      company.contacts && company.contacts.length > 0
        ? company.contacts
        : [{ name: "", role: "", phone: "" }]
    );
    setIsDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const emails = formEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const contacts = formContacts.filter((c) => c.name.trim());
      const companyData = {
        name: formName.trim(),
        cnpj: formCnpj.trim() || null,
        phone: formPhone.trim() || null,
        emails,
        contacts,
        instructions: formInstructions.trim(),
        notes: formNotes.trim(),
      };

      let companyId: string;

      if (editingCompany) {
        const { error } = await supabase
          .from("companies")
          .update(companyData)
          .eq("id", editingCompany.id);
        if (error) throw error;
        companyId = editingCompany.id;

        // Delete old phones
        await supabase
          .from("company_phones")
          .delete()
          .eq("company_id", companyId);
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert(companyData)
          .select("id")
          .single();
        if (error) throw error;
        companyId = data.id;
      }

      // Insert phones
      const phoneNumbers = formPhones
        .map((p) => p.trim())
        .filter(Boolean);
      if (phoneNumbers.length > 0) {
        const { error } = await supabase.from("company_phones").insert(
          phoneNumbers.map((phone_number) => ({
            company_id: companyId,
            phone_number,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCompany ? "Empresa atualizada" : "Empresa cadastrada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-phones"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa removida");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-phones"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover"),
  });

  const filtered = companies.filter((c) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.cnpj || "").toLowerCase().includes(s) ||
      companyPhones.some(
        (p) => p.company_id === c.id && p.phone_number.includes(s)
      )
    );
  });

  if (authLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              {companies.length} empresa(s) cadastrada(s)
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nova Empresa
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou telefone..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Telefones</TableHead>
                <TableHead>E-mails</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isLoading ? "Carregando..." : "Nenhuma empresa encontrada"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((company) => {
                  const phones = companyPhones
                    .filter((p) => p.company_id === company.id)
                    .map((p) => p.phone_number);
                  return (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.cnpj || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {phones.map((p, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                          {phones.length === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(company.emails || []).length > 0
                          ? company.emails.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(company)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remover esta empresa?"))
                                deleteMutation.mutate(company.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog for create/edit */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { resetForm(); } setIsDialogOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={formCnpj}
                  onChange={(e) => setFormCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Telefone principal</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>E-mails (separados por vírgula)</Label>
              <Input
                value={formEmails}
                onChange={(e) => setFormEmails(e.target.value)}
                placeholder="email1@empresa.com, email2@empresa.com"
              />
            </div>

            <Separator />

            {/* Linked phones for lookup */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Telefones vinculados (para identificação automática)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormPhones([...formPhones, ""])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {formPhones.map((phone, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => {
                      const newPhones = [...formPhones];
                      newPhones[idx] = e.target.value;
                      setFormPhones(newPhones);
                    }}
                    placeholder="5511999999999"
                  />
                  {formPhones.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setFormPhones(formPhones.filter((_, i) => i !== idx))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Contacts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Contatos da empresa</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFormContacts([...formContacts, { name: "", role: "", phone: "" }])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {formContacts.map((contact, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={contact.name}
                    onChange={(e) => {
                      const c = [...formContacts];
                      c[idx] = { ...c[idx], name: e.target.value };
                      setFormContacts(c);
                    }}
                    placeholder="Nome"
                    className="flex-1"
                  />
                  <Input
                    value={contact.role}
                    onChange={(e) => {
                      const c = [...formContacts];
                      c[idx] = { ...c[idx], role: e.target.value };
                      setFormContacts(c);
                    }}
                    placeholder="Cargo"
                    className="w-32"
                  />
                  <Input
                    value={contact.phone}
                    onChange={(e) => {
                      const c = [...formContacts];
                      c[idx] = { ...c[idx], phone: e.target.value };
                      setFormContacts(c);
                    }}
                    placeholder="Telefone"
                    className="w-40"
                  />
                  {formContacts.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setFormContacts(formContacts.filter((_, i) => i !== idx))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Instruções de atendimento</Label>
              <Textarea
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                placeholder="Instruções específicas para atendimento desta empresa..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Observações gerais..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
