// Regras puras da importação do TOP Gamific para a Gamificação do Gestão Online (testadas em gamif-import.test.ts).
import { normalizeEmail } from "./gamif-rules";

type Row = Record<string, any>;

export interface TopExport { exported_at: string; counts: Record<string, number>; data: Record<string, Row[]> }
export interface DirUser { user_id: string; email: string | null; name: string; is_active: boolean }
export interface DirSector { id: string; name: string }
export interface DirLink { legacy_id: string; user_id: string | null; status: string }
export interface DirExclusion { legacy_id: string; name: string | null; email: string | null }
export interface Directory { users: DirUser[]; sectors: DirSector[]; links: DirLink[]; exclusions?: DirExclusion[] }

/** Tira do export tudo que pertence a pessoas da lista de exclusão; tarefas ficam, sem vínculo com elas. */
export function applyExclusions(exp: TopExport, excludedIds: Iterable<string>): { exp: TopExport; removed: Record<string, number> } {
  const ex = new Set([...excludedIds].map(String));
  const removed: Record<string, number> = {};
  if (ex.size === 0) return { exp, removed };
  const isEx = (v: unknown) => v !== null && v !== undefined && ex.has(String(v));
  // tabelas em que a linha é da pessoa: sai inteira
  const owner: Record<string, string[]> = {
    profiles: ["user_id"], user_roles: ["user_id"], user_performance_entries: ["user_id"], user_missions: ["user_id"], redemptions: ["user_id"],
    pvp_challenges: ["challenger_id", "challenged_id"], suggestions: ["user_id"], suggestion_votes: ["user_id"], user_streaks: ["user_id"],
    user_notifications: ["user_id"], reading_confirmations: ["user_id"], task_comments: ["user_id"], task_participants: ["user_id"],
  };
  // tabelas em que a pessoa só aparece como referência: a linha fica, sem o vínculo
  const refs: Record<string, string[]> = {
    tasks: ["created_by", "assigned_to"], notifications: ["created_by"], user_performance_entries: ["applied_by"], redemptions: ["reviewed_by"],
    pvp_challenges: ["winner_id"], process_changelog: ["user_id"], role_functions: ["created_by"], missions: ["created_by"],
  };
  const data: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(exp.data)) {
    const own = owner[t] ?? [];
    const kept = rows.filter((r) => !own.some((c) => isEx(r[c])));
    if (kept.length !== rows.length) removed[t] = rows.length - kept.length;
    const rc = refs[t] ?? [];
    data[t] = rc.length ? kept.map((r) => (rc.some((c) => isEx(r[c])) ? { ...r, ...Object.fromEntries(rc.filter((c) => isEx(r[c])).map((c) => [c, null])) } : r)) : kept;
  }
  return { exp: { ...exp, data }, removed };
}

/** Squads do TOP com nome diferente no Gestão Online (nome normalizado → setor do Gestão Online). */
export const SECTOR_ALIASES: Record<string, string> = { adm: "administrativo" };

export const TOP_TABLES = [
  "profiles", "user_roles", "sectors", "squads", "metric_categories", "performance_metrics", "user_performance_entries",
  "auto_metric_rules", "missions", "user_missions", "reward_items", "redemptions", "pvp_challenges", "suggestions",
  "suggestion_votes", "user_streaks", "notifications", "user_notifications", "process_changelog", "reading_confirmations",
  "role_functions", "platform_settings", "tasks", "task_comments", "task_participants", "kanban_columns",
] as const;

/** Tabela do TOP → lista enviada ao Gestão Online. */
export const TABLE_TARGET: Record<string, string> = {
  profiles: "legacy_users", metric_categories: "metric_categories", performance_metrics: "metrics",
  user_performance_entries: "entries", auto_metric_rules: "auto_rules", missions: "missions", user_missions: "user_missions",
  reward_items: "store_items", redemptions: "redemptions", pvp_challenges: "pvp_challenges", suggestions: "suggestions",
  suggestion_votes: "suggestion_votes", user_streaks: "streaks", notifications: "notifications", user_notifications: "user_notifications",
  process_changelog: "process_changelog", reading_confirmations: "reading_confirmations", role_functions: "processes",
  tasks: "tasks", task_comments: "task_comments", task_participants: "task_participants",
};

