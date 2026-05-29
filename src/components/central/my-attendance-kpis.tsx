import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Briefcase, Timer, Target } from "lucide-react";

type Period = "day" | "week" | "month";

function formatMinutes(mins: number | null): string {
  if (mins == null || !Number.isFinite(mins)) return "—";
  if (mins < 1) return "<1 min";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function MyAttendanceKpis() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("day");

  // Realtime: invalida KPIs quando chats do usuário mudam
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`my-kpis-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zapi_chats", filter: `assigned_to=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-avg-attendance-time", user.id] });
          queryClient.invalidateQueries({ queryKey: ["sector-open-chats"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zapi_chats", filter: `closed_by_user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["my-avg-attendance-time", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "zapi_chats" },
        () => {
          // Atualiza contagem do setor para qualquer mudança de status
          queryClient.invalidateQueries({ queryKey: ["sector-open-chats"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Setores do usuário
  const { data: mySectors = [] } = useQuery({
    queryKey: ["my-sectors", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_sector_assignments" as any)
        .select("sectors(name)")
        .eq("user_id", user.id);
      return ((data as any[]) || [])
        .map((r) => r?.sectors?.name)
        .filter(Boolean) as string[];
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Atendimentos em aberto do(s) setor(es) atribuídos ao usuário
  const { data: sectorOpenCount = 0 } = useQuery({
    queryKey: ["sector-open-chats", user?.id, mySectors],
    queryFn: async () => {
      if (!user?.id || mySectors.length === 0) return 0;
      const { count } = await supabase
        .from("zapi_chats" as any)
        .select("id", { count: "exact", head: true })
        .in("sector_name", mySectors)
        .eq("status", "em_atendimento")
        .eq("assigned_to", user.id);
      return count || 0;
    },
    enabled: !!user?.id && mySectors.length > 0,
    refetchInterval: 30000,
  });

  // Meta do usuário (perfil)
  const { data: targetMinutes } = useQuery({
    queryKey: ["my-attendance-target", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("attendance_target_minutes")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any)?.attendance_target_minutes ?? null;
    },
    enabled: !!user?.id,
    staleTime: 300000,
  });

  // Média do tempo dos meus atendimentos finalizados no período.
  // Janela: chats finalizados (closed_at) dentro do período.
  // Duração: do meu PRIMEIRO envio (from_me=true, não-whisper, sent_by_user_id=eu)
  // até closed_at. Chats sem mensagem minha são ignorados.
  const { data: avgMinutes = null } = useQuery({
    queryKey: ["my-avg-attendance-time", user?.id, period],
    queryFn: async () => {
      if (!user?.id) return null;
      const since = new Date();
      if (period === "day") since.setHours(0, 0, 0, 0);
      else if (period === "week") since.setDate(since.getDate() - 7);
      else since.setMonth(since.getMonth() - 1);

      const { data: chats } = await supabase
        .from("zapi_chats" as any)
        .select("id, closed_at, updated_at")
        .eq("closed_by_user_id", user.id)
        .eq("status", "finalizado")
        .gte("closed_at", since.toISOString());

      const chatRows = (chats as any[]) || [];
      if (chatRows.length === 0) return null;

      const chatIds = chatRows.map((c) => c.id);
      const { data: msgs } = await supabase
        .from("zapi_messages" as any)
        .select("chat_id, created_at")
        .in("chat_id", chatIds)
        .eq("sent_by_user_id", user.id)
        .eq("from_me", true)
        .or("is_whisper.is.null,is_whisper.eq.false")
        .order("created_at", { ascending: true });

      const firstMineByChat = new Map<string, number>();
      for (const m of ((msgs as any[]) || [])) {
        if (!firstMineByChat.has(m.chat_id)) {
          firstMineByChat.set(m.chat_id, new Date(m.created_at).getTime());
        }
      }

      let totalMs = 0;
      let count = 0;
      for (const c of chatRows) {
        const firstMine = firstMineByChat.get(c.id);
        if (firstMine == null) continue;
        const end = new Date(c.closed_at ?? c.updated_at).getTime();
        totalMs += Math.max(0, end - firstMine);
        count += 1;
      }
      if (count === 0) return null;
      return totalMs / count / 60000;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });

  const meta = useMemo(() => {
    if (targetMinutes == null) return null;
    return Number(targetMinutes);
  }, [targetMinutes]);

  // Cor da média comparada à meta
  const avgVsTarget = useMemo(() => {
    if (avgMinutes == null || meta == null) return "text-foreground";
    if (avgMinutes <= meta) return "text-emerald-600 dark:text-emerald-400";
    if (avgMinutes <= meta * 1.25) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  }, [avgMinutes, meta]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Atendimentos do meu setor */}
      <Card className="px-3 py-2 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-blue-600" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Meu setor</p>
          <p className="text-sm font-semibold">{sectorOpenCount} aberto(s)</p>
        </div>
      </Card>

      {/* Minha média de tempo */}
      <Card className="px-3 py-2 flex items-center gap-2">
        <Timer className="h-4 w-4 text-purple-600" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Minha média</p>
          <p className={`text-sm font-semibold ${avgVsTarget}`}>{formatMinutes(avgMinutes)}</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="h-7 w-[88px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Dia</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Minha meta */}
      <Card className="px-3 py-2 flex items-center gap-2">
        <Target className="h-4 w-4 text-emerald-600" />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Minha meta</p>
          <p className="text-sm font-semibold">
            {meta != null ? formatMinutes(meta) : "Não definida"}
          </p>
        </div>
      </Card>
    </div>
  );
}
