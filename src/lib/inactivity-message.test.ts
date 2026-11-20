import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldSendInactivityMessage, DEFAULT_INACTIVITY_MESSAGE } from "./inactivity-message";

const base = { enabled: true, message: DEFAULT_INACTIVITY_MESSAGE, isGroup: false, fromMe: false, sentAt: null, enabledAt: "2026-11-20T19:12:41Z", outOfHours: false };

describe("mensagem de inatividade", () => {
  it("texto padrão", () => {
    assert.equal(DEFAULT_INACTIVITY_MESSAGE, "Estou finalizando outro atendimento e já te atualizo por aqui, tudo bem?");
  });
  it("ativada: envia na primeira mensagem de conversa nova", () => assert.equal(shouldSendInactivityMessage(base), true));
  it("desativada: não envia", () => assert.equal(shouldSendInactivityMessage({ ...base, enabled: false }), false));
  it("não repete a cada mensagem do cliente", () => {
    assert.equal(shouldSendInactivityMessage({ ...base, sentAt: "2026-11-20T19:13:00Z" }), false);
  });
  it("conversa já aberta recebe uma vez depois de ligar a chave", () => {
    assert.equal(shouldSendInactivityMessage({ ...base, sentAt: "2026-11-20T18:47:59Z" }), true);
  });
  it("desligar e ligar de novo libera outra vez", () => {
    assert.equal(shouldSendInactivityMessage({ ...base, sentAt: "2026-11-20T19:13:00Z", enabledAt: "2026-11-20T20:00:00Z" }), true);
  });
  it("grupos ficam de fora", () => assert.equal(shouldSendInactivityMessage({ ...base, isGroup: true }), false));
  it("mensagem do próprio atendente não dispara", () => assert.equal(shouldSendInactivityMessage({ ...base, fromMe: true }), false));
  it("texto vazio não envia", () => assert.equal(shouldSendInactivityMessage({ ...base, message: "  " }), false));
  it("fora do horário não envia (vai o aviso de ausência)", () => assert.equal(shouldSendInactivityMessage({ ...base, outOfHours: true }), false));
});
