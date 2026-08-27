import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, User, Building2, Users, Phone, MessageCircle } from "lucide-react";

export interface PickedContact {
  id: string;
  name: string;
  phone: string; // digits only
  company?: string;
  source: "crm" | "sub_client" | "company_phone" | "technician" | "chat";
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
      // PostgREST caps responses at 1000 rows: paginate each source explicitly.
      const fetchAll = async (
        table: string,
        columns: string,
        orderCol: string | null,
        ascending = true,
      ) => {
        const rows: any[] = [];
        const page = 1000;
        for (let from = 0; from < 8000; from += page) {
          let q = (supabase as any).from(table).select(columns).range(from, from + page - 1);
          if (orderCol) q = q.order(orderCol, { ascending });
          const { data, error } = await q;
          if (error || !data) break;
          rows.push(...data);
          if (data.length < page) break;
        }
        return rows;
      };

      const [crmRes, subRes, phonesRes, techRes, chatRes] = await Promise.all([
        fetchAll("crm_contacts", "id, name, phone, email, companies(name)", "name"),
        fetchAll("sub_clients", "id, name, phone, email, companies(name)", "name"),
        fetchAll("company_phones", "id, phone_number, companies(name)", null),
        fetchAll("chat_technicians", "id, name, phone, contact_phone, city_state", "name"),
        fetchAll("zapi_chats", "id, contact_name, phone", "last_message_at", false),
      ]).then((r) => r.map((data) => ({ data })));


      const list: PickedContact[] = [];
      const seen = new Set<string>();
      const seenPhones = new Set<string>();

      const addIfNew = (c: PickedContact, dedupeGlobal = false) => {
        const key = `${c.source}:${c.phone}`;
        if (!c.phone || seen.has(key)) return;
        if (dedupeGlobal && seenPhones.has(c.phone)) return;
        seen.add(key);
        seenPhones.add(c.phone);
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
      for (const r of techRes.data || []) {
        const loc = (r as any).city_state || undefined;
        addIfNew({
          id: `tec-${r.id}`,
          name: (r as any).name || "Técnico",
          phone: (((r as any).phone || (r as any).contact_phone) || "").replace(/\D/g, ""),
          company: loc,
          source: "technician",
        });
      }
      for (const r of chatRes.data || []) {
        const raw = String((r as any).phone || "");
        if (raw.includes("-") || raw.includes("@g.us")) continue;
        addIfNew(
          {
            id: `chat-${r.id}`,
            name: (r as any).contact_name || (r as any).phone || "Contato",
            phone: ((r as any).phone || "").replace(/\D/g, ""),
            source: "chat",
          },
          true,
        );
      }

      return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
    staleTime: 60000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts.slice(0, 200);
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const terms = norm(search).split(/\s+/).filter(Boolean);
    return contacts
      .filter((c) => {
        const haystack = `${norm(c.name)} ${norm(c.company || "")} ${c.phone}`;
        // cada termo digitado precisa aparecer em algum campo (busca flexível)
        return terms.every((t) => {
          if (haystack.includes(t)) return true;
          const d = t.replace(/\D/g, "");
          return !!d && c.phone.includes(d);
        });
      })
      .slice(0, 200);
  }, [contacts, search]);


  const sourceLabel = (s: PickedContact["source"]) => {
    if (s === "crm") return { label: "CRM", icon: User, cls: "bg-blue-50 text-blue-700 border-blue-200" };
    if (s === "sub_client") return { label: "Sub-cliente", icon: Users, cls: "bg-purple-50 text-purple-700 border-purple-200" };
    if (s === "technician") return { label: "Técnico", icon: User, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (s === "chat") return { label: "Conversa", icon: MessageCircle, cls: "bg-slate-50 text-slate-700 border-slate-200" };
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
