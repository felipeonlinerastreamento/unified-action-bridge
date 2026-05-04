import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, MessageSquare, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Log = {
  id: string;
  rule_id: string | null;
  rule_name: string;
  chat_id: string | null;
  phone: string | null;
  contact_name: string | null;
  matched_keyword: string;
  message_excerpt: string;
  action_taken: any;
  triggered_at: string;
  acknowledged_at: string | null;
};

const SEEN_PREFIX = "msg-trigger-seen:";
const beepedRef = { current: 0 };

function playBeep() {
  try {
    // @ts-ignore
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 1000;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 250);
  } catch { /* noop */ }
}

export function MessageTriggerAlert() {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const lastBeepRef = useRef(0);

  const { data: logs = [] } = useQuery<Log[]>({
    queryKey: ["message-trigger-logs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data } = await supabase
        .from("message_trigger_logs" as any)
        .select("*")
        .eq("recipient_user_id", user.id)
        .is("acknowledged_at", null)
        .gte("triggered_at", since)
        .order("triggered_at", { ascending: false })
        .limit(20);
      return ((data as any[]) || []) as Log[];
    },
    enabled: isAuthenticated && !!user?.id,
    refetchInterval: 15_000,
  });

  // Realtime subscription for instant alerts
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`msg-trigger-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_trigger_logs", filter: `recipient_user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["message-trigger-logs", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  const visible = useMemo(() => {
    const now = Date.now();
    return logs.find((l) => {
      if (dismissedIds.has(l.id)) return false;
      try {
        const seen = Number(localStorage.getItem(`${SEEN_PREFIX}${l.id}`) || 0);
        if (seen && now - seen < 30 * 60_000) return false;
      } catch { /* noop */ }
      return true;
    }) || null;
  }, [logs, dismissedIds]);

  useEffect(() => {
    if (!visible) return;
    const sound = !!(visible.action_taken && (visible.action_taken as any).sound);
    if (sound && Date.now() - lastBeepRef.current > 4000) {
      lastBeepRef.current = Date.now();
      playBeep();
    }
  }, [visible]);

  if (!visible) return null;

  const acknowledge = async () => {
    try { localStorage.setItem(`${SEEN_PREFIX}${visible.id}`, String(Date.now())); } catch { /* noop */ }
    await supabase
      .from("message_trigger_logs" as any)
      .update({ acknowledged_at: new Date().toISOString() } as any)
      .eq("id", visible.id);
    setDismissedIds((prev) => new Set(prev).add(visible.id));
    qc.invalidateQueries({ queryKey: ["message-trigger-logs", user?.id] });
  };

  return (
    <div
      className={cn(
        "fixed bottom-5 left-5 z-[100] w-[360px] rounded-lg border-2 border-destructive bg-card shadow-2xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
      )}
      role="alertdialog"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 border-b border-destructive/30 bg-destructive/10 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive animate-pulse" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{visible.rule_name}</div>
          <div className="text-xs text-muted-foreground">
            Palavra detectada: <span className="font-medium">{visible.matched_keyword}</span>
          </div>
        </div>
        <button
          onClick={() => setDismissedIds((p) => new Set(p).add(visible.id))}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 truncate font-medium">
            {visible.contact_name || visible.phone || "Contato"}
          </div>
        </div>
        {visible.message_excerpt && (
          <div className="rounded bg-muted/50 p-2 text-xs italic text-muted-foreground line-clamp-3">
            "{visible.message_excerpt}"
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {visible.chat_id && (
            <Button asChild size="sm" variant="outline" className="flex-1">
              <Link to="/central" search={{ chat: visible.chat_id } as any} onClick={acknowledge}>
                Abrir conversa
              </Link>
            </Button>
          )}
          <Button size="sm" onClick={acknowledge} className="gap-1">
            <Check className="h-4 w-4" />
            Visto
          </Button>
        </div>
      </div>
    </div>
  );
}
