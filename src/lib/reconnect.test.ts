import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  detectHeaderRow, buildRowsFromMatrix, autoDetect, parseDaysOffline, getCriticality, normalizeClientKey,
  planImport, buildNotificationMessage, type VehicleRow,
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
