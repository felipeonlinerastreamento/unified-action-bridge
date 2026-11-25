import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  detectHeaderRow, buildRowsFromMatrix, autoDetect, parseDaysOffline, getCriticality, normalizeClientKey,
  planImport, buildNotificationMessage, type VehicleRow,
  chaveEmpresa, vincularCarteira, riscoPorCarteira, metricasReconnect,
  extrairPlaca, chavePlaca, detectarModelo, normalizarLinhas, MAPEAMENTO_PADRAO,
} from "./reconnect";

const NOW = new Date("2026-11-21T15:00:00Z"); // 21/11 12:00 em São Paulo
let seq = 0;
const id = () => `id-${++seq}`;
const V = (p: Partial<VehicleRow>): VehicleRow => ({
  id: id(), plate: "AAA-0000", last_communication: null, days_offline: 5, client_name: "Cliente", client_id: "c1", observation: "",
  incidences: 1, notifications: 0, battery_voltage: "", imported_at: NOW.toISOString(), was_recovered: false, recovery_count: 0,
  status: "", import_date: "2026-11-21", ...p,
});

describe("planilha", () => {
  it("acha o cabeçalho depois de títulos decorativos e monta as linhas", () => {
    const m = [["Relatório de unidades"], ["Gerado em 21/11"], ["Placa", "Cliente", "Tempo desatualizado", "Tensão"], ["ABC1D23", "Raja", "15 dias", "12,4"], ["", "", "", ""]];
    assert.equal(detectHeaderRow(m), 2);
    const rows = buildRowsFromMatrix(m);
    assert.equal(rows.length, 1);
    assert.deepEqual(autoDetect(Object.keys(rows[0])), { plate: "Placa", client: "Cliente", lastCommunication: "Tempo desatualizado", batteryVoltage: "Tensão" });
  });
  it("dias sem comunicação em vários formatos", () => {
    assert.equal(parseDaysOffline("15 dias", NOW), 15);
    assert.equal(parseDaysOffline("7", NOW), 7);
    assert.equal(parseDaysOffline("11/11/2026 10:00", NOW), 10);
    assert.equal(parseDaysOffline("", NOW), 0);
  });
  it("criticidade e chave de cliente", () => {
    assert.equal(getCriticality(10), "green");
    assert.equal(getCriticality(11), "yellow");
    assert.equal(getCriticality(30), "orange");
    assert.equal(getCriticality(31), "red");
    assert.equal(normalizeClientKey("  Raja   Aluguél "), "raja aluguel");
  });
});

describe("planImport", () => {
  const mapping = { plate: "Placa", client: "Cliente", lastCommunication: "Dias", batteryVoltage: "" };
  it("primeira importação do dia: recuperados, sessão anterior sai, contatos preservados, observação herdada", () => {
    const ontem = [V({ plate: "AAA-1111", import_date: "2026-11-20", observation: "ligar", notifications: 2 }), V({ plate: "BBB-2222", import_date: "2026-11-20", days_offline: 40 })];
    const plan = planImport({
      rows: [{ Placa: "aaa 1111", Cliente: "Raja", Dias: "12 dias" }, { Placa: "CCC3333", Cliente: "Novo Cliente", Dias: "3" }, { Placa: "", Cliente: "X", Dias: "1" }],
      mapping, vehicles: ontem,
      clients: [{ id: "c1", name: "Raja", emails: ["a@b.com"], phones: ["31999"], vehicle_count: 2 }],
      recoveredPlates: new Map([["CCC3333", 1]]), annotations: new Map(), now: NOW, newId: id,
    });
    assert.equal(plan.isFirstImportOfDay, true);
    assert.equal(plan.newVehicles, 2);
    assert.equal(plan.skipped.length, 1);
    assert.deepEqual(plan.recovered.map((r) => r.plate), ["BBB-2222"]);
    assert.equal(plan.previousSessionIdsToRemove.length, 2);
    const aaa = plan.vehiclesToUpsert.find((v) => v.plate === "AAA-1111")!;
    assert.equal(aaa.observation, "ligar");
    assert.equal(aaa.notifications, 2);
    assert.equal(aaa.client_id, "c1");
    const ccc = plan.vehiclesToUpsert.find((v) => v.plate === "CCC3333")!;
    assert.equal(ccc.was_recovered, true);
    assert.equal(plan.newClients.length, 1);
    assert.equal(plan.newClients[0].name, "Novo Cliente");
  });
  it("segunda importação no mesmo dia soma incidência e não gera recuperados", () => {
    const hoje = [V({ plate: "AAA-1111", import_date: "2026-11-21", incidences: 1 })];
    const plan = planImport({
      rows: [{ Placa: "AAA-1111", Cliente: "Cliente", Dias: "13" }], mapping, vehicles: hoje,
      clients: [{ id: "c1", name: "Cliente", emails: [], phones: [], vehicle_count: 1 }], recoveredPlates: new Map(), annotations: new Map(), now: NOW,
    });
    assert.equal(plan.isFirstImportOfDay, false);
    assert.equal(plan.updatedVehicles, 1);
    assert.equal(plan.vehiclesToUpsert[0].incidences, 2);
    assert.equal(plan.recovered.length, 0);
  });
  it("filtro de comunicação recente descarta", () => {
    const plan = planImport({ rows: [{ Placa: "AAA1", Cliente: "C", Dias: "1" }], mapping, discard: { enabled: true, maxDays: 2 }, vehicles: [], clients: [], recoveredPlates: new Map(), annotations: new Map(), now: NOW });
    assert.equal(plan.newVehicles, 0);
    assert.match(plan.skipped[0].reason, /Descartado/);
  });
});

