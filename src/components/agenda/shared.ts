// Helpers tolerantes ao formato de resposta da API do Seu Instalador.

export function asList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const k of ["data", "items", "results", "activities", "clients", "technicians", "serviceTypes", "history", "entries", "timeline"]) {
    const v = payload?.[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      for (const k2 of ["data", "items", "results"]) {
        if (Array.isArray(v?.[k2])) return v[k2];
      }
    }
  }
  return [];
}

export function pick(obj: any, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
    if (v && typeof v === "object") {
      const nested = v.name ?? v.nome ?? v.title;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
  }
  return fallback;
}

// A API do Seu Instalador envia os horários em UTC (ex.: 12:00Z = 09:00 em Brasília).
export const SP_TZ = "America/Sao_Paulo";

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value);
  // Sem fuso explícito, tratamos como horário de Brasília (-03:00).
  const normalized = /T\d{2}:\d{2}/.test(raw) && !/(Z|[+-]\d{2}:?\d{2})$/.test(raw) ? `${raw}-03:00` : raw;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Partes da data/hora no fuso de Brasília. */
export function saoPauloParts(value?: string | null) {
  const d = toDate(value);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

export function formatDateTime(value?: string | null): string {
  const p = saoPauloParts(value);
  if (!p) return value ? String(value) : "—";
  return `${p.day}/${p.month}/${p.year} ${p.time}`;
}

export function formatTime(value?: string | null): string {
  const p = saoPauloParts(value);
  if (!p) return value ? String(value) : "—";
  return p.time;
}

/** Minutos desde a meia-noite, no fuso de Brasília. */
export function minutesOfDaySP(value?: string | null): number | null {
  const p = saoPauloParts(value);
  if (!p) return null;
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Fotos/anexos da OS, em qualquer um dos formatos que a API possa devolver. */
export function osPhotos(activity: any): { url: string; caption?: string }[] {
  const out: { url: string; caption?: string }[] = [];
  const buckets = [activity?.photos, activity?.images, activity?.attachments, activity?.files, activity?.evidences];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (typeof item === "string" && item.trim()) {
        out.push({ url: item });
        continue;
      }
      const url = item?.url ?? item?.src ?? item?.link ?? item?.publicUrl ?? item?.path;
      if (typeof url === "string" && url.trim()) {
        out.push({ url, caption: item?.caption ?? item?.description ?? item?.name });
      }
    }
  }
  return out;
}

export function todayISO(): string {
  const now = new Date();
  const off = now.getTimezoneOffset();
  return new Date(now.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return msg || "Não foi possível concluir a operação.";
}
