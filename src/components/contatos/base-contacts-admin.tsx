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
import { Search, Loader2, Users, Building2, Plus, MessageSquare } from "lucide-react";

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

export function BaseContactsAdmin() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

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
      <p className="text-sm text-muted-foreground">
        Base operacional de contatos (clientes, funcionários, técnicos e outros). Leads,
        parceiros e fornecedores ficam no menu CRM.
      </p>

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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{filtered.length} contato(s)</p>
    </div>
  );
}
