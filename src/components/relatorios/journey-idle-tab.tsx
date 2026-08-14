import { ChartFrame } from "./chart-frame";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";
import { ReportKpiCard } from "@/components/relatorios/report-kpi-card";
import { exportToCSV } from "@/components/relatorios/export-utils";
import { Clock, LogIn, LogOut, Timer, AlertTriangle, Loader2, Download, X, UserX } from "lucide-react";


interface Props {
  dateFrom: string;
  dateTo: string;
  operatorFilter?: string;
}

function fmtHm(minutes: number) {
  if (!minutes || minutes < 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function JourneyIdleTab({ dateFrom, dateTo, operatorFilter }: Props) {
  const [threshold, setThreshold] = useState(10);
  const [thresholdInput, setThresholdInput] = useState("10");
  const [localOperator, setLocalOperator] = useState<string>("__all__");
  const [contactSearch, setContactSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("__all__");
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");



  // Janela em horário de Brasília (UTC-3) para que o dia 24 BRT inclua
  // eventos até 23:59 BRT (que em UTC já são do dia 25).
  const fromIso = `${dateFrom}T00:00:00-03:00`;
  const toIso = `${dateTo}T23:59:59-03:00`;

  // Converte ISO (UTC) para data YYYY-MM-DD em horário de Brasília.
  const brtDay = (iso: string) => {
    const d = new Date(iso);
    d.setUTCHours(d.getUTCHours() - 3);
    return d.toISOString().slice(0, 10);
  };

  // Operators list
  const { data: operators = [] } = useQuery({
    queryKey: ["journey-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.user_id as string,
        name: (p.name as string) || "Sem nome",
      }));
    },
  });

  const opName = useMemo(() => {
    const m: Record<string, string> = {};
    operators.forEach((o) => { m[o.id] = o.name; });
    return m;
  }, [operators]);

  // Presence audit logs
  const { data: presence = [], isLoading: presenceLoading } = useQuery({
    queryKey: ["journey-presence", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      const pageSize = 1000;
      let offset = 0;
      const all: Array<{
        user_id: string; user_name: string | null;
        event_type: string; created_at: string;
      }> = [];
      // Paginate to avoid Supabase's default 1000-row cap dropping the most
      // recent days when ordering ascending.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("audit_logs")
          .select("user_id, user_name, event_type, created_at")
          .eq("event_category", "presence")
          .in("event_type", ["set_online", "set_offline"])
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (operatorFilter) q = q.eq("user_id", operatorFilter);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []) as typeof all;
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 100000) break; // safety
      }
      return all;
    },
  });


  type JourneyRow = {
    userId: string; userName: string; day: string;
    firstOnline: string | null; lastOffline: string | null;
    firstActivity: string | null; lastActivity: string | null;
    totalMinutes: number; pauses: number; stillOnline: boolean;
    attendancesStarted: number; messagesSent: number;
    timeline: Array<{ type: "set_online" | "set_offline"; at: string }>;
  };

  // All audit logs (any category) — used to detect activity for operators
  // who never toggled presence and didn't send WhatsApp messages.
  const { data: activityLogs = [], isLoading: activityLoading } = useQuery({
    queryKey: ["journey-activity-logs", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      const pageSize = 1000;
      let offset = 0;
      const all: Array<{
        user_id: string; user_name: string | null; created_at: string;
      }> = [];
      // Paginate to avoid truncating recent days when the period is busy.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("audit_logs")
          .select("user_id, user_name, created_at")
          .not("user_id", "is", null)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (operatorFilter) q = q.eq("user_id", operatorFilter);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []) as typeof all;
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 200000) break; // safety
      }
      return all;
    },
  });



  // ============ IDLENESS ============
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["journey-chats", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      // Chats relevantes à janela: criados, fechados OU com última mensagem
      // dentro do período. Sem `.or()` truncado, sem `.limit(2000)` sem
      // ordenação (que descartava os chats mais recentes do dia atual).
      const pageSize = 1000;
      let offset = 0;
      type Row = {
        id: string; phone: string; contact_name: string | null;
        assigned_to: string; status: string;
        created_at: string; closed_at: string | null;
        last_message_at: string | null;
      };
      const all: Row[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("zapi_chats")
          .select("id, phone, contact_name, assigned_to, status, created_at, closed_at, last_message_at")
          .not("assigned_to", "is", null)
          .or(
            `last_message_at.gte.${fromIso},` +
            `closed_at.gte.${fromIso},` +
            `created_at.gte.${fromIso}`
          )
          .lte("created_at", toIso)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .range(offset, offset + pageSize - 1);
        if (operatorFilter) q = q.eq("assigned_to", operatorFilter);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []) as Row[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 20000) break; // safety
      }
      return all;
    },
  });

  const { data: opMessages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["journey-op-messages", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      // Conta mensagens enviadas por operador DIRETO de zapi_messages
      // (independente do chat estar atribuído), para não perder envios em
      // chats com assigned_to nulo. Pagina para suportar dias com volume.
      const pageSize = 1000;
      let offset = 0;
      const all: Array<{ chat_id: string; created_at: string; sent_by_user_id: string | null; from_me: boolean }> = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("zapi_messages")
          .select("chat_id, created_at, sent_by_user_id, from_me")
          .eq("from_me", true)
          .not("sent_by_user_id", "is", null)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (operatorFilter) q = q.eq("sent_by_user_id", operatorFilter);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []) as typeof all;
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 100000) break; // safety
      }
      return all;
    },
  });

  // Eventos operacionais (assumido / transferido / finalizado) usados no
  // Resumo da Operação.
  const { data: opsEvents = [], isLoading: opsEventsLoading } = useQuery({
    queryKey: ["journey-ops-events", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      const pageSize = 1000;
      let offset = 0;
      const all: Array<{
        user_id: string; event_type: string; created_at: string;
        target_id: string | null; metadata: any;
      }> = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const q = supabase
          .from("audit_logs")
          .select("user_id, event_type, created_at, target_id, metadata")
          .in("event_type", ["chat.assumido", "chat.transferido", "chat.finalizado", "grupo.finalizado"])
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []) as typeof all;
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 50000) break;
      }
      return all;
    },
  });

  const journeyRows = useMemo<JourneyRow[]>(() => {

    const groups: Record<string, { userId: string; userName: string; day: string; events: typeof presence }> = {};
    presence.forEach((ev) => {
      const day = brtDay(ev.created_at);
      const key = `${ev.user_id}::${day}`;
      if (!groups[key]) {
        groups[key] = {
          userId: ev.user_id,
          userName: ev.user_name || opName[ev.user_id] || "—",
          day, events: [],
        };
      }
      groups[key].events.push(ev);
    });
    const out: JourneyRow[] = [];
    Object.values(groups).forEach((g) => {
      const evs = g.events.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      let firstOnline: string | null = null;
      let lastOffline: string | null = null;
      let total = 0;
      let pauses = 0;
      let openOnline: string | null = null;
      const dayEndIso = `${g.day}T23:59:59`;
      const dayEnd = new Date(dayEndIso).getTime();
      const nowMs = Date.now();
      const timeline: JourneyRow["timeline"] = [];
      evs.forEach((ev) => {
        timeline.push({ type: ev.event_type as "set_online" | "set_offline", at: ev.created_at });
        if (ev.event_type === "set_online") {
          if (!firstOnline) firstOnline = ev.created_at;
          if (!openOnline) openOnline = ev.created_at;
        } else if (ev.event_type === "set_offline") {
          lastOffline = ev.created_at;
          if (openOnline) {
            total += (new Date(ev.created_at).getTime() - new Date(openOnline).getTime()) / 60000;
            openOnline = null;
            pauses++;
          }
        }
      });
      let stillOnline = false;
      if (openOnline) {
        const cap = Math.min(dayEnd, nowMs);
        total += Math.max(0, (cap - new Date(openOnline).getTime()) / 60000);
        stillOnline = true;
      }
      const attendancesStarted = chats.filter((c) =>
        c.assigned_to === g.userId && brtDay(c.created_at) === g.day
      ).length;
      const messagesSent = opMessages.filter((m) =>
        m.sent_by_user_id === g.userId && brtDay(m.created_at) === g.day
      ).length;
      out.push({
        userId: g.userId, userName: g.userName, day: g.day,
        firstOnline, lastOffline,
        firstActivity: null, lastActivity: null,
        totalMinutes: total,
        pauses, stillOnline,
        attendancesStarted, messagesSent, timeline,
      });
    });

    // Build per-(user,day) activity window from union of audit logs, messages, and presence
    const activityIdx: Record<string, { userId: string; userName: string; day: string; first: string; last: string }> = {};
    const bump = (uid: string, uname: string | null, at: string) => {
      const day = brtDay(at);
      const key = `${uid}::${day}`;
      if (!activityIdx[key]) {
        activityIdx[key] = { userId: uid, userName: uname || opName[uid] || "—", day, first: at, last: at };
      } else {
        if (at < activityIdx[key].first) activityIdx[key].first = at;
        if (at > activityIdx[key].last) activityIdx[key].last = at;
        if (!activityIdx[key].userName || activityIdx[key].userName === "—") {
          activityIdx[key].userName = uname || opName[uid] || activityIdx[key].userName;
        }
      }
    };
    presence.forEach((ev) => bump(ev.user_id, ev.user_name, ev.created_at));
    opMessages.forEach((m) => { if (m.sent_by_user_id) bump(m.sent_by_user_id, null, m.created_at); });
    activityLogs.forEach((a) => bump(a.user_id, a.user_name, a.created_at));

    // Fallback: synthesize rows for (user, day) pairs with activity but no presence row
    const existingKeys = new Set(out.map((r) => `${r.userId}::${r.day}`));
    const todayStr = brtDay(new Date().toISOString());
    Object.values(activityIdx).forEach((g) => {
      const key = `${g.userId}::${g.day}`;
      if (existingKeys.has(key)) return;
      const isToday = g.day === todayStr;
      const start = new Date(g.first).getTime();
      const end = new Date(g.last).getTime();
      const total = Math.max(0, (end - start) / 60000);
      const attendancesStarted = chats.filter((c) =>
        c.assigned_to === g.userId && brtDay(c.created_at) === g.day
      ).length;
      const messagesSent = opMessages.filter((m) =>
        m.sent_by_user_id === g.userId && brtDay(m.created_at) === g.day
      ).length;
      out.push({
        userId: g.userId,
        userName: g.userName,
        day: g.day,
        firstOnline: null,
        lastOffline: null,
        firstActivity: g.first,
        lastActivity: isToday ? g.last : g.last,
        totalMinutes: total,
        pauses: 0,
        stillOnline: isToday,
        attendancesStarted,
        messagesSent,
        timeline: [],
      });
    });

    // Attach firstActivity/lastActivity to every row from the activity index
    out.forEach((r) => {
      const idx = activityIdx[`${r.userId}::${r.day}`];
      if (idx) {
        r.firstActivity = idx.first;
        r.lastActivity = idx.last;
      } else {
        // Fall back to presence times if no other activity recorded
        r.firstActivity = r.firstOnline;
        r.lastActivity = r.lastOffline;
      }
    });

    return out.sort((a, b) =>
      b.day.localeCompare(a.day) || a.userName.localeCompare(b.userName)
    );
  }, [presence, opName, chats, opMessages, activityLogs]);



  type Gap = {
    chatId: string; userId: string; userName: string;
    contact: string; phone: string;
    start: string; end: string; minutes: number;
  };
  const gaps = useMemo<Gap[]>(() => {
    const chatById: Record<string, typeof chats[number]> = {};
    chats.forEach((c) => { chatById[c.id] = c; });
    const byChat: Record<string, typeof opMessages> = {};
    opMessages.forEach((m) => {
      (byChat[m.chat_id] ||= []).push(m);
    });
    const out: Gap[] = [];
    chats.forEach((c) => {
      const userId = c.assigned_to;
      if (!userId) return;
      const userName = opName[userId] || "—";
      const msgs = (byChat[c.id] || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      // Anchor start = chat created_at clamped to window
      const windowStart = new Date(fromIso).getTime();
      const windowEnd = new Date(toIso).getTime();
      const chatStart = Math.max(windowStart, new Date(c.created_at).getTime());
      const chatEnd = c.closed_at
        ? Math.min(windowEnd, new Date(c.closed_at).getTime())
        : Math.min(windowEnd, Date.now());
      if (chatEnd <= chatStart) return;

      const points: number[] = [chatStart, ...msgs.map((m) => new Date(m.created_at).getTime()), chatEnd];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const mins = (b - a) / 60000;
        if (mins > threshold) {
          out.push({
            chatId: c.id, userId, userName,
            contact: c.contact_name || c.phone,
            phone: c.phone,
            start: new Date(a).toISOString(),
            end: new Date(b).toISOString(),
            minutes: mins,
          });
        }
      }
    });
    return out.sort((a, b) => b.minutes - a.minutes);
  }, [chats, opMessages, opName, threshold, fromIso, toIso]);

  // Aggregates for charts
  const idleByOperator = useMemo(() => {
    const m: Record<string, { name: string; minutes: number; count: number }> = {};
    gaps.forEach((g) => {
      if (!m[g.userId]) m[g.userId] = { name: g.userName, minutes: 0, count: 0 };
      m[g.userId].minutes += g.minutes;
      m[g.userId].count += 1;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [gaps]);

  const idleByDay = useMemo(() => {
    const m: Record<string, { date: string; minutes: number }> = {};
    gaps.forEach((g) => {
      const day = brtDay(g.start);
      if (!m[day]) m[day] = { date: day, minutes: 0 };
      m[day].minutes += g.minutes;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [gaps]);

  const totalIdleMinutes = useMemo(
    () => gaps.reduce((s, g) => s + g.minutes, 0), [gaps]
  );

  // ============ GLOBAL ABSENCE (no interaction in any chat) ============
  type GlobalGap = {
    userId: string; userName: string; day: string;
    start: string; end: string; minutes: number;
    onlineStart: string; onlineEnd: string;
  };
  const globalGaps = useMemo<GlobalGap[]>(() => {
    const byUserDay: Record<string, { userId: string; userName: string; day: string; events: typeof presence }> = {};
    presence.forEach((ev) => {
      const day = brtDay(ev.created_at);
      const key = `${ev.user_id}::${day}`;
      if (!byUserDay[key]) {
        byUserDay[key] = {
          userId: ev.user_id,
          userName: ev.user_name || opName[ev.user_id] || "—",
          day, events: [],
        };
      }
      byUserDay[key].events.push(ev);
    });

    const msgsByUserDay: Record<string, typeof opMessages> = {};
    opMessages.forEach((m) => {
      if (!m.sent_by_user_id) return;
      const day = brtDay(m.created_at);
      const key = `${m.sent_by_user_id}::${day}`;
      (msgsByUserDay[key] ||= []).push(m);
    });

    const out: GlobalGap[] = [];
    const nowMs = Date.now();

    Object.values(byUserDay).forEach((g) => {
      const evs = g.events.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      const dayEndIso = `${g.day}T23:59:59`;
      const dayEnd = new Date(dayEndIso).getTime();

      const periods: { start: string; end: string }[] = [];
      let openOnline: string | null = null;
      evs.forEach((ev) => {
        if (ev.event_type === "set_online") {
          if (!openOnline) openOnline = ev.created_at;
        } else if (ev.event_type === "set_offline" && openOnline) {
          periods.push({ start: openOnline, end: ev.created_at });
          openOnline = null;
        }
      });
      if (openOnline) {
        const cap = Math.min(dayEnd, nowMs);
        periods.push({ start: openOnline, end: new Date(cap).toISOString() });
      }

      const key = `${g.userId}::${g.day}`;
      const msgs = (msgsByUserDay[key] || [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at));

      periods.forEach((period) => {
        const pStart = new Date(period.start).getTime();
        const pEnd = new Date(period.end).getTime();
        if (pEnd <= pStart) return;
        const periodMsgs = msgs.filter((m) => {
          const t = new Date(m.created_at).getTime();
          return t >= pStart && t <= pEnd;
        });
        const points = [pStart, ...periodMsgs.map((m) => new Date(m.created_at).getTime()), pEnd];
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i], b = points[i + 1];
          const mins = (b - a) / 60000;
          if (mins > threshold) {
            out.push({
              userId: g.userId,
              userName: g.userName,
              day: g.day,
              start: new Date(a).toISOString(),
              end: new Date(b).toISOString(),
              minutes: mins,
              onlineStart: period.start,
              onlineEnd: period.end,
            });
          }
        }
      });
    });

    return out.sort((a, b) => b.minutes - a.minutes);
  }, [presence, opMessages, opName, threshold]);

  // ============ APPLY IN-TAB FILTERS ============
  const matchesOperator = (uid: string) =>
    localOperator === "__all__" || uid === localOperator;
  const matchesContact = (text: string) => {
    if (!contactSearch.trim()) return true;
    return text.toLowerCase().includes(contactSearch.trim().toLowerCase());
  };
  const matchesDay = (day: string) =>
    dayFilter === "__all__" || day === dayFilter;

  const filteredJourneyRows = useMemo(
    () => journeyRows.filter((r) => matchesOperator(r.userId) && matchesDay(r.day)),
    [journeyRows, localOperator, dayFilter]
  );
  const filteredGaps = useMemo(
    () => gaps.filter((g) =>
      matchesOperator(g.userId) &&
      matchesContact(`${g.contact} ${g.phone}`) &&
      matchesDay(brtDay(g.start))
    ),
    [gaps, localOperator, contactSearch, dayFilter]
  );

  const filteredIdleByOperator = useMemo(() => {
    const m: Record<string, { name: string; minutes: number; count: number }> = {};
    filteredGaps.forEach((g) => {
      if (!m[g.userId]) m[g.userId] = { name: g.userName, minutes: 0, count: 0 };
      m[g.userId].minutes += g.minutes;
      m[g.userId].count += 1;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredGaps]);

  const filteredIdleByDay = useMemo(() => {
    const m: Record<string, { date: string; minutes: number }> = {};
    filteredGaps.forEach((g) => {
      const day = brtDay(g.start);
      if (!m[day]) m[day] = { date: day, minutes: 0 };
      m[day].minutes += g.minutes;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredGaps]);

  const filteredTotalIdleMinutes = useMemo(
    () => filteredGaps.reduce((s, g) => s + g.minutes, 0), [filteredGaps]
  );

  const filteredGlobalGaps = useMemo(
    () => globalGaps.filter((g) =>
      matchesOperator(g.userId) && matchesDay(g.day)
    ),
    [globalGaps, localOperator, dayFilter]
  );

  const filteredGlobalIdleByOperator = useMemo(() => {
    const m: Record<string, { name: string; minutes: number; count: number }> = {};
    filteredGlobalGaps.forEach((g) => {
      if (!m[g.userId]) m[g.userId] = { name: g.userName, minutes: 0, count: 0 };
      m[g.userId].minutes += g.minutes;
      m[g.userId].count += 1;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredGlobalGaps]);

  const filteredGlobalIdleByDay = useMemo(() => {
    const m: Record<string, { date: string; minutes: number }> = {};
    filteredGlobalGaps.forEach((g) => {
      if (!m[g.day]) m[g.day] = { date: g.day, minutes: 0 };
      m[g.day].minutes += g.minutes;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredGlobalGaps]);

  const filteredTotalGlobalIdleMinutes = useMemo(
    () => filteredGlobalGaps.reduce((s, g) => s + g.minutes, 0), [filteredGlobalGaps]
  );

  // ============ RESUMO DA OPERAÇÃO (produtividade de interação) ============
  type SummaryRow = {
    userId: string; userName: string; days: number;
    onlineMinutes: number; idleMinutes: number; workMinutes: number;
    idleBlocks: number; shiftMinutes: number;
    assumidos: number; transferidosRecebidos: number; filaTratados: number;
    finalizados: number; messages: number;
  };

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const rows: Record<string, SummaryRow> = {};
    const ensure = (userId: string, userName: string) => {
      if (!rows[userId]) {
        rows[userId] = {
          userId, userName: userName || opName[userId] || "—", days: 0,
          onlineMinutes: 0, idleMinutes: 0, workMinutes: 0,
          idleBlocks: 0, shiftMinutes: 0,
          assumidos: 0, transferidosRecebidos: 0, filaTratados: 0,
          finalizados: 0, messages: 0,
        };
      }
      return rows[userId];
    };

    // Mensagens por usuário (timestamps) para detectar lacunas de interação
    const msgsByUserDay: Record<string, number[]> = {};
    const chatsByUserDay: Record<string, Set<string>> = {};
    opMessages.forEach((m) => {
      if (!m.sent_by_user_id) return;
      const key = `${m.sent_by_user_id}::${brtDay(m.created_at)}`;
      (msgsByUserDay[key] ||= []).push(new Date(m.created_at).getTime());
      (chatsByUserDay[key] ||= new Set()).add(m.chat_id);
    });

    filteredJourneyRows.forEach((r) => {
      const row = ensure(r.userId, r.userName);
      row.days += 1;
      row.onlineMinutes += r.totalMinutes;
      row.messages += r.messagesSent;

      const key = `${r.userId}::${r.day}`;
      row.filaTratados += (chatsByUserDay[key]?.size || 0);

      // Períodos "logado": pares online/offline do dia ou, na ausência de
      // registros de presença, a janela de atividade detectada.
      const periods: Array<{ start: number; end: number }> = [];
      let open: number | null = null;
      r.timeline.forEach((t) => {
        if (t.type === "set_online") {
          if (open === null) open = new Date(t.at).getTime();
        } else if (open !== null) {
          periods.push({ start: open, end: new Date(t.at).getTime() });
          open = null;
        }
      });
      if (open !== null) {
        const dayEnd = new Date(`${r.day}T23:59:59-03:00`).getTime();
        periods.push({ start: open, end: Math.min(dayEnd, Date.now()) });
      }
      if (periods.length === 0 && r.firstActivity && r.lastActivity) {
        periods.push({
          start: new Date(r.firstActivity).getTime(),
          end: new Date(r.lastActivity).getTime(),
        });
      }

      const shiftFrom = new Date(`${r.day}T${shiftStart}:00-03:00`).getTime();
      const shiftTo = new Date(`${r.day}T${shiftEnd}:00-03:00`).getTime();
      const msgs = (msgsByUserDay[key] || []).slice().sort((a, b) => a - b);

      periods.forEach((p) => {
        if (p.end <= p.start) return;
        // Tempo dentro da janela comercial
        const ovStart = Math.max(p.start, shiftFrom);
        const ovEnd = Math.min(p.end, shiftTo);
        if (ovEnd > ovStart) row.shiftMinutes += (ovEnd - ovStart) / 60000;

        const inside = msgs.filter((t) => t >= p.start && t <= p.end);
        const points = [p.start, ...inside, p.end];
        for (let i = 0; i < points.length - 1; i++) {
          const mins = (points[i + 1] - points[i]) / 60000;
          if (mins > threshold) {
            row.idleMinutes += mins;
            row.idleBlocks += Math.floor(mins / threshold);
          }
        }
      });
    });

    // Eventos operacionais
    opsEvents.forEach((e) => {
      const day = brtDay(e.created_at);
      if (!matchesDay(day)) return;
      const meta = (e.metadata || {}) as any;
      if (e.event_type === "chat.assumido") {
        if (!matchesOperator(e.user_id)) return;
        ensure(e.user_id, opName[e.user_id]).assumidos += 1;
      } else if (e.event_type === "chat.transferido") {
        const to = meta.to_user_id as string | undefined;
        if (!to || !matchesOperator(to)) return;
        ensure(to, opName[to]).transferidosRecebidos += 1;
      } else {
        if (!e.user_id || !matchesOperator(e.user_id)) return;
        ensure(e.user_id, opName[e.user_id]).finalizados += 1;
      }
    });

    return Object.values(rows)
      .map((r) => ({
        ...r,
        workMinutes: Math.max(0, r.onlineMinutes - r.idleMinutes),
      }))
      .sort((a, b) => b.workMinutes - a.workMinutes);
  }, [filteredJourneyRows, opMessages, opsEvents, opName, threshold, shiftStart, shiftEnd, localOperator, dayFilter]);

  const summaryTotals = useMemo(() => {
    const t = summaryRows.reduce(
      (acc, r) => {
        acc.online += r.onlineMinutes;
        acc.idle += r.idleMinutes;
        acc.work += r.workMinutes;
        acc.blocks += r.idleBlocks;
        acc.shift += r.shiftMinutes;
        acc.assumidos += r.assumidos;
        acc.transferidos += r.transferidosRecebidos;
        acc.fila += r.filaTratados;
        acc.finalizados += r.finalizados;
        acc.messages += r.messages;
        return acc;
      },
      { online: 0, idle: 0, work: 0, blocks: 0, shift: 0, assumidos: 0, transferidos: 0, fila: 0, finalizados: 0, messages: 0 },
    );
    return {
      ...t,
      occupancy: t.online > 0 ? (t.work / t.online) * 100 : 0,
      msgsPerHour: t.work > 0 ? t.messages / (t.work / 60) : 0,
    };
  }, [summaryRows]);

  const exportSummary = () => {
    exportToCSV(
      summaryRows.map((r) => ({
        Operador: r.userName,
        Dias: r.days,
        "Tempo logado": fmtHm(r.onlineMinutes),
        "Tempo em atendimento": fmtHm(r.workMinutes),
        "Tempo parado": fmtHm(r.idleMinutes),
        [`Blocos de ${threshold}min parado`]: r.idleBlocks,
        [`Atividade ${shiftStart}-${shiftEnd}`]: fmtHm(r.shiftMinutes),
        "Chamados assumidos": r.assumidos,
        "Transferidos para ele": r.transferidosRecebidos,
        "Da fila tratados": r.filaTratados,
        Finalizados: r.finalizados,
        Mensagens: r.messages,
        "Ocupação %": r.onlineMinutes > 0 ? ((r.workMinutes / r.onlineMinutes) * 100).toFixed(1) : "0",
      })),
      `resumo-operacao-${dateFrom}_${dateTo}`,
    );
  };



  // Available days for the day filter dropdown.
  // Enumerate every day in the selected [dateFrom, dateTo] range so the user
  // can pick today even if no presence/message data exists yet, and union with
  // any extra days that show up in data.
  const availableDays = useMemo(() => {
    const set = new Set<string>();
    if (dateFrom && dateTo) {
      const [fy, fm, fd] = dateFrom.split("-").map(Number);
      const [ty, tm, td] = dateTo.split("-").map(Number);
      const start = new Date(fy, (fm || 1) - 1, fd || 1);
      const end = new Date(ty, (tm || 1) - 1, td || 1);
      // safety cap (~2 years) to avoid runaway loops on bad input
      let guard = 0;
      const cur = new Date(start);
      while (cur.getTime() <= end.getTime() && guard < 800) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        set.add(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
        guard++;
      }
    }
    journeyRows.forEach((r) => set.add(r.day));
    gaps.forEach((g) => set.add(brtDay(g.start)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [journeyRows, gaps, dateFrom, dateTo]);

  const formatDayLabel = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const hasActiveFilters =
    localOperator !== "__all__" || contactSearch.trim() !== "" || dayFilter !== "__all__";

  const clearFilters = () => {
    setLocalOperator("__all__");
    setContactSearch("");
    setDayFilter("__all__");
  };


  const applyThreshold = () => {
    const n = Math.max(1, parseInt(thresholdInput, 10) || 10);
    setThreshold(n);
    setThresholdInput(String(n));
  };

  const exportJourney = () => {
    exportToCSV(
      filteredJourneyRows.map((r) => ({
        Operador: r.userName,
        Data: r.day,
        Inicio: fmtTime(r.firstOnline),
        Fim: r.stillOnline ? "Em atividade" : fmtTime(r.lastOffline),
        InicioAtividade: fmtTime(r.firstActivity),
        FimAtividade: r.stillOnline ? "Em atividade" : fmtTime(r.lastActivity),
        TempoOnline: fmtHm(r.totalMinutes),
        Pausas: r.pauses,
        AtendimentosIniciados: r.attendancesStarted,
        MensagensEnviadas: r.messagesSent,
        Timeline: r.timeline
          .map((t) => `${t.type === "set_online" ? "ON" : "OFF"} ${fmtTime(t.at)}`)
          .join(" | "),
      })),
      `jornada-operadores-${dateFrom}_${dateTo}`
    );
  };

  const exportIdle = () => {
    exportToCSV(
      filteredGaps.map((g) => ({
        Operador: g.userName,
        Contato: g.contact,
        Telefone: g.phone,
        InicioGap: fmtDateTime(g.start),
        FimGap: fmtDateTime(g.end),
        Duracao: fmtHm(g.minutes),
        ChatId: g.chatId,
      })),
      `ociosidade-chats-${threshold}min-${dateFrom}_${dateTo}`
    );
  };

  const exportGlobalIdle = () => {
    exportToCSV(
      filteredGlobalGaps.map((g) => ({
        Operador: g.userName,
        Data: g.day,
        InicioPeriodoOnline: fmtDateTime(g.onlineStart),
        FimPeriodoOnline: fmtDateTime(g.onlineEnd),
        InicioAusencia: fmtDateTime(g.start),
        FimAusencia: fmtDateTime(g.end),
        Duracao: fmtHm(g.minutes),
      })),
      `ausencia-global-${threshold}min-${dateFrom}_${dateTo}`
    );
  };


  const loading = presenceLoading || chatsLoading || msgsLoading || activityLoading;

  const cfgBar: ChartConfig = { minutes: { label: "Minutos ociosos", color: "hsl(var(--chart-4))" } };
  const cfgLine: ChartConfig = { minutes: { label: "Minutos ociosos", color: "hsl(var(--chart-2))" } };

  return (
    <div className="space-y-6">
      {/* ============ FILTROS ============ */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <Label className="text-xs">Operador</Label>
              <Select value={localOperator} onValueChange={setLocalOperator}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os operadores</SelectItem>
                  {operators.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label className="text-xs">Dia</Label>
              <Select value={dayFilter} onValueChange={setDayFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os dias</SelectItem>
                  {availableDays.map((d) => (
                    <SelectItem key={d} value={d}>
                      {formatDayLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar contato / telefone</Label>
              <Input
                className="h-9"
                placeholder="Nome ou número..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============ JORNADA ============ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" /> Jornada do Dia (Online / Offline)
          </h3>
          <Button size="sm" variant="outline" onClick={exportJourney} disabled={filteredJourneyRows.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <ReportKpiCard
            title="Operadores ativos"
            value={new Set(filteredJourneyRows.map((r) => r.userId)).size}
            icon={LogIn}
            subtitle={`${dateFrom} a ${dateTo}`}
          />
          <ReportKpiCard
            title="Dias com atividade"
            value={filteredJourneyRows.length}
            icon={Timer}
          />
          <ReportKpiCard
            title="Tempo online total"
            value={fmtHm(filteredJourneyRows.reduce((s, r) => s + r.totalMinutes, 0))}
            icon={Clock}
          />
          <ReportKpiCard
            title="Ainda online"
            value={filteredJourneyRows.filter((r) => r.stillOnline).length}
            icon={LogOut}
          />
        </div>

        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJourneyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum registro de presença no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Início / Finalização</TableHead>
                      <TableHead>Tempo Online</TableHead>
                      <TableHead className="text-right">Pausas</TableHead>
                      <TableHead className="text-right">Atend. iniciados</TableHead>
                      <TableHead className="text-right">Msgs enviadas</TableHead>
                      <TableHead>Atividades do dia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJourneyRows.map((r) => (
                      <TableRow key={`${r.userId}-${r.day}`} className="align-top">
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell>{new Date(r.day).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{fmtTime(r.firstOnline)}</TableCell>
                        <TableCell>
                          {r.stillOnline ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              Em atividade
                            </Badge>
                          ) : fmtTime(r.lastOffline)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {r.firstActivity || r.lastActivity ? (
                            <>
                              {fmtTime(r.firstActivity)}
                              <span className="text-muted-foreground"> → </span>
                              {r.stillOnline ? (
                                <span className="text-emerald-700">agora</span>
                              ) : fmtTime(r.lastActivity)}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{fmtHm(r.totalMinutes)}</TableCell>
                        <TableCell className="text-right">{r.pauses}</TableCell>
                        <TableCell className="text-right">{r.attendancesStarted}</TableCell>
                        <TableCell className="text-right">{r.messagesSent}</TableCell>
                        <TableCell className="max-w-[320px]">
                          {r.timeline.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {r.timeline.map((t, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className={
                                    t.type === "set_online"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                      : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                                  }
                                >
                                  {t.type === "set_online" ? "ON" : "OFF"} {fmtTime(t.at)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* ============ OCIOSIDADE ============ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Chats Ociosos (sem mensagem do operador)
          </h3>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="threshold" className="text-xs">Limite (min)</Label>
              <Input
                id="threshold" type="number" min={1} className="h-8 w-24"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onBlur={applyThreshold}
                onKeyDown={(e) => { if (e.key === "Enter") applyThreshold(); }}
              />
            </div>
            <Button size="sm" variant="outline" onClick={exportIdle} disabled={filteredGaps.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <ReportKpiCard
            title={`Ocorrências (> ${threshold}min)`}
            value={filteredGaps.length}
            icon={AlertTriangle}
          />
          <ReportKpiCard
            title="Tempo ocioso total"
            value={fmtHm(filteredTotalIdleMinutes)}
            icon={Timer}
          />
          <ReportKpiCard
            title="Operadores impactados"
            value={filteredIdleByOperator.length}
            icon={LogIn}
          />
          <ReportKpiCard
            title="Chats com ociosidade"
            value={new Set(filteredGaps.map((g) => g.chatId)).size}
            icon={Clock}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame title="Ociosidade por Operador (min)" data={filteredIdleByOperator as any} filename="ociosidade-por-operador">
            {filteredIdleByOperator.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ChartContainer config={cfgBar} className="h-[280px] w-full">
                <BarChart data={filteredIdleByOperator}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </ChartFrame>

          <ChartFrame title="Ociosidade por Dia (min)" data={filteredIdleByDay as any} filename="ociosidade-por-dia">
            {filteredIdleByDay.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ChartContainer config={cfgLine} className="h-[280px] w-full">
                <LineChart data={filteredIdleByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="minutes" stroke="var(--color-minutes)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            )}
          </ChartFrame>

        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalhamento das Ocorrências</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum período de ociosidade acima de {threshold} min no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGaps.slice(0, 200).map((g, i) => (
                      <TableRow key={`${g.chatId}-${i}`}>
                        <TableCell className="font-medium">{g.userName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{g.contact}</span>
                            <span className="text-xs text-muted-foreground">{g.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{fmtDateTime(g.start)}</TableCell>
                        <TableCell className="text-xs">{fmtDateTime(g.end)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtHm(g.minutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredGaps.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Exibindo 200 de {filteredGaps.length} ocorrências. Exporte o CSV para ver todas.

                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* ============ AUSÊNCIA GLOBAL ============ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <UserX className="h-4 w-4" /> Ausência Global (sem interação em nenhuma conversa)
          </h3>
          <Button size="sm" variant="outline" onClick={exportGlobalIdle} disabled={filteredGlobalGaps.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <ReportKpiCard
            title={`Ocorrências (> ${threshold}min)`}
            value={filteredGlobalGaps.length}
            icon={UserX}
          />
          <ReportKpiCard
            title="Tempo ausente total"
            value={fmtHm(filteredTotalGlobalIdleMinutes)}
            icon={Timer}
          />
          <ReportKpiCard
            title="Operadores impactados"
            value={filteredGlobalIdleByOperator.length}
            icon={LogIn}
          />
          <ReportKpiCard
            title="Dias com ausência"
            value={filteredGlobalIdleByDay.length}
            icon={Clock}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame title="Ausência Global por Operador (min)" data={filteredGlobalIdleByOperator as any} filename="ausencia-por-operador">
            {filteredGlobalIdleByOperator.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ChartContainer config={cfgBar} className="h-[280px] w-full">
                <BarChart data={filteredGlobalIdleByOperator}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </ChartFrame>

          <ChartFrame title="Ausência Global por Dia (min)" data={filteredGlobalIdleByDay as any} filename="ausencia-por-dia">
            {filteredGlobalIdleByDay.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ChartContainer config={cfgLine} className="h-[280px] w-full">
                <LineChart data={filteredGlobalIdleByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="minutes" stroke="var(--color-minutes)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            )}
          </ChartFrame>

        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalhamento da Ausência Global</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGlobalGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma ausência global acima de {threshold} min no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Período online</TableHead>
                      <TableHead>Início da ausência</TableHead>
                      <TableHead>Fim da ausência</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGlobalGaps.slice(0, 200).map((g, i) => (
                      <TableRow key={`${g.userId}-${g.day}-${i}`}>
                        <TableCell className="font-medium">{g.userName}</TableCell>
                        <TableCell>{new Date(g.day).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">
                          {fmtTime(g.onlineStart)} <span className="text-muted-foreground">→</span> {fmtTime(g.onlineEnd)}
                        </TableCell>
                        <TableCell className="text-xs">{fmtDateTime(g.start)}</TableCell>
                        <TableCell className="text-xs">{fmtDateTime(g.end)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtHm(g.minutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredGlobalGaps.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Exibindo 200 de {filteredGlobalGaps.length} ocorrências. Exporte o CSV para ver todas.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