export const NOT_IMPORTED: Record<string, string> = {
  user_roles: "Não importado: valem os papéis do Gestão Online.",
  sectors: "Não importado: usado só para ligar pelo nome aos setores do Gestão Online.",
  squads: "Não importado: cada squad é o setor do Gestão Online com o mesmo nome.",
  kanban_columns: "Não importado: as Tarefas do Gestão Online já têm Pendente, Em andamento e Concluída.",
  platform_settings: "Guardado nas Configurações da Gamificação (só preenche o que ainda não foi definido).",
};

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export type LinkStatus = "ligado" | "pendente" | "duplicado";
export interface UserMapping { legacyId: string; name: string; email: string | null; userId: string | null; status: LinkStatus; reason: string }

/** Liga perfis do TOP a usuários do Gestão Online: ligação manual vale primeiro, depois e-mail único; repetidos ficam como duplicados. */
export function mapTopUsers(profiles: Row[], users: DirUser[], links: DirLink[]): UserMapping[] {
  const sorted = [...profiles].sort((a, b) => String(a["created_at"] ?? "").localeCompare(String(b["created_at"] ?? "")));
  const byEmail = new Map<string, string[]>();
  for (const u of users) {
    const e = normalizeEmail(u.email);
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), u.user_id]);
  }
  const manual = new Map(links.filter((l) => l.status === "ligado" && l.user_id).map((l) => [l.legacy_id, l.user_id as string]));
  const taken = new Set<string>(manual.values());
  const seenEmails = new Set<string>();
  return sorted.map((p): UserMapping => {
    const legacyId = String(p["user_id"]);
    const base = { legacyId, name: String(p["name"] ?? ""), email: (p["email"] as string | null) ?? null };
    const m = manual.get(legacyId);
    if (m) return { ...base, userId: m, status: "ligado", reason: "Ligado manualmente" };
    const e = normalizeEmail(base.email);
    if (!e) return { ...base, userId: null, status: "pendente", reason: "Sem e-mail no TOP" };
    if (seenEmails.has(e)) return { ...base, userId: null, status: "duplicado", reason: "E-mail repetido no TOP" };
    seenEmails.add(e);
    const ids = byEmail.get(e) ?? [];
    if (ids.length === 0) return { ...base, userId: null, status: "pendente", reason: "E-mail não encontrado no Gestão Online" };
    if (ids.length > 1) return { ...base, userId: null, status: "duplicado", reason: "E-mail com mais de um usuário no Gestão Online" };
    const id = ids[0] as string;
    if (taken.has(id)) return { ...base, userId: null, status: "duplicado", reason: "Usuário do Gestão Online já ligado a outro perfil do TOP" };
    taken.add(id);
    return { ...base, userId: id, status: "ligado", reason: "Mesmo e-mail" };
  });
}

/** Valor de uma métrica no Gestão Online: negativas guardam moedas/XP com sinal negativo. */
export function metricValues(m: Row | undefined): { coins: number; xp: number } {
  if (!m) return { coins: 0, xp: 0 };
  const pts = Number(m["points"] ?? 0);
  if (m["type"] === "negative") return { coins: -Math.abs(Number(m["coins_penalty"] ?? 0)) || 0, xp: -Math.abs(pts) || 0 };
  return { coins: Number(m["coins_reward"] ?? 0), xp: pts };
}

/** Lançamento: usa o valor gravado no TOP; sem valor gravado, usa o da métrica. */
export function entryValues(e: Row, m: Row | undefined): { coins: number; xp: number } {
  const mv = metricValues(m);
  return {
    coins: e["coins_delta"] === null || e["coins_delta"] === undefined ? mv.coins : Number(e["coins_delta"]),
    xp: e["points_delta"] === null || e["points_delta"] === undefined ? mv.xp : Number(e["points_delta"]),
  };
}

/** Diferença que fecha o saldo do Gestão Online igual ao do TOP. */
export function balanceAdjustment(topBalance: number, historySum: number): number {
  return Math.round(topBalance) - Math.round(historySum);
}

const pick = (map: Record<string, string>, v: unknown, fallback: string) => map[String(v ?? "")] ?? fallback;
export const missionStatus = (s: unknown) => pick({ active: "ativa", completed: "encerrada", inactive: "encerrada", expired: "encerrada" }, s, "encerrada");
export const userMissionStatus = (approval: unknown, completed: unknown) =>
  approval === "approved" || (completed === true && approval == null) ? "concluida" : pick({ pending: "em_analise", rejected: "recusada" }, approval, "em_andamento");
