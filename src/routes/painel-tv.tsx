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
import {
  Users, Clock, MessageSquare, Bot, CheckCircle2, UserCheck,
  Timer, AlertTriangle, Maximize2, Minimize2, TrendingUp,
  Zap, Ghost, MessageCircleWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { hasRole, isAuthenticated } = useAuth();
  const { canSeeMenu, isLoading: permLoading } = useUserPermissions();
  const isAdmin = hasRole("admin") || hasRole("gestor");
  const allowed = isAdmin || canSeeMenu("painel-tv");

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> Painel de Monitoramento
          </h1>
          <p className="text-xs text-muted-foreground">Atualização a cada 15s • {new Date().toLocaleTimeString("pt-BR")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggleFs}>
          {isFs ? <><Minimize2 className="h-4 w-4 mr-1" /> Sair Tela Cheia</> : <><Maximize2 className="h-4 w-4 mr-1" /> Tela Cheia</>}
        </Button>
      </div>

      {/* KPIs (6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className={cn("border-2", queueBg)}>
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Em atendimento</span>
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-4xl font-black mt-2 text-blue-600 dark:text-blue-400">{inAttendance.length}</p>
            <p className="text-xs text-muted-foreground mt-1">chats ativos</p>
          </CardContent>
        </Card>

        <Card className={cn(botStuck.length > 0 && "border-2 border-amber-500 bg-amber-500/10")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Bot travado</span>
              <Bot className={cn("h-5 w-5", botStuck.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
            </div>
            <p className={cn("text-4xl font-black mt-2", botStuck.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{botStuck.length}</p>
            <p className="text-xs text-muted-foreground mt-1">&gt; {THRESH.botIdleMin}min sem resposta</p>
          </CardContent>
        </Card>

        <Card>
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

        <Card>
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

        <Card>
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
      </div>

      {/* Segunda linha — Operadores online */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="md:col-span-1">
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

        {/* Fila Crítica */}
        <Card className="md:col-span-3">
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
      </div>

      {/* Ranking Operadores */}
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
    </div>
  );

  // Em fullscreen: renderiza sem AppLayout para ganhar toda a tela
  if (isFs) return content;
  return <AppLayout>{content}</AppLayout>;
}
