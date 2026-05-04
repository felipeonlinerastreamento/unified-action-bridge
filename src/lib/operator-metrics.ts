// Pure TS computations for the Operator Performance report.
// Receives already-fetched rows; returns plain data structures consumed by Recharts/tables.

export interface ChatRow {
  id: string;
  assigned_to: string | null;
  sector_name: string | null;
  status: string;
  created_at: string;
  last_message_at: string | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  from_me: boolean;
  is_whisper: boolean | null;
  sent_by_user_id: string | null;
  created_at: string;
}

export interface TicketRow {
  id: string;
  assigned_to: string | null;
  sector: string | null;
  category: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
}

export interface OperatorRow {
  id: string;
  name: string;
}

export type DataSource = "chat" | "atendimento" | "ambos";

const IDLE_THRESHOLD_MS_DEFAULT = 10 * 60 * 1000;

function operatorName(map: Map<string, string>, id: string | null): string {
  if (!id) return "Não atribuído";
  return map.get(id) || "Operador desconhecido";
}

export function buildOperatorMap(ops: OperatorRow[]): Map<string, string> {
  const m = new Map<string, string>();
  ops.forEach((o) => m.set(o.id, o.name));
  return m;
}

/* ============ 1. TMPR — Tempo Médio de Primeira Resposta ============ */

export interface TmprRow {
  operatorId: string;
  operatorName: string;
  avgMs: number;
  chatsAnalyzed: number;
}

export function computeFirstResponseTimes(
  chats: ChatRow[],
  messages: MessageRow[],
  ops: OperatorRow[]
): TmprRow[] {
  const opMap = buildOperatorMap(ops);
  const byChat = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const arr = byChat.get(m.chat_id) || [];
    arr.push(m);
    byChat.set(m.chat_id, arr);
  }
  const acc = new Map<string, { total: number; count: number }>();
  for (const chat of chats) {
    const msgs = (byChat.get(chat.id) || []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const firstClient = msgs.find((m) => m.from_me === false);
    if (!firstClient) continue;
    const firstOpResp = msgs.find(
      (m) =>
        m.from_me === true &&
        !m.is_whisper &&
        new Date(m.created_at).getTime() > new Date(firstClient.created_at).getTime()
    );
    if (!firstOpResp || !firstOpResp.sent_by_user_id) continue;
    const delta =
      new Date(firstOpResp.created_at).getTime() - new Date(firstClient.created_at).getTime();
    const key = firstOpResp.sent_by_user_id;
    const cur = acc.get(key) || { total: 0, count: 0 };
    cur.total += delta;
    cur.count += 1;
    acc.set(key, cur);
  }
  return Array.from(acc.entries())
    .map(([operatorId, v]) => ({
      operatorId,
      operatorName: operatorName(opMap, operatorId),
      avgMs: v.count > 0 ? v.total / v.count : 0,
      chatsAnalyzed: v.count,
    }))
    .sort((a, b) => a.avgMs - b.avgMs);
}

/* ============ 2. Ociosidade ============ */

export interface IdlenessRow {
  operatorId: string;
  operatorName: string;
  totalChats: number;
  idleChats: number;
  idleRate: number; // 0..1
  avgIdleMs: number;
}

export function computeIdleness(
  chats: ChatRow[],
  messages: MessageRow[],
  ops: OperatorRow[],
  thresholdMs: number = IDLE_THRESHOLD_MS_DEFAULT
): IdlenessRow[] {
  const opMap = buildOperatorMap(ops);
  const byChat = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const arr = byChat.get(m.chat_id) || [];
    arr.push(m);
    byChat.set(m.chat_id, arr);
  }
  const acc = new Map<
    string,
    { total: number; idle: number; idleSum: number; idleCount: number }
  >();
  // Initialize totals using chat assignment
  for (const chat of chats) {
    if (!chat.assigned_to) continue;
    const cur = acc.get(chat.assigned_to) || { total: 0, idle: 0, idleSum: 0, idleCount: 0 };
    cur.total += 1;
    acc.set(chat.assigned_to, cur);
    const msgs = (byChat.get(chat.id) || []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let hasIdle = false;
    for (let i = 0; i < msgs.length - 1; i++) {
      const m = msgs[i];
      const next = msgs[i + 1];
      if (m.from_me === false && next.from_me === true && !next.is_whisper) {
        const delta =
          new Date(next.created_at).getTime() - new Date(m.created_at).getTime();
        if (delta > thresholdMs) {
          hasIdle = true;
          cur.idleSum += delta;
          cur.idleCount += 1;
        }
      }
    }
    if (hasIdle) cur.idle += 1;
  }
  return Array.from(acc.entries())
    .map(([operatorId, v]) => ({
      operatorId,
      operatorName: operatorName(opMap, operatorId),
      totalChats: v.total,
      idleChats: v.idle,
      idleRate: v.total > 0 ? v.idle / v.total : 0,
      avgIdleMs: v.idleCount > 0 ? v.idleSum / v.idleCount : 0,
    }))
    .sort((a, b) => b.idleRate - a.idleRate);
}

/* ============ 3. Produtividade — Volume + TMA ============ */

export interface ProductivityRow {
  operatorId: string;
  operatorName: string;
  resolved: number;
  tmaMs: number;
}

