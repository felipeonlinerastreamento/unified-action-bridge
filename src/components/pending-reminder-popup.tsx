import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare, Briefcase, Users, ArrowRight, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "pending-reminder:last:";
const SEEN_DISPATCH_PREFIX = "pending-reminder:dispatch-seen:";

type Settings = {
  id: string;
  is_enabled: boolean;
  interval_hours: number;
  quiet_start: string;
  quiet_end: string;
  weekdays: number[];
  target_type: "all" | "sector" | "users";
  target_sector_ids: string[];
  target_user_ids: string[];
  show_open_chats: boolean;
  show_my_tickets: boolean;
  show_sector_tickets: boolean;
  min_total_to_show: number;
  sound_enabled: boolean;
  requires_acknowledge: boolean;
};

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function parseHM(s: string) {
  const [h, m] = (s || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function withinWindow(start: string, end: string) {
  const now = nowMinutes();
  const s = parseHM(start);
  const e = parseHM(end);
  if (s <= e) return now >= s && now <= e;
  // janela atravessa meia-noite
  return now >= s || now <= e;
}

function playBeep() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 220);
  } catch {}
}

export function PendingReminderPopup() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [logId, setLogId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<"auto" | "manual">("auto");
  const lastEvalRef = useRef<number>(0);

  // Settings
  const { data: settings } = useQuery<Settings | null>({
    queryKey: ["pending-reminder-settings"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data } = await supabase
        .from("pending_reminder_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      return (data as any) || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Setores do usuário
  const { data: userSectors } = useQuery({
    queryKey: ["my-sector-names", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: assigns } = await supabase
        .from("user_sector_assignments")
        .select("sector_id")
        .eq("user_id", user!.id);
      const sectorIds = (assigns || []).map((a: any) => a.sector_id);
      if (sectorIds.length === 0) return { ids: [] as string[], names: [] as string[] };
      const { data: secs } = await supabase
        .from("sectors")
        .select("id, name")
        .in("id", sectorIds);
      return {
        ids: sectorIds,
        names: (secs || []).map((s: any) => s.name).filter(Boolean),
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  // Tick reavaliador (a cada 60s + visibilidade)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Elegibilidade (auto)
  const eligibleAuto = (() => {
    if (!isAuthenticated || !user?.id || !settings) return false;
    if (!settings.is_enabled) return false;
    const dow = new Date().getDay();
    if (!(settings.weekdays || []).includes(dow)) return false;
    if (!withinWindow(settings.quiet_start, settings.quiet_end)) return false;
    if (settings.target_type === "users") {
      if (!(settings.target_user_ids || []).includes(user.id)) return false;
    } else if (settings.target_type === "sector") {
      const my = userSectors?.ids || [];
      const allowed = settings.target_sector_ids || [];
      if (!my.some((id) => allowed.includes(id))) return false;
    }
    return true;
  })();

  // Carrega pendências
  const { data: pending } = useQuery({
    queryKey: [
      "pending-reminder-data",
      user?.id,
      settings?.show_open_chats,
      settings?.show_my_tickets,
      settings?.show_sector_tickets,
      (userSectors?.names || []).join("|"),
      tick,
    ],
    enabled: isAuthenticated && !!user?.id && !!settings,
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id || !settings) {
        return { chats: [], myTickets: [], sectorTickets: [] };
      }
      const sectorNames = userSectors?.names || [];

      const [chatsRes, myRes, sectorRes] = await Promise.all([
        settings.show_open_chats
          ? supabase
              .from("zapi_chats")
              .select("id, contact_name, phone, last_message_preview, last_message_at, status")
              .in("status", ["aguardando", "em_atendimento"])
              .order("last_message_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] as any[] }),
        settings.show_my_tickets
          ? supabase
              .from("service_tickets")
              .select("id, attendance_id, contact_name, status, priority, category, sector")
              .eq("assigned_to", user.id)
              .in("status", ["aberto", "em_andamento"] as any)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] as any[] }),
        settings.show_sector_tickets && sectorNames.length > 0
          ? supabase
              .from("service_tickets")
              .select("id, attendance_id, contact_name, status, priority, category, sector, assigned_to")
              .in("sector", sectorNames)
              .in("status", ["aberto", "em_andamento"] as any)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const mineIds = new Set((myRes.data || []).map((t: any) => t.id));
      const sectorTickets = (sectorRes.data || []).filter((t: any) => !mineIds.has(t.id));

      return {
        chats: chatsRes.data || [],
        myTickets: myRes.data || [],
        sectorTickets,
      };
    },
  });

  const totalPending =
    (pending?.chats.length || 0) +
    (pending?.myTickets.length || 0) +
    (pending?.sectorTickets.length || 0);

  // Função comum: abre o popup e registra log
  const openPopup = useCallback(
    async (trigger: "auto" | "manual", dispatchId?: string | null) => {
      if (!user?.id) return;
      setTriggerType(trigger);
      setAcknowledged(false);
      setOpen(true);
      if (settings?.sound_enabled) playBeep();
      try {
        const { data: inserted } = await supabase
          .from("pending_reminder_dispatch_log" as any)
          .insert({
            user_id: user.id,
            trigger_type: trigger,
            dispatch_id: dispatchId || null,
            total_pending: totalPending,
          } as any)
          .select("id")
          .single();
        if (inserted?.id) setLogId(inserted.id);
      } catch (e) {
        console.warn("[pending-reminder] log insert failed", e);
      }
    },
    [user?.id, settings?.sound_enabled, totalPending],
  );

  // Decide se abre — fluxo automático
  useEffect(() => {
    if (!eligibleAuto || !settings || !user?.id || !pending) return;
    if (typeof window === "undefined") return;
    if (open) return;

    const now = Date.now();
    if (now - lastEvalRef.current < 30_000) return;
    lastEvalRef.current = now;

    const key = `${STORAGE_PREFIX}${user.id}`;
    const lastStr = localStorage.getItem(key);
    const last = lastStr ? parseInt(lastStr, 10) : 0;
    const intervalMs = Math.max(15, settings.interval_hours * 60) * 60 * 1000;

    if (now - last < intervalMs) return;
    if (totalPending < (settings.min_total_to_show || 1)) {
      localStorage.setItem(key, String(now));
      return;
    }

    const otherOpen = document.querySelector('[role="dialog"][data-state="open"]');
    if (otherOpen) return;

    localStorage.setItem(key, String(now));
    openPopup("auto");
  }, [eligibleAuto, settings, user?.id, pending, totalPending, open, tick, openPopup]);

  // Realtime: disparo manual
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const channel = supabase
      .channel(`pending-reminder-dispatches-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pending_reminder_dispatches" },
        async (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;

          // Evita duplicar: marca dispatch como visto
          const seenKey = `${SEEN_DISPATCH_PREFIX}${row.id}`;
          if (localStorage.getItem(seenKey)) return;
          localStorage.setItem(seenKey, String(Date.now()));

          // Verifica se este usuário é alvo
          let matches = false;
          if (row.target_type === "all") matches = true;
          else if (row.target_type === "users") {
            matches = Array.isArray(row.target_user_ids) && row.target_user_ids.includes(user.id);
          } else if (row.target_type === "sector") {
            const mine = userSectors?.ids || [];
            const allowed: string[] = Array.isArray(row.target_sector_ids) ? row.target_sector_ids : [];
            matches = mine.some((id) => allowed.includes(id));
          }
          if (!matches) return;

          // Não acumula em cima de outro popup já aberto
          if (open) return;

          openPopup("manual", row.id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, userSectors?.ids, open, openPopup]);

  const requireAck = settings?.requires_acknowledge !== false;

  const confirm = useCallback(async () => {
    if (requireAck && !acknowledged) return;
    if (logId) {
      try {
        await supabase
          .from("pending_reminder_dispatch_log" as any)
          .update({ acknowledged_at: new Date().toISOString() } as any)
          .eq("id", logId);
      } catch (e) {
        console.warn("[pending-reminder] ack update failed", e);
      }
    }
    setOpen(false);
    setLogId(null);
    setAcknowledged(false);
  }, [requireAck, acknowledged, logId]);

  if (!isAuthenticated) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Bloqueia fechamento por click-out / ESC quando exige confirmação
        if (!v && requireAck && !acknowledged) return;
        if (!v) confirm();
      }}
    >
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => {
          if (requireAck && !acknowledged) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (requireAck && !acknowledged) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (requireAck && !acknowledged) e.preventDefault();
        }}
        showCloseButton={!(requireAck && !acknowledged)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Lembrete de pendências
            {triggerType === "manual" && (
              <Badge variant="outline" className="text-[10px] py-0 h-5">
                disparo manual
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Você tem <strong>{totalPending}</strong> {totalPending === 1 ? "item" : "itens"} aguardando atenção.
            {requireAck && (
              <span className="block mt-1 text-amber-600 text-xs">
                É necessário confirmar para continuar usando o sistema.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[45vh] pr-2">
          <div className="space-y-3">
            {pending && pending.chats.length > 0 && (
              <Section
                icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
                title="Chats em aberto"
                count={pending.chats.length}
                href="/central"
                onNavigate={() => {/* navegação livre, mas dialog continua bloqueante */}}
              >
                {pending.chats.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="text-xs p-2 rounded-md border bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">
                        {c.contact_name || c.phone}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 h-5">
                        {c.status}
                      </Badge>
                    </div>
                    {c.last_message_preview && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1">
                        {c.last_message_preview}
                      </p>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {pending && pending.myTickets.length > 0 && (
              <Section
                icon={<Briefcase className="h-4 w-4 text-amber-500" />}
                title="Meus atendimentos"
                count={pending.myTickets.length}
                href="/atendimentos"
              >
                {pending.myTickets.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="text-xs p-2 rounded-md border bg-card flex items-center gap-2">
                    <span className="font-medium truncate flex-1">
                      {t.contact_name || t.attendance_id}
                    </span>
                    {t.priority && (
                      <Badge variant="outline" className="text-[10px] py-0 h-5">
                        {t.priority}
                      </Badge>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {pending && pending.sectorTickets.length > 0 && (
              <Section
                icon={<Users className="h-4 w-4 text-purple-500" />}
                title="Atendimentos do meu setor"
                count={pending.sectorTickets.length}
                href="/atendimentos"
              >
                {pending.sectorTickets.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="text-xs p-2 rounded-md border bg-card flex items-center gap-2">
                    <span className="font-medium truncate flex-1">
                      {t.contact_name || t.attendance_id}
                    </span>
                    {t.sector && (
                      <Badge variant="secondary" className="text-[10px] py-0 h-5">
                        {t.sector}
                      </Badge>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {totalPending === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                🎉 Sem pendências no momento.
              </p>
            )}
          </div>
        </ScrollArea>

        {requireAck && (
          <label
            htmlFor="ack-checkbox"
            className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 cursor-pointer hover:bg-muted/60 transition-colors"
          >
            <Checkbox
              id="ack-checkbox"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(!!v)}
              className="mt-0.5"
            />
            <div className="text-sm">
              <span className="font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Irei verificar e categorizar todos
              </span>
              <p className="text-xs text-muted-foreground">
                Marque para confirmar que vai revisar as pendências listadas acima.
              </p>
            </div>
          </label>
        )}

        <DialogFooter>
          <Button
            onClick={confirm}
            size="sm"
            disabled={requireAck && !acknowledged}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  count,
  children,
  href,
  onNavigate,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
  href?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        <span>{title}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {count}
        </Badge>
        {href && (
          <Link
            to={href}
            onClick={onNavigate}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            Ver todos <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
