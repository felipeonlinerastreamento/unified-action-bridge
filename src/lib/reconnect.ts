// Regras do Reconnect (portadas do Reconnect Hub sem mudar o comportamento):
// leitura das planilhas, dias sem comunicação, criticidade, sessão do dia e veículos recuperados.
// Puras e testáveis em reconnect.test.ts.

export type Mapping = { plate: string; lastCommunication: string; client: string; batteryVoltage: string };
export type Criticidade = "green" | "yellow" | "orange" | "red";

export const KNOWN_MAPPINGS: Record<keyof Mapping, string[]> = {
  plate: ["placa", "plate", "veículo", "veiculo", "identificador", "prefixo", "frota"],
  lastCommunication: ["tempo desatualizado", "desatualizado", "última comunicação", "ultima comunicacao", "dias", "dia", "days", "heartbeat", "last communication", "data da atualização", "data do evento", "data"],
  client: ["cliente", "client", "nome", "empresa"],
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

  const isFirstImportOfDay = !input.vehicles.some((v) => v.import_date === today);
  const previousDay = isFirstImportOfDay ? input.vehicles.filter((v) => v.import_date !== today) : [];
  const list = input.vehicles.filter((v) => v.import_date === today).map((v) => ({ ...v }));
  const touched = new Map<string, VehicleRow>(); // id -> linha inserida/alterada
  const seenPlates = new Set<string>();
  let newVehicles = 0;
  let updatedVehicles = 0;
  const dash = (s: string) => s === "-" || s === "–" || s === "—";

  input.rows.forEach((row, index) => {
    const rowNum = index + 2;
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
      skipped.push({ rowNumber: rowNum, rawPlate: rawPlate || "(vazio)", rawClient: rawClient || "(vazio)", reason });
      return;
    }
    const timeValue = mapping.lastCommunication ? row[mapping.lastCommunication] : "";
    const timeStr = timeValue == null ? "" : timeValue instanceof Date ? timeValue.toISOString() : String(timeValue).trim();
    const isTimeEmpty = !timeStr || timeStr === "0" || timeStr === "null" || timeStr === "undefined";
    const daysOffline = parseDaysOffline(timeValue, now);
    const status = isTimeEmpty ? "Sem Transmissão" : `${daysOffline} dia(s) sem comunicação`;
    if (input.discard?.enabled && daysOffline <= input.discard.maxDays) {
      skipped.push({ rowNumber: rowNum, rawPlate, rawClient, reason: `Descartado: ${daysOffline} dia(s) sem comunicação (filtro ≤ ${input.discard.maxDays} dias)` });
      return;
    }
    if (mapping.lastCommunication && isTimeEmpty) {
      warnings.push({ row: rowNum, column: mapping.lastCommunication, value: "(vazio)", issue: "⚠️ Data de comunicação ausente", suggestion: `Preencha a coluna "${mapping.lastCommunication}" na linha ${rowNum} da planilha`, severity: "error" });
    } else if (!isTimeEmpty && daysOffline === 0 && !/(\d+)\s*dias?/i.test(timeStr) && !parseDateString(timeStr, now)) {
      warnings.push({ row: rowNum, column: mapping.lastCommunication || "Última Comunicação", value: timeStr.slice(0, 30), issue: "⚠️ Formato de data não reconhecido", suggestion: "Verifique o formato da data nesta célula", severity: "warning" });
    }
    const lastComm = new Date(now.getTime() - daysOffline * 86_400_000).toISOString();
    const battery = mapping.batteryVoltage ? String(row[mapping.batteryVoltage] ?? "").trim() : "";
    seenPlates.add(plate);

    const existing = list.find((v) => v.plate === plate && v.import_date === today);
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
    const prevCount = input.recoveredPlates.get(plate) ?? 0;
    const previous = input.vehicles.find((v) => v.plate === plate && v.import_date !== today);
    const v: VehicleRow = {
      id: newId(), plate, last_communication: lastComm, days_offline: daysOffline, client_name: clientName, client_id: client.id,
      observation: previous?.observation ?? input.annotations.get(plate) ?? "", incidences: 1, notifications: previous?.notifications ?? 0,
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
      if (seenPlates.has(v.plate) || seenPrev.has(v.plate)) continue;
      seenPrev.add(v.plate);
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
