import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  listaDeFaturas, clienteDoGsystem, formatarDocumento, statusDaFatura, categoriaDaFatura, converterFatura, atualizacaoDeFatura, deveImportar,
} from "./finance-gsystem";

const cli = { key: "c1", documento: "22632188000123", nome: "Cliente X" };

describe("listaDeFaturas", () => {
  it("aceita array puro ou embrulhado", () => {
    assert.equal(listaDeFaturas([{ a: 1 }]).length, 1);
    assert.equal(listaDeFaturas({ Items: [{}, {}] }).length, 2);
    assert.equal(listaDeFaturas({ data: [{}] }).length, 1);
    assert.equal(listaDeFaturas(null).length, 0);
  });
});

describe("clienteDoGsystem", () => {
  it("pega documento só com números e ignora quem não tem CPF/CNPJ válido", () => {
    assert.deepEqual(clienteDoGsystem({ Key: 9, CNPJ: "22.632.188/0001-23", Nome: "Online" }), { key: "9", documento: "22632188000123", nome: "Online" });
    assert.equal(clienteDoGsystem({ Nome: "Sem doc" }), null);
    assert.equal(clienteDoGsystem({ CPF: "123" }), null);
  });
  it("formata documento", () => {
    assert.equal(formatarDocumento("22632188000123"), "22.632.188/0001-23");
    assert.equal(formatarDocumento("12345678901"), "123.456.789-01");
  });
});

describe("statusDaFatura", () => {
  it("reconhece pago, cancelado e aberto", () => {
    assert.equal(statusDaFatura({ SituacaoDescricao: "Paga" }), "pago");
    assert.equal(statusDaFatura({ Status: "Liquidado" }), "pago");
    assert.equal(statusDaFatura({ Situacao: "Cancelada" }), "cancelado");
    assert.equal(statusDaFatura({ Situacao: "Em aberto" }), "aberto");
    assert.equal(statusDaFatura({ Situacao: "Não pago" }), "aberto");
    assert.equal(statusDaFatura({ Situacao: "A pagar" }), "aberto");
  });
  it("data de pagamento sem status também é paga", () => {
    assert.equal(statusDaFatura({ DataPagamento: "2026-11-05T00:00:00" }), "pago");
  });
});

describe("categoriaDaFatura", () => {
  it("instalação/serviço x mensalidade", () => {
    assert.equal(categoriaDaFatura("Taxa de Instalação"), "Receita de instalação e serviços");
    assert.equal(categoriaDaFatura("Visita técnica"), "Receita de instalação e serviços");
    assert.equal(categoriaDaFatura("Mensalidade 11/2026"), "Receita de mensalidades");
    assert.equal(categoriaDaFatura(null), "Receita de mensalidades");
  });
});

describe("converterFatura", () => {
  it("converte fatura paga com id", () => {
    const f = converterFatura({ Key: 55, NumeroDocumento: "123", Valor: "89,90", DataVencimento: "2026-11-10T00:00:00", DataPagamento: "11/11/2026", ValorPago: 91.5, SituacaoDescricao: "Paga", Descricao: "Mensalidade" }, cli)!;
    assert.equal(f.chave, "gs:55");
    assert.equal(f.valor, 89.9);
    assert.equal(f.vencimento, "2026-11-10");
    assert.equal(f.status, "pago");
    assert.equal(f.dataPagamento, "2026-11-11");
    assert.equal(f.valorPago, 91.5);
    assert.equal(f.categoria, "Receita de mensalidades");
  });
  it("paga sem data nem valor pago usa vencimento e valor", () => {
    const f = converterFatura({ Id: 1, Valor: 100, Vencimento: "2026-10-05", Status: "Quitada" }, cli)!;
    assert.equal(f.dataPagamento, "2026-10-05");
    assert.equal(f.valorPago, 100);
  });
  it("sem id usa cliente + número + valor; sem valor não importa", () => {
    const f = converterFatura({ Numero: "A7", Valor: 50, Vencimento: "2026-12-01" }, cli)!;
    assert.equal(f.chave, "gs:22632188000123:A7:50.00");
    assert.equal(f.status, "aberto");
    assert.equal(f.dataPagamento, null);
    assert.equal(converterFatura({ Id: 2, Valor: 0 }, cli), null);
  });
});

describe("atualizacaoDeFatura", () => {
  const base = { status: "aberto", valor: 100, vencimento: "2026-11-10", data_pagamento: null, valor_pago: null };
  const fat = (p: any) => ({ chave: "gs:1", numero: "1", valor: 100, vencimento: "2026-11-10", emissao: null, status: "aberto", dataPagamento: null, valorPago: null, descricao: null, linhaDigitavel: null, link: null, categoria: "Receita de mensalidades", ...p }) as any;
  it("sem mudança devolve null", () => {
    assert.equal(atualizacaoDeFatura(base, fat({})), null);
  });
  it("baixa no GSystem vira recebido", () => {
    assert.deepEqual(atualizacaoDeFatura(base, fat({ status: "pago", dataPagamento: "2026-11-09", valorPago: 100 })), { status: "pago", data_pagamento: "2026-11-09", valor_pago: 100 });
  });
  it("não desfaz baixa feita no Financeiro quando o GSystem ainda mostra aberto", () => {
    assert.equal(atualizacaoDeFatura({ ...base, status: "pago", data_pagamento: "2026-11-08", valor_pago: 100 }, fat({})), null);
  });
  it("valor e vencimento acompanham o GSystem", () => {
    assert.deepEqual(atualizacaoDeFatura(base, fat({ valor: 120, vencimento: "2026-11-15" })), { valor: 120, vencimento: "2026-11-15" });
  });
});

describe("deveImportar", () => {
  it("aberto sempre; pago só nos últimos 12 meses", () => {
    assert.equal(deveImportar({ status: "aberto", vencimento: "2020-01-10", dataPagamento: null }, "2026-11-21"), true);
    assert.equal(deveImportar({ status: "pago", vencimento: "2025-11-01", dataPagamento: null }, "2026-11-21"), true);
    assert.equal(deveImportar({ status: "pago", vencimento: "2025-10-31", dataPagamento: null }, "2026-11-21"), false);
    assert.equal(deveImportar({ status: "cancelado", vencimento: null, dataPagamento: null }, "2026-11-21"), false);
    assert.equal(deveImportar({ status: "pago", vencimento: "2025-01-01", dataPagamento: null }, "2026-01-05"), true);
  });
});

it("fatura que sumiu da lista de abertas do GSystem é dada como baixada (só vencidas ou do mês)", async () => {
  const { faturasBaixadasNoGsystem, respostaDeFaturasConfiavel } = await import("./finance-gsystem");
  const nossas = [
    { id: "a", gsystem_fatura_key: "gs:1", vencimento: "2026-10-10" }, // sumiu → baixada
    { id: "b", gsystem_fatura_key: "gs:2", vencimento: "2026-11-10" }, // ainda veio → aberta
    { id: "c", gsystem_fatura_key: "gs:3", vencimento: "2026-12-10" }, // futura sumida → não mexe
    { id: "d", gsystem_fatura_key: "gs:4", vencimento: "2026-11-30" }, // do mês, sumiu → baixada
  ];
  assert.deepEqual(faturasBaixadasNoGsystem(nossas, new Set(["gs:2"]), "2026-11-24"), ["a", "d"]);
  assert.equal(respostaDeFaturasConfiavel([]), true);
  assert.equal(respostaDeFaturasConfiavel({ Items: [] }), true);
  assert.equal(respostaDeFaturasConfiavel({ success: true }), false);
  assert.equal(respostaDeFaturasConfiavel(null), false);
});
