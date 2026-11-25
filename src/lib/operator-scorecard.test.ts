import { test } from "node:test";
import assert from "node:assert/strict";
import { comparacaoMedia, horasLogadas, montarBoletins, notaComposta, notaRelativa, PESOS_PADRAO, semanaDe } from "./operator-scorecard.ts";

test("nota relativa respeita o sentido e empates", () => {
  assert.equal(notaRelativa(10, [10, 20, 30], "menor"), 100);
  assert.equal(notaRelativa(30, [10, 20, 30], "menor"), 0);
  assert.equal(notaRelativa(30, [10, 20, 30], "maior"), 100);
  assert.equal(notaRelativa(20, [20, 20, 20], "maior"), 50);
  assert.equal(notaRelativa(5, [5], "maior"), 50);
});

test("nota composta renormaliza pesos das dimensões presentes", () => {
  assert.equal(notaComposta({ velocidade: 80, qualidade: 40 }, PESOS_PADRAO), Math.round((80 * 25 + 40 * 30) / 55));
  assert.equal(notaComposta({}, PESOS_PADRAO), null);
  assert.equal(notaComposta({ negocio: 90 }, PESOS_PADRAO), null);
});

test("boletins: fortes, a desenvolver e quadrante", () => {
  const b = montarBoletins([
    { operatorId: "a", operatorName: "Ana", valores: { tmpr: 60_000, resolvidos: 50, csat: 4.8, reabertura: 0.02 } },
    { operatorId: "b", operatorName: "Bia", valores: { tmpr: 600_000, resolvidos: 60, csat: 3.5, reabertura: 0.2 } },
    { operatorId: "c", operatorName: "Caio", valores: { tmpr: 300_000, resolvidos: 10, csat: 4.9, reabertura: 0.01 } },
  ]);
  const ana = b.find((x) => x.operatorId === "a")!, bia = b.find((x) => x.operatorId === "b")!, caio = b.find((x) => x.operatorId === "c")!;
  assert.equal(ana.notas.tmpr, 100);
  assert.ok(ana.fortes.includes("tmpr"));
  assert.ok(bia.aDesenvolver.includes("csat"));
  assert.equal(bia.quadrante, "Pressa");
  assert.equal(caio.quadrante, "Cuidadoso");
  assert.equal(ana.quadrante, "Referência");
});

test("comparação com a média usa o sentido da métrica", () => {
  assert.equal(comparacaoMedia(5, 10, "menor"), "melhor");
  assert.equal(comparacaoMedia(15, 10, "menor"), "pior");
  assert.equal(comparacaoMedia(10.2, 10, "maior"), "igual");
  assert.equal(comparacaoMedia(10, 10, "neutra"), null);
});

test("horas logadas e semana", () => {
  const h = horasLogadas([
    { user_id: "a", started_at: "2026-11-24T11:00:00Z", last_ping_at: "2026-11-24T12:30:00Z", ended_at: null },
    { user_id: "a", started_at: "2026-11-24T13:00:00Z", last_ping_at: "2026-11-24T13:10:00Z", ended_at: "2026-11-24T14:00:00Z" },
  ]);
  assert.equal(h.get("a"), 2.5);
  assert.equal(semanaDe("2026-11-26T15:00:00Z"), "2026-11-23");
});
