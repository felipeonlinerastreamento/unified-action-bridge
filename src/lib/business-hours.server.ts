// Helpers de horário de funcionamento (server-only)

type DaySchedule = {
  enabled: boolean;
  open: string; // "HH:MM"
  close: string;
  lunch_start: string | null;
  lunch_end: string | null;
};

export type BusinessHoursSettings = {
  is_enabled: boolean;
  timezone: string;
  schedule: Record<string, DaySchedule>;
  out_of_hours_message: string;
  cooldown_minutes: number;
  holidays: string[]; // YYYY-MM-DD
};

function getZonedParts(date: Date, tz: string) {
  // Usa Intl para extrair partes na timezone alvo
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dow: weekdayMap[parts.weekday] ?? new Date(date).getDay(),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isWithinBusinessHours(
  settings: BusinessHoursSettings,
  now: Date = new Date(),
): boolean {
  if (!settings.is_enabled) return true; // se desabilitado, considera sempre dentro
  const tz = settings.timezone || "America/Sao_Paulo";
  const parts = getZonedParts(now, tz);
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;

  // Feriado?
  if (Array.isArray(settings.holidays) && settings.holidays.includes(isoDate)) {
    return false;
  }

  const day = settings.schedule?.[String(parts.dow)];
  if (!day || !day.enabled) return false;

  const cur = parts.hour * 60 + parts.minute;
  const open = toMinutes(day.open);
  const close = toMinutes(day.close);
  if (cur < open || cur >= close) return false;

  // Almoço
  if (day.lunch_start && day.lunch_end) {
    const ls = toMinutes(day.lunch_start);
    const le = toMinutes(day.lunch_end);
    if (cur >= ls && cur < le) return false;
  }

  return true;
}

export async function loadBusinessHoursSettings(
  supabase: any,
): Promise<BusinessHoursSettings | null> {
  const { data, error } = await supabase
    .from("business_hours_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    is_enabled: !!data.is_enabled,
    timezone: data.timezone || "America/Sao_Paulo",
    schedule: data.schedule || {},
    out_of_hours_message: data.out_of_hours_message || "",
    cooldown_minutes: data.cooldown_minutes ?? 120,
    holidays: (data.holidays as string[]) || [],
  };
}

/** Retorna true se devemos enviar a mensagem (cooldown não bloqueando). */
export async function shouldSendOutOfHoursMessage(
  supabase: any,
  phone: string,
  cooldownMinutes: number,
): Promise<boolean> {
  // Reserva atômica: grava primeiro e só então confere se já existia outro
  // envio dentro da janela — evita duas mensagens iguais em poucos segundos.
  const windowMinutes = cooldownMinutes > 0 ? cooldownMinutes : 1;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { data: reserved, error: reserveError } = await supabase
    .from("out_of_hours_message_log")
    .insert({ contact_phone: phone, message_sent: "__reserva__" })
    .select("id")
    .maybeSingle();
  if (reserveError || !(reserved as any)?.id) return false;
  const reservationId = (reserved as any).id;

  const { data: previous } = await supabase
    .from("out_of_hours_message_log")
    .select("id")
    .eq("contact_phone", phone)
    .gte("sent_at", since)
    .neq("id", reservationId)
    .limit(1)
    .maybeSingle();

  if (previous) {
    await supabase.from("out_of_hours_message_log").delete().eq("id", reservationId);
    return false;
  }
  return true;
}

export async function logOutOfHoursMessage(
  supabase: any,
  phone: string,
  chatId: string | null,
  message: string,
) {
  // Preenche a reserva criada por shouldSendOutOfHoursMessage, se existir.
  const { data: reservation } = await supabase
    .from("out_of_hours_message_log")
    .select("id")
    .eq("contact_phone", phone)
    .eq("message_sent", "__reserva__")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((reservation as any)?.id) {
    await supabase
      .from("out_of_hours_message_log")
      .update({ chat_id: chatId, message_sent: message })
      .eq("id", (reservation as any).id);
    return;
  }

  await supabase.from("out_of_hours_message_log").insert({
    contact_phone: phone,
    chat_id: chatId,
    message_sent: message,
  });
}
