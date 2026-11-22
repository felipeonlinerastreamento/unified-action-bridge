import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  normalizarRegras, contarEquipamentos, contarServicos, competenciaDaCobranca, calcularEsperado, conferirCobranca,
  aumentoVsAnteriores, acharFornecedor, lerXmlNota, lerPlanilhaDda, casarDda, chaveDda,
} from "./finance-fornecedores";

describe("regras e contagens", () => {
  it("normaliza regras e descarta lixo", () => {
    const r = normalizarRegras([{ tipo: "fixo", valor: "100" }, { tipo: "por_chip", valor_unit: 9.9, filtro: " vivo " }, { tipo: "x" }, { tipo: "por_servico", precos: { instalacao: 80, retirada: "0" }, canal: "?" }]);
    assert.deepEqual(r, [
      { tipo: "fixo", descricao: undefined, valor: 100 },
      { tipo: "por_chip", descricao: undefined, valor_unit: 9.9, filtro: "vivo", minimo: undefined },
      { tipo: "por_servico", descricao: undefined, precos: { instalacao: 80 }, canal: "todos" },
    ]);
  });
  it("conta veículos e chips vinculados com filtro", () => {
    const raws = [
      { Status: "Vinculado", Chip: { Operadora: "Vivo" }, Equipamento: "J16" },
      { Status: "Vinculado", Chip: "8955 Claro" },
      { Status: "Vinculado", Chip: null },
      { Status: "Disponível", Chip: { Operadora: "Vivo" } },
    ];
    assert.equal(contarEquipamentos(raws, "veiculo"), 3);
    assert.equal(contarEquipamentos(raws, "veiculo", "j16"), 1);
    assert.equal(contarEquipamentos(raws, "chip"), 2);
    assert.equal(contarEquipamentos(raws, "chip", "vivo"), 1);
  });
  it("conta serviços técnicos do mês por canal", () => {
    const s = [
      { service_type: "instalacao", schedule_kind: "agendamento", concluido_em: "2026-10-05T10:00:00Z" },
      { service_type: "instalacao", schedule_kind: "terceiro", concluido_em: "2026-10-09T10:00:00Z" },
      { service_type: "retirada", schedule_kind: "solicitacao", concluido_em: "2026-10-20T10:00:00Z" },
      { service_type: "retirada", schedule_kind: "agendamento", concluido_em: "2026-11-01T10:00:00Z" },
    ];
    assert.deepEqual(contarServicos(s, "2026-10"), { instalacao: 2, retirada: 1, manutencao: 0 });
    assert.deepEqual(contarServicos(s, "2026-10", "terceiro"), { instalacao: 1, retirada: 0, manutencao: 0 });
    assert.deepEqual(contarServicos(s, "2026-10", "seu_instalador"), { instalacao: 1, retirada: 1, manutencao: 0 });
  });
  it("competência", () => {
    assert.equal(competenciaDaCobranca("2026-01-10"), "2025-12");
    assert.equal(competenciaDaCobranca("2026-01-10", "atual"), "2026-01");
    assert.equal(competenciaDaCobranca(null), null);
  });
});

describe("cobrança esperada e conferência", () => {
  const c = { veiculos: (f?: string) => (f ? 10 : 120), chips: () => 80, servicos: () => ({ instalacao: 5, retirada: 2, manutencao: 1 }) };
  it("soma componentes com memória e mínimo", () => {
    const r = calcularEsperado([
      { tipo: "fixo", valor: 300 },
      { tipo: "por_veiculo", valor_unit: 2.5, minimo: 150 },
      { tipo: "por_chip", valor_unit: 9.9 },
      { tipo: "por_servico", precos: { instalacao: 90, retirada: 60 }, canal: "terceiro" },
    ], c, "2026-10");
    assert.equal(r.total, 300 + 375 + 792 + 450 + 120);
    assert.equal(r.itens[1].quantidade, 150);
    assert.match(r.itens[1].fonte, /mínimo contratado 150/);
    assert.equal(r.itens.length, 5);
  });
  it("confere com tolerância", () => {
    assert.equal(conferirCobranca(1010, 1000, 2).status, "ok");
    assert.equal(conferirCobranca(1100, 1000, 2).status, "acima");
    assert.equal(conferirCobranca(900, 1000, 2).diferenca, -100);
    assert.equal(conferirCobranca(900, null, 2).status, "sem_regra");
  });
  it("aumento contra as cobranças anteriores", () => {
    assert.deepEqual(aumentoVsAnteriores(1200, [1000, 1000, 1000], 5), { media: 1000, pct: 20, aumentou: true });
    assert.equal(aumentoVsAnteriores(1020, [1000], 5)?.aumentou, false);
    assert.equal(aumentoVsAnteriores(1000, [], 5), null);
  });
});

describe("fornecedor", () => {
  const lista = [
    { id: "a", documento: "11222333000144", emails: ["cobranca@alfa.com.br"] },
    { id: "b", documento: null, emails: ["@beta.com"] },
    { id: "c", documento: "99888777000100", emails: ["gama.net"], ativo: false },
  ];
  it("acha por CNPJ, raiz do CNPJ, e-mail e domínio", () => {
    assert.equal(acharFornecedor(lista, "11.222.333/0001-44", null)?.id, "a");
    assert.equal(acharFornecedor(lista, "11222333000299", null)?.id, "a");
    assert.equal(acharFornecedor(lista, null, "Cobranca@Alfa.com.br")?.id, "a");
    assert.equal(acharFornecedor(lista, null, "nf@beta.com")?.id, "b");
    assert.equal(acharFornecedor(lista, "99888777000100", "x@gama.net"), null);
  });
});

