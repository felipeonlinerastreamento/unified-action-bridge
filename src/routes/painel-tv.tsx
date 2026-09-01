import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { AppLayout } from "@/components/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Users, Clock, MessageSquare, Bot, CheckCircle2, UserCheck,
  AlertTriangle, Maximize2, Minimize2, TrendingUp,
  Zap, Ghost, Settings2, RotateCcw, Move,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingBlock, type FloatRect } from "@/components/painel/floating-block";

// ============ Personalização de layout ============
type BlockId =
  | "queue" | "inatt" | "bot" | "tmr" | "tma" | "fin"
  | "zombie" | "engage" | "tmer"
  | "ops" | "critical" | "zombieList" | "ranking";

type BlockGroup = "kpiMain" | "kpiSub" | "panel" | "full";

const BLOCK_META: Record<BlockId, { label: string; group: BlockGroup; defaultSpan: number; defaultVisible: boolean }> = {
  queue:      { label: "KPI • Fila aguardando",       group: "kpiMain", defaultSpan: 1, defaultVisible: true },
  inatt:      { label: "KPI • Em atendimento",        group: "kpiMain", defaultSpan: 1, defaultVisible: true },
  bot:        { label: "KPI • Bot travado",           group: "kpiMain", defaultSpan: 1, defaultVisible: true },
  fin:        { label: "KPI • Finalizados hoje",      group: "kpiMain", defaultSpan: 1, defaultVisible: true },
  tmr:        { label: "Métrica • TMR",               group: "kpiSub",  defaultSpan: 1, defaultVisible: true },
  tma:        { label: "Métrica • TMA hoje",          group: "kpiSub",  defaultSpan: 1, defaultVisible: true },
  tmer:       { label: "Métrica • TMER",              group: "kpiSub",  defaultSpan: 1, defaultVisible: true },
  engage:     { label: "Métrica • Taxa de engajamento", group: "kpiSub", defaultSpan: 1, defaultVisible: true },
  zombie:     { label: "Métrica • Chats zumbis",      group: "kpiSub",  defaultSpan: 1, defaultVisible: true },
  ops:        { label: "Painel • Operadores online", group: "panel",   defaultSpan: 4, defaultVisible: true },
  critical:   { label: "Painel • Fila crítica",      group: "panel",   defaultSpan: 3, defaultVisible: true },
  zombieList: { label: "Painel • Lista de zumbis",   group: "panel",   defaultSpan: 5, defaultVisible: true },
  ranking:    { label: "Painel • Distribuição de chamados", group: "full", defaultSpan: 1, defaultVisible: true },
};

type LayoutState = {
  visible: Record<BlockId, boolean>;
  span: Record<BlockId, number>;
};

const DEFAULT_LAYOUT: LayoutState = {
  visible: Object.fromEntries((Object.keys(BLOCK_META) as BlockId[]).map((k) => [k, BLOCK_META[k].defaultVisible])) as Record<BlockId, boolean>,
  span:    Object.fromEntries((Object.keys(BLOCK_META) as BlockId[]).map((k) => [k, BLOCK_META[k].defaultSpan]))    as Record<BlockId, number>,
};

const MAIN_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4",
};
const SUB_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4", 5: "col-span-5",
};
const PANEL_SPAN_CLASS: Record<number, string> = {
  1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4",
  5: "col-span-5", 6: "col-span-6", 7: "col-span-7", 8: "col-span-8",
  9: "col-span-9", 10: "col-span-10", 11: "col-span-11", 12: "col-span-12",
};

