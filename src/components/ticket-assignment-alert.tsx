import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BellRing, Mail, UserPlus, Repeat } from "lucide-react";

type Alert = {
  id: string;
  ticket_id: string;
  event_type: string;
  triggered_by_name: string | null;
  protocol: string | null;
  client_name: string | null;
  subject: string | null;
  created_at: string;
};

const db = supabase as any;

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.35].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* ignore */ }
}

export function TicketAssignmentAlert() {
  const [uid, setUid] = useState<string | null>(null);
  const [queue, setQueue] = useState<Alert[]>([]);
  const [sound, setSound] = useState(true);
  const lastBeep = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!uid) return;
    const [{ data }, { data: s }] = await Promise.all([
      db.from("ticket_assignment_alerts").select("*").eq("target_user_id", uid)
        .is("acknowledged_at", null).order("created_at", { ascending: true }).limit(20),
      db.from("ticket_assignment_alert_settings").select("sound_enabled").eq("id", 1).maybeSingle(),
    ]);
    setQueue((data as Alert[]) || []);
    setSound(s?.sound_enabled ?? true);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    load();
    const ch = supabase
      .channel(`ticket-assign-alerts-${uid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ticket_assignment_alerts", filter: `target_user_id=eq.${uid}` },
        () => load())
      .subscribe();
    const iv = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [uid, load]);

  const current = queue[0];

  useEffect(() => {
    if (current && sound && lastBeep.current !== current.id) {
      lastBeep.current = current.id;
      beep();
    }
  }, [current, sound]);

  const ack = async (open: boolean) => {
    if (!current) return;
    const c = current;
    setQueue((q) => q.slice(1));
    await db.from("ticket_assignment_alerts").update({ acknowledged_at: new Date().toISOString() }).eq("id", c.id);
    if (open) navigate({ to: "/atendimentos", search: { ticket: c.ticket_id } as any });
  };

  if (!current) return null;

  const Icon = current.event_type === "email" ? Mail : current.event_type === "reassigned" ? Repeat : UserPlus;
  const title = current.event_type === "email" ? "Novo chamado via e-mail"
    : current.event_type === "reassigned" ? "Chamado transferido para você" : "Novo chamado para você";
  const who = current.event_type === "email" || !current.triggered_by_name || current.triggered_by_name.startsWith("Sistema")
    ? "Atribuído automaticamente" + (current.event_type === "email" ? " via e-mail" : "")
    : `${current.triggered_by_name} atribuiu este chamado a você`;

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-background/70 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="w-[min(92vw,460px)] rounded-xl border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary"><Icon className="h-6 w-6" /></div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><BellRing className="h-4 w-4 text-destructive" />{title}</h2>
            <p className="text-sm text-muted-foreground">{who}</p>
          </div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">Protocolo:</span> <b>{current.protocol || "—"}</b></div>
          <div><span className="text-muted-foreground">Cliente:</span> {current.client_name || "—"}</div>
          <div><span className="text-muted-foreground">Assunto:</span> {current.subject || "—"}</div>
          <div className="text-xs text-muted-foreground">{new Date(current.created_at).toLocaleString("pt-BR")}</div>
        </div>
        {queue.length > 1 && <p className="text-xs text-muted-foreground">+{queue.length - 1} outro(s) alerta(s) aguardando</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => ack(true)}>Abrir chamado</Button>
          <Button className="flex-1" autoFocus onClick={() => ack(false)}>OK, estou ciente</Button>
        </div>
      </div>
    </div>
  );
}