export const redemptionStatus = (s: unknown) => pick({ pending: "pendente", approved: "aprovado", rejected: "recusado", delivered: "entregue" }, s, "pendente");
export const duelStatus = (s: unknown) => pick({ pending: "pendente", active: "ativo", disputed: "disputa", completed: "concluido", rejected: "recusado", cancelled: "cancelado", canceled: "cancelado" }, s, "pendente");
export const suggestionStatus = (s: unknown) => pick({ pending: "nova", new: "nova", under_review: "em_analise", in_review: "em_analise", approved: "aprovada", implemented: "aprovada", rejected: "recusada" }, s, "nova");

/** Data do lançamento no fuso de São Paulo. */
export function brDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Id estável (formato uuid) a partir de um texto, para o ajuste de saldo não duplicar ao repetir. */
export function stableUuid(text: string): string {
  const h = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  };
  const hex = (h(1) + h(2)).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export interface Skip { count: number; reason: string }
export interface Prepared {
  payload: Record<string, unknown>;
  mapping: UserMapping[];
  skipped: Record<string, Skip>;
  /** linhas do TOP deixadas de fora por serem de pessoas excluídas, por tabela */
  excluded: Record<string, number>;
  excludedPeople: { legacyId: string; name: string; email: string | null }[];
  unmatchedSquads: string[];
  tasksCreatorFallback: number;
  history: Record<string, { coins: number; xp: number; adjCoins: number; adjXp: number }>;
}

