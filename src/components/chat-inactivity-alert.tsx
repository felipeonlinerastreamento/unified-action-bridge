import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, MessageSquare, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Settings = {
  id: string;
  is_enabled: boolean;
  inactivity_minutes: number;
  alert_message: string;
  target_type: "assigned" | "all" | "sector" | "users";
  target_sector_ids: string[];
  target_user_ids: string[];
  requires_acknowledge: boolean;
  sound_enabled: boolean;
  cooldown_minutes: number;
};

type StaleChat = {
  id: string;
  phone: string;
  contact_name: string | null;
  assigned_to: string | null;
  sector_name: string | null;
  last_message_at: string;
  inactiveMinutes: number;
};

const SEEN_KEY_PREFIX = "chat-inactivity-seen:";

function playBeep() {
  try {
    // @ts-ignore
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
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
    }, 200);
  } catch {
    /* noop */
  }
}

export function ChatInactivityAlert() {
  const { user, isAuthenticated } = useAuth();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const lastBeepRef = useRef<number>(0);

  // Fetch settings
  const { data: settings } = useQuery<Settings | null>({
    queryKey: ["chat-inactivity-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_inactivity_alert_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      return (data as any) || null;
    },
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  // Fetch user's sectors (for target_type === "sector")
  const { data: mySectorIds = [] } = useQuery<string[]>({
    queryKey: ["my-sector-ids", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_sector_assignments")
        .select("sector_id")
        .eq("user_id", user.id);
      return (data || []).map((r: any) => r.sector_id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  // Fetch user profile (for log records)
  const { data: profile } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  // Decide if current user should receive alerts
  const isTargetUser = useMemo(() => {
    if (!settings || !user?.id) return false;
    if (!settings.is_enabled) return false;
    switch (settings.target_type) {
      case "all":
        return true;
      case "users":
        return (settings.target_user_ids || []).includes(user.id);
      case "sector":
        return (settings.target_sector_ids || []).some((sid) => mySectorIds.includes(sid));
      case "assigned":
        // shown only on chats assigned to this user — handled below per-chat
        return true;
      default:
        return false;
    }
  }, [settings, user?.id, mySectorIds]);

  // Poll active chats (not finalized) — same source the operator already sees
  const { data: chats = [] } = useQuery({
    queryKey: ["chat-inactivity-scan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("zapi_chats")
        .select("id, phone, contact_name, assigned_to, sector_name, last_message_at, status")
        .neq("status", "finalizado")
        .order("last_message_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    refetchInterval: 30_000,
    enabled: isAuthenticated && !!settings?.is_enabled && isTargetUser,
  });

  // Compute stale chats relevant to this user
  const staleChats: StaleChat[] = useMemo(() => {
    if (!settings || !user?.id) return [];
    const threshold = Math.max(1, settings.inactivity_minutes) * 60_000;
    const now = Date.now();
    const filtered = (chats as any[]).filter((c) => {
      if (!c.last_message_at) return false;
      const lastMs = new Date(c.last_message_at).getTime();
      if (now - lastMs < threshold) return false;
      if (settings.target_type === "assigned") {
        return c.assigned_to === user.id;
      }
      return true;
    });
    return filtered.map((c) => ({
      id: c.id,
      phone: c.phone,
      contact_name: c.contact_name,
      assigned_to: c.assigned_to,
      sector_name: c.sector_name,
      last_message_at: c.last_message_at,
      inactiveMinutes: Math.floor((now - new Date(c.last_message_at).getTime()) / 60_000),
    }));
  }, [chats, settings, user?.id]);

  // Pick the most-stale chat that hasn't been ack'd recently (cooldown)
  const visibleChat = useMemo(() => {
    if (!staleChats.length) return null;
    const cooldownMs = (settings?.cooldown_minutes ?? 30) * 60_000;
    const now = Date.now();
    const candidates = staleChats
      .filter((c) => {
        if (dismissedId === c.id) return false;
        try {
          const seenAt = Number(localStorage.getItem(`${SEEN_KEY_PREFIX}${c.id}`) || 0);
          if (seenAt && now - seenAt < cooldownMs) return false;
        } catch {
          /* noop */
        }
        return true;
      })
      .sort((a, b) => b.inactiveMinutes - a.inactiveMinutes);
    return candidates[0] || null;
  }, [staleChats, dismissedId, settings?.cooldown_minutes]);

  // Log dispatch + optional sound when a new alert appears
  const lastLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visibleChat || !user?.id || !settings) return;
    if (lastLoggedRef.current === visibleChat.id) return;
    lastLoggedRef.current = visibleChat.id;

    void supabase.from("chat_inactivity_alert_logs" as any).insert({
      chat_id: visibleChat.id,
      chat_phone: visibleChat.phone,
      contact_name: visibleChat.contact_name,
      assigned_user_id: visibleChat.assigned_to,
      recipient_user_id: user.id,
      recipient_name: (profile as any)?.name || "",
      inactivity_minutes: visibleChat.inactiveMinutes,
      last_message_at: visibleChat.last_message_at,
      alert_message: settings.alert_message,
    } as any);

    if (settings.sound_enabled && Date.now() - lastBeepRef.current > 5000) {
      lastBeepRef.current = Date.now();
      playBeep();
    }
  }, [visibleChat, user?.id, settings, profile]);

  if (!settings?.is_enabled || !isTargetUser || !visibleChat) return null;

  const acknowledge = async () => {
    try {
      localStorage.setItem(`${SEEN_KEY_PREFIX}${visibleChat.id}`, String(Date.now()));
    } catch {
      /* noop */
    }
    // Mark the latest open log as acknowledged
    if (user?.id) {
      await supabase
        .from("chat_inactivity_alert_logs" as any)
        .update({ acknowledged_at: new Date().toISOString() } as any)
        .eq("chat_id", visibleChat.id)
        .eq("recipient_user_id", user.id)
        .is("acknowledged_at", null);
    }
    setDismissedId(visibleChat.id);
  };

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-[100] w-[340px] rounded-lg border-2 border-amber-500 bg-card shadow-2xl",
        "animate-in fade-in slide-in-from-bottom-4 duration-300",
      )}
      role="alertdialog"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 animate-pulse" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{settings.alert_message}</div>
          <div className="text-xs text-muted-foreground">
            Inativo há {visibleChat.inactiveMinutes} min
          </div>
        </div>
        {!settings.requires_acknowledge && (
          <button
            onClick={() => setDismissedId(visibleChat.id)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 truncate font-medium">
            {visibleChat.contact_name || visibleChat.phone}
          </div>
        </div>
        {visibleChat.sector_name && (
          <div className="text-xs text-muted-foreground">Setor: {visibleChat.sector_name}</div>
        )}
        <div className="flex gap-2 pt-1">
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link to="/" search={{ chat: visibleChat.id } as any} onClick={acknowledge}>
              Abrir conversa
            </Link>
          </Button>
          <Button size="sm" onClick={acknowledge} className="gap-1">
            <Check className="h-4 w-4" />
            Visto
          </Button>
        </div>
      </div>
    </div>
  );
}