describe("XML de nota", () => {
  it("NF-e com duplicatas", () => {
    const xml = `<nfeProc><NFe><infNFe Id="NFe31261111222333000144550010000012341000012345" versao="4.00"><ide><nNF>1234</nNF><dhEmi>2026-11-03T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>11222333000144</CNPJ><xNome>Alfa Ltda</xNome></emit><dest><CNPJ>55666777000188</CNPJ></dest>
      <total><ICMSTot><vNF>1500.50</vNF></ICMSTot></total><cobr><dup><nDup>001</nDup><dVenc>2026-12-03</dVenc><vDup>1500.50</vDup></dup></cobr></infNFe></NFe></nfeProc>`;
    const n = lerXmlNota(xml)!;
    assert.equal(n.tipo, "nfe");
    assert.equal(n.chave, "31261111222333000144550010000012341000012345");
    assert.equal(n.emitente_cnpj, "11222333000144");
    assert.equal(n.valor, 1500.5);
    assert.equal(n.emissao, "2026-11-03");
    assert.deepEqual(n.vencimentos, [{ data: "2026-12-03", valor: 1500.5 }]);
  });
  it("NFS-e padrão nacional e ABRASF", () => {
    const nac = `<NFSe><infNFSe Id="NFS3106200211222333000144000000000000526110000000001"><nNFSe>52</nNFSe><dhProc>2026-11-05T09:00:00-03:00</dhProc><emit><CNPJ>11222333000144</CNPJ><xNome>Plataforma X</xNome></emit><valores><vLiq>980.00</vLiq></valores><DPS><infDPS><toma><CNPJ>55666777000188</CNPJ></toma></infDPS></DPS></infNFSe></NFSe>`;
    const a = lerXmlNota(nac)!;
    assert.equal(a.tipo, "nfse"); assert.equal(a.valor, 980); assert.equal(a.numero, "52"); assert.equal(a.destinatario_cnpj, "55666777000188");
    const abrasf = `<CompNfse><Nfse><InfNfse><Numero>77</Numero><CodigoVerificacao>ABC123</CodigoVerificacao><DataEmissao>2026-11-02T08:00:00</DataEmissao><ValoresNfse><ValorLiquidoNfse>450,00</ValorLiquidoNfse></ValoresNfse><PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>11222333000144</Cnpj></CpfCnpj></IdentificacaoPrestador><RazaoSocial>Técnico Y</RazaoSocial></PrestadorServico></InfNfse></Nfse></CompNfse>`;
    const b = lerXmlNota(abrasf)!;
    assert.equal(b.valor, 450); assert.equal(b.emitente_nome, "Técnico Y"); assert.equal(b.numero, "77");
    assert.equal(lerXmlNota("<html>nada</html>"), null);
  });
});

describe("DDA", () => {
  const matriz = [
    ["Relatório DDA"],
    ["Beneficiário", "CNPJ/CPF", "Vencimento", "Valor (R$)", "Linha digitável"],
    ["Alfa Ltda", "11.222.333/0001-44", "10/12/2026", "1.500,50", "23793.38128 60000.000003 00000.000400 1 99990000150050"],
    ["Beta SA", "99.888.777/0001-00", "15/12/2026", "300,00", ""],
    ["", "", "", "", ""],
  ];
  it("lê a planilha do banco", () => {
    const { itens } = lerPlanilhaDda(matriz);
    assert.equal(itens.length, 2);
    assert.equal(itens[0].valor, 1500.5);
    assert.equal(itens[0].vencimento, "2026-12-10");
    assert.ok(itens[0].chave.startsWith("ld:2379"));
    assert.equal(itens[1].chave, "dv:99888777000100:2026-12-15:300.00");
  });
  it("casa com as contas a pagar e aponta divergências", () => {
    const { itens } = lerPlanilhaDda(matriz);
    const lancs = [
      { id: "1", tipo: "pagar", status: "aberto", valor: 1500.5, vencimento: "2026-12-10", linha_digitavel: "23793381286000000000300000000400199990000150050", documento_contraparte: "11222333000144", tipo_documento: "boleto" },
      { id: "2", tipo: "pagar", status: "aberto", valor: 777, vencimento: "2026-12-12", linha_digitavel: "1111", documento_contraparte: null, tipo_documento: "boleto" },
    ];
    const r = casarDda(itens, lancs);
    assert.deepEqual(r.casados.map((c) => c.lanc.id), ["1"]);
    assert.deepEqual(r.semCobranca.map((s) => s.beneficiario), ["Beta SA"]);
    assert.deepEqual(r.foraDoDda.map((l) => l.id), ["2"]);
  });
  it("chave sem linha", () => {
    assert.equal(chaveDda({ linha: null, documento: null, vencimento: "2026-01-01", valor: 10, beneficiario: "Ação Ltda" }), "dv:acao ltda:2026-01-01:10.00");
  });
});
