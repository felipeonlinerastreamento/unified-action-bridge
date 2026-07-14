import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Users, Clock, MessageSquare, Bot, CheckCircle2, UserCheck,
  Timer, AlertTriangle, Maximize2, Minimize2, TrendingUp,
  Zap, Ghost, MessageCircleWarning, Settings2, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============ Personalização de layout ============
type BlockId =
  | "queue" | "inatt" | "bot" | "tmr" | "tma" | "fin"
  | "zombie" | "engage" | "tmer"
  | "ops" | "critical" | "zombieList" | "ranking";

type BlockGroup = "kpi" | "panel" | "full";

const BLOCK_META: Record<BlockId, { label: string; group: BlockGroup; defaultSpan: number; defaultVisible: boolean }> = {
  queue:      { label: "KPI • Fila aguardando",       group: "kpi",   defaultSpan: 1, defaultVisible: true },
  inatt:      { label: "KPI • Em atendimento",        group: "kpi",   defaultSpan: 1, defaultVisible: true },
  bot:        { label: "KPI • Bot travado",           group: "kpi",   defaultSpan: 1, defaultVisible: true },
  tmr:        { label: "KPI • TMR",                   group: "kpi",   defaultSpan: 1, defaultVisible: true },
  tma:        { label: "KPI • TMA hoje",              group: "kpi",   defaultSpan: 1, defaultVisible: true },
  fin:        { label: "KPI • Finalizados hoje",      group: "kpi",   defaultSpan: 1, defaultVisible: true },
  zombie:     { label: "KPI • Chats zumbis",          group: "kpi",   defaultSpan: 2, defaultVisible: true },
  engage:     { label: "KPI • Taxa de engajamento",   group: "kpi",   defaultSpan: 2, defaultVisible: true },
  tmer:       { label: "KPI • TMER",                  group: "kpi",   defaultSpan: 2, defaultVisible: true },
  ops:        { label: "Painel • Operadores online", group: "panel", defaultSpan: 1, defaultVisible: true },
  critical:   { label: "Painel • Fila crítica",      group: "panel", defaultSpan: 3, defaultVisible: true },
  zombieList: { label: "Painel • Lista de zumbis",   group: "full",  defaultSpan: 1, defaultVisible: true },
  ranking:    { label: "Painel • Ranking",           group: "full",  defaultSpan: 1, defaultVisible: true },
};

type LayoutState = {
  visible: Record<BlockId, boolean>;
  span: Record<BlockId, number>;
};

const DEFAULT_LAYOUT: LayoutState = {
  visible: Object.fromEntries((Object.keys(BLOCK_META) as BlockId[]).map((k) => [k, BLOCK_META[k].defaultVisible])) as Record<BlockId, boolean>,
  span:    Object.fromEntries((Object.keys(BLOCK_META) as BlockId[]).map((k) => [k, BLOCK_META[k].defaultSpan]))    as Record<BlockId, number>,
};

const KPI_SPAN_CLASS: Record<number, string> = {
  1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3",
  4: "lg:col-span-4", 5: "lg:col-span-5", 6: "lg:col-span-6",
};
const PANEL_SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4",
};

function maxSpanFor(group: BlockGroup): number {
  return group === "kpi" ? 6 : group === "panel" ? 4 : 1;
}

export const Route = createFileRoute("/painel-tv")({
  component: PainelTvPage,
});

// Metas / thresholds
const THRESH = {
  queueYellowMin: 5,
  queueRedMin: 10,
  botIdleMin: 10,
  zombieMin: 5,               // chat em_atendimento sem resposta do operador > 5min
  engagementTargetMin: 2,     // 1ª resposta do operador em ≤ 2min
  tmerTargetMin: 3,           // tempo médio entre msgs do cliente e resposta
  operatorOnlineMin: 2,
  tmrTargetMin: 3,
  tmaTargetMin: 20,
  dailyFinalizedGoal: 30,
};

