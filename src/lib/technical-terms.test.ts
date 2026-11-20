import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allowedServiceTypes,
  categoryRequirementOptions,
  serviceTypeLabel,
  slugifyTermKey,
  termDeletionAction,
  validateTermType,
  canSendToScheduling,
  categoryRequiresTerm,
  missingChecklistItems,
  normalizeChecklistConfig,
  schedulingGate,
  statusAfterDecision,
  FIXED_SERVICE_TYPES,
  isFixedServiceType,
  defaultTermFor,
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

// ---- Tipos de termo cadastráveis (Configurações > CRM) ----

test("categoria 'escolher' oferece todos os tipos ativos do catálogo, inclusive novos", () => {
  assert.deepEqual(allowedServiceTypes("escolher", ["instalacao", "troca_equipamento"]), ["instalacao", "troca_equipamento"]);
});

test("categoria que exige um tipo novo oferece só esse tipo", () => {
  assert.deepEqual(allowedServiceTypes("troca_equipamento", ["instalacao", "troca_equipamento"]), ["troca_equipamento"]);
});

test("'Exige termo' das categorias lista os tipos ativos e esconde os inativos", () => {
  const opts = categoryRequirementOptions([
    { key: "instalacao", label: "Instalação", is_active: true },
    { key: "troca_equipamento", label: "Troca de equipamento", is_active: true },
    { key: "vistoria", label: "Vistoria", is_active: false },
  ]).map((o) => o.value);
  assert.deepEqual(opts, ["none", "instalacao", "troca_equipamento", "escolher"]);
});

test("novo tipo ganha identificador sem acentos e sem repetir os existentes", () => {
  assert.equal(slugifyTermKey("Troca de equipamento"), "troca_de_equipamento");
  assert.equal(slugifyTermKey("Instalação", ["instalacao"]), "instalacao_2");
});

test("mensagens de WhatsApp e e-mail precisam do link do aceite", () => {
  const base = { label: "Vistoria", title: "Termo", body: "Texto", whatsapp_template: "Acesse {link}", email_subject: "Assunto", email_template: "Veja {link}" };
  assert.equal(validateTermType(base), null);
  assert.match(String(validateTermType({ ...base, whatsapp_template: "Sem link" })), /WhatsApp/);
  assert.match(String(validateTermType({ ...base, email_template: "Sem link" })), /e-mail/);
});

test("excluir termo já usado em chamado apenas inativa", () => {
  assert.equal(termDeletionAction({ usedInTerms: true, requiredByCategories: [] }), "inactivate");
});

test("excluir termo nunca usado exclui de vez", () => {
  assert.equal(termDeletionAction({ usedInTerms: false, requiredByCategories: [] }), "delete");
});

test("termo exigido por categoria não pode ser excluído", () => {
  assert.equal(termDeletionAction({ usedInTerms: false, requiredByCategories: ["Serviço Técnico"] }), "block");
});

test("termo enviado mostra o nome do serviço da época do envio", () => {
  assert.equal(serviceTypeLabel("instalacao", [{ key: "instalacao", label: "Instalação nova" }], "Instalação"), "Instalação");
});

// ---- Tipo de serviço fixo + termo de aceite independente ----

test("tipo de serviço tem sempre e somente Instalação, Retirada e Manutenção", () => {
  assert.deepEqual(FIXED_SERVICE_TYPES.map((t) => t.label), ["Instalação", "Retirada", "Manutenção"]);
  assert.equal(isFixedServiceType("termo_teste"), false);
  assert.equal(isFixedServiceType("retirada"), true);
});

const catalog = [
  { key: "instalacao", is_active: true, default_service_type: "instalacao" as const },
  { key: "manutencao_frota", is_active: true, default_service_type: "manutencao" as const },
  { key: "manutencao", is_active: true, default_service_type: null },
  { key: "retirada_antiga", is_active: false, default_service_type: "retirada" as const },
];

test("termo padrão do tipo escolhido vem pré-selecionado", () => {
  assert.equal(defaultTermFor("instalacao", catalog), "instalacao");
  assert.equal(defaultTermFor("manutencao", catalog), "manutencao_frota");
});

test("sem termo padrão ativo para o tipo, nenhum termo vem marcado", () => {
  assert.equal(defaultTermFor("retirada", catalog), "");
  assert.equal(defaultTermFor("", catalog), "");
});

test("categoria que exige um termo específico pré-seleciona esse termo", () => {
  assert.equal(defaultTermFor("instalacao", catalog, "manutencao"), "manutencao");
});
