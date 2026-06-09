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
  const rows: BottleneckRow[] = Array.from(acc.values()).map((v) => ({
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

/* ============ 6. Atraso de Início (TMPR-like p/ tickets + chats) ============ */

export interface StartDelayRow {
  operatorId: string;
  operatorName: string;
  avgMs: number;
  p90Ms: number;
  itemsAnalyzed: number;
}

function p90(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[idx];
}

/**
 * Atraso de início por operador:
 * - Chats: created_at do chat → primeira msg from_me=true (não whisper) do operador.
 * - Tickets: created_at do ticket → closed_at é fim; aqui só sabemos quando o
 *   operador "começou" se ele está atribuído. Usamos updated_at se houver
 *   assigned_to; fallback para o tempo até closed_at se finalizado e não há
 *   sinal melhor. Para evitar ruído, só considera tickets com assigned_to.
 */
export function computeStartDelay(
  chats: ChatRow[],
  tickets: TicketRow[],
  messages: MessageRow[],
  ops: OperatorRow[]
): StartDelayRow[] {
  const opMap = buildOperatorMap(ops);
  const byChat = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const arr = byChat.get(m.chat_id) || [];
    arr.push(m);
    byChat.set(m.chat_id, arr);
  }
  const acc = new Map<string, number[]>();
  for (const chat of chats) {
    const msgs = (byChat.get(chat.id) || []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const firstOp = msgs.find((m) => m.from_me === true && !m.is_whisper && m.sent_by_user_id);
    if (!firstOp || !firstOp.sent_by_user_id) continue;
    const delta = new Date(firstOp.created_at).getTime() - new Date(chat.created_at).getTime();
    if (delta < 0) continue;
    const arr = acc.get(firstOp.sent_by_user_id) || [];
    arr.push(delta);
    acc.set(firstOp.sent_by_user_id, arr);
  }
  return Array.from(acc.entries())
    .map(([operatorId, vals]) => ({
      operatorId,
      operatorName: operatorName(opMap, operatorId),
      avgMs: vals.reduce((a, b) => a + b, 0) / vals.length,
      p90Ms: p90(vals),
      itemsAnalyzed: vals.length,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);
}

/* ============ 7. Silêncio em chamados ainda abertos (snapshot) ============ */

export interface OpenSilenceItem {
  id: string;
  kind: "chat" | "ticket";
  operatorId: string | null;
  operatorName: string;
  sector: string | null;
  silenceMs: number;
  createdAt: string;
}

export interface OpenSilenceSummary {
  totalOpen: number;
  silentCount: number;
  avgSilenceMs: number;
  p90SilenceMs: number;
  byOperator: Array<{
    operatorId: string | null;
    operatorName: string;
    silentCount: number;
    avgSilenceMs: number;
  }>;
  topSilent: OpenSilenceItem[];
}

export function computeOpenSilence(
  openChats: ChatRow[],
  openTickets: TicketRow[],
  ops: OperatorRow[],
  thresholdMs: number,
  now: number = Date.now()
): OpenSilenceSummary {
  const opMap = buildOperatorMap(ops);
  const items: OpenSilenceItem[] = [];
  for (const c of openChats) {
    const last = c.last_message_at ? new Date(c.last_message_at).getTime() : new Date(c.created_at).getTime();
    items.push({
      id: c.id,
      kind: "chat",
      operatorId: c.assigned_to,
      operatorName: operatorName(opMap, c.assigned_to),
      sector: c.sector_name,
      silenceMs: Math.max(0, now - last),
      createdAt: c.created_at,
    });
  }
  for (const t of openTickets) {
    const last = new Date(t.created_at).getTime();
    items.push({
      id: t.id,
      kind: "ticket",
      operatorId: t.assigned_to,
      operatorName: operatorName(opMap, t.assigned_to),
      sector: t.sector,
      silenceMs: Math.max(0, now - last),
      createdAt: t.created_at,
    });
  }
  const silent = items.filter((i) => i.silenceMs > thresholdMs);
  const byOpMap = new Map<string, { silentCount: number; sum: number; name: string; id: string | null }>();
  for (const it of silent) {
    const key = it.operatorId || "__none__";
    const cur = byOpMap.get(key) || { silentCount: 0, sum: 0, name: it.operatorName, id: it.operatorId };
    cur.silentCount += 1;
    cur.sum += it.silenceMs;
    byOpMap.set(key, cur);
  }
  return {
    totalOpen: items.length,
    silentCount: silent.length,
    avgSilenceMs: silent.length ? silent.reduce((s, i) => s + i.silenceMs, 0) / silent.length : 0,
    p90SilenceMs: p90(silent.map((i) => i.silenceMs)),
    byOperator: Array.from(byOpMap.values())
      .map((v) => ({
        operatorId: v.id,
        operatorName: v.name,
        silentCount: v.silentCount,
        avgSilenceMs: v.silentCount > 0 ? v.sum / v.silentCount : 0,
      }))
      .sort((a, b) => b.silentCount - a.silentCount),
    topSilent: silent.sort((a, b) => b.silenceMs - a.silenceMs).slice(0, 20),
  };
}

/* ============ 8. Padrão de finalização ============ */

export interface ClosingPatternResult {
  buckets: Array<{ hour: number; count: number }>;
  lastWindowPct: number; // % fechados nos últimos `windowMinutes` antes do close do dia
  totalClosed: number;
}

/**
 * `dayCloseByDow` mapeia dia da semana (0=Dom .. 6=Sáb) para minuto-do-dia do
 * fechamento do expediente (ex.: 18*60). Quando não informado, usa 18:00.
 */
export function computeClosingPattern(
  chats: ChatRow[],
  tickets: TicketRow[],
  dayCloseByDow: Record<number, number> | null = null,
  windowMinutes: number = 30
): ClosingPatternResult {
  const closes: Date[] = [];
  for (const c of chats) if (c.status === "finalizado" && c.last_message_at) closes.push(new Date(c.last_message_at));
  for (const t of tickets) if (t.status === "finalizado" && t.closed_at) closes.push(new Date(t.closed_at));

  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  let inWindow = 0;
  for (const d of closes) {
    buckets[d.getHours()].count += 1;
    const dow = d.getDay();
    const dayClose = dayCloseByDow?.[dow] ?? 18 * 60;
    const cur = d.getHours() * 60 + d.getMinutes();
    if (cur >= dayClose - windowMinutes && cur < dayClose) inWindow += 1;
  }
  return {
    buckets,
    lastWindowPct: closes.length ? inWindow / closes.length : 0,
    totalClosed: closes.length,
  };
}

/* ============ 9. Qualidade ============ */

export interface CsatRow {
  operator_user_id: string | null;
  score: number | null;
}

export interface QualityRow {
  operatorId: string;
  operatorName: string;
  resolved: number;
  reopened: number;
  reopenRate: number;
  csatAvg: number;
  csatCount: number;
}

export function computeQuality(
  source: DataSource,
  chats: ChatRow[],
  tickets: TicketRow[],
  csat: CsatRow[],
  ops: OperatorRow[]
): QualityRow[] {
  const opMap = buildOperatorMap(ops);
  const acc = new Map<string, { resolved: number; reopened: number; csatSum: number; csatCount: number }>();
  function ensure(id: string) {
    if (!acc.has(id)) acc.set(id, { resolved: 0, reopened: 0, csatSum: 0, csatCount: 0 });
    return acc.get(id)!;
  }
  if (source === "chat" || source === "ambos") {
    for (const c of chats) {
      if (!c.assigned_to) continue;
      const v = ensure(c.assigned_to);
      if (c.status === "finalizado") v.resolved += 1;
      if (c.status === "reaberto") v.reopened += 1;
    }
  }
  if (source === "atendimento" || source === "ambos") {
    for (const t of tickets) {
      if (!t.assigned_to) continue;
      const v = ensure(t.assigned_to);
      if (t.status === "finalizado") v.resolved += 1;
      if (t.status === "reaberto") v.reopened += 1;
    }
  }
  for (const r of csat) {
    if (!r.operator_user_id || r.score == null) continue;
    const v = ensure(r.operator_user_id);
    v.csatSum += r.score;
    v.csatCount += 1;
  }
  return Array.from(acc.entries())
    .map(([operatorId, v]) => ({
      operatorId,
      operatorName: operatorName(opMap, operatorId),
      resolved: v.resolved,
      reopened: v.reopened,
      reopenRate: v.resolved + v.reopened > 0 ? v.reopened / (v.resolved + v.reopened) : 0,
      csatAvg: v.csatCount > 0 ? v.csatSum / v.csatCount : 0,
      csatCount: v.csatCount,
    }))
    .sort((a, b) => b.resolved - a.resolved);
}

/* ============ 10. Diagnóstico de Equipe ============ */

export type OperatorLabel = "Alto desempenho" | "Sobrecarregado" | "Subutilizado" | "Atenção" | "Regular";

export interface TeamDiagnosticRow {
  operatorId: string;
  operatorName: string;
  resolved: number;
  startDelayMs: number;
  silentOpen: number;
  csatAvg: number;
  label: OperatorLabel;
}

export interface TeamDiagnosticSummary {
  operators: TeamDiagnosticRow[];
  totalResolved: number;
  top3Share: number; // 0..1
  top5Share: number;
  sectorThroughput: Array<{ sector: string; resolved: number; headcount: number; perHead: number }>;
}

export function computeTeamDiagnostic(
  productivity: ProductivityRow[],
  startDelays: StartDelayRow[],
  silence: OpenSilenceSummary,
  quality: QualityRow[],
  ops: OperatorRow[],
  sectorTotals: Map<string, number>,
  sectorHeadcount: Map<string, number>
): TeamDiagnosticSummary {
  const opMap = buildOperatorMap(ops);
  const prodMap = new Map(productivity.map((p) => [p.operatorId, p.resolved]));
  const delayMap = new Map(startDelays.map((p) => [p.operatorId, p.avgMs]));
  const silentMap = new Map(silence.byOperator.map((p) => [p.operatorId || "__none__", p.silentCount]));
  const csatMap = new Map(quality.map((p) => [p.operatorId, p.csatAvg]));

  const totalResolved = productivity.reduce((s, p) => s + p.resolved, 0);
  const sortedByResolved = productivity.slice().sort((a, b) => b.resolved - a.resolved);
  const top3 = sortedByResolved.slice(0, 3).reduce((s, p) => s + p.resolved, 0);
  const top5 = sortedByResolved.slice(0, 5).reduce((s, p) => s + p.resolved, 0);

  const medianResolved = median(productivity.map((p) => p.resolved));
  const medianDelay = median(startDelays.map((p) => p.avgMs));

  const ids = new Set<string>([
    ...productivity.map((p) => p.operatorId),
    ...startDelays.map((p) => p.operatorId),
    ...quality.map((q) => q.operatorId),
  ]);

  const operators: TeamDiagnosticRow[] = Array.from(ids).map((id) => {
    const resolved = prodMap.get(id) || 0;
    const startDelayMs = delayMap.get(id) || 0;
    const silentOpen = silentMap.get(id) || 0;
    const csatAvg = csatMap.get(id) || 0;

    let label: OperatorLabel = "Regular";
    const highVolume = resolved > medianResolved && medianResolved > 0;
    const lowVolume = resolved < medianResolved * 0.5;
    const fastStart = medianDelay > 0 && startDelayMs > 0 && startDelayMs < medianDelay;
    const slowStart = medianDelay > 0 && startDelayMs > medianDelay;

    if (highVolume && fastStart && (csatAvg === 0 || csatAvg >= 4)) label = "Alto desempenho";
    else if (resolved >= (sortedByResolved[2]?.resolved ?? 0) && silentOpen > 2) label = "Sobrecarregado";
    else if (lowVolume) label = "Subutilizado";
    else if (slowStart || silentOpen > 3) label = "Atenção";

    return {
      operatorId: id,
      operatorName: operatorName(opMap, id),
      resolved,
      startDelayMs,
      silentOpen,
      csatAvg,
      label,
    };
  }).sort((a, b) => b.resolved - a.resolved);

  const sectorThroughput = Array.from(sectorTotals.entries()).map(([sector, resolved]) => {
    const headcount = sectorHeadcount.get(sector) || 0;
    return {
      sector,
      resolved,
      headcount,
      perHead: headcount > 0 ? resolved / headcount : 0,
    };
  }).sort((a, b) => b.perHead - a.perHead);

  return {
    operators,
    totalResolved,
    top3Share: totalResolved > 0 ? top3 / totalResolved : 0,
    top5Share: totalResolved > 0 ? top5 / totalResolved : 0,
    sectorThroughput,
  };
}

