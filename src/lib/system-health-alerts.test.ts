import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { decidirAlertas, falhaDoGsystem, chamadaDoGsystem } from "./system-health-alerts";

const T = Date.parse("2026-11-23T12:00:00Z");
const ab = (key: string, metadata: object, minAtras = 10) => ({ id: key, key, opened_at: new Date(T - minAtras * 60_000).toISOString(), metadata });

describe("avisos da saúde do sistema", () => {
  it("só avisa na segunda verificação seguida", () => {
    const a1 = decidirAlertas({ problemas: ["integration_gsystem"], abertos: [], oscilaram: new Set(), limite: 2, agora: T });
    assert.deepEqual(a1.map((a) => [a.tipo, a.notificar]), [["abrir", false]]);
    const a2 = decidirAlertas({ problemas: ["integration_gsystem"], abertos: [ab("integration_gsystem", { streak: 1 })], oscilaram: new Set(), limite: 2, agora: T });
    assert.deepEqual(a2.map((a) => [a.tipo, a.notificar]), [["atualizar", true]]);
    const a3 = decidirAlertas({ problemas: ["integration_gsystem"], abertos: [ab("integration_gsystem", { streak: 2, notified: true })], oscilaram: new Set(), limite: 2, agora: T });
    assert.equal(a3[0].notificar, false);
  });
  it("falha de uma verificação só some sem aviso", () => {
    const r = decidirAlertas({ problemas: [], abertos: [ab("x", { streak: 1 })], oscilaram: new Set(), limite: 2, agora: T });
    assert.deepEqual(r.map((a) => [a.tipo, a.notificar]), [["fechar", false]]);
  });
  it("normalizado só depois de duas verificações boas", () => {
    const r1 = decidirAlertas({ problemas: [], abertos: [ab("x", { streak: 3, notified: true })], oscilaram: new Set(), limite: 2, agora: T });
    assert.deepEqual(r1.map((a) => [a.tipo, a.notificar]), [["atualizar", false]]);
    const r2 = decidirAlertas({ problemas: [], abertos: [ab("x", { streak: 3, notified: true, ok_streak: 1 })], oscilaram: new Set(), limite: 2, agora: T });
    assert.deepEqual(r2.map((a) => [a.tipo, a.notificar]), [["fechar", true]]);
  });
  it("problema que oscila espera durar antes de avisar de novo", () => {
    const os = new Set(["x"]);
    const r1 = decidirAlertas({ problemas: ["x"], abertos: [ab("x", { streak: 1 }, 20)], oscilaram: os, limite: 2, agora: T });
    assert.equal(r1[0].notificar, false);
    const r2 = decidirAlertas({ problemas: ["x"], abertos: [ab("x", { streak: 5 }, 70)], oscilaram: os, limite: 2, agora: T });
    assert.equal(r2[0].notificar, true);
  });
  it("limite 1 avisa na hora", () => {
    assert.equal(decidirAlertas({ problemas: ["x"], abertos: [], oscilaram: new Set(), limite: 1, agora: T })[0].notificar, true);
  });
});

describe("falhas do GSystem", () => {
  it("só conta falha real do serviço", () => {
    assert.equal(falhaDoGsystem({ status_code: 404 }), false);
    assert.equal(falhaDoGsystem({ status_code: 422 }), false);
    assert.equal(falhaDoGsystem({ status_code: 503 }), true);
    assert.equal(falhaDoGsystem({ status_code: 0 }), true);
    assert.equal(falhaDoGsystem({ status_code: 401 }), true);
    assert.equal(chamadaDoGsystem({ endpoint: "/rastreio/AA123BR" }), false);
    assert.equal(chamadaDoGsystem({ endpoint: "/messages" }), true);
  });
});
