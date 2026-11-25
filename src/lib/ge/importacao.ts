/**
 * Importação dos dados do projeto antigo "Gestão Telemetria e Fadiga" para a Gestão de eventos.
 * O admin exporta cada tabela do Lovable Cloud antigo (CSV ou JSON) e envia os arquivos aqui;
 * nada é lido do projeto antigo pela rede.
 */

/** Ordem de gravação respeitando as chaves estrangeiras. */
export const ORDEM_TABELAS = [
  "client_groups",
  "clients",
  "profiles",
  "user_roles",
  "feature_catalog",
  "client_features",
  "client_external_accounts",
  "api_configurations",
  "fleets",
  "drivers",
  "vehicles",
  "vehicle_equipments",
  "fleet_responsibles",
  "vehicle_fleet_transfers",
  "risk_configurations",
  "notification_configurations",
  "events",
  "event_analyses",
  "treatments",
  "treatment_history",
  "notification_logs",
  "audit_logs",
  "client_event_type_settings",
  "unmatched_event_type_settings",
] as const;
export type TabelaGe = (typeof ORDEM_TABELAS)[number];

/** Chave de conflito para regravar sem duplicar (importação pode ser repetida). */
export const CHAVE_CONFLITO: Record<TabelaGe, string> = Object.fromEntries(
  ORDEM_TABELAS.map((t) => [t, "id"]),
) as Record<TabelaGe, string>;
CHAVE_CONFLITO.feature_catalog = "key";
CHAVE_CONFLITO.client_features = "client_id,feature_key";
CHAVE_CONFLITO.user_roles = "user_id,role";
CHAVE_CONFLITO.client_event_type_settings = "client_id,api_source,event_type";
CHAVE_CONFLITO.unmatched_event_type_settings = "api_source,event_type";

/** Colunas que guardam id de usuário do projeto antigo e precisam ser trocadas pelo id no Gestão. */
export const COLUNAS_USUARIO: Partial<Record<TabelaGe, string[]>> = {
  profiles: ["id"],
  user_roles: ["user_id"],
  treatments: ["created_by_user_id", "assigned_to_user_id"],
  treatment_history: ["changed_by_user_id"],
  event_analyses: ["analyzed_by_user_id"],
  fleet_responsibles: ["user_id"],
  vehicle_fleet_transfers: ["transferred_by_user_id"],
  audit_logs: ["user_id"],
};

/** Descobre a tabela pelo nome do arquivo ("vehicles_rows.csv", "ge_events.json", "events (1).csv"). */
export function tabelaDoArquivo(nome: string): TabelaGe | null {
  const base = nome.toLowerCase().replace(/\.(csv|json)$/i, "").replace(/\s*\(\d+\)$/, "").replace(/-export-[\d_-]+$/, "").replace(/^ge_/, "").replace(/_rows$/, "").replace(/^public\./, "");
  return (ORDEM_TABELAS as readonly string[]).includes(base) ? (base as TabelaGe) : null;
}

/** CSV (RFC 4180): vírgula ou ponto e vírgula, aspas duplas, quebras de linha dentro de aspas. */
export function lerCsv(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, "");
  const primeira = t.slice(0, t.indexOf("\n") === -1 ? t.length : t.indexOf("\n"));
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((h, i) => [h.trim(), l[i] ?? ""])));
}

/** Converte o texto de uma célula exportada: vazio → null; JSON e arrays do Postgres → valor. */
export function valorCelula(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (v === "" || v === "NULL") return null;
  const s = v.trim();
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try { return JSON.parse(s); } catch { /* segue */ }
    if (s.startsWith("{")) {
      // array do Postgres: {a,b,"c d"}
      const corpo = s.slice(1, -1);
      if (!corpo) return [];
      return (corpo.match(/("([^"\\]|\\.)*"|[^,]+)/g) ?? []).map((x) => x.startsWith('"') ? x.slice(1, -1).replace(/\\(.)/g, "$1") : x);
    }
  }
  return v;
}

/** Lê o conteúdo de um arquivo exportado (CSV ou JSON) em linhas já convertidas. */
export function lerArquivo(nome: string, texto: string): Record<string, unknown>[] {
  if (/\.json$/i.test(nome)) {
    const j = JSON.parse(texto);
    const arr = Array.isArray(j) ? j : Array.isArray(j?.rows) ? j.rows : [];
    return arr as Record<string, unknown>[];
  }
  return lerCsv(texto).map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, valorCelula(v)])));
}

/**
 * Troca ids de usuários antigos pelos ids no Gestão. Em profiles/user_roles a linha de quem não
 * foi mapeado é descartada; nas demais tabelas o campo fica vazio.
 */
export function remapearUsuarios(
  tabela: TabelaGe,
  linhas: Record<string, unknown>[],
  mapa: Record<string, string>,
): Record<string, unknown>[] {
  const cols = COLUNAS_USUARIO[tabela];
  if (!cols) return linhas;
  const obrigatoria = tabela === "profiles" || tabela === "user_roles";
  const out: Record<string, unknown>[] = [];
  for (const l of linhas) {
    const n = { ...l };
    let ok = true;
    for (const c of cols) {
      const v = n[c];
      if (v == null || v === "") continue;
      const novo = mapa[String(v)];
      if (novo) n[c] = novo;
      else if (obrigatoria) ok = false;
      else n[c] = null;
    }
    if (ok) out.push(n);
  }
  return out;
}

/** Chave para comparar nomes de empresas (sem acento, sem sufixos societários). */
export function chaveEmpresa(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\/?a|sa)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
