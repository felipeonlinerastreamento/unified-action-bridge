import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { linkPhoneToCompany } from "@/lib/company-sync.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users, Building2 } from "lucide-react";
import { toast } from "sonner";

interface SubClientLinkerProps {
  contactPhone: string;
  ticketId?: string;
  onSuccess: () => void;
}

export function SubClientLinker({ contactPhone, ticketId, onSuccess }: SubClientLinkerProps) {
  const [search, setSearch] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");

  const { data: subClients = [], isLoading } = useQuery({
    queryKey: ["all-sub-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sub_clients")
        .select("*, companies(id, name, cnpj)")
        .order("name");
      return data || [];
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const sub = subClients.find((s: any) => s.id === selectedSubId);
      if (!sub) throw new Error("Sub-cliente não encontrado");

      const company = sub.companies as any;
      if (!company) throw new Error("Empresa do sub-cliente não encontrada");

      const cleanPhone = contactPhone.replace(/\D/g, "");

      // Update sub-client phone if different
      const subPhone = sub.phone?.replace(/\D/g, "");
      if (subPhone !== cleanPhone) {
        // Link the phone to the company
        const { data: { session } } = await supabase.auth.getSession();
        await linkPhoneToCompany({
          data: {
            companyName: company.name,
            companyCnpj: company.cnpj || undefined,
            phone: contactPhone,
            ticketId,
          },
          headers: { authorization: `Bearer ${session?.access_token}` },
        });
      } else {
        // Just link the phone to the company
        const { data: { session } } = await supabase.auth.getSession();
        await linkPhoneToCompany({
          data: {
            companyName: company.name,
            companyCnpj: company.cnpj || undefined,
            phone: contactPhone,
            ticketId,
          },
          headers: { authorization: `Bearer ${session?.access_token}` },
        });
      }
    },
    onSuccess: () => {
      toast.success("Contato vinculado ao sub-cliente");
      onSuccess();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao vincular"),
  });

  const filtered = subClients.filter((s: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.phone?.includes(term) ||
      (s.companies as any)?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar sub-cliente..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          <Users className="h-4 w-4 inline mr-1" />
          Nenhum sub-cliente encontrado.
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
          {filtered.slice(0, 50).map((sub: any) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubId(sub.id)}
              className={`w-full text-left p-2 rounded text-sm hover:bg-accent/50 transition-colors ${
                selectedSubId === sub.id ? "bg-accent border border-primary/30" : ""
              }`}
            >
              <p className="font-medium">{sub.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{sub.phone}</span>
                {(sub.companies as any)?.name && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                    <Building2 className="h-2.5 w-2.5" />
                    {(sub.companies as any).name}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Button
        className="w-full"
        onClick={() => linkMutation.mutate()}
        disabled={!selectedSubId || linkMutation.isPending}
      >
        {linkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Vincular ao Sub-cliente
      </Button>
    </div>
  );
}