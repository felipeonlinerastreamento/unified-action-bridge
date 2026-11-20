import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reissueRefusedTerm, resendTechnicalTerm, closeProtocolByRefusal } from "@/lib/technical-terms.functions";
import { termActions } from "@/lib/technical-service-cycle";

interface Props {
  ticket: { id: string; status: string; tech_stage?: string | null };
  term: { id: string; status: string; responsible_phone?: string | null; responsible_email?: string | null; superseded_by?: string | null };
  onNewTerm: () => void;
}

/** Ações do termo mais recente: reenviar, recusa (reenviar/novo/encerrar), enviar solicitação. */
export function TechProtocolActions({ ticket, term, onNewTerm }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const a = termActions(term.superseded_by ? "" : term.status, ticket.status !== "finalizado");
  const channels = { sendWhatsapp: !!term.responsible_phone, sendEmail: !!term.responsible_email };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["technical-terms"] }); }
    catch (e: any) { toast.error(e?.message || "Falha."); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {a.resend && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => resendTechnicalTerm({ data: { id: term.id, ...channels } }), "Termo reenviado")}>Reenviar termo</Button>
      )}
      {a.reissue && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => reissueRefusedTerm({ data: { id: term.id, ...channels } }), "Termo reenviado")}>Reenviar mesmo termo</Button>
      )}
      {a.newTerm && <Button size="sm" variant="outline" disabled={busy} onClick={onNewTerm}>Gerar outro termo</Button>}
      {a.closeByRefusal && !closing && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setClosing(true)}>Encerrar protocolo</Button>
      )}
      {closing && (
        <div className="w-full space-y-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo da recusa (obrigatório)" rows={2} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 5}
              onClick={() => run(() => closeProtocolByRefusal({ data: { ticketId: ticket.id, reason } }), "Protocolo encerrado")}>Confirmar encerramento</Button>
            <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      {a.sendRequest && (
        <Button size="sm" asChild><Link to="/crm" search={{ tab: "servicos-tecnicos" }}>Enviar solicitação</Link></Button>
      )}
    </div>
  );
}