export function computeProductivity(
  source: DataSource,
  chats: ChatRow[],
  tickets: TicketRow[],
  ops: OperatorRow[]
): ProductivityRow[] {
  const opMap = buildOperatorMap(ops);
  const acc = new Map<string, { count: number; sum: number }>();

  if (source === "chat" || source === "ambos") {
    for (const c of chats) {
      if (!c.assigned_to) continue;
      if (c.status !== "finalizado") continue;
      const start = new Date(c.created_at).getTime();
      const end = c.last_message_at ? new Date(c.last_message_at).getTime() : start;
      const cur = acc.get(c.assigned_to) || { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += Math.max(0, end - start);
      acc.set(c.assigned_to, cur);
    }
  }
  if (source === "atendimento" || source === "ambos") {
    for (const t of tickets) {
      if (!t.assigned_to) continue;
      if (t.status !== "finalizado" || !t.closed_at) continue;
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.closed_at).getTime();
      const cur = acc.get(t.assigned_to) || { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += Math.max(0, end - start);
      acc.set(t.assigned_to, cur);
    }
  }
  return Array.from(acc.entries())
    .map(([operatorId, v]) => ({
      operatorId,
      operatorName: operatorName(opMap, operatorId),
      resolved: v.count,
      tmaMs: v.count > 0 ? v.sum / v.count : 0,
    }))
    .sort((a, b) => b.resolved - a.resolved);
}

/* ============ 4. Gargalos por Setor / Categoria ============ */

export interface BottleneckRow {
  sector: string;
  category: string;
  total: number;
  open: number;
  finalized: number;
  tmaMs: number;
  isBottleneck?: boolean;
}

export function computeSectorBottlenecks(tickets: TicketRow[]): BottleneckRow[] {
  const acc = new Map<
    string,
    { sector: string; category: string; total: number; open: number; final: number; sum: number; finalCount: number }
  >();
  for (const t of tickets) {
    const sector = t.sector || "Sem setor";
    const category = t.category || "Sem categoria";
    const key = `${sector}::${category}`;
    const cur = acc.get(key) || { sector, category, total: 0, open: 0, final: 0, sum: 0, finalCount: 0 };
    cur.total += 1;
    if (t.status === "finalizado" && t.closed_at) {
      cur.final += 1;
      cur.finalCount += 1;
      cur.sum += Math.max(
        0,
        new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()
      );
    } else if (t.status !== "finalizado") {
      cur.open += 1;
    }
    acc.set(key, cur);
  }
  const rows = Array.from(acc.values()).map((v) => ({
    sector: v.sector,
    category: v.category,
    total: v.total,
    open: v.open,
    finalized: v.final,
    tmaMs: v.finalCount > 0 ? v.sum / v.finalCount : 0,
  }));
  // Mark bottleneck = max TMA
  if (rows.length) {
    const maxTma = Math.max(...rows.map((r) => r.tmaMs));
    rows.forEach((r) => {
      if (r.tmaMs === maxTma && maxTma > 0) r.isBottleneck = true;
    });
  }
  return rows.sort((a, b) => b.tmaMs - a.tmaMs);
}

/* ============ 5. Plano de Ação Individual ============ */

export interface ActionPlan {
  operatorId: string;
  operatorName: string;
  metrics: { idleRate: number; tmprMs: number; tmaMs: number };
  actions: string[];
}

export function suggestActions(
  idleness: IdlenessRow[],
  tmpr: TmprRow[],
  productivity: ProductivityRow[]
): ActionPlan[] {
  const tmprMap = new Map(tmpr.map((r) => [r.operatorId, r.avgMs]));
  const tmaMap = new Map(productivity.map((r) => [r.operatorId, r.tmaMs]));
  const top3 = idleness.filter((r) => r.totalChats > 0).slice(0, 3);
  const tmprMedian = median(tmpr.map((r) => r.avgMs));
  const tmaMedian = median(productivity.map((r) => r.tmaMs));

  return top3.map((r) => {
    const tmprMs = tmprMap.get(r.operatorId) || 0;
    const tmaMs = tmaMap.get(r.operatorId) || 0;
    const actions: string[] = [];
    if (tmprMs > tmprMedian && tmprMedian > 0) {
      actions.push("Habilitar notificações sonoras de novos chats para reduzir o tempo de primeira resposta.");
      actions.push("Revisar e usar respostas rápidas para acelerar a primeira interação com o cliente.");
    } else if (tmaMs > tmaMedian && tmaMedian > 0) {
      actions.push("Bloquear janela de foco de 30 min sem novas atribuições para encerrar conversas pendentes.");
      actions.push("Encerrar imediatamente conversas resolvidas, liberando capacidade da fila.");
    } else {
      actions.push("Limitar a fila simultânea durante o horário de pico para não acumular esperas.");
      actions.push("Transferir chats parados há mais de 10 min para um colega disponível.");
    }
    return {
      operatorId: r.operatorId,
      operatorName: r.operatorName,
      metrics: { idleRate: r.idleRate, tmprMs, tmaMs },
      actions: actions.slice(0, 2),
    };
  });
}

function median(arr: number[]): number {
  const v = arr.filter((n) => n > 0).slice().sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/* ============ Helpers de formatação ============ */

export function formatDuration(ms: number): string {
  if (!ms || !isFinite(ms)) return "—";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
