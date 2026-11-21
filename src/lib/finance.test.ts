import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  statusVisivel, parseValorBR, calcularDre, fluxoDeCaixa, chavePeriodo, parseOfx, parseCsvExtrato,
  sugerirConciliacao, dicasDoNomeArquivo, mesAnterior, calcularDreMensal, mesesDoAno, type FinLancamento, type FinCategoria,
} from "./finance";

const cats: FinCategoria[] = [
  { id: "r1", nome: "Mensalidades", tipo: "receita", grupo_dre: "Receita bruta" },
  { id: "d1", nome: "Chips", tipo: "despesa", grupo_dre: "Custo dos serviços" },
  { id: "d2", nome: "Aluguel", tipo: "despesa", grupo_dre: "Despesas administrativas" },
];
const L = (p: Partial<FinLancamento>): FinLancamento => ({ id: Math.random().toString(36).slice(2), tipo: "pagar", valor: 0, status: "aberto", ...p });

describe("statusVisivel", () => {
  it("aberto com vencimento passado vira vencido", () => {
    assert.equal(statusVisivel({ status: "aberto", vencimento: "2026-11-10" }, "2026-11-21"), "vencido");
  });
  it("vence hoje continua aberto; pago fica pago", () => {
    assert.equal(statusVisivel({ status: "aberto", vencimento: "2026-11-21" }, "2026-11-21"), "aberto");
    assert.equal(statusVisivel({ status: "pago", vencimento: "2026-01-01" }, "2026-11-21"), "pago");
  });
});

describe("parseValorBR", () => {
  it("formatos brasileiro e ponto decimal", () => {
    assert.equal(parseValorBR("1.850,56"), 1850.56);
    assert.equal(parseValorBR("R$ 1.000,00"), 1000);
    assert.equal(parseValorBR("1850.56"), 1850.56);
    assert.equal(parseValorBR("-45,90"), -45.9);
  });
});

describe("calcularDre", () => {
  it("agrupa por grupo do DRE, compara com o mês anterior e ignora cancelados", () => {
    const ls = [
      L({ tipo: "receber", valor: 10000, competencia: "2026-11-01", categoria_id: "r1" }),
      L({ valor: 1200, competencia: "2026-11-01", categoria_id: "d1" }),
      L({ valor: 800, competencia: "2026-11-15", categoria_id: "d1", status: "pago" }),
      L({ valor: 3000, competencia: "2026-11-01", categoria_id: "d2" }),
      L({ valor: 999, competencia: "2026-11-01", categoria_id: "d2", status: "cancelado" }),
      L({ tipo: "receber", valor: 9000, competencia: "2026-10-01", categoria_id: "r1" }),
      L({ valor: 2500, competencia: "2026-10-01", categoria_id: "d2" }),
    ];
    const dre = calcularDre(ls, cats, "2026-11-01");
    assert.equal(dre.receitaAtual, 10000);
    assert.equal(dre.despesaAtual, 5000);
    assert.equal(dre.resultadoAtual, 5000);
    assert.equal(dre.resultadoAnterior, 6500);
    const custo = dre.linhas.find((x) => x.grupo === "Custo dos serviços")!;
    assert.equal(custo.atual, 2000);
    assert.equal(dre.linhas[0].tipo, "receita");
  });
  it("sem categoria cai no grupo padrão pelo tipo", () => {
    const dre = calcularDre([L({ valor: 50, competencia: "2026-11-01" })], cats, "2026-11-01");
    assert.equal(dre.linhas[0].grupo, "Despesas sem categoria");
  });
  it("mesAnterior vira o ano", () => {
    assert.equal(mesAnterior("2026-01-01"), "2025-12-01");
  });
});

describe("fluxoDeCaixa", () => {
  it("pago entra na data de pagamento, aberto no vencimento, saldo acumula", () => {
    const ls = [
      L({ tipo: "receber", valor: 1000, vencimento: "2026-11-05", status: "pago", data_pagamento: "2026-11-03" }),
      L({ valor: 300, vencimento: "2026-11-03" }),
      L({ valor: 200, vencimento: "2026-11-10", status: "cancelado" }),
    ];
    const f = fluxoDeCaixa(ls, "dia", 100);
    assert.deepEqual(f, [{ periodo: "2026-11-03", entradas: 1000, saidas: 300, saldo: 800 }]);
  });
  it("semana começa na segunda-feira", () => {
    assert.equal(chavePeriodo("2026-11-22", "semana"), "2026-11-16"); // domingo
    assert.equal(chavePeriodo("2026-11-16", "semana"), "2026-11-16");
  });
});

