import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { findCategoryByLabel, type TicketCategoryOption } from "@/hooks/use-ticket-categories";
import {
  TERM_STATUS_LABELS,
  serviceTypeLabel,
  allowedServiceTypes,
  categoryRequiresTerm,
  termNumberLabel,
  type TechnicalTermStatus,
} from "@/lib/technical-terms";
import { TechnicalTermDialog } from "./technical-term-dialog";
import { TechProtocolActions } from "./tech-protocol-actions";
import { techStageLabel } from "@/lib/technical-service-cycle";

interface Props {
  ticket: {
    id: string;
    status?: string;
    tech_stage?: string | null;
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
  const requiresTerm = categoryRequiresTerm(cat?.termType);
  // [] = categoria "escolher": o formulário oferece todos os tipos ativos do catálogo.
  const types = requiresTerm ? allowedServiceTypes(cat?.termType, []) : [];

  const { data: terms = [] } = useQuery({
    queryKey: ["technical-terms", "ticket", ticket.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("technical_service_terms")
        .select("id, seq, service_type, service_label, status, responsible_name, responsible_phone, responsible_email, responded_at, responder_note, superseded_by")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
  const { data: tests = [] } = useQuery({
    queryKey: ["technical-terms", "tests", ticket.id],
    enabled: !!ticket.tech_stage,
    queryFn: async () => {
      const { data } = await supabase.from("service_tickets")
        .select("id, protocol_number, created_at, test_result, contact_name, opened_by, closed_by")
        .eq("tech_protocol_id", ticket.id).order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  if (!requiresTerm && terms.length === 0 && !ticket.tech_stage) return null;
  const hasActive = terms.some((t: any) => ["pendente", "aceito", "enviada"].includes(t.status));
  const latest: any = terms.find((t: any) => t.status !== "cancelado");

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Termo de serviço técnico
          {ticket.tech_stage && <Badge variant="outline" className="ml-1">{techStageLabel(ticket.tech_stage)}</Badge>}</p>
        {requiresTerm && !hasActive && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Gerar termo</Button>
        )}
      </div>
      {requiresTerm && !terms.some((t: any) => t.status === "enviada") && (
        <p className="text-xs text-muted-foreground">
          Esta categoria exige aceite do responsável pela frota. O protocolo só é finalizado pelo teste de equipamento "Serviço concluído" ou encerrando após recusa.
        </p>
      )}
      {terms.map((t: any) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">{termNumberLabel(t.seq)}</span>
          <Badge variant="outline">{serviceTypeLabel(t.service_type, null, t.service_label)}</Badge>
          <Badge variant={t.status === "recusado" ? "destructive" : t.status === "aceito" ? "default" : "secondary"}>
            {TERM_STATUS_LABELS[t.status as TechnicalTermStatus]}
          </Badge>
          <span className="text-muted-foreground">{t.responsible_name}</span>
          {t.status === "recusado" && t.responder_note && <span className="text-destructive">— {t.responder_note}</span>}
        </div>
      ))}
      {latest && <TechProtocolActions ticket={{ id: ticket.id, status: ticket.status ?? "aberto", tech_stage: ticket.tech_stage }} term={latest} onNewTerm={() => setOpen(true)} />}
      {tests.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-medium">Testes de equipamento</p>
          {tests.map((t) => (
            <p key={t.id} className="text-xs text-muted-foreground">
              #{t.protocol_number} · {new Date(t.created_at).toLocaleString("pt-BR")} · {t.contact_name ?? "-"} ·{" "}
              {t.test_result === "concluido" ? "Serviço concluído" : "Parcial"}
            </p>
          ))}
        </div>
      )}
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
