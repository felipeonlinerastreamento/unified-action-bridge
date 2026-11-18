import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedServiceTypes,
  canSendToScheduling,
  categoryRequiresTerm,
  missingChecklistItems,
  normalizeChecklistConfig,
  schedulingGate,
  statusAfterDecision,
} from "./technical-terms";

test("manutenção exige os 4 itens do checklist antes de enviar", () => {
  const required = normalizeChecklistConfig(undefined, "manutencao");
  assert.deepEqual(required, [
    "Solicitou reset chip",
    "Enviou reset SMS (com ignição ligada)",
    "Reconfigurar equipamento",
    "Conferir pacote de dados",
  ]);
  const filled = required.map((label, i) => ({ label, checked: i !== 2 }));
  assert.deepEqual(missingChecklistItems(required, filled), ["Reconfigurar equipamento"]);
});

test("retirada exige conferir localização e ID do equipamento", () => {
  const required = normalizeChecklistConfig(undefined, "retirada");
  assert.deepEqual(missingChecklistItems(required, []), ["Conferir localização com agendamento", "Conferir ID equipamento"]);
});

test("instalação não tem checklist: só comunicado e aceite", () => {
  assert.deepEqual(missingChecklistItems(normalizeChecklistConfig(undefined, "instalacao"), []), []);
});

test("atendente só abre solicitação na Agenda com termo aceito", () => {
  assert.equal(schedulingGate({ isManager: false }).allowed, false);
  assert.equal(schedulingGate({ isManager: false, termStatus: "pendente" }).allowed, false);
  assert.equal(schedulingGate({ isManager: false, termStatus: "recusado" }).allowed, false);
  assert.equal(schedulingGate({ isManager: false, termStatus: "aceito" }).allowed, true);
});

test("termo já enviado não pode ser agendado de novo, nem por gestor", () => {
  assert.equal(schedulingGate({ isManager: true, termStatus: "enviada" }).allowed, false);
  assert.equal(canSendToScheduling("enviada"), false);
  assert.equal(canSendToScheduling("aceito"), true);
});

test("admin/gestor pode abrir solicitação sem termo (contingência)", () => {
  assert.equal(schedulingGate({ isManager: true }).allowed, true);
});

test("aceite vai para Aceitos e recusa para Recusados (sem expiração)", () => {
  assert.equal(statusAfterDecision("accept"), "aceito");
  assert.equal(statusAfterDecision("reject"), "recusado");
});

test("categoria Serviço Técnico deixa escolher o tipo; categoria fixa restringe", () => {
  assert.equal(categoryRequiresTerm("none"), false);
  assert.equal(categoryRequiresTerm("escolher"), true);
  assert.deepEqual(allowedServiceTypes("escolher"), ["instalacao", "manutencao", "retirada"]);
  assert.deepEqual(allowedServiceTypes("retirada"), ["retirada"]);
});
