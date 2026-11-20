import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canFinalizeProtocol, ensureProtocolPrefix, isNoResponseDue, protocolAcceptsTest, protocolAfterTest, protocolPrefix, termActions } from "./technical-service-cycle";

describe("ciclo do serviço técnico", () => {
  it("cabeçalho da solicitação tem só protocolo e cliente", () => {
    assert.equal(protocolPrefix({ protocol: "11071", clientName: "Raja Aluguel" }), "Protocolo: #11071\nCliente: Raja Aluguel");
  });
  it("cabeçalho não pode ser removido nem duplicado", () => {
    const p = "Protocolo: #11071\nCliente: Raja Aluguel";
    assert.equal(ensureProtocolPrefix("trocar chip", p), `${p}\ntrocar chip`);
    assert.equal(ensureProtocolPrefix(`Protocolo: #1\nCliente: X\ntrocar chip`, p), `${p}\ntrocar chip`);
    assert.equal(ensureProtocolPrefix(`Protocolo #1 – antigo\ntrocar chip`, p), `${p}\ntrocar chip`);
    assert.equal(ensureProtocolPrefix("", p), p);
  });
  it("enviar solicitação só após aceite", () => {
    assert.equal(termActions("aceito", true).sendRequest, true);
    assert.equal(termActions("pendente", true).sendRequest, false);
  });
  it("recusa permite reenviar, outro termo ou encerrar", () => {
    const r = termActions("recusado", true);
    assert.ok(r.reissue && r.newTerm && r.closeByRefusal);
  });
  it("aviso de 8h sem resposta", () => {
    const now = new Date("2026-11-20T18:00:00Z");
    assert.equal(isNoResponseDue("2026-11-20T10:00:00Z", "pendente", now), true);
    assert.equal(isNoResponseDue("2026-11-20T10:01:00Z", "pendente", now), false);
    assert.equal(isNoResponseDue("2026-11-20T01:00:00Z", "aceito", now), false);
  });
  it("teste exige protocolo técnico aberto", () => {
    assert.notEqual(protocolAcceptsTest(null), null);
    assert.notEqual(protocolAcceptsTest({ status: "aberto", tech_stage: null }), null);
    assert.notEqual(protocolAcceptsTest({ status: "finalizado", tech_stage: "a_resolver" }), null);
    assert.equal(protocolAcceptsTest({ status: "aberto", tech_stage: "aguardando_agendamento" }), null);
  });
  it("teste parcial mantém protocolo; concluído finaliza", () => {
    assert.equal(protocolAfterTest("parcial").finalize, false);
    assert.deepEqual(protocolAfterTest("concluido"), { finalize: true, stage: "concluido" });
  });
  it("atendente não finaliza fora do fluxo; gestor com justificativa", () => {
    assert.equal(canFinalizeProtocol({ isManager: false, reason: "justificativa longa" }), false);
    assert.equal(canFinalizeProtocol({ isManager: true, reason: "curta" }), false);
    assert.equal(canFinalizeProtocol({ isManager: true, reason: "cliente pediu por telefone" }), true);
  });
});
