import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  lerListaDias, lembretesDevidos, avisosVencimento, rascunhoDaProposta, conferirValor, valorMensalVigente,
  acumulado12, percentualReajuste, proximoAniversario, reajustesPendentes, mensagemReajuste, nomeArquivoContrato,
} from "./contratos-automacao";

const HOJE = "2026-11-22";

describe("listas de dias", () => {
  it("lê, ordena e ignora lixo", () => {
    assert.deepEqual(lerListaDias("7, 3; 3 x 0 15"), [3, 7, 15]);
  });
});

describe("lembrete de assinatura", () => {
  const C = (enviado: string, feitos = 0, status = "enviado") => ({ id: enviado, status, enviado_em: `${enviado}T12:00:00Z`, lembretes_enviados: feitos });
  it("manda na etapa certa e não repete", () => {
    const r = lembretesDevidos([C("2026-11-19"), C("2026-11-20"), C("2026-11-14", 1), C("2026-11-17", 1), C("2026-11-01", 2), C("2026-11-01", 0, "assinado")], [3, 7], HOJE);
    assert.deepEqual(r.map((x) => [x.contrato.id, x.etapa]), [["2026-11-19", 1], ["2026-11-14", 2]]);
  });
});

describe("vencimento", () => {
  const C = (inicio: string, avisos: Record<string, string> = {}, extra: object = {}) => ({ id: inicio, status: "assinado", vigencia_inicio: inicio, vigencia_meses: 12, renovacao_automatica: false, avisos_enviados: avisos, ...extra });
  it("avisa uma vez por limite e junta os limites já passados", () => {
    // fim 2027-01-10 → faltam 49 dias: dentro de 60, fora de 30
    const r = avisosVencimento([C("2026-01-10")], [60, 30], HOJE);
    assert.deepEqual(r[0].chaves, ["venc:2027-01-10:60"]);
    // fim 2026-12-10 → faltam 18: os dois limites, um aviso só
    const r2 = avisosVencimento([C("2025-12-10")], [30, 60], HOJE);
    assert.deepEqual(r2[0].chaves, ["venc:2026-12-10:60", "venc:2026-12-10:30"]);
    assert.equal(avisosVencimento([C("2025-12-10", { "venc:2026-12-10:60": "x", "venc:2026-12-10:30": "x" })], [60, 30], HOJE).length, 0);
  });
  it("pula encerrados e, se pedido, fornecedores", () => {
    assert.equal(avisosVencimento([C("2025-01-10")], [60], HOJE).length, 0);
    assert.equal(avisosVencimento([C("2026-01-10", {}, { categoria: "fornecedor" })], [60], HOJE, false).length, 0);
  });
});

describe("proposta aceita", () => {
  it("preenche cliente, valores e signatário", () => {
    const r = rascunhoDaProposta({
      title: "Frota X", client: { companyName: "Alfa Ltda", contactName: "Ana", phone: "31999990000", email: "ana@alfa.com", cnpj: "11.222.333/0001-44" },
      items: [{ name: "Rastreador", quantity: 10, monthlyValue: 59.9 }, { name: "", quantity: 1 }], totals: { activation: 1500, monthly: 599 },
    }, HOJE);
    assert.equal(r.cliente_documento, "11222333000144");
    assert.equal(r.dados.tipo_pessoa, "PJ");
    assert.equal(r.dados.valor_mensalidade, "599,00");
    assert.equal(r.dados.valor_implantacao, "1.500,00");
    assert.match(String(r.dados.remuneracao), /10× Rastreador/);
    assert.equal(r.signatario_nome, "Ana");
    assert.equal(r.valor_mensal, 599);
  });
});

describe("financeiro", () => {
  it("compara com tolerância", () => {
    assert.equal(conferirValor(1000, 980, 5).status, "ok");
    assert.equal(conferirValor(1000, 800, 5).status, "abaixo");
    assert.equal(conferirValor(1000, 1200, 5).status, "acima");
    assert.equal(conferirValor(null, 1200, 5).status, "sem_dados");
    assert.equal(conferirValor(1000, 800, 5).diferenca, -200);
  });
  it("valor vigente usa reajustado, contrato ou texto do rascunho", () => {
    assert.equal(valorMensalVigente({ valor_mensal_atual: 1100, valor_mensal: 1000 }), 1100);
    assert.equal(valorMensalVigente({ valor_mensal: 1000 }), 1000);
    assert.equal(valorMensalVigente({ dados: { valor_mensalidade: "R$ 1.234,56" } }), 1234.56);
    assert.equal(valorMensalVigente({}), null);
  });
});

describe("reajuste", () => {
  it("acumula 12 meses da série do Banco Central", () => {
    const serie = Array.from({ length: 14 }, (_, i) => ({ data: `01/${String((i % 12) + 1).padStart(2, "0")}/${2025 + Math.floor(i / 12)}`, valor: "0,50" }));
    const r = acumulado12(serie)!;
    assert.equal(r.pct, 6.17);
    assert.equal(r.ate, "2026-02");
    assert.equal(acumulado12(serie.slice(0, 5)), null);
  });
  it("percentual pelo índice ou fixo", () => {
    assert.equal(percentualReajuste({ reajuste_indice: "FIXO", reajuste_fixo_pct: 7, indices: {} }), 7);
    assert.equal(percentualReajuste({ reajuste_indice: "IPCA", reajuste_fixo_pct: 0, indices: { IPCA: { pct: 4.5, ate: "2026-10", atualizado_em: "" } } }), 4.5);
    assert.equal(percentualReajuste({ reajuste_indice: "IGPM", reajuste_fixo_pct: 0, indices: {} }), null);
  });
  it("aniversário e pendências", () => {
    assert.equal(proximoAniversario("2024-12-05", HOJE), "2026-12-05");
    const C = (inicio: string, reajustes: { data: string }[] = []) => ({ id: inicio, status: "assinado", vigencia_inicio: inicio, vigencia_meses: 12, renovacao_automatica: true, valor_mensal: 1000, reajustes });
    const r = reajustesPendentes([C("2024-12-05"), C("2025-03-01"), C("2025-11-01"), C("2024-12-05", [{ data: "2026-12-05" }])], HOJE, 30, 5);
    assert.deepEqual(r.map((x) => [x.contrato.id, x.data, x.valorNovo]), [["2025-11-01", "2026-11-01", 1050], ["2024-12-05", "2026-12-05", 1050]]);
  });
  it("mensagem com variáveis", () => {
    const t = mensagemReajuste("{contato}: {percentual} {indice} em {data}, {valor_atual} → {valor_novo} (nº {numero}, {cliente})", { contato: "Ana", cliente: "Alfa", numero: 12, percentual: 4.5, indice: "IPCA", data: "2026-12-05", valorAtual: 1000, valorNovo: 1045 });
    assert.match(t, /^Ana: 4,50% IPCA em 05\/12\/2026, R\$\s1\.000,00 → R\$\s1\.045,00 \(nº 12, Alfa\)$/);
  });
  it("nome do arquivo", () => {
    assert.equal(nomeArquivoContrato(7, "Açaí & Cia / Ltda"), "contrato-7-Acai-Cia-Ltda.pdf");
  });
});
