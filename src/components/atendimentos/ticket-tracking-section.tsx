import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Package, RefreshCw, Pencil, ChevronDown, MapPin, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { refreshTicketTracking, previewTracking } from "@/lib/tracking.functions";

interface Props {
  ticketId: string;
  trackingCode: string | null;
}

function statusColor(status?: string | null, delivered?: boolean) {
  if (delivered) return "bg-emerald-600 text-white";
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s.includes("entregue")) return "bg-emerald-600 text-white";
  if (s.includes("trânsito") || s.includes("transito") || s.includes("encaminh")) return "bg-blue-500 text-white";
  if (s.includes("postado") || s.includes("postag")) return "bg-amber-500 text-white";
  if (s.includes("aguard")) return "bg-amber-500 text-white";
  if (s.includes("falha") || s.includes("erro") || s.includes("ausent") || s.includes("devolv")) return "bg-red-600 text-white";
  return "bg-violet-600 text-white";
}

export function TicketTrackingSection({ ticketId, trackingCode }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!trackingCode);
  const [code, setCode] = useState(trackingCode || "");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: tracking, refetch } = useQuery({
    queryKey: ["ticket-tracking", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_tracking")
        .select("*")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      return data;
    },
    enabled: !!ticketId,
  });

  const saveCode = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(c)) {
      toast.error("Formato inválido. Use AA123456789BR");
      return;
    }
    setSaving(true);
    try {
      // Update ticket
      await supabase.from("service_tickets").update({ tracking_code: c }).eq("id", ticketId);

      // Upsert tracking row (one per ticket)
      const { data: existing } = await supabase
        .from("ticket_tracking")
        .select("id")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      if (existing) {
        await supabase.from("ticket_tracking").update({ tracking_code: c }).eq("id", existing.id);
      } else {
        await supabase.from("ticket_tracking").insert({
          ticket_id: ticketId,
          tracking_code: c,
          carrier: "correios",
        });
      }

      // First fetch
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { authorization: `Bearer ${session?.access_token}` };
      const preview = await previewTracking({ data: { code: c }, headers });
      if (preview && (preview as any).ok === false) {
        toast.warning(`Código salvo, mas falha ao consultar: ${(preview as any).error}`);
      }
      await refreshTicketTracking({ data: { ticketId }, headers });

      toast.success("Código de envio salvo");
      setEditing(false);
      await refetch();
      qc.invalidateQueries({ queryKey: ["service-tickets"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { authorization: `Bearer ${session?.access_token}` };
      const res = await refreshTicketTracking({ data: { ticketId }, headers });
      if ((res as any)?.ok === false) {
        toast.error((res as any).error || "Falha ao atualizar");
      } else {
        toast.success("Rastreamento atualizado");
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ["service-tickets"] });
    } finally {
      setRefreshing(false);
    }
  };

  const events: any[] = Array.isArray(tracking?.events) ? (tracking?.events as any[]) : [];

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Rastreamento Sedex</span>
        </div>
        <div className="flex gap-1">
          {trackingCode && !editing && (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={refreshNow} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="AA123456789BR"
            className="h-8 text-sm font-mono"
            maxLength={13}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveCode} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Salvar
            </Button>
            {trackingCode && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setCode(trackingCode); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">{trackingCode}</span>
            <Badge className={`text-[10px] ${statusColor(tracking?.last_status, tracking?.is_delivered)}`}>
              {tracking?.is_delivered ? <CheckCircle className="h-3 w-3 mr-1" /> : null}
              {tracking?.last_status || "Sem dados"}
            </Badge>
          </div>
          {tracking?.last_location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {tracking.last_location}
            </p>
          )}
          {tracking?.last_status_date && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(tracking.last_status_date).toLocaleString("pt-BR")}
            </p>
          )}
          {tracking?.last_error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {tracking.last_error}
            </p>
          )}

          {events.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-full justify-between text-xs">
                  Histórico ({events.length}) <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5 mt-1 max-h-48 overflow-y-auto pr-1">
                {events.map((ev, i) => (
                  <div key={i} className="text-xs border-l-2 border-primary/40 pl-2 py-0.5">
                    <p className="font-medium">{ev.descricao}</p>
                    {ev.detalhe && <p className="text-muted-foreground">{ev.detalhe}</p>}
                    <p className="text-muted-foreground">
                      {ev.data ? new Date(ev.data).toLocaleString("pt-BR") : ""} {ev.local ? `· ${ev.local}` : ""}
                    </p>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
}
