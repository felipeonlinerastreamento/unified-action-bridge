import { test } from "node:test";
import assert from "node:assert/strict";
import { converterParcela, ehDuplicataGsystem, janelasImportacao, somarResumo } from "./finance-bomcontrole";

const base = {
  IdMovimentacaoFinanceiraParcela: 123,
  Debito: true,
  DataVencimento: "2026-03-10T00:00:00",
  DataCompetencia: "2026-02-15T00:00:00",
  DataQuitacao: null,
  Valor: -1500.5,
  NomeFormaPagamento: "Boleto",
  NomeTipoMovimentacao: "Despesa",
  Nome: "Plataforma",
  NumeroParcela: 1,
  QuantidadeParcela: 1,
  NomeCategoriaFinanceira: "Plataformas e software",
  NomeContaFinanceira: "Itaú",
  NomeClienteFornecedor: "SYSTEMSAT LTDA",
  DocumentoClienteFornecedor: "12.345.678/0001-90",
  DocumentoEmpresa: "11.222.333/0001-44",
};

test("converte despesa em aberto", () => {
  const l = converterParcela(base)!;
  assert.equal(l.tipo, "pagar");
  assert.equal(l.valor, 1500.5);
  assert.equal(l.status, "aberto");
  assert.equal(l.vencimento, "2026-03-10");
  assert.equal(l.competencia, "2026-02-01");
  assert.equal(l.documento, "12345678000190");
  assert.equal(l.empresaDocumento, "11222333000144");
  assert.match(l.observacao!, /Bom Controle/);
});

test("quitada vira paga e receita vira receber; parcelas no nome", () => {
  const l = converterParcela({ ...base, Debito: false, DataQuitacao: "2026-03-09T12:00:00", QuantidadeParcela: 3, NumeroParcela: 2 })!;
  assert.equal(l.tipo, "receber");
  assert.equal(l.status, "pago");
  assert.equal(l.dataPagamento, "2026-03-09");
  assert.equal(l.valorPago, 1500.5);
  assert.equal(l.descricao, "Plataforma (2/3)");
});

test("ignora transferência, valor zero e sem id", () => {
  assert.equal(converterParcela({ ...base, NomeTipoMovimentacao: "Transferência" }), null);
  assert.equal(converterParcela({ ...base, Valor: 0, ValorDefinitivo: true }), null);
  assert.equal(converterParcela({ ...base, IdMovimentacaoFinanceiraParcela: null }), null);
  assert.equal(converterParcela({ ...base, DataQuitacao: "0001-01-01T00:00:00" })!.status, "aberto");
});

test("recebível do GSystem não duplica", () => {
  const l = converterParcela({ ...base, Debito: false, Valor: 199.9 })!;
  const g = [{ documento: "12.345.678/0001-90", vencimento: "2026-03-12", valor: 199.9 }];
  assert.equal(ehDuplicataGsystem(l, g), true);
  assert.equal(ehDuplicataGsystem(l, [{ ...g[0], vencimento: "2026-03-30" }]), false);
  assert.equal(ehDuplicataGsystem(l, [{ ...g[0], valor: 250 }]), false);
  assert.equal(ehDuplicataGsystem({ ...l, tipo: "pagar" }, g), false);
});

test("janelas: 12 meses atrás até 12 à frente", () => {
  const j = janelasImportacao("2026-11-22");
  assert.equal(j.length, 25);
  assert.deepEqual(j[0], { de: "2025-11-01", ate: "2025-11-30", mes: "2025-11" });
  assert.equal(j[24].ate, "2027-11-30");
  assert.equal(j.find((x) => x.mes === "2026-02")!.ate, "2026-02-28");
});

test("resumo por mês", () => {
  const l = converterParcela(base)!;
  const r = somarResumo({}, [{ l, situacao: "novo" }, { l, situacao: "existente" }, { l: { ...l, tipo: "receber" }, situacao: "gsystem" }], "2026-03");
  assert.equal(r["2026-03"].pagarQtd, 2);
  assert.equal(r["2026-03"].pagarTotal, 3001);
  assert.equal(r["2026-03"].jaImportados, 1);
  assert.equal(r["2026-03"].ignoradosGsystem, 1);
});
