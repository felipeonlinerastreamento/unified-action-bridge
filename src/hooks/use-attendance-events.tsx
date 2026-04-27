import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export interface AttendanceEventSettings {
  id: string;
  sla_band_change_enabled: boolean;
  sla_band_change_sound: boolean;
  daily_review_enabled: boolean;
  daily_review_time: string; // "HH:MM"
  daily_review_message: string;
  daily_review_sound: boolean;
}

const BAND_LABEL: Record<string, string> = {
  green: "Verde",
  yellow: "Amarelo",
  orange: "Laranja",
  red: "Vermelho",
};

function playBeep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 250);
  } catch {
    // ignore
  }
}

export function useAttendanceEventSettings() {
  return useQuery({
    queryKey: ["attendance-event-settings"],
    queryFn: async (): Promise<AttendanceEventSettings | null> => {
      const { data } = await supabase
        .from("attendance_event_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      return (data as any) || null;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Tracks SLA band changes for chats assigned to the current user and pops a
 * notification when the band changes (e.g., green -> yellow).
 *
 * Pass an array of { chatId, assignedUserId, band, contactName } refreshed
 * by the polling loop in the Central page.
 */
export function useSlaBandChangeNotifier(
  items: Array<{
    chatId: string;
    assignedUserId?: string | null;
    currentUserIsResponsible: boolean;
    band: string;
    contactName?: string;
  }>,
  enabled: boolean,
  withSound: boolean,
) {
  const previous = useRef<Map<string, string>>(new Map());
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled) {
      previous.current.clear();
      initialized.current = false;
      return;
    }
    // First run: just snapshot — do not fire pop-ups for existing state.
    if (!initialized.current) {
      for (const it of items) previous.current.set(it.chatId, it.band);
      initialized.current = true;
      return;
    }

    for (const it of items) {
      const prev = previous.current.get(it.chatId);
      previous.current.set(it.chatId, it.band);
      if (!prev || prev === it.band) continue;
      if (!it.currentUserIsResponsible) continue;

      const message = `Esse chamado está mudando de categoria${
        it.contactName ? ` — ${it.contactName}` : ""
      } (${BAND_LABEL[prev] || prev} → ${BAND_LABEL[it.band] || it.band})`;

      toast.warning("Mudança de faixa de SLA", {
        description: message,
        duration: 8000,
      });
      if (withSound) playBeep();

      // Log event (fire-and-forget)
      supabase
        .from("attendance_event_logs" as any)
        .insert({
          event_type: "sla_band_change",
          message,
          chat_id: it.chatId,
          user_id: it.assignedUserId || null,
          from_band: prev,
          to_band: it.band,
        })
        .then(() => {});
    }
  }, [items, enabled, withSound]);
}

/**
 * Daily reminder pop-up: shows once per day at the configured time
 * for every authenticated user.
 */
export function useDailyReviewReminder() {
  const { isAuthenticated, user } = useAuth();
  const { data: settings } = useAttendanceEventSettings();
  const lastFiredKey = useRef<string>("");

  const fire = useCallback(
    (msg: string, sound: boolean) => {
      toast.info("Revisão de Atendimentos", {
        description: msg,
        duration: 15000,
      });
      if (sound) playBeep();
      supabase
        .from("attendance_event_logs" as any)
        .insert({
          event_type: "daily_review",
          message: msg,
          user_id: user?.id || null,
        })
        .then(() => {});
    },
    [user?.id],
  );

  useEffect(() => {
    if (!isAuthenticated || !settings?.daily_review_enabled) return;
    const time = settings.daily_review_time || "17:40";
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;

    const storageKey = `daily_review_last_fired_${user?.id || "anon"}`;
    lastFiredKey.current = localStorage.getItem(storageKey) || "";

    const tick = () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (now.getHours() === hh && now.getMinutes() === mm) {
        if (lastFiredKey.current !== today) {
          lastFiredKey.current = today;
          localStorage.setItem(storageKey, today);
          fire(settings.daily_review_message, settings.daily_review_sound);
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, settings, user?.id, fire]);
}
