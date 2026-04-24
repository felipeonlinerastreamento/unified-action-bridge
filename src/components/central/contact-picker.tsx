import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, User, Building2, Users, Phone } from "lucide-react";

export interface PickedContact {
  id: string;
  name: string;
  phone: string; // digits only
  company?: string;
  source: "crm" | "sub_client" | "company_phone";
}

interface Props {
  selectedId?: string;
  onSelect: (contact: PickedContact) => void;
}

export function ContactPicker({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contact-picker-all"],
    queryFn: async () => {
      const [crmRes, subRes, phonesRes] = await Promise.all([
        supabase
          .from("crm_contacts")
          .select("id, name, phone, email, companies(name)")
          .order("name")
          .limit(500),
        supabase
          .from("sub_clients")
          .select("id, name, phone, email, companies(name)")
          .order("name")
          .limit(500),
        supabase
          .from("company_phones")
          .select("id, phone_number, companies(name)")
          .limit(500),
      ]);

      const list: PickedContact[] = [];
      const seen = new Set<string>();

      const addIfNew = (c: PickedContact) => {
        const key = `${c.source}:${c.phone}`;
        if (!c.phone || seen.has(key)) return;
        seen.add(key);
        list.push(c);
      };

      for (const r of crmRes.data || []) {
        addIfNew({
          id: `crm-${r.id}`,
          name: r.name || "Sem nome",
          phone: (r.phone || "").replace(/\D/g, ""),
          company: (r.companies as any)?.name,
          source: "crm",
        });
      }
      for (const r of subRes.data || []) {
        addIfNew({
          id: `sub-${r.id}`,
          name: r.name || "Sem nome",
          phone: (r.phone || "").replace(/\D/g, ""),
          company: (r.companies as any)?.name,
          source: "sub_client",
        });
      }
      for (const r of phonesRes.data || []) {
        const company = (r.companies as any)?.name;
        addIfNew({
          id: `cph-${r.id}`,
          name: company || "Empresa",
          phone: (r.phone_number || "").replace(/\D/g, ""),
          company,
          source: "company_phone",
        });
      }

      return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
    staleTime: 60000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts.slice(0, 100);
    const term = search.toLowerCase().trim();
    const digits = term.replace(/\D/g, "");
    return contacts
      .filter((c) => {
        if (c.name.toLowerCase().includes(term)) return true;
        if (c.company?.toLowerCase().includes(term)) return true;
        if (digits && c.phone.includes(digits)) return true;
        return false;
      })
      .slice(0, 100);
  }, [contacts, search]);

  const sourceLabel = (s: PickedContact["source"]) => {
    if (s === "crm") return { label: "CRM", icon: User, cls: "bg-blue-50 text-blue-700 border-blue-200" };
    if (s === "sub_client") return { label: "Sub-cliente", icon: Users, cls: "bg-purple-50 text-purple-700 border-purple-200" };
    return { label: "Telefone empresa", icon: Phone, cls: "bg-amber-50 text-amber-700 border-amber-200" };
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Buscar por nome, empresa ou telefone..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando contatos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          {search ? "Nenhum contato encontrado." : "Nenhum contato salvo."}
        </div>
      ) : (
        <ScrollArea className="h-72 rounded-md border">
          <div className="p-1 space-y-1">
            {filtered.map((c) => {
              const meta = sourceLabel(c.source);
              const Icon = meta.icon;
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className={`w-full text-left p-2 rounded-md text-sm transition-colors hover:bg-accent/60 ${
                    isSelected ? "bg-accent border border-primary/40" : "border border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{c.phone}</span>
                        {c.company && c.source !== "company_phone" && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5">
                            <Building2 className="h-2.5 w-2.5" />
                            {c.company}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] gap-1 shrink-0 ${meta.cls}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {meta.label}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <p className="text-[10px] text-muted-foreground">
        {filtered.length} de {contacts.length} contato(s){contacts.length > filtered.length && search ? "" : contacts.length > 100 && !search ? " · refine a busca para ver mais" : ""}
      </p>
    </div>
  );
}