function minutesAgo(iso?: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function fmtMinutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "—";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h > 0 ? `${h}h${String(r).padStart(2, "0")}` : `${r}min`;
}

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function PainelTvPage() {
  const { hasRole, isAuthenticated, user } = useAuth();
  const { canSeeMenu, isLoading: permLoading } = useUserPermissions();
  const isAdmin = hasRole("admin") || hasRole("gestor");
  const allowed = isAdmin || canSeeMenu("painel-tv");

  // ============ Layout personalizável (por usuário) ============
  const layoutKey = user?.id ? `painel-tv-layout:${user.id}` : null;
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT);

  useEffect(() => {
    if (!layoutKey) return;
    try {
      const raw = localStorage.getItem(layoutKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLayout({
          visible: { ...DEFAULT_LAYOUT.visible, ...(parsed?.visible ?? {}) },
          span:    { ...DEFAULT_LAYOUT.span,    ...(parsed?.span    ?? {}) },
        });
      }
    } catch { /* ignore */ }
  }, [layoutKey]);

  const persistLayout = (next: LayoutState) => {
    setLayout(next);
    if (layoutKey) {
      try { localStorage.setItem(layoutKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };
  const toggleVisible = (id: BlockId) =>
    persistLayout({ ...layout, visible: { ...layout.visible, [id]: !layout.visible[id] } });
  const setSpan = (id: BlockId, span: number) => {
    const max = maxSpanFor(BLOCK_META[id].group);
    const clamped = Math.max(1, Math.min(max, span));
    persistLayout({ ...layout, span: { ...layout.span, [id]: clamped } });
  };
  const resetLayout = () => persistLayout(DEFAULT_LAYOUT);

  const isVisible = (id: BlockId) => layout.visible[id] !== false;
  const kpiClass = (id: BlockId) => KPI_SPAN_CLASS[layout.span[id] ?? BLOCK_META[id].defaultSpan] ?? "lg:col-span-1";
  const panelClass = (id: BlockId) => PANEL_SPAN_CLASS[layout.span[id] ?? BLOCK_META[id].defaultSpan] ?? "md:col-span-1";

  const [isFs, setIsFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Início do dia local
  const todayStartISO = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  // Chats abertos (aguardando / em_atendimento / bot)
  const { data: openChats = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-open-chats"],
    enabled: isAuthenticated && allowed,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("zapi_chats")
        .select("id, status, sector_name, contact_name, phone, assigned_to, created_at, updated_at, last_message_at")
        .in("status", ["aguardando", "em_atendimento", "bot"])
        .order("created_at", { ascending: true })
        .limit(1000);
      return data || [];
    },
  });

  // Tickets finalizados hoje
  const { data: closedToday = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-closed-today", todayStartISO],
    enabled: isAuthenticated && allowed,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_tickets")
        .select("id, closed_at, created_at, opened_by, assigned_to, category")
        .eq("status", "finalizado")
        .gte("closed_at", todayStartISO)
        .limit(2000);
      return data || [];
    },
  });

  // Chats de hoje (para TMR)
  const { data: todayChats = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-today-chats", todayStartISO],
    enabled: isAuthenticated && allowed,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("zapi_chats")
        .select("id, created_at, assigned_to")
        .gte("created_at", todayStartISO)
        .in("status", ["em_atendimento", "finalizado"])
        .limit(1000);
      return data || [];
    },
  });

  // Primeiras mensagens do operador para TMR (limitado aos chats de hoje)
  const { data: firstOpMsgs = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-first-op-msgs", todayChats.map((c) => c.id).join(",")],
    enabled: isAuthenticated && allowed && todayChats.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const ids = todayChats.map((c) => c.id);
      const chunks: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const { data } = await supabase
          .from("zapi_messages")
          .select("chat_id, created_at, sent_by_user_id, from_me, is_whisper")
          .in("chat_id", slice)
          .eq("from_me", true)
          .or("is_whisper.is.null,is_whisper.eq.false")
          .not("sent_by_user_id", "is", null)
          .order("created_at", { ascending: true });
        chunks.push(...(data || []));
      }
      return chunks;
    },
  });
  // Todas as mensagens (ambos sentidos) dos chats de hoje — para TMER e Engajamento
  const { data: todayMessages = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-today-messages", todayChats.map((c) => c.id).join(",")],
    enabled: isAuthenticated && allowed && todayChats.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const ids = todayChats.map((c) => c.id);
      const chunks: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const { data } = await supabase
          .from("zapi_messages")
          .select("chat_id, created_at, from_me, sent_by_user_id, is_whisper")
          .in("chat_id", slice)
          .gte("created_at", todayStartISO)
          .or("is_whisper.is.null,is_whisper.eq.false")
          .order("created_at", { ascending: true })
          .limit(5000);
        chunks.push(...(data || []));
      }
      return chunks;
    },
  });

  // Última mensagem por chat em atendimento — para detectar "chats zumbis"
  const inAttendanceIds = openChats.filter((c) => c.status === "em_atendimento").map((c) => c.id);
  const { data: lastMsgByChat = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-last-msg", inAttendanceIds.join(",")],
    enabled: isAuthenticated && allowed && inAttendanceIds.length > 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const chunks: any[] = [];
      for (let i = 0; i < inAttendanceIds.length; i += 100) {
        const slice = inAttendanceIds.slice(i, i + 100);
        const { data } = await supabase
          .from("zapi_messages")
          .select("chat_id, created_at, from_me, is_whisper")
          .in("chat_id", slice)
          .or("is_whisper.is.null,is_whisper.eq.false")
          .order("created_at", { ascending: false })
          .limit(1000);
        chunks.push(...(data || []));
      }
      // manter apenas a mais recente por chat
      const seen = new Set<string>();
      const latest: any[] = [];
      for (const m of chunks) {
        if (seen.has(m.chat_id)) continue;
        seen.add(m.chat_id);
        latest.push(m);
      }
      return latest;
    },
  });


  // Operadores (perfis)
  const { data: profiles = [] } = useQuery<any[]>({
    queryKey: ["painel-tv-profiles"],
    enabled: isAuthenticated && allowed,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, last_seen_at, is_chat_available, is_active")
        .eq("is_active", true);
      return data || [];
    },
  });

  // ==== Cálculos ====
  const waiting = openChats.filter((c) => c.status === "aguardando");
  const inAttendance = openChats.filter((c) => c.status === "em_atendimento");
  const botStuck = openChats.filter(
    (c) => c.status === "bot" && minutesAgo(c.last_message_at || c.updated_at) >= THRESH.botIdleMin,
  );
  const oldestWaitingMin = waiting.length
    ? minutesAgo(waiting[0].created_at)
    : 0;

  // TMR: primeiro from_me por chat criado hoje
  const firstByChat = new Map<string, number>();
  for (const m of firstOpMsgs) {
    if (!firstByChat.has(m.chat_id)) {
      firstByChat.set(m.chat_id, new Date(m.created_at).getTime());
    }
  }
  const tmrValues: number[] = [];
  for (const c of todayChats) {
    const first = firstByChat.get(c.id);
    if (!first) continue;
    const created = new Date(c.created_at).getTime();
    const diff = (first - created) / 60000;
    if (diff >= 0 && diff < 24 * 60) tmrValues.push(diff);
  }
  const tmrAvg = tmrValues.length ? tmrValues.reduce((a, b) => a + b, 0) / tmrValues.length : 0;

  // Engajamento: % de chats onde 1ª resposta ≤ engagementTargetMin
  const engagedCount = tmrValues.filter((v) => v <= THRESH.engagementTargetMin).length;
  const engagementRate = tmrValues.length ? (engagedCount / tmrValues.length) * 100 : 0;

  // TMER: tempo médio entre msg do cliente e próxima resposta do operador (mesmo chat)
  const tmerValues: number[] = [];
  const msgsByChat = new Map<string, any[]>();
  for (const m of todayMessages) {
    if (!msgsByChat.has(m.chat_id)) msgsByChat.set(m.chat_id, []);
    msgsByChat.get(m.chat_id)!.push(m);
  }
  for (const arr of msgsByChat.values()) {
    for (let i = 0; i < arr.length; i++) {
      const cur = arr[i];
      if (cur.from_me) continue; // buscar msgs do cliente
      // próximo operador
      for (let j = i + 1; j < arr.length; j++) {
        const nx = arr[j];
        if (nx.from_me && nx.sent_by_user_id) {
          const diff = (new Date(nx.created_at).getTime() - new Date(cur.created_at).getTime()) / 60000;
          if (diff >= 0 && diff < 6 * 60) tmerValues.push(diff);
          break;
        }
      }
    }
  }
  const tmerAvg = tmerValues.length ? tmerValues.reduce((a, b) => a + b, 0) / tmerValues.length : 0;

  // Chats Zumbis: em_atendimento cuja última msg é do cliente há > zombieMin
  const lastMap = new Map(lastMsgByChat.map((m) => [m.chat_id, m]));
  const zombies = inAttendance
    .map((c) => {
      const last = lastMap.get(c.id);
      if (!last || last.from_me) return null;
      const idle = minutesAgo(last.created_at);
      if (idle < THRESH.zombieMin) return null;
      return { ...c, idleMin: idle };
    })
    .filter(Boolean) as any[];
  zombies.sort((a, b) => b.idleMin - a.idleMin);



  // TMA hoje: média de (closed_at - created_at) para tickets finalizados hoje
  const tmaValues = closedToday
    .map((t) => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000)
    .filter((v) => v >= 0 && v < 24 * 60);
  const tmaAvg = tmaValues.length ? tmaValues.reduce((a, b) => a + b, 0) / tmaValues.length : 0;

  const finalizedToday = closedToday.length;
  const operatorsOnline = profiles.filter(
    (p) => p.last_seen_at && minutesAgo(p.last_seen_at) <= THRESH.operatorOnlineMin,
  ).length;

  // Ranking hoje
  const ranking = useMemo(() => {
    const byUser = new Map<string, { user_id: string; finalized: number; tmaSum: number; tmaCount: number; inService: number }>();
    for (const t of closedToday) {
      const uid = t.opened_by || t.assigned_to;
      if (!uid) continue;
      const entry = byUser.get(uid) || { user_id: uid, finalized: 0, tmaSum: 0, tmaCount: 0, inService: 0 };
      entry.finalized += 1;
      const dur = (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      if (dur >= 0 && dur < 24 * 60) {
        entry.tmaSum += dur;
        entry.tmaCount += 1;
      }
      byUser.set(uid, entry);
    }
    for (const c of inAttendance) {
      if (!c.assigned_to) continue;
      const entry = byUser.get(c.assigned_to) || { user_id: c.assigned_to, finalized: 0, tmaSum: 0, tmaCount: 0, inService: 0 };
      entry.inService += 1;
      byUser.set(c.assigned_to, entry);
    }
    const profMap = new Map(profiles.map((p) => [p.user_id, p]));
    return Array.from(byUser.values())
      .map((e) => {
        const p = profMap.get(e.user_id);
        const online = p?.last_seen_at && minutesAgo(p.last_seen_at) <= THRESH.operatorOnlineMin;
        return {
          ...e,
          name: p?.name || "—",
          avatar_url: p?.avatar_url,
          online: !!online,
          tmaAvg: e.tmaCount ? e.tmaSum / e.tmaCount : 0,
        };
      })
      .sort((a, b) => b.finalized - a.finalized || a.tmaAvg - b.tmaAvg)
      .slice(0, 12);
  }, [closedToday, inAttendance, profiles]);

  // Fila crítica ordenada
  const criticalQueue = useMemo(() => {
    return [...waiting]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 15)
      .map((c) => ({ ...c, waitingMin: minutesAgo(c.created_at) }));
  }, [waiting]);

  // Cor da fila
  const queueColor =
    oldestWaitingMin >= THRESH.queueRedMin ? "text-destructive"
    : oldestWaitingMin >= THRESH.queueYellowMin ? "text-amber-500"
    : "text-emerald-500";
  const queueBg =
    oldestWaitingMin >= THRESH.queueRedMin ? "bg-destructive/10 border-destructive"
    : oldestWaitingMin >= THRESH.queueYellowMin ? "bg-amber-500/10 border-amber-500"
    : "bg-emerald-500/10 border-emerald-500";

  if (!isAuthenticated || permLoading) {
    return <AppLayout><div className="p-4">Carregando...</div></AppLayout>;
  }
  if (!allowed) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardHeader><CardTitle>Sem permissão</CardTitle></CardHeader>
            <CardContent>Este menu está disponível apenas para admin/gestor ou usuários com acesso ao Painel TV.</CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const content = (
    <div ref={containerRef} className={cn("space-y-4 bg-background", isFs && "min-h-screen p-6 overflow-auto")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> Painel de Monitoramento
          </h1>
          <p className="text-xs text-muted-foreground">Atualização a cada 15s • {new Date().toLocaleTimeString("pt-BR")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-1" /> Personalizar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="text-sm font-semibold">Layout do painel</div>
                <Button variant="ghost" size="sm" onClick={resetLayout}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                </Button>
              </div>
              <ScrollArea className="h-[420px]">
                <div className="p-3 space-y-2">
                  {(Object.keys(BLOCK_META) as BlockId[]).map((id) => {
                    const meta = BLOCK_META[id];
                    const max = maxSpanFor(meta.group);
                    const currentSpan = layout.span[id] ?? meta.defaultSpan;
                    return (
                      <div key={id} className="flex items-center gap-2 p-2 rounded-md border">
                        <Switch
                          checked={isVisible(id)}
                          onCheckedChange={() => toggleVisible(id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{meta.label}</p>
                          {max > 1 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-muted-foreground uppercase mr-1">Tam.</span>
                              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={!isVisible(id)}
                                  onClick={() => setSpan(id, n)}
                                  className={cn(
                                    "h-6 w-6 text-xs rounded border font-mono",
                                    currentSpan === n
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background hover:bg-muted",
                                    !isVisible(id) && "opacity-40 cursor-not-allowed",
                                  )}
                                  title={`${n} coluna${n > 1 ? "s" : ""}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="p-2 text-[11px] text-muted-foreground border-t">
                Preferências salvas neste dispositivo para o seu usuário.
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={toggleFs}>
            {isFs ? <><Minimize2 className="h-4 w-4 mr-1" /> Sair Tela Cheia</> : <><Maximize2 className="h-4 w-4 mr-1" /> Tela Cheia</>}
          </Button>
        </div>
      </div>

      {/* KPIs — grid único cols-6 com spans personalizáveis */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {isVisible("queue") && (
          <Card className={cn("border-2", queueBg, kpiClass("queue"))}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Fila aguardando</span>
                <Clock className={cn("h-5 w-5", queueColor)} />
              </div>
              <p className={cn("text-4xl font-black mt-2", queueColor)}>{waiting.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                + antigo: <span className={cn("font-semibold", queueColor)}>{fmtMinutes(oldestWaitingMin)}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {isVisible("inatt") && (
          <Card className={kpiClass("inatt")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Em atendimento</span>
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-4xl font-black mt-2 text-blue-600 dark:text-blue-400">{inAttendance.length}</p>
              <p className="text-xs text-muted-foreground mt-1">chats ativos</p>
            </CardContent>
          </Card>
        )}

        {isVisible("bot") && (
          <Card className={cn(botStuck.length > 0 && "border-2 border-amber-500 bg-amber-500/10", kpiClass("bot"))}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Bot travado</span>
                <Bot className={cn("h-5 w-5", botStuck.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
              </div>
              <p className={cn("text-4xl font-black mt-2", botStuck.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{botStuck.length}</p>
              <p className="text-xs text-muted-foreground mt-1">&gt; {THRESH.botIdleMin}min sem resposta</p>
            </CardContent>
          </Card>
        )}

        {isVisible("tmr") && (
          <Card className={kpiClass("tmr")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">TMR (1ª resposta)</span>
                <Timer className={cn("h-5 w-5", tmrAvg > THRESH.tmrTargetMin ? "text-destructive" : "text-emerald-500")} />
              </div>
              <p className={cn("text-4xl font-black mt-2", tmrAvg > THRESH.tmrTargetMin ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                {tmrValues.length ? fmtMinutes(tmrAvg) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">meta ≤ {THRESH.tmrTargetMin}min</p>
            </CardContent>
          </Card>
        )}

        {isVisible("tma") && (
          <Card className={kpiClass("tma")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">TMA hoje</span>
                <Timer className={cn("h-5 w-5", tmaAvg > THRESH.tmaTargetMin ? "text-destructive" : "text-emerald-500")} />
              </div>
              <p className={cn("text-4xl font-black mt-2", tmaAvg > THRESH.tmaTargetMin ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                {tmaValues.length ? fmtMinutes(tmaAvg) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">meta ≤ {THRESH.tmaTargetMin}min</p>
            </CardContent>
          </Card>
        )}

        {isVisible("fin") && (
          <Card className={kpiClass("fin")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Finalizados hoje</span>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-4xl font-black mt-2 text-emerald-600 dark:text-emerald-400">{finalizedToday}</p>
              <p className="text-xs text-muted-foreground mt-1">
                meta {THRESH.dailyFinalizedGoal} • {Math.round((finalizedToday / THRESH.dailyFinalizedGoal) * 100)}%
              </p>
            </CardContent>
          </Card>
        )}

        {isVisible("zombie") && (
          <Card className={cn(zombies.length > 0 && "border-2 border-destructive bg-destructive/10", kpiClass("zombie"))}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Chats zumbis</span>
                <Ghost className={cn("h-5 w-5", zombies.length > 0 ? "text-destructive" : "text-muted-foreground")} />
              </div>
              <p className={cn("text-4xl font-black mt-2", zombies.length > 0 ? "text-destructive" : "text-foreground")}>{zombies.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                em atendimento sem resposta &gt; {THRESH.zombieMin}min
              </p>
            </CardContent>
          </Card>
        )}

        {isVisible("engage") && (
          <Card className={kpiClass("engage")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Taxa de engajamento</span>
                <Zap className={cn("h-5 w-5", engagementRate >= 70 ? "text-emerald-500" : engagementRate >= 40 ? "text-amber-500" : "text-destructive")} />
              </div>
              <p className={cn("text-4xl font-black mt-2",
                engagementRate >= 70 ? "text-emerald-600 dark:text-emerald-400"
                : engagementRate >= 40 ? "text-amber-600 dark:text-amber-400"
                : "text-destructive")}>
                {tmrValues.length ? `${Math.round(engagementRate)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                respondidos em ≤ {THRESH.engagementTargetMin}min ({engagedCount}/{tmrValues.length})
              </p>
            </CardContent>
          </Card>
        )}

        {isVisible("tmer") && (
          <Card className={kpiClass("tmer")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">TMER (resposta média)</span>
                <MessageCircleWarning className={cn("h-5 w-5", tmerAvg > THRESH.tmerTargetMin ? "text-destructive" : "text-emerald-500")} />
              </div>
              <p className={cn("text-4xl font-black mt-2", tmerAvg > THRESH.tmerTargetMin ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                {tmerValues.length ? fmtMinutes(tmerAvg) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                entre msg do cliente e resposta (meta ≤ {THRESH.tmerTargetMin}min)
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Chats Zumbis — lista */}
      {isVisible("zombieList") && zombies.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ghost className="h-4 w-4 text-destructive" />
              Chats zumbis — sem resposta do operador
              <Badge variant="destructive" className="ml-auto">{zombies.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[220px]">
              <div className="divide-y">
                {zombies.slice(0, 20).map((c) => {
                  const prof = profiles.find((p) => p.user_id === c.assigned_to);
                  return (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.contact_name || c.phone || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Operador: {prof?.name || "—"} • Setor: {c.sector_name || "—"}
                        </p>
                      </div>
                      <div className="text-right font-mono font-semibold text-destructive">
                        {fmtMinutes(c.idleMin)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}


      {/* Operadores online + Fila crítica */}
      {(isVisible("ops") || isVisible("critical")) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {isVisible("ops") && (
            <Card className={panelClass("ops")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Operadores online</span>
                  <UserCheck className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-4xl font-black mt-2">
                  <span className="text-emerald-600 dark:text-emerald-400">{operatorsOnline}</span>
                  <span className="text-muted-foreground text-2xl"> / {profiles.length}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">ativos nos últimos {THRESH.operatorOnlineMin}min</p>
              </CardContent>
            </Card>
          )}

          {isVisible("critical") && (
            <Card className={panelClass("critical")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Fila crítica — aguardando atendimento
                  <Badge variant="secondary" className="ml-auto">{waiting.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[280px]">
                  {criticalQueue.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Sem chats aguardando — 🎉 fila zerada!
                    </div>
                  ) : (
                    <div className="divide-y">
                      {criticalQueue.map((c) => {
                        const color =
                          c.waitingMin >= THRESH.queueRedMin ? "text-destructive"
                          : c.waitingMin >= THRESH.queueYellowMin ? "text-amber-500"
                          : "text-muted-foreground";
                        return (
                          <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{c.contact_name || c.phone || "Sem nome"}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                Setor: {c.sector_name || "—"}
                              </p>
                            </div>
                            <div className={cn("text-right font-mono font-semibold", color)}>
                              {fmtMinutes(c.waitingMin)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Ranking Operadores */}
      {isVisible("ranking") && (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Ranking de operadores — hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ranking.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem atividade registrada hoje.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
              {ranking.map((r, i) => (
                <div
                  key={r.user_id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    i === 0 && "border-yellow-500 bg-yellow-500/10",
                    i === 1 && "border-slate-400 bg-slate-400/10",
                    i === 2 && "border-orange-500 bg-orange-500/10",
                  )}
                >
                  <div className="text-lg font-black w-6 text-center text-muted-foreground">
                    {i + 1}
                  </div>
                  <Avatar className="h-10 w-10">
                    {r.avatar_url ? <img src={r.avatar_url} alt={r.name} /> : null}
                    <AvatarFallback>{initials(r.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-sm truncate">{r.name}</p>
                      {r.online && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="online" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.inService} em atendimento • TMA {fmtMinutes(r.tmaAvg)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary leading-none">{r.finalized}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">finaliz.</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );

  // Em fullscreen: renderiza sem AppLayout para ganhar toda a tela
  if (isFs) return content;
  return <AppLayout>{content}</AppLayout>;
}
