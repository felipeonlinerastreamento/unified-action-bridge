import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarNegativacao, candidatosNegativacao, indicadoresNegativacao, somaDiasUteis, textoCartaAnuencia, type Negativacao, type LancNeg } from "./finance-negativacao";
import { montarInadimplencia } from "./finance-inadimplencia";

const HOJE = "2026-11-23"; // segunda-feira
const N = (p: Partial<Negativacao>): Negativacao => ({
  id: "n1", documento: "12345678000190", orgao: "serasa", situacao: "ativo", valor: 300,
  lancamento_ids: ["a", "b"], created_at: "2026-10-01T10:00:00Z", ...p,
});
const mapa = (xs: LancNeg[]) => new Map(xs.map((x) => [x.id, x]));

test("dias úteis pulam fim de semana", () => {
  assert.equal(somaDiasUteis("2026-11-20", 5), "2026-11-27"); // sexta + 5 úteis = sexta seguinte
  assert.equal(somaDiasUteis("2026-11-23", 1), "2026-11-24");
  assert.equal(somaDiasUteis("2026-11-21", 1), "2026-11-23"); // sábado → segunda
});

test("ativo com faturas em aberto continua ativo", () => {
  const a = avaliarNegativacao(N({}), mapa([{ id: "a", status: "aberto", valor: 100 }, { id: "b", status: "pago", valor: 200, data_pagamento: "2026-11-10" }]), HOJE);
  assert.equal(a.visivel, "ativo");
  assert.equal(a.valorAberto, 100);
  assert.equal(a.valorPago, 200);
});

test("quitado: prazo de baixa de 5 dias úteis e atraso", () => {
  const pago = mapa([{ id: "a", status: "pago", valor: 100, data_pagamento: "2026-11-20" }, { id: "b", status: "pago", valor: 200, data_pagamento: "2026-11-19" }]);
  const a = avaliarNegativacao(N({}), pago, HOJE);
  assert.equal(a.visivel, "quitado_baixar");
  assert.equal(a.dataQuitacao, "2026-11-20");
  assert.equal(a.prazoBaixa, "2026-11-27");
  assert.equal(a.diasParaPrazo, 4);
  const velho = mapa([{ id: "a", status: "pago", valor: 100, data_pagamento: "2026-11-02" }, { id: "b", status: "cancelado", valor: 200 }]);
  assert.equal(avaliarNegativacao(N({}), velho, HOJE).visivel, "baixa_atrasada");
  assert.equal(avaliarNegativacao(N({ situacao: "baixado" }), velho, HOJE).visivel, "baixado");
  // quitação informada à mão (acordo pago fora das faturas)
  const manual = avaliarNegativacao(N({ data_quitacao: "2026-11-23" }), mapa([{ id: "a", status: "aberto", valor: 100 }]), HOJE);
  assert.equal(manual.visivel, "quitado_baixar");
});

test("candidatos: atraso e valor mínimos, sem registro, sem promessa", () => {
  const lanc: any[] = [
    { id: "1", tipo: "receber", status: "aberto", valor: 500, vencimento: "2026-08-01", contraparte: "A", documento_contraparte: "12345678000190" },
    { id: "2", tipo: "receber", status: "aberto", valor: 500, vencimento: "2026-08-01", contraparte: "B", documento_contraparte: "11111111000111" },
    { id: "3", tipo: "receber", status: "aberto", valor: 50, vencimento: "2026-08-01", contraparte: "C", documento_contraparte: "22222222000122" },
    { id: "4", tipo: "receber", status: "aberto", valor: 500, vencimento: "2026-11-10", contraparte: "D", documento_contraparte: "33333333000133" },
  ];
  const lista = montarInadimplencia(lanc, [], [], HOJE);
  const c = candidatosNegativacao(lista, [N({ documento: "12345678000190" })], HOJE, { diasMinimo: 60, valorMinimo: 100 });
  assert.deepEqual(c.map((x) => x.documento), ["11111111000111"]);
});

test("indicadores", () => {
  const l = mapa([{ id: "a", status: "aberto", valor: 100 }, { id: "b", status: "pago", valor: 200, data_pagamento: "2026-11-02" }, { id: "c", status: "pago", valor: 50, data_pagamento: "2026-11-02" }]);
  const i = indicadoresNegativacao([N({ lancamento_ids: ["a", "b"], custo: 12 }), N({ id: "n2", orgao: "protesto", lancamento_ids: ["c"], valor: 50 })], l, HOJE);
  assert.equal(i.emVigor, 2);
  assert.equal(i.valorEmVigor, 100);
  assert.equal(i.porOrgao.serasa.qtd, 1);
  assert.equal(i.baixasAtrasadas, 1);
  assert.equal(i.recuperado, 250);
  assert.equal(i.custos, 12);
});

test("carta de anuência", () => {
  const t = textoCartaAnuencia({
    credor: { nome: "Online Rastreamento Ltda", cnpj: "22632188000123", cidade: "Belo Horizonte" },
    devedor: { nome: "Cliente X Ltda", documento: "12345678000190" },
    neg: { protocolo: "123", cartorio: "2º Tabelionato de Protesto", cidade_uf: "Belo Horizonte/MG", data_inclusao: "2026-10-05", valor: 300 },
    faturas: [{ vencimento: "2026-08-01", valor: 300, numero: "99" }], hoje: HOJE,
  });
  assert.match(t.paragrafos[0], /2º Tabelionato de Protesto de Belo Horizonte\/MG/);
  assert.match(t.paragrafos[1], /22\.632\.188\/0001-23/);
  assert.match(t.paragrafos[1], /CNPJ sob o nº 12\.345\.678\/0001-90/);
  assert.match(t.paragrafos[2], /protocolo nº 123, em 05\/10\/2026/);
  assert.equal(t.local, "Belo Horizonte, 23 de novembro de 2026.");
});
