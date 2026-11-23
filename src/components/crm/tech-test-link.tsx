import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { recordTechTestResult, searchTechProtocols } from "@/lib/technical-terms.functions";
import { techStageLabel } from "@/lib/technical-service-cycle";

/** Chamado de teste de equipamento: protocolo obrigatório + resultado parcial/concluído. */
export function TechTestLink({ ticket }: { ticket: { id: string; tech_protocol_id?: string | null; test_result?: string | null; teste_sem_protocolo_justificativa?: string | null } }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [semProtocolo, setSemProtocolo] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const justificado = (ticket.teste_sem_protocolo_justificativa || "").trim();
  const salvarJustificativa = async () => {
    const j = justificativa.trim();
    if (j.length < 10) { toast.error("Escreva a justificativa (mín. 10 caracteres)."); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("service_tickets").update({
        teste_sem_protocolo_justificativa: j,
        teste_sem_protocolo_por: u.user?.id ?? null,
        teste_sem_protocolo_em: new Date().toISOString(),
      } as any).eq("id", ticket.id);
      if (error) throw error;
      toast.success("Justificativa registrada. O chamado já pode ser finalizado sem protocolo.");
      setSemProtocolo(false); setJustificativa("");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message || "Falha ao registrar a justificativa."); }
    finally { setBusy(false); }
  };
  const { data: linked } = useQuery({
    queryKey: ["tech-protocol", ticket.tech_protocol_id],
    enabled: !!ticket.tech_protocol_id,
    queryFn: async () => (await supabase.from("service_tickets").select("id, protocol_number, plate, tech_stage, status").eq("id", ticket.tech_protocol_id!).maybeSingle()).data as any,
  });
  const { data: results = [] } = useQuery({
    queryKey: ["tech-protocol-search", q],
    enabled: !ticket.test_result && q.trim().length >= 2,
    queryFn: () => searchTechProtocols({ data: { q } }),
  });
  const record = async (result: "parcial" | "concluido") => {
    const pid = picked?.id ?? ticket.tech_protocol_id;
    if (!pid) { toast.error("Informe o protocolo de serviço técnico."); return; }
    setBusy(true);
    try {
      const r = await recordTechTestResult({ data: { testTicketId: ticket.id, protocolId: pid, result } });
      toast.success(r.finalized ? "Serviço concluído — protocolo finalizado." : "Teste parcial registrado.");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message || "Falha ao registrar teste."); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm font-medium flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> Protocolo de serviço técnico</p>
      {linked && (
        <p className="text-xs">
          Protocolo <span className="font-mono">#{linked.protocol_number}</span> {linked.plate && `· ${linked.plate}`}{" "}
          <Badge variant="outline">{techStageLabel(linked.tech_stage)}</Badge>
          {ticket.test_result && <Badge className="ml-1">{ticket.test_result === "concluido" ? "Serviço concluído" : "Teste parcial"}</Badge>}
        </p>
      )}
      {!ticket.test_result && justificado && (
        <p className="text-xs rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2">
          <b>Sem protocolo</b> — {justificado}
        </p>
      )}
      {!ticket.test_result && !justificado && (
        <>
          <Input value={picked ? `#${picked.protocol_number} ${picked.plate ?? ""}` : q} onChange={(e) => { setPicked(null); setQ(e.target.value); }}
            placeholder="Buscar por número, placa ou cliente" className="h-8 text-xs" />
          {!picked && results.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border text-xs">
              {results.map((r: any) => (
                <button key={r.id} type="button" className="block w-full px-2 py-1 text-left hover:bg-muted" onClick={() => setPicked(r)}>
                  #{r.protocol_number} · {r.plate ?? "-"} · {r.companies?.name ?? r.contact_name ?? ""} · {techStageLabel(r.tech_stage)}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => record("parcial")}>Teste parcial</Button>
            <Button size="sm" disabled={busy} onClick={() => record("concluido")}>Serviço concluído</Button>
          </div>
          <p className="text-xs text-muted-foreground">Para finalizar, informe o protocolo e o resultado do teste — ou justifique abaixo por que não há protocolo.</p>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
            <Checkbox checked={semProtocolo} onCheckedChange={(v) => setSemProtocolo(v === true)} />
            Não há protocolo de serviço técnico (justificar)
          </label>
          {semProtocolo && (
            <div className="space-y-2">
              <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Por que este teste não tem protocolo? (mín. 10 caracteres)" className="min-h-[70px] text-xs" />
              <p className="text-[11px] text-muted-foreground">A justificativa fica nos comentários do chamado e gera um registro em Relatórios › Gatilhos.</p>
              <Button size="sm" variant="secondary" disabled={busy || justificativa.trim().length < 10} onClick={salvarJustificativa}>Registrar justificativa</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
