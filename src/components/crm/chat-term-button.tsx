import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { TERM_STATUS_LABELS, termNumberLabel, type TechnicalTermStatus } from "@/lib/technical-terms";
import { techStageLabel } from "@/lib/technical-service-cycle";
import { TechProtocolActions } from "./tech-protocol-actions";

/** Chat: "Enviar termo" quando a categoria exige termo; "Ver termo" quando já existe. */
export function ChatTermButton({ ticketId, onSend }: { ticketId: string | null; onSend: () => void }) {
  const { data } = useQuery({
    queryKey: ["technical-terms", "ticket", ticketId, "chat"],
    enabled: !!ticketId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ data: terms }, { data: tk }] = await Promise.all([
        supabase.from("technical_service_terms").select("*").eq("ticket_id", ticketId!).neq("status", "cancelado")
          .order("created_at", { ascending: false }).limit(1),
        supabase.from("service_tickets").select("id, status, tech_stage, protocol_number").eq("id", ticketId!).maybeSingle(),
      ]);
      return { term: (terms?.[0] as any) ?? null, ticket: tk as any };
    },
  });
  const term = data?.term;
  // Aviso dentro da conversa quando o cliente responde.
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!term) return;
    const key = `${term.id}:${term.status}`;
    if (last.current && last.current !== key && ["aceito", "recusado"].includes(term.status)) {
      const fn = term.status === "aceito" ? toast.success : toast.error;
      fn(`Termo ${termNumberLabel(term.seq, data?.ticket?.protocol_number)} ${term.status} por ${term.responder_name ?? "responsável"}.`);
    }
    last.current = key;
  }, [term?.id, term?.status]);

  if (!term) {
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSend}>
        <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Enviar termo
      </Button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Eye className="h-3.5 w-3.5 mr-1" /> Ver termo
          <Badge variant={term.status === "recusado" ? "destructive" : "secondary"} className="ml-1 h-4 text-[10px]">
            {TERM_STATUS_LABELS[term.status as TechnicalTermStatus]}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="start">
        <p className="text-sm font-medium">{termNumberLabel(term.seq, data?.ticket?.protocol_number)} — {term.service_label ?? term.service_type}</p>
        {term.term_label && <p className="text-xs text-muted-foreground">Termo de aceite: {term.term_label}</p>}
        <p className="text-xs text-muted-foreground">
          Responsável: {term.responsible_name}
          {data?.ticket?.tech_stage && <> · Protocolo: {techStageLabel(data.ticket.tech_stage)}</>}
        </p>
        {term.status === "recusado" && term.responder_note && <p className="text-xs text-destructive">Motivo: {term.responder_note}</p>}
        {data?.ticket && <TechProtocolActions ticket={data.ticket} term={term} onNewTerm={onSend} />}
      </PopoverContent>
    </Popover>
  );
}
