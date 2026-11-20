// Regras puras da Gamificação (testadas em gamif-rules.test.ts).

/** Liberada para todos na virada (20/11/2026); o Admin da gamificação segue só para admin e gestor. */
export const GAMIF_RELEASED = true;

export function canSeeGamification(roles: { isAdmin: boolean }, released = GAMIF_RELEASED): boolean {
  return released || roles.isAdmin;
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export interface LegacyUser { legacyId: string; email: string | null }
export interface HubUser { userId: string; email: string | null }
export interface EmailMatch {
  matched: { legacyId: string; userId: string }[];
  pending: string[];
  duplicated: string[];
}

/** Liga usuários do TOP aos do Gestão Online pelo e-mail; sem par único fica pendente. */
export function matchUsersByEmail(legacy: LegacyUser[], hub: HubUser[]): EmailMatch {
  const byEmail = new Map<string, string[]>();
  for (const h of hub) {
    const e = normalizeEmail(h.email);
    if (!e) continue;
    byEmail.set(e, [...(byEmail.get(e) ?? []), h.userId]);
  }
  const out: EmailMatch = { matched: [], pending: [], duplicated: [] };
  for (const l of legacy) {
    const ids = byEmail.get(normalizeEmail(l.email)) ?? [];
    if (ids.length === 1 && ids[0]) out.matched.push({ legacyId: l.legacyId, userId: ids[0] });
    else if (ids.length > 1) out.duplicated.push(l.legacyId);
    else out.pending.push(l.legacyId);
  }
  return out;
}

export function canAfford(balance: number, cost: number, stock: number | null): boolean {
  if (stock !== null && stock <= 0) return false;
  return cost >= 0 && balance >= cost;
}

/** Nível: a cada `xpPerLevel` XP (padrão 1000) sobe um nível, começando no 1. */
export function levelFromXp(xp: number, xpPerLevel = 1000): { level: number; progress: number } {
  const step = xpPerLevel > 0 ? Math.floor(xpPerLevel) : 1000;
  const safe = Math.max(0, Math.floor(xp));
  return { level: Math.floor(safe / step) + 1, progress: (safe % step) / step };
}

/** ISO weekday (1=seg … 7=dom), como o banco usa nas regras automáticas. */
export function ruleAppliesOn(weekdays: number[], date: Date): boolean {
  const d = date.getDay();
  return weekdays.includes(d === 0 ? 7 : d);
}

// ---------- Configurações ----------
export interface GamifSettings {
  coin_name: string;
  xp_per_level: number;
  season_name: string;
  season_start: string;
  season_end: string;
  max_duel_stake: number;
  notifications_enabled: boolean;
  notify_new_mission: boolean;
  notify_redemption_status: boolean;
}
export const DEFAULT_GAMIF_SETTINGS: GamifSettings = {
  coin_name: "AtentaCoins",
  xp_per_level: 1000,
  season_name: "",
  season_start: "",
  season_end: "",
  max_duel_stake: 500,
  notifications_enabled: true,
  notify_new_mission: true,
  notify_redemption_status: true,
};
/** Lê o JSON salvo, aplicando padrões e descartando valores inválidos. */
export function parseGamifSettings(raw: unknown): GamifSettings {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : def);
  const str = (v: unknown, def: string) => (typeof v === "string" ? v : def);
  const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : v === "false" ? false : v === "true" ? true : def);
  const D = DEFAULT_GAMIF_SETTINGS;
  return {
    coin_name: str(d["coin_name"], D.coin_name).trim() || D.coin_name,
    xp_per_level: num(d["xp_per_level"], D.xp_per_level),
    season_name: str(d["season_name"], D.season_name),
    season_start: str(d["season_start"], D.season_start),
    season_end: str(d["season_end"], D.season_end),
    max_duel_stake: num(d["max_duel_stake"], D.max_duel_stake),
    notifications_enabled: bool(d["notifications_enabled"], D.notifications_enabled),
    notify_new_mission: bool(d["notify_new_mission"], D.notify_new_mission),
    notify_redemption_status: bool(d["notify_redemption_status"], D.notify_redemption_status),
  };
}

// ---------- Sequência ----------
function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86400000);
}
/**
 * Sequência de dias seguidos com lançamento positivo. A atual conta até hoje,
 * ou até ontem se hoje ainda não teve lançamento.
 */
export function computeStreak(dates: string[], today: string): { current: number; best: number } {
  const days = Array.from(new Set(dates.filter(Boolean).map(dayNumber))).sort((a, b) => a - b);
  let best = 0, run = 0, prev: number | null = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const t = dayNumber(today);
  const set = new Set(days);
  let cursor = set.has(t) ? t : t - 1;
  let current = 0;
  while (set.has(cursor)) { current++; cursor--; }
  return { current, best };
}

// ---------- Duelos ----------
export type DuelClaim = "venci" | "perdi";
/** Mesmo critério do banco: acordo encerra o duelo; dois "venci" ou dois "perdi" viram disputa. */
export function duelOutcome(challenger: DuelClaim | null, opponent: DuelClaim | null): "aguardando" | "desafiante" | "desafiado" | "disputa" {
  if (!challenger || !opponent) return "aguardando";
  if (challenger === "venci" && opponent === "perdi") return "desafiante";
  if (challenger === "perdi" && opponent === "venci") return "desafiado";
  return "disputa";
}
/** Aposta válida: inteiro positivo, até o teto configurado e dentro do saldo do desafiante. */
export function validDuelStake(stake: number, balance: number, max: number): string | null {
  if (!Number.isInteger(stake) || stake <= 0) return "Informe uma aposta maior que zero";
  if (stake > max) return `A aposta máxima é ${max}`;
  if (stake > balance) return "Saldo insuficiente";
  return null;
}

// ---------- Processos ----------
/** Leitura confirmada vale só para a versão atual do processo. */
export function readingStatus(confirmedVersion: number | null | undefined, currentVersion: number): "lido" | "desatualizado" | "pendente" {
  if (confirmedVersion == null) return "pendente";
  return confirmedVersion >= currentVersion ? "lido" : "desatualizado";
}

// ---------- Relatórios ----------
export interface ReportEntry { key: string; coins: number; xp: number }
export interface ReportRow { key: string; coins: number; xp: number; count: number; earned: number; spent: number }
/** Agrupa lançamentos somando moedas/XP; "ganho" e "perdido" separam valores positivos e negativos. */
export function aggregateEntries(entries: ReportEntry[]): ReportRow[] {
  const map = new Map<string, ReportRow>();
  for (const e of entries) {
    const r = map.get(e.key) ?? { key: e.key, coins: 0, xp: 0, count: 0, earned: 0, spent: 0 };
    r.coins += e.coins; r.xp += e.xp; r.count += 1;
    if (e.coins >= 0) r.earned += e.coins; else r.spent += -e.coins;
    map.set(e.key, r);
  }
  return Array.from(map.values()).sort((a, b) => b.xp - a.xp || b.coins - a.coins);
}