// Posições padrão do modo "balões flutuantes" (canvas de 1920px de largura)
const DEFAULT_FLOAT: Record<BlockId, FloatRect> = {
  queue:      { x: 0,    y: 0,   w: 456, h: 200 },
  inatt:      { x: 480,  y: 0,   w: 456, h: 200 },
  bot:        { x: 960,  y: 0,   w: 456, h: 200 },
  fin:        { x: 1440, y: 0,   w: 456, h: 200 },
  tmr:        { x: 0,    y: 220, w: 360, h: 140 },
  tma:        { x: 384,  y: 220, w: 360, h: 140 },
  tmer:       { x: 768,  y: 220, w: 360, h: 140 },
  engage:     { x: 1152, y: 220, w: 360, h: 140 },
  zombie:     { x: 1536, y: 220, w: 360, h: 140 },
  zombieList: { x: 0,    y: 384, w: 760, h: 520 },
  ops:        { x: 784,  y: 384, w: 560, h: 250 },
  ranking:    { x: 784,  y: 654, w: 560, h: 250 },
  critical:   { x: 1368, y: 384, w: 528, h: 520 },
};

function maxSpanFor(group: BlockGroup): number {
  return group === "kpiMain" ? 4 : group === "kpiSub" ? 5 : group === "panel" ? 12 : 1;
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

// Largura de referência do design do painel — todo o conteúdo é renderizado
// nessa largura e escalado proporcionalmente para caber na tela real.
const DESIGN_WIDTH = 1920;

/**
 * Ajuste automático ao tamanho da tela: mede o espaço disponível e aplica
 * transform: scale() no conteúdo (que é renderizado sempre em DESIGN_WIDTH).
 * Assim o painel nunca sobrepõe itens nem quebra linhas, em qualquer tela.
 */
function useFitScale() {
  // Callback refs + state: o painel renderiza condicionalmente (loading),
  // então refs comuns ficariam nulas quando o efeito roda pela 1ª vez.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0, availH: 0 });

  useEffect(() => {
    if (!container || !content) return;

    const update = () => {
      const availW = container.clientWidth;
      // Altura realmente visível: da posição do painel até o fim da viewport
      // (o container usa min-h-screen e cresceria junto com o conteúdo).
      const top = container.getBoundingClientRect().top + window.scrollY;
      const availH = Math.max(320, window.innerHeight - Math.max(0, top - window.scrollY));
      if (availW <= 0) return;
      // Altura natural do conteúdo (transform: scale não afeta scrollHeight)
      const naturalH = content.scrollHeight;
      // Preencher SEMPRE a largura da tela (TV): a escala base é a largura.
      // Se o conteúdo ficar mais alto que a tela, reduzimos um pouco (até 75%
      // da escala de largura) e o restante rola dentro do painel — assim nunca
      // sobra espaço morto na lateral direita.
      const byW = availW / DESIGN_WIDTH;
      const byH = naturalH > 0 ? availH / naturalH : byW;
      // Preenche sempre pelo menos 85% da largura; se o conteúdo ficar um
      // pouco mais alto que a tela, o excesso rola dentro do painel (em vez
      // de encolher tudo e deixar espaço vazio à direita).
      const scale = Math.max(0.3, Math.min(3, Math.max(Math.min(byW, byH), byW * 0.85)));
      setFit({ scale, height: naturalH * scale, availH });

    };



    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    ro.observe(content);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [container, content]);

  return { containerRef: setContainer, contentRef: setContent, container, ...fit };
}

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


function PainelTvPage() {
  const { hasRole, isAuthenticated, user } = useAuth();
  const { canSeeMenu, isLoading: permLoading, allowedMenus } = useUserPermissions();
  const isAdmin = hasRole("admin") || hasRole("gestor");
  const allowed = isAdmin || canSeeMenu("painel-tv");
  // Usuário "Apenas Painel TV": renderiza sem sidebar/header para usar a TV toda
  const isPanelOnly =
    allowedMenus !== null &&
    allowedMenus.has("painel-tv") &&
    [...allowedMenus].every((m) => m === "painel-tv" || m === "central");

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
  const mainKpiClass = (id: BlockId) => MAIN_SPAN_CLASS[layout.span[id] ?? BLOCK_META[id].defaultSpan] ?? "col-span-1";
  const subKpiClass = (id: BlockId) => SUB_SPAN_CLASS[layout.span[id] ?? BLOCK_META[id].defaultSpan] ?? "col-span-1";
  const panelClass = (id: BlockId) => PANEL_SPAN_CLASS[layout.span[id] ?? BLOCK_META[id].defaultSpan] ?? "col-span-4";

  // ============ Modo balões flutuantes (arrastar / redimensionar) ============
  const freeKey = user?.id ? `painel-tv-float:${user.id}` : null;
  const [freeMode, setFreeMode] = useState(false);
  const [floats, setFloats] = useState<Record<BlockId, FloatRect>>(DEFAULT_FLOAT);
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  const scaleRef = useRef(1);

  useEffect(() => {
    if (!freeKey) return;
    try {
      const raw = localStorage.getItem(freeKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setFreeMode(!!parsed?.enabled);
        setFloats({ ...DEFAULT_FLOAT, ...(parsed?.rects ?? {}) });
      }
    } catch { /* ignore */ }
  }, [freeKey]);

  const persistFloat = (enabled: boolean, rects: Record<BlockId, FloatRect>) => {
    if (!freeKey) return;
    try { localStorage.setItem(freeKey, JSON.stringify({ enabled, rects })); } catch { /* ignore */ }
  };
  const setRect = (id: BlockId, rect: FloatRect, commit = false) => {
    setFloats((prev) => {
      const next = { ...prev, [id]: rect };
      if (commit) persistFloat(freeMode, next);
      return next;
    });
  };
  const toggleFreeMode = () => {
    const next = !freeMode;
    setFreeMode(next);
    persistFloat(next, floats);
  };
  const resetFloats = () => {
    setFloats(DEFAULT_FLOAT);
    persistFloat(freeMode, DEFAULT_FLOAT);
  };

  const canvasHeight = useMemo(() => {
    const bottoms = (Object.keys(BLOCK_META) as BlockId[])
      .filter((id) => layout.visible[id] !== false)
      .map((id) => (floats[id] ?? DEFAULT_FLOAT[id]).y + (floats[id] ?? DEFAULT_FLOAT[id]).h);
    return Math.max(600, ...bottoms) + 48;
  }, [floats, layout.visible]);

  const wrap = (id: BlockId, node: React.ReactNode) => {
    if (!freeMode) return node;
    return (
      <FloatingBlock
        key={id}
        id={id}
        label={BLOCK_META[id].label}
        rect={floats[id] ?? DEFAULT_FLOAT[id]}
        canvas={canvas}
        scaleRef={scaleRef}
        onChange={(r) => setRect(id, r)}
        onCommit={(r) => setRect(id, r, true)}
      >
        {node}
      </FloatingBlock>
    );
  };

  const [isFs, setIsFs] = useState(false);
  // Ajuste automático ao tamanho da tela (detectado via ResizeObserver)
  const { containerRef, contentRef, container, scale, height: fitHeight, availH } = useFitScale();
  scaleRef.current = scale;

  // Relógio ao vivo (cabeçalho)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    if (!document.fullscreenElement) {
      container?.requestFullscreen?.();
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
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("zapi_chats")
        .select("id, status, sector_name, contact_name, phone, assigned_to, unread_count, created_at, updated_at, last_message_at")
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

  // Operadores do setor "Atendimento" (para o card Operadores online)
  const { data: atendimentoUserIds = [] } = useQuery<string[]>({
    queryKey: ["painel-tv-atendimento-ops"],
    enabled: isAuthenticated && allowed,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data: sectorRows } = await supabase
        .from("sectors")
        .select("id")
        .ilike("name", "atendimento");
      const sectorIds = (sectorRows || []).map((s: any) => s.id);
      if (sectorIds.length === 0) return [];
      const { data: assigns } = await supabase
        .from("user_sector_assignments")
        .select("user_id")
        .in("sector_id", sectorIds);
      return Array.from(new Set((assigns || []).map((a: any) => a.user_id).filter(Boolean))) as string[];
    },
  });

  // ==== Cálculos ====
  // Aguardando = chats na fila (sem responsável) OU chats com mensagem do cliente
  // ainda não respondida (unread_count > 0). O tempo de espera considera a última
  // mensagem recebida, e não a criação do chat.
  const waitingRef = (c: any) => c.last_message_at || c.created_at;
  const waiting = openChats
    .filter(
      (c) =>
        c.status === "aguardando" ||
        (c.status !== "bot" && Number(c.unread_count || 0) > 0),
    )
    .sort((a, b) => new Date(waitingRef(a)).getTime() - new Date(waitingRef(b)).getTime());
  const inAttendance = openChats.filter((c) => c.status === "em_atendimento");
  const botStuck = openChats.filter(
    (c) => c.status === "bot" && minutesAgo(c.last_message_at || c.updated_at) >= THRESH.botIdleMin,
  );
  const oldestWaitingMin = waiting.length
    ? minutesAgo(waitingRef(waiting[0]))
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
  // Card "Operadores online": somente operadores do setor Atendimento
  const atendimentoSet = new Set(atendimentoUserIds);
  const opsProfiles = atendimentoSet.size > 0
    ? profiles.filter((p) => atendimentoSet.has(p.user_id))
    : profiles;
  const operatorsOnline = opsProfiles.filter(
    (p) => p.last_seen_at && minutesAgo(p.last_seen_at) <= THRESH.operatorOnlineMin,
  ).length;

  // Ranking hoje — somente operadores do setor Atendimento
  const ranking = useMemo(() => {
    const atendimentoSet = new Set(atendimentoUserIds);
    const byUser = new Map<string, { user_id: string; finalized: number; tmaSum: number; tmaCount: number; inService: number }>();
    for (const t of closedToday) {
      const uid = t.opened_by || t.assigned_to;
      if (!uid) continue;
      if (atendimentoSet.size > 0 && !atendimentoSet.has(uid)) continue;
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
      if (atendimentoSet.size > 0 && !atendimentoSet.has(c.assigned_to)) continue;
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
      .sort((a, b) => b.inService - a.inService || b.finalized - a.finalized || a.tmaAvg - b.tmaAvg)
      .slice(0, 12);
  }, [closedToday, inAttendance, profiles, atendimentoUserIds]);

  // Fila crítica ordenada (espera medida pela última mensagem do cliente)
  const criticalQueue = useMemo(() => {
    return waiting
      .slice(0, 15)
      .map((c) => ({ ...c, waitingMin: minutesAgo(waitingRef(c)) }));
    // `now` força o recálculo do tempo a cada tick do relógio
  }, [waiting, now]);

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

  // Estilo do KPI principal conforme criticidade da fila
  const queueAccent =
    oldestWaitingMin >= THRESH.queueRedMin ? "border-red-600" : "border-amber-500";
  const queueText =
    oldestWaitingMin >= THRESH.queueRedMin ? "text-red-500" : "text-amber-500";

  const content = (
    <div
      ref={containerRef}
      className={cn("w-full bg-[#020617] text-slate-100 overflow-x-hidden overflow-y-auto", isFs && "h-screen")}
      style={!isFs && availH ? { height: availH } : undefined}
    >
      <div className="relative w-full" style={{ height: Math.max(fitHeight, availH) || undefined }}>

        <div
          ref={contentRef}
          style={{
            width: DESIGN_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginLeft:
              container && scale > 0
                ? Math.max(0, (container.clientWidth - DESIGN_WIDTH * scale) / 2) / scale
                : undefined,
          }}
          className="p-8 flex flex-col gap-5"
        >

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-400" />
            Monitoramento WhatsApp
          </h1>
          <p className="text-slate-400 font-medium">Central de Atendimento em Tempo Real</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-emerald-400 tracking-widest tabular-nums">
              {now.toLocaleTimeString("pt-BR")}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">Sistema Online</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
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
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
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
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFreeMode}
              className={cn("border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white", freeMode && "border-emerald-500 text-emerald-400")}
            >
              <Move className="h-4 w-4 mr-1" /> {freeMode ? "Balões livres" : "Modo grade"}
            </Button>
            {freeMode && (
              <Button variant="ghost" size="sm" onClick={resetFloats} className="text-slate-400 hover:text-white">
                <RotateCcw className="h-4 w-4 mr-1" /> Posições
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleFs} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
              {isFs ? <><Minimize2 className="h-4 w-4 mr-1" /> Sair</> : <><Maximize2 className="h-4 w-4 mr-1" /> Tela Cheia</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas dos balões flutuantes */}
      {freeMode && (
        <div ref={setCanvas} className="relative w-full" style={{ height: canvasHeight }} />
      )}

      {/* KPIs principais */}
      <div className={cn("grid grid-cols-4 gap-6", freeMode && "hidden")}>
        {isVisible("queue") && wrap("queue", (
          <div className={cn("bg-slate-900 border-l-8 p-6 rounded-r-xl shadow-2xl min-w-0 overflow-hidden", queueAccent, mainKpiClass("queue"))}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-widest truncate">Fila Aguardando</span>
              <Clock className={cn("h-5 w-5 shrink-0", queueText)} />
            </div>
            <div className={cn("text-[clamp(2.75rem,5.5vw,6rem)] leading-none font-black mt-2 tabular-nums whitespace-nowrap", queueText)}>{waiting.length}</div>
            <p className="text-sm text-slate-500 mt-2">
              + antigo: <span className={cn("font-bold", queueText)}>{fmtMinutes(oldestWaitingMin)}</span>
            </p>
          </div>
        ))}
        {isVisible("inatt") && wrap("inatt", (
          <div className={cn("bg-slate-900 border-l-8 border-blue-500 p-6 rounded-r-xl shadow-2xl min-w-0 overflow-hidden", mainKpiClass("inatt"))}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-widest truncate">Em Atendimento</span>
              <MessageSquare className="h-5 w-5 text-blue-400 shrink-0" />
            </div>
            <div className="text-[clamp(2.75rem,5.5vw,6rem)] leading-none font-black text-blue-400 mt-2 tabular-nums whitespace-nowrap">{inAttendance.length}</div>
            <p className="text-sm text-slate-500 mt-2">chats ativos</p>
          </div>
        ))}
        {isVisible("bot") && wrap("bot", (
          <div className={cn("bg-slate-900 border-l-8 p-6 rounded-r-xl shadow-2xl min-w-0 overflow-hidden", botStuck.length > 0 ? "border-red-600" : "border-slate-700", mainKpiClass("bot"))}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-widest truncate">Bot Travado</span>
              <Bot className={cn("h-5 w-5 shrink-0", botStuck.length > 0 ? "text-red-500" : "text-slate-500")} />
            </div>
            <div className={cn("text-[clamp(2.75rem,5.5vw,6rem)] leading-none font-black mt-2 tabular-nums whitespace-nowrap", botStuck.length > 0 ? "text-red-500" : "text-slate-300")}>
              {String(botStuck.length).padStart(2, "0")}
            </div>
            <p className="text-sm text-slate-500 mt-2">&gt; {THRESH.botIdleMin}min sem resposta</p>
          </div>
        ))}
        {isVisible("fin") && wrap("fin", (
          <div className={cn("bg-slate-900 border-l-8 border-emerald-500 p-6 rounded-r-xl shadow-2xl min-w-0 overflow-hidden", mainKpiClass("fin"))}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-widest truncate">Finalizados Hoje</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            </div>
            <div className="text-[clamp(2.75rem,5.5vw,6rem)] leading-none font-black text-emerald-400 mt-2 tabular-nums whitespace-nowrap">{finalizedToday}</div>
            <p className="text-sm text-slate-500 mt-2">
              meta {THRESH.dailyFinalizedGoal} • <span className="text-emerald-400 font-bold">{Math.round((finalizedToday / THRESH.dailyFinalizedGoal) * 100)}%</span>
            </p>
          </div>
        ))}
      </div>

      {/* Métricas secundárias */}
      <div className={cn("grid grid-cols-5 gap-4", freeMode && "hidden")}>
        {isVisible("tmr") && wrap("tmr", (
          <div className={cn("bg-slate-900/50 p-4 rounded-lg border border-slate-800 min-w-0 overflow-hidden", subKpiClass("tmr"))}>
            <span className="text-slate-500 text-xs font-bold uppercase">TMR (1ª resposta)</span>
            <div className={cn("text-[clamp(1.5rem,2.6vw,2.5rem)] leading-none font-bold mt-1 font-mono tabular-nums whitespace-nowrap", tmrAvg > THRESH.tmrTargetMin ? "text-red-400" : "text-white")}>
              {tmrValues.length ? fmtMinutes(tmrAvg) : "—"}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 uppercase">meta ≤ {THRESH.tmrTargetMin}min</p>
          </div>
        ))}
        {isVisible("tma") && wrap("tma", (
          <div className={cn("bg-slate-900/50 p-4 rounded-lg border border-slate-800 min-w-0 overflow-hidden", subKpiClass("tma"))}>
            <span className="text-slate-500 text-xs font-bold uppercase">TMA (Média)</span>
            <div className={cn("text-[clamp(1.5rem,2.6vw,2.5rem)] leading-none font-bold mt-1 font-mono tabular-nums whitespace-nowrap", tmaAvg > THRESH.tmaTargetMin ? "text-red-400" : "text-white")}>
              {tmaValues.length ? fmtMinutes(tmaAvg) : "—"}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 uppercase">meta ≤ {THRESH.tmaTargetMin}min</p>
          </div>
        ))}
        {isVisible("tmer") && wrap("tmer", (
          <div className={cn("bg-slate-900/50 p-4 rounded-lg border border-slate-800 min-w-0 overflow-hidden", subKpiClass("tmer"))}>
            <span className="text-slate-500 text-xs font-bold uppercase">TMER</span>
            <div className={cn("text-[clamp(1.5rem,2.6vw,2.5rem)] leading-none font-bold mt-1 font-mono tabular-nums whitespace-nowrap", tmerAvg > THRESH.tmerTargetMin ? "text-red-400" : "text-white")}>
              {tmerValues.length ? fmtMinutes(tmerAvg) : "—"}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 uppercase">meta ≤ {THRESH.tmerTargetMin}min</p>
          </div>
        ))}
        {isVisible("engage") && wrap("engage", (
          <div className={cn("bg-slate-900/50 p-4 rounded-lg border border-slate-800 min-w-0 overflow-hidden", subKpiClass("engage"))}>
            <span className="text-slate-500 text-xs font-bold uppercase">Taxa Engajamento</span>
            <div className={cn("text-[clamp(1.5rem,2.6vw,2.5rem)] leading-none font-bold mt-1 font-mono tabular-nums whitespace-nowrap",
              engagementRate >= 70 ? "text-emerald-400" : engagementRate >= 40 ? "text-amber-400" : "text-red-400")}>
              {tmrValues.length ? `${Math.round(engagementRate)}%` : "—"}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 uppercase">≤ {THRESH.engagementTargetMin}min ({engagedCount}/{tmrValues.length})</p>
          </div>
        ))}
        {isVisible("zombie") && wrap("zombie", (
          <div className={cn("bg-slate-900/50 p-4 rounded-lg border", zombies.length > 0 ? "border-purple-500/50" : "border-slate-800", "min-w-0 overflow-hidden", subKpiClass("zombie"))}>
            <span className="text-slate-500 text-xs font-bold uppercase">Chats Zumbis</span>
            <div className={cn("text-[clamp(1.5rem,2.6vw,2.5rem)] leading-none font-bold mt-1 font-mono tabular-nums whitespace-nowrap", zombies.length > 0 ? "text-purple-400" : "text-white")}>
              {String(zombies.length).padStart(2, "0")}
            </div>
            <p className="text-[11px] text-slate-600 mt-1 uppercase">sem resposta &gt; {THRESH.zombieMin}min</p>
          </div>
        ))}
      </div>

      {/* Listas detalhadas */}
      {(isVisible("zombieList") || isVisible("ops") || isVisible("ranking") || isVisible("critical")) && (
        <div className={cn("grid grid-cols-12 gap-6 grow items-start", freeMode && "hidden")}>
          {/* Chats Zumbis */}
          {isVisible("zombieList") && wrap("zombieList", (
            <div className={cn("bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-w-0", panelClass("zombieList"))}>
              <div className="bg-purple-900/20 px-5 py-3.5 border-b border-purple-500/30 flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-widest text-purple-400 text-sm flex items-center gap-2">
                  <Ghost className="h-4 w-4" /> Lista de Chats Zumbis
                </h3>
                <span className="font-mono font-bold text-purple-300 bg-purple-950 px-2 py-0.5 rounded text-sm">{zombies.length}</span>
              </div>
              <ScrollArea className="grow max-h-[420px]">
                {zombies.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">Nenhum chat zumbi no momento — tudo respondido.</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase sticky top-0">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Contato / Operador</th>
                        <th className="px-5 py-3 font-semibold">Setor</th>
                        <th className="px-5 py-3 font-semibold text-right">Tempo</th>
                      </tr>
                    </thead>
                    <tbody className="text-lg">
                      {zombies.slice(0, 20).map((c) => {
                        const prof = profiles.find((p) => p.user_id === c.assigned_to);
                        return (
                          <tr key={c.id} className="border-b border-slate-800/50">
                            <td className="px-5 py-3">
                              <div className="font-semibold text-white truncate max-w-[220px]">{c.contact_name || c.phone || "Sem nome"}</div>
                              <div className="text-xs text-slate-500 truncate">{prof?.name || "—"}</div>
                            </td>
                            <td className="px-5 py-3 text-slate-400 text-xs uppercase">{c.sector_name || "—"}</td>
                            <td className="px-5 py-3 text-right font-mono text-purple-400 font-bold tabular-nums">{fmtMinutes(c.idleMin)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </ScrollArea>
            </div>
          ))}

          {/* Operadores + Ranking */}
          {(isVisible("ops") || isVisible("ranking")) && (
            <div className={cn("grid gap-6 content-start auto-rows-min min-w-0", panelClass("ops"))}>
              {isVisible("ops") && wrap("ops", (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold uppercase tracking-widest text-blue-400 text-sm flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> Operadores Online ({operatorsOnline})
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">{opsProfiles.length} no setor</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {opsProfiles
                      .filter((p) => p.last_seen_at && minutesAgo(p.last_seen_at) <= THRESH.operatorOnlineMin)
                      .map((p) => (
                        <span key={p.user_id} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded uppercase">
                          {p.name}
                        </span>
                      ))}
                    {opsProfiles
                      .filter((p) => !(p.last_seen_at && minutesAgo(p.last_seen_at) <= THRESH.operatorOnlineMin))
                      .map((p) => (
                        <span key={p.user_id} className="px-3 py-1 bg-slate-800/50 border border-slate-700 text-slate-500 text-xs font-bold rounded uppercase">
                          {p.name}
                        </span>
                      ))}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-3 uppercase">setor Atendimento • online = ativo nos últimos {THRESH.operatorOnlineMin}min</p>
                </div>
              ))}
              {isVisible("ranking") && wrap("ranking", (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 min-w-0 overflow-hidden">
                  <h3 className="font-bold uppercase tracking-widest text-emerald-400 text-sm flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4" /> Distribuição de chamados
                  </h3>
                  {ranking.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-sm">Sem operadores com chamados em aberto.</div>
                  ) : (
                    <ScrollArea className="max-h-[260px]">
                      <div className="space-y-3 pr-2">
                        {ranking.map((r, i) => (
                          <div key={r.user_id} className={cn("flex justify-between items-center gap-3", i === 1 && "opacity-80", i >= 2 && "opacity-60")}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn("font-black w-6 text-center shrink-0",
                                i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-500")}>
                                {i + 1}
                              </span>
                              {r.online && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="online" />}
                              <span className="font-bold text-white truncate">{r.name}</span>
                            </div>
                            <span className={cn("font-mono font-bold px-2 rounded shrink-0 text-sm tabular-nums",
                              i === 0 ? "text-emerald-400 bg-emerald-950" : "text-slate-300 bg-slate-800/60")}>
                              {r.inService} ABERTO{r.inService === 1 ? "" : "S"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fila Crítica */}
          {isVisible("critical") && wrap("critical", (
            <div className={cn("rounded-xl p-5 flex flex-col border-2 min-w-0 overflow-hidden",
              waiting.length >= THRESH.queueRedMin
                ? "bg-red-950/20 border-red-900/50"
                : "bg-slate-900/40 border-slate-800",
              panelClass("critical"))}>
              <h3 className={cn("font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-sm",
                waiting.length >= THRESH.queueRedMin ? "text-red-500" : "text-amber-400")}>
                <span className={cn("w-3 h-3 rounded-full", waiting.length > 0 ? "bg-red-600 animate-ping" : "bg-slate-600")} />
                Fila Crítica
                <span className="ml-auto font-mono font-bold text-slate-300 bg-slate-800/60 px-2 rounded text-sm">{waiting.length}</span>
              </h3>
              <ScrollArea className="grow max-h-[420px]">
                {criticalQueue.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">Sem chats aguardando — fila zerada.</div>
                ) : (
                  <div className="space-y-3 pr-2">
                    {criticalQueue.map((c) => {
                      const hot = c.waitingMin >= THRESH.queueRedMin;
                      const warm = c.waitingMin >= THRESH.queueYellowMin;
                      return (
                        <div key={c.id} className={cn("p-3.5 rounded-lg border-l-4",
                          hot ? "bg-red-900/30 border-red-600"
                          : warm ? "bg-amber-900/20 border-amber-500"
                          : "bg-slate-800/30 border-slate-600")}>
                          <div className={cn("text-[11px] uppercase font-bold tracking-tight", hot ? "text-red-400" : warm ? "text-amber-400" : "text-slate-400")}>
                            {c.sector_name || "Sem setor"}
                          </div>
                          <div className="text-lg font-black text-white truncate">{c.contact_name || c.phone || "Sem nome"}</div>
                          <div className={cn("text-sm mt-0.5 font-mono tabular-nums", hot ? "text-red-300" : warm ? "text-amber-300" : "text-slate-400")}>
                            Aguardando: {fmtMinutes(c.waitingMin)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Rodapé / ticker */}
      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex justify-between items-center px-5 mt-auto">
        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest italic flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-slate-600" />
          Atualização automática a cada 15s
        </div>
        <div className="text-sm font-bold text-blue-400 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
        </div>
      </div>
        </div>
      </div>
    </div>
  );

  // Em fullscreen ou para usuário "Apenas Painel TV": sem AppLayout (tela toda)
  if (isFs || isPanelOnly) return content;
  return <AppLayout>{content}</AppLayout>;
}
