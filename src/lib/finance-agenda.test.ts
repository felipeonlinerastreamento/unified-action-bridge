import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { inicioSemana, semana, montarAgenda, saldoEstimado, saldoProjetado, linhaLote, situacaoAgenda } from "./finance-agenda";

const L = (id: string, o: object) => ({ id, tipo: "pagar" as const, status: "aberto", valor: 100, vencimento: "2026-11-25", conta_bancaria_id: "itau", aprovacao: null, ...o });

describe("semana", () => {
  it("segunda a domingo", () => {
    assert.equal(inicioSemana("2026-11-22"), "2026-11-16"); // domingo
    assert.equal(inicioSemana("2026-11-23"), "2026-11-23"); // segunda
    assert.deepEqual(semana("2026-11-22", 1), { de: "2026-11-23", ate: "2026-11-29" });
  });
});

describe("agenda", () => {
  const lancs = [
    L("a", {}), L("b", { conta_bancaria_id: "inter", valor: 50 }), L("c", { conta_bancaria_id: null, valor: 30, data_programada: "2026-11-24" }),
    L("d", { aprovacao: "pendente", valor: 999 }), L("e", { aprovacao: "reprovado" }), L("f", { aprovacao: "aprovado", vencimento: "2026-11-20", valor: 70 }),
    L("g", { status: "pago" }), L("h", { tipo: "receber" }), L("i", { vencimento: "2026-12-10" }),
  ];
  it("agrupa por dia e conta, separa atrasadas e aguardando", () => {
    const r = montarAgenda(lancs, "2026-11-23", "2026-11-29", "2026-11-23");
    assert.deepEqual(r.dias.map((d) => [d.data, d.atrasado, d.total]), [["2026-11-23", true, 70], ["2026-11-24", false, 30], ["2026-11-25", false, 150]]);
    assert.deepEqual(r.dias[2].contas.map((c) => [c.contaId, c.total]), [["itau", 100], ["inter", 50]]);
    assert.equal(r.dias[1].contas[0].contaId, null);
    assert.deepEqual(r.aguardando.map((l) => l.id), ["d"]);
    assert.equal(r.reprovadas, 1);
    assert.equal(r.total, 250);
    assert.equal(r.totalAguardando, 999);
  });
  it("semana futura não puxa atrasadas", () => {
    const r = montarAgenda(lancs, "2026-11-30", "2026-12-06", "2026-11-23");
    assert.equal(r.dias.length, 0);
  });
  it("situação", () => {
    assert.equal(situacaoAgenda({ aprovacao: null }), "pronto");
    assert.equal(situacaoAgenda({ aprovacao: "pendente" }), "aguardando");
  });
});

describe("saldo", () => {
  const conta = { id: "itau", nome: "Itaú", saldo_inicial: 1000, saldo_inicial_data: "2026-11-01" };
  const lancs = [
    { id: "1", tipo: "receber" as const, status: "pago", valor: 500, vencimento: "2026-11-10", data_pagamento: "2026-11-10", conta_bancaria_id: "itau" },
    { id: "2", tipo: "pagar" as const, status: "pago", valor: 200, valor_pago: 210, vencimento: "2026-11-12", data_pagamento: "2026-11-12", conta_bancaria_id: "itau" },
    { id: "3", tipo: "pagar" as const, status: "pago", valor: 999, vencimento: "2026-10-30", data_pagamento: "2026-10-30", conta_bancaria_id: "itau" },
    { id: "4", tipo: "receber" as const, status: "aberto", valor: 300, vencimento: "2026-11-25", conta_bancaria_id: "itau" },
  ];
  it("estimado e projetado", () => {
    assert.equal(saldoEstimado(conta, lancs), 1290);
    const p = saldoProjetado(conta, lancs, ["2026-11-24", "2026-11-25"], new Map([["2026-11-24|itau", 100], ["2026-11-25|itau", 2000]]), "2026-11-23");
    assert.deepEqual(p, { "2026-11-24": 1190, "2026-11-25": -510 });
  });
});

describe("lote", () => {
  it("linha da planilha", () => {
    const r = linhaLote({ contraparte: "Alfa", valor: 10, vencimento: "2026-11-25", data_programada: "2026-11-24", linha_digitavel: "123" }, "Itaú");
    assert.equal(r["Pagar em"], "24/11/2026");
    assert.equal(r["Valor"], 10);
  });
});