export function prepareTopImport(fullExp: TopExport, dir: Directory, importerId: string, aliases: Record<string, string> = SECTOR_ALIASES): Prepared {
  const { exp, removed } = applyExclusions(fullExp, (dir.exclusions ?? []).map((x) => x.legacy_id));
  const d = (t: string): Row[] => exp.data[t] ?? [];
  const mapping = mapTopUsers(d("profiles"), dir.users, dir.links);
  const uid = new Map(mapping.map((m) => [m.legacyId, m.userId]));
  const u = (id: unknown): string | null => (id ? uid.get(String(id)) ?? null : null);
  const skipped: Record<string, Skip> = {};
  const skip = (t: string, reason: string) => { skipped[t] = { count: (skipped[t]?.count ?? 0) + 1, reason }; };
  const excluded: Record<string, number> = removed;

  const sectorByName = new Map(dir.sectors.map((s) => [normalizeName(s.name), s.id]));
  const unmatched = new Set<string>();
  const sector = (name: unknown): string | null => {
    const n = normalizeName(name as string);
    if (!n) return null;
    const id = sectorByName.get(n) ?? sectorByName.get(aliases[n] ?? "");
    if (!id) unmatched.add(String(name));
    return id ?? null;
  };
  for (const p of d("profiles")) sector(p["squad"]);
  const topSectorName = new Map(d("sectors").map((s) => [String(s["id"]), String(s["name"])]));

  const categories = d("metric_categories");
  const catByName = new Map(categories.map((c) => [normalizeName(c["name"]), c["id"]]));
  const metrics = new Map(d("performance_metrics").map((m) => [String(m["id"]), m]));
  const items = new Map(d("reward_items").map((i) => [String(i["id"]), i]));
  const notifs = new Map(d("notifications").map((n) => [String(n["id"]), n]));

  const history: Prepared["history"] = {};
  const entries = d("user_performance_entries").map((e) => {
    const m = metrics.get(String(e["metric_id"]));
    const v = entryValues(e, m);
    const lid = String(e["user_id"]);
    const h = (history[lid] ??= { coins: 0, xp: 0, adjCoins: 0, adjXp: 0 });
    h.coins += v.coins; h.xp += v.xp;
    return {
      id: e["id"], user_id: u(lid), legacy_user_id: lid, metric_id: m ? e["metric_id"] : null, metric_name: m?.["name"]?.trim() ?? "Métrica do TOP",
      entry_date: brDate(e["created_at"]), coins: v.coins, xp: v.xp, notes: e["notes"] ?? null, source: "top", acknowledged: true,
      created_by: u(e["applied_by"]), created_at: e["created_at"],
    };
  });

  const adjustments: Row[] = [];
  const deleteIds: string[] = [];
  const today = brDate(exp.exported_at);
  for (const p of d("profiles")) {
    const lid = String(p["user_id"]);
    const h = (history[lid] ??= { coins: 0, xp: 0, adjCoins: 0, adjXp: 0 });
    h.adjCoins = balanceAdjustment(Number(p["coins"] ?? 0), h.coins);
    h.adjXp = balanceAdjustment(Number(p["total_points"] ?? 0), h.xp);
    const id = stableUuid(`top-adjust:${lid}`);
    if (h.adjCoins === 0 && h.adjXp === 0) { deleteIds.push(id); continue; }
    adjustments.push({
      id, user_id: u(lid), legacy_user_id: lid, metric_id: null, metric_name: "Ajuste de saldo da migração (TOP)", entry_date: today,
      coins: h.adjCoins, xp: h.adjXp, notes: "Diferença entre o saldo do TOP e a soma dos lançamentos (missões, resgates, bônus e limites do TOP).",
      source: "migracao", acknowledged: true, created_by: importerId, created_at: exp.exported_at,
    });
  }

  const legacy_users = mapping.map((m) => {
    const p = d("profiles").find((x) => String(x["user_id"]) === m.legacyId) ?? {};
    const roles = d("user_roles").filter((r) => String(r["user_id"]) === m.legacyId).map((r) => r["role"]);
    return {
      legacy_id: m.legacyId, email: m.email, name: m.name, user_id: m.userId, status: m.status,
      coins: Number(p["coins"] ?? 0), xp: Number(p["total_points"] ?? 0), raw: { ...p, roles, link_reason: m.reason }, created_at: p["created_at"],
    };
  });

  const processes = d("role_functions").map((r) => {
    const changes = d("process_changelog").filter((c) => String(c["target_id"]) === String(r["id"]));
    return {
      id: r["id"], title: r["title"], content: [r["description"], r["content"]].filter(Boolean).join("\n\n"),
      sector_id: r["sector_id"] ? sector(topSectorName.get(String(r["sector_id"]))) : null, version: Math.max(1, changes.length),
      created_by: u(r["created_by"]), created_at: r["created_at"], updated_at: r["updated_at"] ?? r["created_at"],
    };
  });
  const procVersion = new Map(processes.map((p) => [String(p.id), p.version]));
  const changelog: Row[] = [];
  const byProc = new Map<string, number>();
  for (const c of [...d("process_changelog")].sort((a, b) => String(a["created_at"]).localeCompare(String(b["created_at"])))) {
    const pid = String(c["target_id"]);
    if (!procVersion.has(pid)) { skip("process_changelog", "Mudança de algo que não é processo"); continue; }
    const v = (byProc.get(pid) ?? 0) + 1; byProc.set(pid, v);
    changelog.push({ id: c["id"], process_id: pid, version: v, summary: c["details"] ?? c["action"], changed_by: u(c["user_id"]), created_at: c["created_at"] });
  }
  const readings: Row[] = [];
  for (const r of d("reading_confirmations")) {
    const pid = String(r["target_id"]);
    if (!procVersion.has(pid)) { skip("reading_confirmations", "Leitura de algo que não é processo"); continue; }
    if (!u(r["user_id"])) { skip("reading_confirmations", "Pessoa pendente de ligação (entra ao repetir após ligar)"); continue; }
    readings.push({ id: r["id"], process_id: pid, user_id: u(r["user_id"]), version: procVersion.get(pid), confirmed_at: r["confirmed_at"] });
  }

  const votes: Row[] = [];
  for (const v of d("suggestion_votes")) {
    if (v["vote_type"] && v["vote_type"] !== "up") { skip("suggestion_votes", "Voto contra (o Gestão Online só conta apoios)"); continue; }
    if (!u(v["user_id"])) { skip("suggestion_votes", "Pessoa pendente de ligação (entra ao repetir após ligar)"); continue; }
    votes.push({ suggestion_id: v["suggestion_id"], user_id: u(v["user_id"]), created_at: v["created_at"] });
  }
  const streaks: Row[] = [];
  for (const s of d("user_streaks")) {
    if (!u(s["user_id"])) { skip("user_streaks", "Pessoa pendente de ligação (entra ao repetir após ligar)"); continue; }
    streaks.push({ user_id: u(s["user_id"]), current_streak: s["current_streak"] ?? 0, best_streak: s["longest_streak"] ?? 0, last_date: s["last_active_date"] ?? null });
  }

  let tasksCreatorFallback = 0;
  const tasks = [...d("tasks")].sort((a, b) => Number(!!a["parent_task_id"]) - Number(!!b["parent_task_id"])).map((t) => {
    let createdBy = u(t["created_by"]);
    if (!createdBy) { createdBy = importerId; tasksCreatorFallback++; }
    return {
      id: t["id"], title: t["title"], description: t["description"] ?? "", status: t["status"] ?? "pending", priority: t["priority"] ?? "medium",
      due_date: t["due_date"], created_by: createdBy, assigned_to: u(t["assigned_to"]), is_group_task: !!t["is_group_task"],
      recurrence_type: t["recurrence_type"], recurrence_interval: t["recurrence_interval"], recurrence_end_date: t["recurrence_end_date"],
      parent_task_id: t["parent_task_id"], completed_at: t["completed_at"], reminder_at: t["reminder_at"], created_at: t["created_at"], updated_at: t["updated_at"],
    };
  });
  const taskIds = new Set(tasks.map((t) => String(t.id)));
  const participants: Row[] = [];
  for (const p of d("task_participants")) {
    if (!taskIds.has(String(p["task_id"]))) { skip("task_participants", "Tarefa não encontrada"); continue; }
    if (!u(p["user_id"])) { skip("task_participants", "Pessoa pendente de ligação (entra ao repetir após ligar)"); continue; }
    participants.push({ id: p["id"], task_id: p["task_id"], user_id: u(p["user_id"]), created_at: p["created_at"] });
  }
  const comments: Row[] = [];
  for (const c of d("task_comments")) {
    if (!taskIds.has(String(c["task_id"]))) { skip("task_comments", "Tarefa não encontrada"); continue; }
    if (!u(c["user_id"])) { skip("task_comments", "Pessoa pendente de ligação (entra ao repetir após ligar)"); continue; }
    comments.push({ id: c["id"], task_id: c["task_id"], user_id: u(c["user_id"]), content: c["content"], created_at: c["created_at"] });
  }

  const st = Object.fromEntries(d("platform_settings").map((s) => [String(s["key"]), s["value"]]));
  const settings: Row = { top_settings: st };
  const setIf = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") settings[k] = v; };
  setIf("season_name", st["season_name"]);
  setIf("season_start", st["season_start_date"]);
  setIf("season_end", st["season_end_date"]);
  if (st["notifications_enabled"] !== undefined) settings["notifications_enabled"] = String(st["notifications_enabled"]) !== "false";
  if (st["notification_new_mission"] !== undefined) settings["notify_new_mission"] = String(st["notification_new_mission"]) !== "false";
  if (st["notification_redemption_status"] !== undefined) settings["notify_redemption_status"] = String(st["notification_redemption_status"]) !== "false";

  const payload = {
    legacy_users,
    metric_categories: categories.map((c, i) => ({ id: c["id"], name: c["name"], position: i, created_at: c["created_at"] })),
    metrics: [...metrics.values()].map((m) => {
      const v = metricValues(m);
      return { id: m["id"], category_id: catByName.get(normalizeName(m["category"])) ?? null, name: String(m["name"]).trim(), description: m["description"] ?? null,
        metric_type: m["type"] === "negative" ? "negativo" : "positivo", coins: v.coins, xp: v.xp, is_active: m["active"] !== false, created_at: m["created_at"] };
    }),
    auto_rules: d("auto_metric_rules").map((r) => ({ id: r["id"], sector_id: sector(r["sector"]), metric_id: r["metric_id"], weekdays: [1, 2, 3, 4, 5], created_at: r["created_at"] })),
    entries,
    adjustments,
    delete_entry_ids: deleteIds,
    missions: d("missions").map((m) => ({
      id: m["id"], title: m["title"], description: m["description"], category: m["category"], mission_type: m["type"], target: m["target"],
      reward_coins: Number(m["reward"] ?? 0), reward_xp: 0, target_sector_id: sector(m["target_squad"]), status: missionStatus(m["status"]),
      expires_at: m["expires_at"], created_at: m["created_at"],
    })),
    user_missions: d("user_missions").map((um) => ({
      id: um["id"], mission_id: um["mission_id"], user_id: u(um["user_id"]), legacy_user_id: String(um["user_id"]), progress: um["progress"] ?? 0,
      status: userMissionStatus(um["approval_status"], um["completed"]), completed_at: um["completed_at"],
      created_at: d("missions").find((m) => m["id"] === um["mission_id"])?.["created_at"],
    })),
    store_items: [...items.values()].map((i) => ({ id: i["id"], name: String(i["name"]).trim(), description: i["description"], image_url: null, cost_coins: Number(i["cost"] ?? 0), stock: i["stock"] ?? null, is_active: true, created_at: i["created_at"] })),
    redemptions: d("redemptions").map((r) => {
      const it = items.get(String(r["reward_item_id"]));
      return { id: r["id"], item_id: it ? r["reward_item_id"] : null, item_name: it ? String(it["name"]).trim() : "Item do TOP", user_id: u(r["user_id"]), legacy_user_id: String(r["user_id"]),
        cost_coins: Number(it?.["cost"] ?? 0), status: redemptionStatus(r["status"]), decided_by: u(r["reviewed_by"]), decided_at: r["reviewed_at"], created_at: r["created_at"] };
    }),
    pvp_challenges: d("pvp_challenges").map((p) => ({
      id: p["id"], challenger_id: u(p["challenger_id"]), opponent_id: u(p["challenged_id"]), metric_id: metrics.has(String(p["metric_id"])) ? p["metric_id"] : null,
      title: p["title"], description: p["description"], stake_coins: Number(p["reward"] ?? 0), status: duelStatus(p["status"]), winner_id: u(p["winner_id"]),
      starts_at: p["starts_at"], ends_at: p["ends_at"], created_at: p["created_at"], resolved_at: p["resolved_at"],
      challenger_vote: p["challenger_vote"], opponent_vote: p["challenged_vote"], challenger_note: p["challenger_observation"], opponent_note: p["challenged_observation"],
    })),
    suggestions: d("suggestions").map((s) => ({ id: s["id"], user_id: u(s["user_id"]), legacy_user_id: String(s["user_id"]), title: s["title"], description: s["description"], status: suggestionStatus(s["status"]), admin_response: s["admin_notes"], created_at: s["created_at"] })),
    suggestion_votes: votes,
    streaks,
    notifications: d("notifications").map((n) => ({ id: n["id"], title: n["title"], body: n["message"], target_sector_id: n["target_type"] === "squad" ? sector(n["target_squad"]) : null, scheduled_at: n["scheduled_at"], sent_at: n["sent_at"] ?? n["created_at"], created_by: u(n["created_by"]), created_at: n["created_at"] })),
    user_notifications: d("user_notifications").map((un) => {
      const n = notifs.get(String(un["notification_id"]));
      return { id: un["id"], notification_id: n ? un["notification_id"] : null, user_id: u(un["user_id"]), legacy_user_id: String(un["user_id"]), title: n?.["title"] ?? null, body: n?.["message"] ?? null,
        read_at: un["read"] ? un["read_at"] ?? un["created_at"] : null, created_at: un["created_at"] };
    }),
    processes,
    process_changelog: changelog,
    reading_confirmations: readings,
    settings,
    tasks,
    task_people: d("tasks").map((t) => ({ id: t["id"], created_by: u(t["created_by"]), assigned_to: u(t["assigned_to"]) })),
    task_participants: participants,
    task_comments: comments,
  };
  const excludedPeople = (dir.exclusions ?? []).map((x) => ({ legacyId: String(x.legacy_id), name: x.name ?? "", email: x.email ?? null }));
  return { payload, mapping, skipped, excluded, excludedPeople, unmatchedSquads: [...unmatched].sort(), tasksCreatorFallback, history };
}

