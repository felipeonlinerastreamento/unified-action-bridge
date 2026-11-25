// Regras do Reconnect (portadas do Reconnect Hub sem mudar o comportamento):
// leitura das planilhas, dias sem comunicação, criticidade, sessão do dia e veículos recuperados.
// Puras e testáveis em reconnect.test.ts.

export type Mapping = { plate: string; lastCommunication: string; client: string; batteryVoltage: string };
export type Criticidade = "green" | "yellow" | "orange" | "red";

export const KNOWN_MAPPINGS: Record<keyof Mapping, string[]> = {
  plate: ["placa", "plate", "unidade rastreada", "veículo", "veiculo", "identificador", "prefixo", "frota"],
  lastCommunication: ["tempo desatualizado", "desatualizado", "última comunicação", "ultima comunicacao", "dias", "dia", "days", "heartbeat", "last communication", "last time on line", "last time", "data da atualização", "data/hora", "data do evento", "data"],
  client: ["cliente", "client", "fleet name", "fleet", "nome", "empresa"],
  batteryVoltage: ["tensão", "tensao", "bateria", "battery", "voltage", "volt", "tensão da bateria", "tensão bateria", "bat", "vbat", "v_bat"],
};

export function getCriticality(days: number): Criticidade {
  if (days <= 10) return "green";
  if (days <= 20) return "yellow";
  if (days <= 30) return "orange";
  return "red";
}

export const CRITICIDADE_LABEL: Record<Criticidade, string> = {
  green: "1-10 dias",
  yellow: "11-20 dias",
  orange: "21-30 dias",
  red: "31+ dias",
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Linha de cabeçalho: a que mais pontua entre as 12 primeiras (ignora títulos decorativos). */
export function detectHeaderRow(matrix: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(matrix.length, 12); i++) {
    const cells = (matrix[i] ?? []).map(norm).filter(Boolean);
    if (cells.length < 2) continue;
    let score = 0;
    for (const cell of cells) {
      for (const keywords of Object.values(KNOWN_MAPPINGS)) {
        if (keywords.some((k) => cell.includes(k) || cell === k)) score += 1;
      }
    }
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  }
  return bestScore >= 1 ? bestIndex : 0;
}

