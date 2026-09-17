import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE_URL = "https://jyukercrhruslahpqlqi.supabase.co/functions/v1/public-api";

export interface TopGamificEntry {
  id: string;
  date: string;
  userName: string;
  squad: string | null;
  metricName: string;
  metricType: string | null;
  category: string | null;
  coins: number;
  points: number;
  notes: string | null;
  acknowledged: boolean;
}

export interface TopGamificMission {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: string | null;
  status: string | null;
  target: number | null;
  reward: number | null;
  targetSquad: string | null;
  expiresAt: string | null;
}

export interface TopGamificResult {
  ok: boolean;
  error: string | null;
  userName: string;
  entries: TopGamificEntry[];
  totalEntries: number;
  totalCoins: number;
  totalPoints: number;
  missions: TopGamificMission[];
  unseenCount: number;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sameUser(apiName: string, profileName: string): boolean {
  const a = normalize(apiName);
  const b = normalize(profileName);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

async function fetchJson(path: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const getTopGamificOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopGamificResult> => {
    const empty: TopGamificResult = {
      ok: false,
      error: null,
      userName: "",
      entries: [],
      totalEntries: 0,
      totalCoins: 0,
      totalPoints: 0,
      missions: [],
      unseenCount: 0,
    };

    const apiKey = process.env["TOPGAMIFIC_API_KEY"];
    if (!apiKey) {
      return { ...empty, error: "Chave de integração não configurada." };
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();

    const userName = profile?.name?.trim() ?? "";
    if (!userName) {
      return { ...empty, error: "Seu perfil não possui nome cadastrado." };
    }

    const now = new Date();
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [entriesRaw, missionsRaw] = await Promise.all([
      fetchJson(`/entries?from=${iso(from)}&to=${iso(to)}`, apiKey),
      fetchJson(`/missions?status=active`, apiKey),
    ]);

    if (!entriesRaw && !missionsRaw) {
      return {
        ...empty,
        userName,
        error: "Não foi possível conectar à plataforma de gamificação.",
      };
    }

    const rawEntries: any[] = Array.isArray(entriesRaw?.entries)
      ? entriesRaw.entries
      : Array.isArray(entriesRaw)
        ? entriesRaw
        : [];

    const mine: TopGamificEntry[] = rawEntries
      .filter((e) => sameUser(String(e?.user?.name ?? ""), userName))
      .map((e) => ({
        id: String(e.id),
        date: String(e.date ?? ""),
        userName: String(e?.user?.name ?? ""),
        squad: e?.user?.squad ?? null,
        metricName: String(e?.metric?.name ?? "Lançamento"),
        metricType: e?.metric?.type ?? null,
        category: e?.metric?.category ?? null,
        coins: Number(e?.coins ?? 0),
        points: Number(e?.points ?? 0),
        notes: e?.notes ?? null,
        acknowledged: false,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    // Marca quais lançamentos o usuário já deu ciência.
    const { data: ackRows } = await context.supabase
      .from("topgamific_entry_acks")
      .select("entry_id")
      .eq("user_id", context.userId);
    let ackIds = new Set((ackRows ?? []).map((r: any) => String(r.entry_id)));

    // Primeira vez: considera tudo o que já existe como visto.
    if (ackIds.size === 0 && mine.length > 0) {
      await context.supabase
        .from("topgamific_entry_acks")
        .upsert(
          mine.map((e) => ({ user_id: context.userId, entry_id: e.id })),
          { onConflict: "user_id,entry_id", ignoreDuplicates: true },
        );
      ackIds = new Set(mine.map((e) => e.id));
    }

    for (const e of mine) e.acknowledged = ackIds.has(e.id);

    const rawMissions: any[] = Array.isArray(missionsRaw?.missions)
      ? missionsRaw.missions
      : Array.isArray(missionsRaw)
        ? missionsRaw
        : [];

    const mySquad = mine[0]?.squad ?? null;
    const missions: TopGamificMission[] = rawMissions
      .filter((m) => {
        const squad = m?.target_squad ?? null;
        if (!squad || !mySquad) return true;
        return normalize(String(squad)) === normalize(String(mySquad));
      })
      .map((m) => ({
        id: String(m.id),
        title: String(m.title ?? "Desafio"),
        description: m.description ?? null,
        category: m.category ?? null,
        type: m.type ?? null,
        status: m.status ?? null,
        target: m.target ?? null,
        reward: m.reward ?? null,
        targetSquad: m.target_squad ?? null,
        expiresAt: m.expires_at ?? null,
      }));

    return {
      ok: true,
      error: null,
      userName,
      entries: mine.slice(0, 3),
      totalEntries: mine.length,
      totalCoins: mine.reduce((sum, e) => sum + e.coins, 0),
      totalPoints: mine.reduce((sum, e) => sum + e.points, 0),
      missions,
    };
  });
