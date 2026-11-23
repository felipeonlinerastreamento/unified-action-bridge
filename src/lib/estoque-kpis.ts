export type EquipRaw = {
  Codigo?: number | string | null;
  Status?: string | null;
  Chip?: string | null;
  Tecnico?: unknown;
  Modelo?: string | null;
};

export function hasChip(r: EquipRaw): boolean {
  return !!(r.Chip && String(r.Chip).trim());
}
export function hasTecnico(r: EquipRaw): boolean {
  const t = r.Tecnico;
  if (t == null) return false;
  if (typeof t === "string") return t.trim().length > 0;
  return true;
}
export function normStatus(s?: string | null): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
/** Pronto p/ instalação: status Disponível e com chip vinculado. */
export function isReady(r: EquipRaw): boolean {
  return normStatus(r.Status) === "disponivel" && hasChip(r);
}
/** Aguardando chip: status Sem_Chip, ou Disponível sem chip. */
export function isAwaitingChip(r: EquipRaw): boolean {
  const s = normStatus(r.Status);
  return s === "sem_chip" || (s === "disponivel" && !hasChip(r));
}
export function isLinked(r: EquipRaw): boolean {
  return normStatus(r.Status) === "vinculado";
}

export function computeKpis(items: EquipRaw[]) {
  let ready = 0, awaiting = 0, tecnico = 0, linked = 0;
  for (const r of items) {
    if (isReady(r)) ready++;
    if (isAwaitingChip(r)) awaiting++;
    if (hasTecnico(r)) tecnico++;
    if (isLinked(r)) linked++;
  }
  return { ready, awaiting, tecnico, linked };
}

export function summaryByModel(items: EquipRaw[]) {
  const map = new Map<string, { modelo: string; ready: number; awaiting: number }>();
  for (const r of items) {
    const ready = isReady(r), awaiting = isAwaitingChip(r);
    if (!ready && !awaiting) continue;
    const m = (r.Modelo || "Sem modelo").trim();
    const e = map.get(m) ?? { modelo: m, ready: 0, awaiting: 0 };
    if (ready) e.ready++; else e.awaiting++;
    map.set(m, e);
  }
  return [...map.values()].sort((a, b) => b.ready + b.awaiting - (a.ready + a.awaiting));
}

export function normalizePlate(p: string): string {
  return String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Situação de um equipamento ou chip nas abas Equipamentos e Chips (filtro "Disponíveis").
 * O GSystem usa vários nomes: "Disponível", "Sem_Chip" (equipamento sem chip), "Sem_Equipamento"
 * (chip solto), "Estoque", "Desvinculado"... Todos esses estão disponíveis para formar o par.
 * Só é "vinculado" o que está em uso num veículo; inativo/cancelado/bloqueado fica à parte.
 */
export function classificarStatusEstoque(raw: unknown): "disponivel" | "vinculado" | "inativo" | "outro" {
  const s = normStatus(String(raw ?? "")).replace(/[_-]+/g, " ");
  if (!s) return "outro";
  if (/inativ|cancel|bloque|suspens|baixad|descart|defeit/.test(s)) return "inativo";
  if (/dispon|sem chip|sem equip|sem vinculo|estoque|livre|desvincul|nao vinculad|aguardando/.test(s)) return "disponivel";
  if (/vincul|em uso|instalad/.test(s)) return "vinculado";
  if (/^ativ/.test(s)) return "disponivel"; // chip/equipamento "Ativo/Ativado" sem par: o par em uso já sai pelo espelho
  return "outro";
}