/** Monta as linhas (objeto por coluna) a partir da matriz bruta da planilha. */
export function buildRowsFromMatrix(matrix: unknown[][]): Record<string, unknown>[] {
  if (!matrix.length) return [];
  const h = detectHeaderRow(matrix);
  const used = new Map<string, number>();
  const headers = (matrix[h] ?? []).map((cell, idx) => {
    const base = String(cell ?? "").trim() || `Coluna ${idx + 1}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count > 1 ? `${base} (${count})` : base;
  });
  return matrix
    .slice(h + 1)
    .filter((row) => (row ?? []).some((c) => String(c ?? "").trim() !== ""))
    .map((row) => {
      const o: Record<string, unknown> = {};
      headers.forEach((hd, i) => { o[hd] = row[i] ?? ""; });
      return o;
    });
}

/** Sugere as colunas pelo nome (ordem de prioridade das palavras-chave). */
export function autoDetect(headers: string[]): Mapping {
  const r: Mapping = { plate: "", lastCommunication: "", client: "", batteryVoltage: "" };
  for (const field of Object.keys(r) as (keyof Mapping)[]) {
    for (const k of KNOWN_MAPPINGS[field]) {
      if (r[field]) break;
      const col = headers.find((c) => { const cl = c.toLowerCase().trim(); return cl.includes(k) || cl === k; });
      if (col) r[field] = col;
    }
  }
  return r;
}

export function excelSerialToDate(serial: number): Date | null {
  if (serial >= 1 && serial <= 60000) return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  return null;
}

export function parseDateString(s0: string, now: Date = new Date()): Date | null {
  const s = String(s0 ?? "").trim();
  if (!s || s.toLowerCase() === "unidade rastreada") return null;
  if (/^\d+([.,]\d+)?$/.test(s)) {
    const d = excelSerialToDate(Math.floor(Number(s.replace(",", "."))));
    if (d) return d;
  }
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})[\sT]*(.*)$/);
  if (br) {
    const [, a, b, cRaw] = br;
    const c = cRaw.length === 2 ? 2000 + Number(cRaw) : Number(cRaw);
    const day = Number(a), month = Number(b);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return new Date(c, month - 1, day);
    if (month >= 1 && month <= 31 && day >= 1 && day <= 12) return new Date(c, day - 1, month);
  }
  const iso = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dias = s.match(/(\d+)\s*dias?/i);
  if (dias) return new Date(now.getTime() - parseInt(dias[1], 10) * 86_400_000);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Dias sem comunicação a partir da célula (data, "15 dias", número de dias ou serial do Excel). */
export function parseDaysOffline(value: unknown, now: Date = new Date()): number {
  const diff = (d: Date) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
  if (value instanceof Date) return diff(value);
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "unidade rastreada") return 0;
  const dias = text.match(/(\d+)\s*dias?/i);
  if (dias) return parseInt(dias[1], 10);
  if (/^\d+([.,]\d+)?$/.test(text)) {
    const num = Number(text.replace(",", "."));
    const serial = excelSerialToDate(Math.floor(num));
    if (serial && num >= 30000) return diff(serial);
    if (num < 30000) return Math.floor(num);
  }
  const d = parseDateString(text, now);
  return d ? diff(d) : 0;
}

export function normalizeClientKey(v: string): string {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo: a "sessão do dia". */
export function todaySP(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export type VehicleRow = {
  id: string; plate: string; last_communication: string | null; days_offline: number; client_name: string; client_id: string;
  observation: string; incidences: number; notifications: number; battery_voltage: string; imported_at: string;
  was_recovered: boolean; recovery_count: number; status: string; import_date: string;
};
export type ClientRow = { id: string; name: string; name_key?: string; emails: string[]; phones: string[]; vehicle_count: number };
export type SkippedItem = { rowNumber: number; rawPlate: string; rawClient: string; reason: string };
export type Warning = { row: number; column: string; value: string; issue: string; suggestion: string; severity: "error" | "warning" };
export type RecoveredItem = { plate: string; client_name: string; client_id: string; last_days_offline: number };

/**
 * Plano de importação (mesma regra do Reconnect Hub):
 * - Linhas sem placa/cliente ou separadores ("UNIDADE RASTREADA") são puladas.
 * - Filtro opcional descarta quem tem até N dias sem comunicação.
 * - Mesma placa no mesmo dia: atualiza e soma incidência (sessão do dia).
 * - Primeira importação do dia: placas de dias anteriores que não vieram viram "recuperadas"
 *   e a sessão anterior sai da lista ativa.
 * - Cliente é unificado pelo nome normalizado; contatos existentes nunca são apagados.
 * - Observação e notificações da placa passam de sessões anteriores (ou da última anotação).
 */
export function planImport(input: {
  rows: Record<string, unknown>[];
  mapping: Mapping;
  discard?: { enabled: boolean; maxDays: number };
  vehicles: VehicleRow[];
  clients: ClientRow[];
  recoveredPlates: Map<string, number>; // placa -> nº de recuperações anteriores
  annotations: Map<string, string>; // placa -> última anotação
  now?: Date;
  newId?: () => string;
}) {
  const now = input.now ?? new Date();
  const today = todaySP(now);
  const newId = input.newId ?? (() => crypto.randomUUID());
  const { mapping } = input;
  const skipped: SkippedItem[] = [];
  const warnings: Warning[] = [];
  const clientMap = new Map<string, ClientRow>();
  for (const c of input.clients) clientMap.set(normalizeClientKey(c.name), { ...c, emails: [...(c.emails || [])], phones: [...(c.phones || [])] });
  const newClients: ClientRow[] = [];
  const recPorChave = new Map<string, number>();
  for (const [pl, n] of input.recoveredPlates) recPorChave.set(chavePlaca(pl), (recPorChave.get(chavePlaca(pl)) ?? 0) + n);
  const anotPorChave = new Map<string, string>();
  for (const [pl, o] of input.annotations) if (!anotPorChave.has(chavePlaca(pl))) anotPorChave.set(chavePlaca(pl), o);

  const isFirstImportOfDay = !input.vehicles.some((v) => v.import_date === today);
  const previousDay = isFirstImportOfDay ? input.vehicles.filter((v) => v.import_date !== today) : [];
  const list = input.vehicles.filter((v) => v.import_date === today).map((v) => ({ ...v }));
  const touched = new Map<string, VehicleRow>(); // id -> linha inserida/alterada
  const seenPlates = new Set<string>();
  let newVehicles = 0;
  let updatedVehicles = 0;
  const dash = (s: string) => s === "-" || s === "–" || s === "—";

  input.rows.forEach((row, index) => {
    const rowNum = Number(row.__linha) || index + 2;
    const arq = row.__arquivo ? ` — ${String(row.__arquivo)}` : "";
    const rawPlate = String(row[mapping.plate] ?? "").trim();
    const rawClient = String(row[mapping.client] ?? "").trim();
    const plate0 = rawPlate.toUpperCase().replace(/\s+/g, "-");
    const plate = dash(plate0) ? "" : plate0;
    const clientName = dash(rawClient) ? "" : rawClient.replace(/\s+/g, " ").trim();
    if (!plate || !clientName || plate === "UNIDADE-RASTREADA" || plate === "UNIDADE RASTREADA") {
      let reason = "Dados incompletos";
      if (!plate && !clientName) reason = "Placa e cliente vazios";
      else if (!plate) reason = "Placa vazia";
      else if (!clientName) reason = "Cliente vazio";
      else reason = "Linha de cabeçalho/separador";
      skipped.push({ rowNumber: rowNum, rawPlate: rawPlate || "(vazio)", rawClient: rawClient || "(vazio)", reason: reason + arq });
      return;
    }
    if (row.__pular) {
      skipped.push({ rowNumber: rowNum, rawPlate, rawClient, reason: String(row.__pular) + arq });
      return;
    }
    const timeValue = mapping.lastCommunication ? row[mapping.lastCommunication] : "";
    const timeStr = timeValue == null ? "" : timeValue instanceof Date ? timeValue.toISOString() : String(timeValue).trim();
    const isTimeEmpty = !timeStr || timeStr === "0" || timeStr === "null" || timeStr === "undefined";
    const daysOffline = parseDaysOffline(timeValue, now);
    // Data em branco = o sistema de rastreamento não tem posição: "Sem comunicação" (nunca é descartado).
    const status = isTimeEmpty ? STATUS_SEM_COMUNICACAO : `${daysOffline} dia(s) sem comunicação`;
    if (input.discard?.enabled && !isTimeEmpty && daysOffline <= input.discard.maxDays) {
      skipped.push({ rowNumber: rowNum, rawPlate, rawClient, reason: `Descartado: ${daysOffline} dia(s) sem comunicação (filtro ≤ ${input.discard.maxDays} dias)` });
      return;
    }
    if (!isTimeEmpty && daysOffline === 0 && !/(\d+)\s*dias?/i.test(timeStr) && !parseDateString(timeStr, now)) {
      warnings.push({ row: rowNum, column: mapping.lastCommunication || "Última Comunicação", value: timeStr.slice(0, 30), issue: "⚠️ Formato de data não reconhecido", suggestion: "Verifique o formato da data nesta célula", severity: "warning" });
    }
    const lastComm = new Date(now.getTime() - daysOffline * 86_400_000).toISOString();
    const battery = mapping.batteryVoltage ? String(row[mapping.batteryVoltage] ?? "").trim() : "";
    seenPlates.add(chavePlaca(plate));

    const pk = chavePlaca(plate);
    const existing = list.find((v) => chavePlaca(v.plate) === pk && v.import_date === today);
    if (existing) {
      existing.days_offline = daysOffline;
      existing.last_communication = lastComm;
      existing.incidences += 1;
      existing.battery_voltage = battery || existing.battery_voltage;
      existing.status = status;
      touched.set(existing.id, existing);
      updatedVehicles++;
      return;
    }
    const key = normalizeClientKey(clientName);
    let client = clientMap.get(key);
    if (!client) {
      client = { id: newId(), name: clientName, name_key: key, emails: [], phones: [], vehicle_count: 0 };
      clientMap.set(key, client);
      newClients.push(client);
    }
    const prevCount = recPorChave.get(pk) ?? 0;
    const previous = input.vehicles.find((v) => chavePlaca(v.plate) === pk && v.import_date !== today);
    const v: VehicleRow = {
      id: newId(), plate, last_communication: lastComm, days_offline: daysOffline, client_name: clientName, client_id: client.id,
      observation: previous?.observation ?? anotPorChave.get(pk) ?? "", incidences: 1, notifications: previous?.notifications ?? 0,
      battery_voltage: battery, imported_at: now.toISOString(), was_recovered: prevCount > 0, recovery_count: prevCount, status, import_date: today,
    };
    list.push(v);
    touched.set(v.id, v);
    newVehicles++;
  });

  const recovered: RecoveredItem[] = [];
  if (isFirstImportOfDay) {
    const seenPrev = new Set<string>();
    for (const v of previousDay) {
      const k = chavePlaca(v.plate);
      if (seenPlates.has(k) || seenPrev.has(k)) continue;
      seenPrev.add(k);
      recovered.push({ plate: v.plate, client_name: v.client_name, client_id: v.client_id, last_days_offline: v.days_offline });
    }
  }
  const countByClient = new Map<string, number>();
  for (const v of list) countByClient.set(v.client_id, (countByClient.get(v.client_id) ?? 0) + 1);

  return {
    today,
    isFirstImportOfDay,
    vehiclesToUpsert: [...touched.values()],
    previousSessionIdsToRemove: previousDay.map((v) => v.id),
    newClients,
    clientCounts: countByClient,
    recovered,
    skipped,
    warnings,
    newVehicles,
    updatedVehicles,
  };
}

/** Mensagem da notificação: modelo com {cliente} e a lista de placas no fim (igual ao sistema antigo). */
export function buildNotificationMessage(body: string, clientName: string, plates: string[]): string {
  const text = String(body || "").replace(/\{cliente\}/gi, clientName).replace(/\{placas\}/gi, "");
  return `${text.trim()}\n\nPlacas sem comunicação:\n${plates.map((p) => `• ${p}`).join("\n")}`;
}

// ---------------------------------------------------------------------------
// Resultados e risco (Pós-venda / Financeiro)
// ---------------------------------------------------------------------------

/** Nome para comparar entre sistemas: sem acento, pontuação e sufixos societários (LTDA, ME, EIRELI, S/A...). */
export function chaveEmpresa(nome: string): string {
  return normalizeClientKey(nome)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(ltda|me|epp|eireli|s ?a|sa|ss|mei|cia|e cia|comercio e servicos)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Liga cada cliente do Reconnect a um cliente da carteira do Pós-venda:
 * primeiro pelo CNPJ da empresa vinculada no Gestão Online, depois pelo nome.
 */
export function vincularCarteira(
  rcClients: { id: string; name: string; company_id?: string | null }[],
  cnpjPorEmpresa: Map<string, string>,
  carteira: { id: string; documento: string; nome: string }[],
): Map<string, string> {
  const porDoc = new Map(carteira.map((c) => [c.documento, c.id]));
  const porNome = new Map<string, string>();
  for (const c of carteira) { const k = chaveEmpresa(c.nome); if (k && !porNome.has(k)) porNome.set(k, c.id); }
  const out = new Map<string, string>();
  for (const r of rcClients) {
    const doc = r.company_id ? cnpjPorEmpresa.get(r.company_id) : undefined;
    const id = (doc && porDoc.get(doc)) || porNome.get(chaveEmpresa(r.name));
    if (id) out.set(r.id, id);
  }
  return out;
}

/** Placas da sessão mais recente (as que estão sem comunicação agora). */
export function sessaoAtual<T extends { import_date: string }>(vehicles: T[]): T[] {
  const ultima = vehicles.reduce((m, v) => (v.import_date > m ? v.import_date : m), "");
  return vehicles.filter((v) => v.import_date === ultima);
}

export type RiscoCarteira = { rc_placas_paradas: number; rc_dias_max: number; rc_notificadas: number };

/** Soma as placas paradas por cliente da carteira. */
export function riscoPorCarteira(atuais: Pick<VehicleRow, "client_id" | "days_offline" | "notifications">[], vinculo: Map<string, string>): Map<string, RiscoCarteira> {
  const out = new Map<string, RiscoCarteira>();
  for (const v of atuais) {
    const cid = vinculo.get(v.client_id);
    if (!cid) continue;
    const r = out.get(cid) ?? { rc_placas_paradas: 0, rc_dias_max: 0, rc_notificadas: 0 };
    r.rc_placas_paradas++;
    r.rc_dias_max = Math.max(r.rc_dias_max, v.days_offline || 0);
    if ((v.notifications || 0) > 0) r.rc_notificadas++;
    out.set(cid, r);
  }
  return out;
}

export type RecuperadoRow = { plate: string; client_id: string; client_name: string; last_days_offline: number; recovered_at: string };
export type NotificacaoRow = { client_id: string; sent_at: string; plates: string[] };

const diaSP = (iso: string) => todaySP(new Date(iso));
const segundaDe = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const difDias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Métricas do painel de resultado do Reconnect no período [de, ate] (datas AAAA-MM-DD, inclusive).
 * Uma placa conta como "recuperada após aviso" se foi notificada até `janelaDias` antes de voltar.
 * Receita (opcional) é a receita mensal da carteira do Pós-venda por cliente do Reconnect.
 */
export function metricasReconnect(input: {
  recovered: RecuperadoRow[];
  notifications: NotificacaoRow[];
  atuais: Pick<VehicleRow, "plate" | "client_id" | "client_name" | "days_offline" | "notifications">[];
  de: string;
  ate: string;
  janelaDias?: number;
  receitaPorCliente?: Map<string, number>;
}) {
  const janela = input.janelaDias ?? 30;
  const noPeriodo = (dia: string) => dia >= input.de && dia <= input.ate;
  const avisosPorPlaca = new Map<string, string[]>();
  for (const n of input.notifications) for (const p of n.plates || []) avisosPorPlaca.set(p, [...(avisosPorPlaca.get(p) ?? []), n.sent_at]);

  const recs = input.recovered.filter((r) => noPeriodo(diaSP(r.recovered_at)));
  const semanas = new Map<string, { recuperados: number; aposAviso: number }>();
  let aposAviso = 0, somaDiasAviso = 0, somaDiasParado = 0;
  for (const r of recs) {
    const sem = segundaDe(diaSP(r.recovered_at));
    const w = semanas.get(sem) ?? { recuperados: 0, aposAviso: 0 };
    w.recuperados++;
    const aviso = (avisosPorPlaca.get(r.plate) ?? []).filter((s) => s <= r.recovered_at && difDias(s, r.recovered_at) <= janela).sort().pop();
    if (aviso) { w.aposAviso++; aposAviso++; somaDiasAviso += Math.max(0, difDias(aviso, r.recovered_at)); }
    somaDiasParado += r.last_days_offline || 0;
    semanas.set(sem, w);
  }

  // Taxa de retorno do aviso: placas avisadas no período que voltaram em até `janela` dias.
  const avisadas = new Map<string, string>(); // placa -> primeiro aviso no período
  for (const n of input.notifications) {
    if (!noPeriodo(diaSP(n.sent_at))) continue;
    for (const p of n.plates || []) if (!avisadas.has(p) || n.sent_at < avisadas.get(p)!) avisadas.set(p, n.sent_at);
  }
  let voltaram = 0;
  for (const [placa, s] of avisadas) {
    if (input.recovered.some((r) => r.plate === placa && r.recovered_at >= s && difDias(s, r.recovered_at) <= janela)) voltaram++;
  }

  const porCliente = new Map<string, { clientId: string; nome: string; placas: number; diasMax: number; notificadas: number }>();
  for (const v of input.atuais) {
    const c = porCliente.get(v.client_id) ?? { clientId: v.client_id, nome: v.client_name, placas: 0, diasMax: 0, notificadas: 0 };
    c.placas++;
    c.diasMax = Math.max(c.diasMax, v.days_offline || 0);
    if ((v.notifications || 0) > 0) c.notificadas++;
    porCliente.set(v.client_id, c);
  }
  const receita = input.receitaPorCliente;
  const clientes = [...porCliente.values()].map((c) => ({ ...c, receita: receita?.get(c.clientId) ?? null }));
  const soma = (ids: Iterable<string>) => { let t = 0; for (const id of new Set(ids)) t += receita?.get(id) ?? 0; return Math.round(t * 100) / 100; };

  return {
    recuperados: recs.length,
    recuperadosAposAviso: aposAviso,
    diasMedioAvisoAteVoltar: aposAviso ? Math.round((somaDiasAviso / aposAviso) * 10) / 10 : null,
    diasMedioParadoAntesDeVoltar: recs.length ? Math.round((somaDiasParado / recs.length) * 10) / 10 : null,
    placasAvisadas: avisadas.size,
    taxaRetornoAviso: avisadas.size ? Math.round((voltaram / avisadas.size) * 1000) / 10 : null,
    semanas: [...semanas.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([semana, w]) => ({ semana, ...w })),
    paradasAgora: input.atuais.length,
    notificadasSemRetorno: input.atuais.filter((v) => (v.notifications || 0) > 0).length,
    clientesQueMaisDemoram: clientes.sort((a, b) => b.diasMax - a.diasMax || b.placas - a.placas).slice(0, 15),
    receita: receita
      ? {
          emRisco: soma(clientes.map((c) => c.clientId)),
          emRisco31: soma(clientes.filter((c) => c.diasMax > 30).map((c) => c.clientId)),
          clientesComReceita: clientes.filter((c) => (c.receita ?? 0) > 0).length,
          recuperada: soma(recs.map((r) => r.client_id)),
          porFaixa: (["green", "yellow", "orange", "red"] as Criticidade[]).map((f) => ({
            faixa: f,
            receita: soma(clientes.filter((c) => getCriticality(c.diasMax) === f).map((c) => c.clientId)),
          })),
        }
      : null,
  };
}


// ------------------------------------------------------------------ várias planilhas, vários sistemas
export const STATUS_SEM_COMUNICACAO = "Sem comunicação";

/** Chave de comparação da placa: só letras e números (TCA-8A29 = TCA8A29). */
export function chavePlaca(p: string): string {
  return String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const PLACA_RE = /(?<![A-Z0-9])([A-Z]{3})[-\s]?(\d[A-Z0-9]\d{2})(?![A-Z0-9])/g;

/**
 * Placa dentro de textos como "FIAT/STRADA TCA-8A29", "CMF4102 ESCAVADEIRA" ou "RUI3D01 - CM-045"
 * (padrão antigo e Mercosul; pega a última ocorrência). Sem placa reconhecível, devolve o texto limpo
 * (ex.: "ONLINE-0181", "EH07"), para não perder o veículo.
 */
export function extrairPlaca(raw: unknown): string {
  const t = String(raw ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!t || t === "-" || t === "–" || t === "—") return "";
  const achados = [...t.matchAll(PLACA_RE)];
  if (achados.length) { const m = achados[achados.length - 1]; return `${m[1]}${m[2]}`; }
  return t.replace(/\s*\/\s*/g, "/").replace(/\s*-\s*/g, "-").replace(/\s+/g, "-");
}

export type ModeloPlanilha = { nome: string; mapping: Mapping; situacao?: string };

const tem = (hs: string[], nome: string) => hs.find((h) => h.trim().toLowerCase() === nome.toLowerCase());

/** Reconhece os relatórios dos sistemas de rastreamento usados (pelo cabeçalho). */
export function detectarModelo(headers: string[], rows: Record<string, unknown>[] = []): ModeloPlanilha {
  const h = headers;
  if (tem(h, "IMEI") && tem(h, "Identificador") && tem(h, "Último Heartbeat")) {
    return { nome: "Relatório de Equipamentos (heartbeat)", mapping: { plate: tem(h, "Identificador")!, client: tem(h, "Cliente") ?? "", lastCommunication: tem(h, "Último Heartbeat")!, batteryVoltage: "" }, situacao: tem(h, "Situação") };
  }
  if (tem(h, "Unidade rastreada") && tem(h, "Data da atualização")) {
    return { nome: "Unidades rastreadas desatualizadas", mapping: { plate: tem(h, "Unidade rastreada")!, client: tem(h, "Cliente") ?? "", lastCommunication: tem(h, "Data da atualização")!, batteryVoltage: "" } };
  }
  if (tem(h, "Plate Number") && tem(h, "Last Time On Line")) {
    return { nome: "Vehicle List", mapping: { plate: tem(h, "Plate Number")!, client: tem(h, "Fleet Name") ?? "", lastCommunication: tem(h, "Last Time On Line")!, batteryVoltage: "" } };
  }
  if (tem(h, "Placa") && tem(h, "Data/Hora") && tem(h, "Serial")) {
    return { nome: "Grid de veículos", mapping: { plate: tem(h, "Placa")!, client: tem(h, "Cliente") ?? "", lastCommunication: tem(h, "Data/Hora")!, batteryVoltage: "" } };
  }
  const m = autoDetect(h);
  // Se a coluna de data escolhida veio toda vazia, usa outra candidata que tenha dados.
  if (m.lastCommunication && rows.length && rows.every((r) => !String(r[m.lastCommunication] ?? "").trim())) {
    const alt = h.find((c) => c !== m.lastCommunication && KNOWN_MAPPINGS.lastCommunication.some((k) => c.toLowerCase().includes(k)) && rows.some((r) => String(r[c] ?? "").trim()));
    if (alt) m.lastCommunication = alt;
  }
  return { nome: "Outro formato (colunas reconhecidas pelo nome)", mapping: m };
}

/** Colunas padrão das linhas já normalizadas (todas as planilhas juntas numa importação só). */
export const MAPEAMENTO_PADRAO: Mapping = { plate: "Placa", client: "Cliente", lastCommunication: "Última comunicação", batteryVoltage: "Bateria" };

/**
 * Converte as linhas de uma planilha para as colunas padrão, com a placa extraída, o arquivo e a
 * linha de origem (para o relatório de puladas). Equipamento inativo (coluna Situação) é pulado.
 */
export function normalizarLinhas(rows: Record<string, unknown>[], modelo: ModeloPlanilha, arquivo: string, linhaInicial = 2): Record<string, unknown>[] {
  const m = modelo.mapping;
  return rows.map((r, i) => {
    const sit = modelo.situacao ? String(r[modelo.situacao] ?? "").trim().toLowerCase() : "";
    const data = m.lastCommunication ? r[m.lastCommunication] : "";
    const dataTxt = String(data ?? "").trim();
    return {
      Placa: m.plate ? extrairPlaca(r[m.plate]) : "",
      Cliente: m.client ? String(r[m.client] ?? "").trim() : "",
      "Última comunicação": dataTxt === "-" || dataTxt === "–" ? "" : data,
      Bateria: m.batteryVoltage ? r[m.batteryVoltage] : "",
      __arquivo: arquivo,
      __linha: linhaInicial + i,
      ...(/inativ|desativ/.test(sit) ? { __pular: "Equipamento inativo no sistema de rastreamento" } : {}),
    };
  });
}