describe("mensagem", () => {
  it("troca {cliente} e põe as placas no fim", () => {
    assert.equal(buildNotificationMessage("Olá {cliente}, {placas}", "Raja", ["A-1", "B-2"]), "Olá Raja,\n\nPlacas sem comunicação:\n• A-1\n• B-2");
  });
});

describe("resultados e risco", () => {
  it("chaveEmpresa ignora sufixos e pontuação", () => {
    assert.equal(chaveEmpresa("Transportes Silva LTDA."), chaveEmpresa("TRANSPORTES SILVA - ME"));
    assert.equal(chaveEmpresa("Açaí & Cia S/A"), "acai");
  });
  it("vincularCarteira usa o CNPJ da empresa e depois o nome", () => {
    const v = vincularCarteira(
      [{ id: "r1", name: "Nome diferente", company_id: "e1" }, { id: "r2", name: "Logística Beta Ltda" }, { id: "r3", name: "Sem par" }],
      new Map([["e1", "11222333000144"]]),
      [{ id: "c1", documento: "11222333000144", nome: "Alfa Transportes" }, { id: "c2", documento: "99", nome: "LOGISTICA BETA" }],
    );
    assert.equal(v.get("r1"), "c1");
    assert.equal(v.get("r2"), "c2");
    assert.equal(v.has("r3"), false);
  });
  it("riscoPorCarteira soma placas, pior placa e avisadas", () => {
    const r = riscoPorCarteira([
      { client_id: "r1", days_offline: 5, notifications: 0 },
      { client_id: "r1", days_offline: 40, notifications: 2 },
      { client_id: "rx", days_offline: 9, notifications: 0 },
    ], new Map([["r1", "c1"]]));
    assert.deepEqual(r.get("c1"), { rc_placas_paradas: 2, rc_dias_max: 40, rc_notificadas: 1 });
    assert.equal(r.size, 1);
  });
  it("metricasReconnect: recuperados após aviso, taxa de retorno e receita", () => {
    const m = metricasReconnect({
      de: "2026-11-01", ate: "2026-11-30",
      recovered: [
        { plate: "AAA1", client_id: "r1", client_name: "A", last_days_offline: 12, recovered_at: "2026-11-10T15:00:00Z" },
        { plate: "BBB2", client_id: "r2", client_name: "B", last_days_offline: 4, recovered_at: "2026-11-12T15:00:00Z" },
        { plate: "OLD9", client_id: "r2", client_name: "B", last_days_offline: 4, recovered_at: "2026-10-12T15:00:00Z" },
      ],
      notifications: [
        { client_id: "r1", sent_at: "2026-11-06T15:00:00Z", plates: ["AAA1"] },
        { client_id: "r3", sent_at: "2026-11-08T15:00:00Z", plates: ["CCC3"] },
      ],
      atuais: [
        { plate: "CCC3", client_id: "r3", client_name: "C", days_offline: 35, notifications: 1 },
        { plate: "DDD4", client_id: "r1", client_name: "A", days_offline: 3, notifications: 0 },
      ],
      receitaPorCliente: new Map([["r1", 1000], ["r3", 500]]),
    });
    assert.equal(m.recuperados, 2);
    assert.equal(m.recuperadosAposAviso, 1);
    assert.equal(m.diasMedioAvisoAteVoltar, 4);
    assert.equal(m.placasAvisadas, 2);
    assert.equal(m.taxaRetornoAviso, 50);
    assert.equal(m.notificadasSemRetorno, 1);
    assert.equal(m.clientesQueMaisDemoram[0].clientId, "r3");
    assert.equal(m.receita?.emRisco, 1500);
    assert.equal(m.receita?.emRisco31, 500);
    assert.equal(m.receita?.recuperada, 1000);
    assert.deepEqual(m.semanas.map((s) => s.semana), ["2026-11-09"]);
  });
});

