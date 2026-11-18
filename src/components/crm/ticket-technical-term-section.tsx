import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { findCategoryByLabel, type TicketCategoryOption } from "@/hooks/use-ticket-categories";
import {
  SERVICE_TYPE_LABELS,
  TERM_STATUS_LABELS,
  allowedServiceTypes,
  termNumberLabel,
  type TechnicalServiceType,
  type TechnicalTermStatus,
} from "@/lib/technical-terms";
import { TechnicalTermDialog } from "./technical-term-dialog";

interface Props {
  ticket: {
    id: string;
    category?: string | null;
    company_id?: string | null;
    plate?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    companies?: { name?: string | null } | null;
  };
  categories: TicketCategoryOption[];
}

/** Mostra/gera o termo técnico do chamado quando a categoria exige aceite. */
export function TicketTechnicalTermSection({ ticket, categories }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const cat = findCategoryByLabel(categories, ticket.category);
  const types = allowedServiceTypes(cat?.termType);

  const { data: terms = [] } = useQuery({
    queryKey: ["technical-terms", "ticket", ticket.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("technical_service_terms")
        .select("id, seq, service_type, status, responsible_name, responded_at, responder_note")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (types.length === 0 && terms.length === 0) return null;
  const hasActive = terms.some((t: any) => ["pendente", "aceito", "enviada"].includes(t.status));

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Termo de serviço técnico</p>
        {types.length > 0 && !hasActive && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Gerar termo</Button>
        )}
      </div>
      {types.length > 0 && !terms.some((t: any) => t.status === "enviada") && (
        <p className="text-xs text-muted-foreground">
          Esta categoria exige aceite do responsável pela frota. O chamado só pode ser finalizado depois que o termo for aceito e enviado para agendamento (CRM &gt; Serviços Técnicos).
        </p>
      )}
      {terms.map((t: any) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">{termNumberLabel(t.seq)}</span>
          <Badge variant="outline">{SERVICE_TYPE_LABELS[t.service_type as TechnicalServiceType]}</Badge>
          <Badge variant={t.status === "recusado" ? "destructive" : t.status === "aceito" ? "default" : "secondary"}>
            {TERM_STATUS_LABELS[t.status as TechnicalTermStatus]}
          </Badge>
          <span className="text-muted-foreground">{t.responsible_name}</span>
          {t.status === "recusado" && t.responder_note && <span className="text-destructive">— {t.responder_note}</span>}
        </div>
      ))}
      <TechnicalTermDialog
        open={open}
        onOpenChange={setOpen}
        allowedTypes={types.length ? types : undefined}
        ticket={{
          id: ticket.id,
          companyId: ticket.company_id,
          clientName: ticket.companies?.name ?? null,
          plate: ticket.plate,
          contactName: ticket.contact_name,
          contactPhone: ticket.contact_phone,
        }}
        onCreated={() => qc.invalidateQueries({ queryKey: ["technical-terms", "ticket", ticket.id] })}
      />
    </div>
  );
}
