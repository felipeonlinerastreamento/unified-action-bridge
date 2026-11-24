import { test } from "node:test";
import assert from "node:assert/strict";
import { lerRespostaOportunidade, deveCriar, notasOportunidade } from "./ia-oportunidades";

test("lê o JSON da IA mesmo com texto e bloco de código em volta", () => {
  const l = lerRespostaOportunidade('Segue:\n```json\n{"oportunidade": true, "tipo": "novos_veiculos", "titulo": "Mais 5 caminhões", "resumo": "Cliente vai comprar 5 caminhões", "valor_mensal": "R$ 450,00", "quantidade": 5, "proposta": "Olá! Podemos já deixar os 5 caminhões rastreados.", "confianca": 0.85, "trecho": "vou pegar mais 5 caminhões mês que vem"}\n```');
  assert.ok(l);
  assert.equal(l!.tipo, "novos_veiculos");
  assert.equal(l!.valor_mensal, 450);
  assert.equal(l!.quantidade, 5);
  assert.equal(deveCriar(l, 0.6), true);
  assert.match(notasOportunidade(l!, "#11150"), /protocolo #11150 \(confiança 85%\)/);
});

test("não cria sem oportunidade, com confiança baixa ou resposta inválida", () => {
  assert.equal(lerRespostaOportunidade("sem json"), null);
  assert.equal(lerRespostaOportunidade("{quebrado"), null);
  const nao = lerRespostaOportunidade('{"oportunidade": false, "confianca": 0.9, "resumo": "segunda via"}');
  assert.equal(deveCriar(nao, 0.6), false);
  const baixa = lerRespostaOportunidade('{"oportunidade": true, "tipo": "xyz", "confianca": 0.4, "resumo": "talvez"}');
  assert.equal(baixa!.tipo, "outro");
  assert.equal(deveCriar(baixa, 0.6), false);
  assert.equal(lerRespostaOportunidade('{"oportunidade": true, "valor_mensal": "1.250,50", "confianca": 2}')!.valor_mensal, 1250.5);
  assert.equal(lerRespostaOportunidade('{"oportunidade": true, "confianca": 2}')!.confianca, 1);
});
