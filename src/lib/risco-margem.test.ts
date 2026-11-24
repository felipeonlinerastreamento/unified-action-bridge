import { test } from "node:test";
import assert from "node:assert/strict";
import { riscoCancelamento, planoRetencao, descricaoPlano, nivelDe } from "./risco-cancelamento";
import { margemCliente, valorAquisicao, clienteDoEquipamento, faixaMargem, CONFIG_MARGEM_PADRAO } from "./margem-cliente";

const base = {
  id: "1", nome: "Transportes X", documento: "12345678000199", receita_mensal: 1000,
  vencidas_valor: 0, vencidas_qtd: 0, classe: "B" as const,
};
const HOJE = "2026-11-24";

test("cliente sem sinais tem risco baixo", () => {
  const r = riscoCancelamento({ ...base, ultimo_contato_em: "2026-11-20" }, HOJE);
  assert.equal(r.nota, 0);
  assert.equal(r.nivel, "baixo");
  assert.deepEqual(planoRetencao(r), []);
});

test("soma os sinais e chega a risco alto", () => {
  const r = riscoCancelamento({
    ...base, ultimo_contato_em: "2026-11-20",
    vencidas_qtd: 2, vencidas_valor: 2500, vencidas_dias: 45,
    rc_placas_paradas: 3, rc_dias_max: 25, rc_notificadas: 1,
    ultimo_nps: 4, chamados_90d: 6, chamados_atrasados: 1,
  }, HOJE);
  // financeiro 18+5, comunicação 15+5, satisfação 20, chamados 14, atraso 8 = 85
  assert.equal(r.nota, 85);
  assert.equal(r.nivel, "alto");
  assert.equal(r.motivos[0].sinal, "financeiro");
  assert.equal(planoRetencao(r).length, 5);
  assert.match(descricaoPlano("Transportes X", r), /Risco de cancelamento 85\/100/);
});

test("teto de 100 e sem contato pela cadência", () => {
  const r = riscoCancelamento({
    ...base, ultimo_contato_em: "2026-06-01",
    vencidas_qtd: 5, vencidas_valor: 9000, vencidas_dias: 90,
    rc_placas_paradas: 5, rc_dias_max: 40, rc_notificadas: 2,
    ultimo_nps: 2, ultimo_sentimento: "negativo", chamados_90d: 12, chamados_atrasados: 4,
  }, HOJE);
  assert.equal(r.nota, 100);
  assert.ok(r.motivos.some((m) => m.sinal === "sem_contato" && m.pontos === 10));
  assert.equal(nivelDe(59), "medio");
  assert.equal(nivelDe(34), "baixo");
});

test("margem: chips, depreciação, visitas, atendimento e impostos", () => {
  const m = margemCliente({
    receita_mensal: 300,
    equipamentos: [{ valor_aquisicao: 360, com_chip: true }, { valor_aquisicao: null, com_chip: true }, { valor_aquisicao: 0, com_chip: false }],
    visitas_90d: 3, chamados_90d: 6,
  }, { ...CONFIG_MARGEM_PADRAO, imposto_pct: 10 });
  // chips 2×10=20; equip 360/36 + 250/36 + 250/36 = 23.89; visitas 3×120/3=120; atendimento 6×12/3=24; impostos 30
  assert.equal(m.chips, 20);
  assert.equal(m.equipamentos, 23.89);
  assert.equal(m.visitas, 120);
  assert.equal(m.atendimento, 24);
  assert.equal(m.impostos, 30);
  assert.equal(m.margem, 82.11);
  assert.equal(m.margem_pct, 27.4);
  assert.equal(m.veiculos, 3);
  assert.equal(faixaMargem(m), "saudavel");
  assert.equal(faixaMargem({ margem: -5, margem_pct: -2 }), "prejuizo");
  assert.equal(faixaMargem({ margem: 10, margem_pct: 12 }), "apertada");
});

test("valor de aquisição e cliente do equipamento", () => {
  assert.equal(valorAquisicao({ "Valor Aquisição": 189.9 }), 189.9);
  assert.equal(valorAquisicao({ "valor aquisicao": "1.250,50" }), 1250.5);
  assert.equal(valorAquisicao({ "Valor Aquisição": 0 }), null);
  assert.equal(valorAquisicao(null), null);
  assert.equal(clienteDoEquipamento({ Cliente: "Transportes X Ltda" }), clienteDoEquipamento({ Cliente: { Nome: "TRANSPORTES X" } }));
  assert.equal(clienteDoEquipamento({ Cliente: null }), "");
});
