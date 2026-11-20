// Regras puras da Gamificação (testadas em gamif-rules.test.ts).

/** Enquanto false, o menu e as telas da Gamificação ficam só para admins. */
export const GAMIF_RELEASED = false;

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

/** Liga usuários do TOP aos do GS Hub pelo e-mail; sem par único fica pendente. */
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

/** Nível: a cada 1000 XP sobe um nível, começando no 1. */
export function levelFromXp(xp: number): { level: number; progress: number } {
  const safe = Math.max(0, Math.floor(xp));
  return { level: Math.floor(safe / 1000) + 1, progress: (safe % 1000) / 1000 };
}

/** ISO weekday (1=seg … 7=dom), como o banco usa nas regras automáticas. */
export function ruleAppliesOn(weekdays: number[], date: Date): boolean {
  const d = date.getDay();
  return weekdays.includes(d === 0 ? 7 : d);
}
