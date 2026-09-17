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

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