export interface ApplyResult {
  present: Record<string, number>;
  balances: { legacy_id: string; user_id: string | null; status: string; gs_name: string | null; wallet_coins: number | null; wallet_xp: number | null; top_part_coins: number; top_part_xp: number }[];
}

export interface ImportReport {
  exported_at: string;
  ran_at: string;
  users: { linked: UserMapping[]; pending: UserMapping[]; duplicates: UserMapping[]; excluded?: { legacyId: string; name: string; email: string | null }[] };
  tables: { table: string; top: number; gs: number | null; note: string; excluded?: number }[];
  balances: { name: string; email: string | null; status: string; gsName: string | null; topCoins: number; gsCoins: number; topXp: number; gsXp: number; historyCoins: number; adjustmentCoins: number; ok: boolean }[];
  unmatchedSquads: string[];
  tasksCreatorFallback: number;
}

/** Relatório: pessoas, contagem por tabela e saldo TOP x Gestão Online. Pendentes mostram o saldo guardado até a ligação. */
export function buildImportReport(exp: TopExport, prep: Prepared, applied: ApplyResult, ranAt = new Date().toISOString()): ImportReport {
  const bal = new Map(applied.balances.map((b) => [b.legacy_id, b]));
  const profiles = new Map((exp.data["profiles"] ?? []).map((p) => [String(p["user_id"]), p]));
  const status = (s: LinkStatus) => prep.mapping.filter((m) => {
    const now = bal.get(m.legacyId)?.status ?? m.status;
    return now === s;
  });
  const tables = TOP_TABLES.map((t) => {
    const top = exp.counts[t] ?? exp.data[t]?.length ?? 0;
    const target = TABLE_TARGET[t];
    const sk = prep.skipped[t];
    if (t === "platform_settings") return { table: t, top, gs: Object.keys((prep.payload["settings"] as Row)["top_settings"] ?? {}).length, note: NOT_IMPORTED[t] ?? "" };
    if (!target) return { table: t, top, gs: null, note: NOT_IMPORTED[t] ?? "" };
    const exn = prep.excluded[t] ?? 0;
    let note = sk ? `${sk.count} não trazido(s): ${sk.reason}` : "";
    if (exn) note = `${note ? note + " · " : ""}${exn} de pessoa(s) excluída(s) da gamificação`;
    if (t === "user_performance_entries") note = `${note ? note + " · " : ""}+${applied.present["adjustments"] ?? 0} ajuste(s) de saldo da migração`;
    if (t === "tasks" && prep.tasksCreatorFallback) note = `${note ? note + " · " : ""}${prep.tasksCreatorFallback} com criador pendente, registradas em nome de quem importou`;
    if (t === "auto_metric_rules") note = "Entra desligada para não pontuar em dobro enquanto o TOP funciona; ligar na virada.";
    return { table: t, top, gs: applied.present[target] ?? 0, note, excluded: exn };
  });
  const balances = prep.mapping.map((m) => {
    const p = profiles.get(m.legacyId) ?? {};
    const b = bal.get(m.legacyId);
    const linked = (b?.status ?? m.status) === "ligado" && b?.user_id;
    const h = prep.history[m.legacyId] ?? { coins: 0, xp: 0, adjCoins: 0, adjXp: 0 };
    const topCoins = Number(p["coins"] ?? 0), topXp = Number(p["total_points"] ?? 0);
    const gsCoins = linked ? Number(b?.wallet_coins ?? 0) : Number(b?.top_part_coins ?? 0);
    const gsXp = linked ? Number(b?.wallet_xp ?? 0) : Number(b?.top_part_xp ?? 0);
    return { name: m.name, email: m.email, status: b?.status ?? m.status, gsName: b?.gs_name ?? null, topCoins, gsCoins, topXp, gsXp,
      historyCoins: h.coins, adjustmentCoins: h.adjCoins, ok: topCoins === gsCoins && topXp === gsXp };
  });
  return {
    exported_at: exp.exported_at, ran_at: ranAt,
    users: { linked: status("ligado"), pending: status("pendente"), duplicates: status("duplicado"), excluded: prep.excludedPeople },
    tables, balances, unmatchedSquads: prep.unmatchedSquads, tasksCreatorFallback: prep.tasksCreatorFallback,
  };
}

export function parseTopExport(raw: unknown): TopExport {
  const r = raw as Partial<TopExport> | null;
  if (!r || typeof r !== "object" || !r.data || typeof r.data !== "object") throw new Error("Resposta do TOP sem os dados da exportação.");
  return { exported_at: String(r.exported_at ?? new Date().toISOString()), counts: (r.counts ?? {}) as Record<string, number>, data: r.data as Record<string, Row[]> };
}
