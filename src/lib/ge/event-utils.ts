import { geDb as supabase } from "@/lib/ge/db";

export function extractSpeedLimitFromFence(eventData: unknown): number | null {
  if (!eventData || typeof eventData !== "object") return null;
  const obj = eventData as Record<string, unknown>;
  const name = obj.activeGeofenceName ?? obj.fence_name ?? obj.geofenceName;
  if (typeof name !== "string") return null;
  const m = name.match(/(\d+)\s*km/i);
  return m ? Number(m[1]) : null;
}

function getSpeed(eventData: unknown): number | null {
  if (!eventData || typeof eventData !== "object") return null;
  const obj = eventData as Record<string, unknown>;
  const v = obj.speed ?? obj.velocidade ?? obj.velocity;
  return typeof v === "number" ? v : null;
}

export interface ComputedDuration {
  durationSeconds: number;
  isApproximate: boolean;
}

const STOP_EVENT_TYPES = [
  "Ignição desligada",
  "Ignicao desligada",
  "Parado",
  "Parada",
];

function isStopEvent(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  const lower = eventType.toLowerCase();
  return STOP_EVENT_TYPES.some((t) => lower.includes(t.toLowerCase()));
}

export async function computeSpeedingDuration(params: {
  eventId: string;
  licensePlate: string | null;
  eventTime: string;
  clientId: string;
  speedLimit: number | null;
}): Promise<ComputedDuration | null> {
  const { licensePlate, eventTime, clientId, speedLimit: initialLimit } = params;
  if (!licensePlate) return null;

  const targetMs = new Date(eventTime).getTime();
  const windowStart = new Date(targetMs - 30 * 60_000).toISOString();
  const windowEnd = new Date(targetMs + 30 * 60_000).toISOString();

  const { data, error } = await supabase
    .from("ge_events")
    .select("event_time, event_type, event_data")
    .eq("client_id", clientId)
    .eq("license_plate", licensePlate)
    .gte("event_time", windowStart)
    .lte("event_time", windowEnd)
    .order("event_time", { ascending: true })
    .limit(120);

  if (error || !data || data.length === 0) return null;

  // Resolve a working speed limit: prefer the provided limit, else infer from any row's fence.
  let limit = initialLimit;
  if (limit == null) {
    for (const row of data) {
      const l = extractSpeedLimitFromFence(row.event_data);
      if (l != null) {
        limit = l;
        break;
      }
    }
  }

  // Fallback mode: no limit available (e.g. Movias telemetry without fence).
  // Treat consecutive "Excesso de velocidade" rows of the same plate as the
  // same episode — the source already classified each sample as speeding.
  const noLimitMode = limit == null;

  // Locate the row that matches the opened event (by exact timestamp match).
  const targetIdx = data.findIndex(
    (r) => new Date(r.event_time).getTime() === targetMs,
  );

  // Helper: a sample counts as "over limit" if its speed > limit OR it is itself
  // an excess event with no speed sample (treat as over).
  const isOver = (row: { event_type: string; event_data: unknown }): boolean => {
    if (noLimitMode) return /excesso/i.test(row.event_type ?? "");
    const s = getSpeed(row.event_data);
    if (s != null) return s > limit!;
    return /excesso/i.test(row.event_type ?? "");
  };
  const isBelow = (row: { event_type: string; event_data: unknown }): boolean => {
    if (noLimitMode) return !/excesso/i.test(row.event_type ?? "");
    const s = getSpeed(row.event_data);
    return s != null && s <= limit!;
  };

  // Walk backwards from the target to find the first sample of the episode.
  let startIdx = targetIdx >= 0 ? targetIdx : 0;
  if (targetIdx >= 0) {
    for (let i = targetIdx - 1; i >= 0; i--) {
      const row = data[i];
      if (isStopEvent(row.event_type) || isBelow(row)) break;
      if (isOver(row)) startIdx = i;
    }
  } else {
    // Target row not found in window — fall back to first over-limit sample <= target.
    for (let i = 0; i < data.length; i++) {
      const t = new Date(data[i].event_time).getTime();
      if (t > targetMs) break;
      if (isOver(data[i])) {
        startIdx = i;
        break;
      }
    }
  }

  const startMs = new Date(data[startIdx].event_time).getTime();

  // Walk forwards from target (or start) to find first below-limit / stop event.
  const scanFrom = Math.max(targetIdx, startIdx) + 1;
  for (let i = scanFrom; i < data.length; i++) {
    const row = data[i];
    if (isStopEvent(row.event_type) || isBelow(row)) {
      const dur = Math.round((new Date(row.event_time).getTime() - startMs) / 1000);
      return { durationSeconds: Math.max(dur, 0), isApproximate: false };
    }
  }

  // No closing sample — approximate using the last over-limit sample (or target itself).
  const lastIdx = Math.max(targetIdx, startIdx, data.length - 1);
  const lastMs = new Date(data[lastIdx].event_time).getTime();
  const dur = Math.round((lastMs - startMs) / 1000);
  return { durationSeconds: Math.max(dur, 0), isApproximate: true };
}