describe("extrato", () => {
  it("lê OFX", () => {
    const ofx = "<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261130120000[-3:BRT]<TRNAMT>-1000.00<FITID>abc1<MEMO>PAG BOLETO SYSTEMSAT</STMTTRN><STMTTRN><DTPOSTED>20261201<TRNAMT>250,50<FITID>abc2<NAME>PIX RECEBIDO CLIENTE</STMTTRN></OFX>";
    const it2 = parseOfx(ofx);
    assert.equal(it2.length, 2);
    assert.deepEqual(it2[0], { data: "2026-11-30", valor: -1000, descricao: "PAG BOLETO SYSTEMSAT", documento: undefined, fit_id: "abc1" });
    assert.equal(it2[1].valor, 250.5);
  });
  it("lê CSV com ; e datas brasileiras", () => {
    const csv = "Data;Histórico;Valor\n30/11/2026;PAG BOLETO SYSTEMSAT;-1.000,00\n01/12/2026;PIX RECEBIDO;250,50\n";
    const r = parseCsvExtrato(csv);
    assert.equal(r.length, 2);
    assert.equal(r[0].data, "2026-11-30");
    assert.equal(r[0].valor, -1000);
  });
});

describe("sugerirConciliacao", () => {
  it("mesmo valor, sentido e data próxima; desempata pelo nome", () => {
    const cands = [
      L({ id: "a", valor: 1000, vencimento: "2026-11-30", contraparte: "YUV" }),
      L({ id: "b", valor: 1000, vencimento: "2026-11-30", contraparte: "SYSTEMSAT" }),
      L({ id: "c", tipo: "receber", valor: 1000, vencimento: "2026-11-30" }),
    ];
    const s = sugerirConciliacao({ data: "2026-11-30", valor: -1000, descricao: "PAG BOLETO SYSTEMSAT" }, cands);
    assert.equal(s?.lancamentoId, "b");
  });
  it("fora da janela ou já conciliado não sugere", () => {
    const cands = [L({ id: "a", valor: 50, vencimento: "2026-11-01" }), { ...L({ id: "b", valor: 50, vencimento: "2026-11-20" }), ja_conciliado: true }];
    assert.equal(sugerirConciliacao({ data: "2026-11-20", valor: -50, descricao: "" }, cands), null);
  });
});

describe("dicasDoNomeArquivo", () => {
  it("padrão dos arquivos da pasta de comprovantes", () => {
    assert.deepEqual(dicasDoNomeArquivo("SYSTEMSAT_boleto_3011.pdf"), { empresa: undefined, tipoDocumento: "boleto", contraparte: "SYSTEMSAT" });
    assert.equal(dicasDoNomeArquivo("DARF_INSS_OR_boleto_1911.pdf").empresa, "OR");
    assert.equal(dicasDoNomeArquivo("JIMI_out26_nf_2050_1.850,56.pdf").tipoDocumento, "nota_fiscal");
    assert.equal(dicasDoNomeArquivo("FELIPE_PRO_LABORE_OR_recibo_nov26.pdf").tipoDocumento, "recibo");
  });
});

describe("extrato por banco", () => {
  it("Bradesco: cabeçalho do banco, colunas Crédito/Débito e linha de saldo", () => {
    const csv = [
      "Extrato de: Agência: 1234 Conta: 56789-0",
      "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)",
      "29/11/2026;SALDO ANTERIOR;;;;10.000,00",
      "30/11/2026;PAGTO ELETRON COBRANCA SYSTEMSAT;123;;1.000,00;9.000,00",
      "30/11/2026;PIX RECEBIDO CLIENTE;456;350,00;;9.350,00",
    ].join("\n");
    const r = parseCsvExtrato(csv);
    assert.equal(r.length, 2);
    assert.equal(r[0].valor, -1000);
    assert.equal(r[1].valor, 350);
  });
  it("Inter: Data Lançamento;Histórico;Descrição;Valor;Saldo", () => {
    const csv = "Extrato Conta Corrente\nConta ;123\nData Lançamento;Histórico;Descrição;Valor;Saldo\n30/11/2026;Pix enviado;SYSTEMSAT;-1.000,00;5.000,00\n";
    const r = parseCsvExtrato(csv);
    assert.equal(r.length, 1);
    assert.equal(r[0].valor, -1000);
    assert.equal(r[0].data, "2026-11-30");
  });
  it("Itaú: data;lançamento;valor sem cabeçalho extra", () => {
    const r = parseCsvExtrato("data;lançamento;valor\n30/11/2026;TAR BANCARIA;-12,50\n");
    assert.equal(r[0].valor, -12.5);
  });
});

describe("calcularDreMensal", () => {
  it("competência x caixa por mês", () => {
    const ls = [
      L({ tipo: "receber", valor: 1000, competencia: "2026-10-01", status: "pago", data_pagamento: "2026-11-05", categoria_id: "r1" }),
      L({ valor: 300, competencia: "2026-11-01", categoria_id: "d1" }),
    ];
    const meses = mesesDoAno(2026);
    const comp = calcularDreMensal(ls, cats, meses, "competencia");
    assert.equal(comp.receitas[9], 1000); // outubro
    assert.equal(comp.despesas[10], 300); // novembro
    const caixa = calcularDreMensal(ls, cats, meses, "caixa");
    assert.equal(caixa.receitas[10], 1000); // recebido em novembro
    assert.equal(caixa.despesas[10], 0); // em aberto não entra no caixa
    assert.equal(caixa.resultado[10], 1000);
  });
});
