import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildProposalUrl,
  canRespond,
  computeTotals,
  computeValidUntil,
  formatCpf,
  isValidCpf,
  maskCpf,
  renderProposalTemplate,
  resolveDecisionStage,
} from "./crm-proposal";

const stages = [
  { id: "prospec", position: 1, is_active: true },
  { id: "proposta", position: 3, is_active: true },
  { id: "ganho", position: 5, is_active: true, is_won: true },
  { id: "perdido", position: 6, is_active: true, is_lost: true },
];

describe("Proposta enviada ao cliente", () => {
  it("aceite move para a etapa ganha quando nenhuma etapa foi configurada", () => {
    assert.equal(resolveDecisionStage("accept", null, stages), "ganho");
  });

  it("recusa move para a etapa perdida quando nenhuma etapa foi configurada", () => {
    assert.equal(resolveDecisionStage("reject", null, stages), "perdido");
  });

  it("usa a etapa definida em Configurações > CRM quando ela existe", () => {
    assert.equal(resolveDecisionStage("accept", "proposta", stages), "proposta");
  });

  it("ignora etapa configurada que foi desativada", () => {
    const withInactive = [...stages, { id: "antiga", position: 7, is_active: false, is_won: true }];
    assert.equal(resolveDecisionStage("accept", "antiga", withInactive), "ganho");
  });

  it("cliente não responde proposta vencida nem já respondida", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    assert.equal(canRespond("pending", "2026-11-20T00:00:00Z", now), true);
    assert.equal(canRespond("pending", "2026-11-17T00:00:00Z", now), false);
    assert.equal(canRespond("accepted", "2026-11-20T00:00:00Z", now), false);
    assert.equal(canRespond("rejected", null, now), false);
  });

  it("validade padrão soma os dias configurados à data de envio", () => {
    const issued = new Date("2026-11-18T12:00:00Z");
    assert.equal(computeValidUntil(issued, 15).toISOString(), "2026-12-03T12:00:00.000Z");
  });

  it("totais multiplicam quantidade pelos valores de ativação e mensalidade", () => {
    const t = computeTotals([
      { quantity: 2, activationValue: 150, monthlyValue: 59.9 },
      { quantity: 1, activationValue: 0, monthlyValue: 20 },
    ]);
    assert.deepEqual(t, { activation: 300, monthly: 139.8 });
  });

  it("mensagem substitui marcadores e mantém o link", () => {
    const msg = renderProposalTemplate("Olá {contato}, proposta {numero}: {link}", {
      contato: "Maria",
      numero: "#12",
      link: "https://x.app/proposta/abc",
    });
    assert.equal(msg, "Olá Maria, proposta #12: https://x.app/proposta/abc");
  });

  it("link público fica em /proposta/<token> sem barra duplicada", () => {
    assert.equal(buildProposalUrl("https://x.app/", "tok"), "https://x.app/proposta/tok");
  });
});

describe("CPF para abrir o link da proposta", () => {
  it("aceita CPF válido com ou sem pontuação", () => {
    assert.equal(isValidCpf("529.982.247-25"), true);
    assert.equal(isValidCpf("52998224725"), true);
  });

  it("recusa CPF com dígito verificador errado, incompleto ou repetido", () => {
    assert.equal(isValidCpf("529.982.247-24"), false);
    assert.equal(isValidCpf("5299822472"), false);
    assert.equal(isValidCpf("111.111.111-11"), false);
    assert.equal(isValidCpf(""), false);
  });

  it("formata enquanto digita e mascara para exibição", () => {
    assert.equal(formatCpf("52998224725"), "529.982.247-25");
    assert.equal(formatCpf("5299"), "529.9");
    assert.equal(maskCpf("52998224725"), "529.***.***-25");
  });
});