describe("várias planilhas de sistemas diferentes", () => {
  it("extrai a placa de textos dos relatórios", () => {
    assert.equal(extrairPlaca("FIAT/STRADA TCA-8A29"), "TCA8A29");
    assert.equal(extrairPlaca("MPOLO/VOLARE V10L   TZT1G65"), "TZT1G65");
    assert.equal(extrairPlaca("CMF4102 ESCAVADEIRA"), "CMF4102");
    assert.equal(extrairPlaca("RUI3D01   -  CM-045"), "RUI3D01");
    assert.equal(extrairPlaca("GOL OWL-4065"), "OWL4065");
    assert.equal(extrairPlaca("ONLINE-0181"), "ONLINE-0181");
    assert.equal(extrairPlaca("TAG -0158"), "TAG-0158");
    assert.equal(extrairPlaca("-"), "");
    assert.equal(chavePlaca("TCA-8A29"), chavePlaca("tca8a29"));
  });

  it("reconhece os 4 modelos pelo cabeçalho", () => {
    assert.equal(detectarModelo(["IMEI", "Modelo", "Cliente", "Prefixo", "Identificador", "Chip", "Último Heartbeat", "Situação", "Status"]).mapping.plate, "Identificador");
    const u = detectarModelo(["Unidade rastreada", "Cliente", "Data da atualização", "Tempo desatualizado"]);
    assert.equal(u.mapping.lastCommunication, "Data da atualização");
    const v = detectarModelo(["Plate Number", "Device Number", "Status", "Fleet Name", "Last Time On Line"]);
    assert.deepEqual([v.mapping.plate, v.mapping.client, v.mapping.lastCommunication], ["Plate Number", "Fleet Name", "Last Time On Line"]);
    const g = detectarModelo(["Sts. GPS", "Serial", "Frota", "Placa", "Cliente", "Data/Hora", "Atraso"]);
    assert.deepEqual([g.mapping.plate, g.mapping.lastCommunication], ["Placa", "Data/Hora"]);
  });

  it("junta planilhas, data em branco vira 'Sem comunicação' (sem descartar) e inativo é pulado", () => {
    const now = new Date("2026-11-25T12:00:00-03:00");
    const a = normalizarLinhas(
      [{ "Unidade rastreada": "FIAT/STRADA TCA-8A29", Cliente: "Lok", "Data da atualização": "" },
       { "Unidade rastreada": "GOL OWL-4065", Cliente: "Sicoob", "Data da atualização": "01/11/2026 10:00" }],
      detectarModelo(["Unidade rastreada", "Cliente", "Data da atualização"]), "unidades.xlsx");
    const b = normalizarLinhas(
      [{ IMEI: "1", Cliente: "Lok", Identificador: "TCA8A29", "Último Heartbeat": "25/11/2026 09:00:00", Situação: "Ativo" },
       { IMEI: "2", Cliente: "X", Identificador: "ABC1D23", "Último Heartbeat": "-", Situação: "Inativo" }],
      detectarModelo(["IMEI", "Cliente", "Identificador", "Último Heartbeat", "Situação"]), "equip.xlsx", 3);
    const plan = planImport({
      rows: [...a, ...b], mapping: MAPEAMENTO_PADRAO, discard: { enabled: true, maxDays: 2 },
      vehicles: [], clients: [], recoveredPlates: new Map(), annotations: new Map(), now, newId: (() => { let i = 0; return () => `id${++i}`; })(),
    });
    const porPlaca = Object.fromEntries(plan.vehiclesToUpsert.map((v) => [v.plate, v.status]));
    assert.equal(porPlaca["TCA8A29"], "Sem comunicação");
    assert.match(porPlaca["OWL4065"], /dia\(s\) sem comunicação/);
    assert.equal(plan.warnings.filter((w) => w.severity === "error").length, 0);
    assert.ok(plan.skipped.some((s) => /inativo/.test(s.reason) && /equip\.xlsx/.test(s.reason)));
  });
});
