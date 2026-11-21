import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  qualificacao, preencher, camposFaltando, montarDocumento, variaveisDe, textoParaHtml, fimVigencia, situacao,
  somaMeses, mascararCpf, mascararDestino, dataExtenso, mesesExtenso, textoVeiculos, gerarCodigo, type DadosContrato,
} from "./contratos";
import { MODELO_CONTRATO_LICENCIAMENTO, MODELO_TERMO_ADESAO } from "./contratos-modelos";

const D = (p: Partial<DadosContrato> = {}): DadosContrato => ({
  tipo_pessoa: "PJ", cliente_nome: "Transportes X Ltda", cliente_documento: "11222333000181", endereco: "Rua A, 10, Centro, Betim/MG, CEP 32600-000",
  representante_nome: "Maria Souza", representante_cpf: "12345678909", planos: ["frotas", "video"], instalacao: "credenciado",
  vigencia_meses: 12, vigencia_inicio: "2026-12-01", veiculos: [{ placa: "abc1d23", marca: "VW", modelo: "Delivery", ano: "2022" }],
  valor_implantacao: "350,00", valor_mensalidade: "189,90", email_cobranca: "fin@x.com", ...p,
});

describe("qualificação e textos", () => {
  it("PJ com representante e PF com dados pessoais", () => {
    assert.equal(qualificacao(D()), "Transportes X Ltda, inscrita no CNPJ sob nº 11.222.333/0001-81, situada à Rua A, 10, Centro, Betim/MG, CEP 32600-000, representada por Maria Souza, inscrito(a) no CPF sob nº 123.456.789-09");
    const pf = qualificacao(D({ tipo_pessoa: "PF", cliente_nome: "João", cliente_documento: "12345678909", estado_civil: "casado", profissao: "motorista", rg: "MG-1" }));
    assert.equal(pf, "João, casado, motorista, RG nº MG-1, inscrito(a) no CPF sob nº 123.456.789-09, residente à Rua A, 10, Centro, Betim/MG, CEP 32600-000");
  });
  it("datas, meses e veículos", () => {
    assert.equal(dataExtenso("2026-12-01"), "1 de dezembro de 2026");
    assert.equal(mesesExtenso(12), "12 (doze) meses");
    assert.equal(textoVeiculos([{ placa: "abc1d23", chassi: "9BW", marca: "VW", modelo: "Delivery", ano: "2022" }]), "1. Placa ABC1D23 — Chassi 9BW — VW Delivery — Ano 2022");
  });
  it("marca os planos e a instalação", () => {
    const v = variaveisDe(D());
    assert.equal(v["x:plano_frotas"], "(X)");
    assert.equal(v["x:plano_simples"], "( )");
    assert.equal(v["x:instalacao_credenciado"], "(X)");
    assert.match(v.remuneracao, /Implantação de R\$ 350,00; mensalidade de R\$ 189,90/);
  });
});

describe("preenchimento dos modelos", () => {
  it("troca campos e deixa linha nos vazios", () => {
    assert.equal(preencher("A {{a}} B {{ b }}", { a: "1" }), "A 1 B __________");
    assert.deepEqual(camposFaltando("{{a}} {{b}} {{a}}", { a: "x" }), ["b"]);
  });
  it("os modelos reais montam sem campo desconhecido e mantêm a cláusula de assinatura eletrônica", () => {
    const { html, faltando } = montarDocumento(MODELO_CONTRATO_LICENCIAMENTO, MODELO_TERMO_ADESAO, D({
      equipamentos: "Rastreador", kit_instalacao: "Kit frota", valor_visita_frustrada: "80,00", valor_telemetria: "1", valor_identificador: "1",
      valor_modulo_camera: "1", valor_camera_motorista: "1", valor_cracha: "1",
    }));
    assert.deepEqual(faltando, []);
    assert.ok(html.includes("ANEXO I"));
    assert.ok(html.includes("art. 10 §2º"));
    assert.ok(html.includes("(X) Licenciamento de Rastreamento de Frotas"));
    assert.ok(!html.includes("{{"));
    assert.ok(html.includes("12 (doze) meses, com início a partir de 1 de dezembro de 2026"));
  });
  it("aponta o que falta no termo", () => {
    const { faltando } = montarDocumento(MODELO_CONTRATO_LICENCIAMENTO, MODELO_TERMO_ADESAO, D());
    assert.ok(faltando.includes("valor_cracha"));
    assert.ok(faltando.includes("equipamentos"));
  });
  it("HTML escapa e cria títulos", () => {
    assert.equal(textoParaHtml("CLÁUSULA PRIMEIRA - DO OBJETO\n\n1.1. a <b>"), "<h3>CLÁUSULA PRIMEIRA - DO OBJETO</h3>\n<p>1.1. a &lt;b&gt;</p>");
  });
});

describe("vigência e situação", () => {
  it("soma meses respeitando fim do mês", () => {
    assert.equal(somaMeses("2026-01-31", 1), "2026-02-28");
    assert.equal(somaMeses("2026-12-01", 12), "2027-12-01");
  });
  it("renovação automática avança o período", () => {
    assert.equal(fimVigencia("2024-03-10", 12, true, "2026-11-21"), "2027-03-10");
    assert.equal(fimVigencia("2024-03-10", 12, false, "2026-11-21"), "2025-03-10");
  });
  it("situação", () => {
    assert.equal(situacao({ status: "enviado" }, "2026-11-21"), "enviado");
    assert.equal(situacao({ status: "assinado", vigencia_inicio: "2026-01-10", vigencia_meses: 12, renovacao_automatica: false }, "2026-11-21"), "vencendo");
    assert.equal(situacao({ status: "assinado", vigencia_inicio: "2026-06-10", vigencia_meses: 12 }, "2026-11-21"), "vigente");
    assert.equal(situacao({ status: "assinado", vigencia_inicio: "2024-01-10", vigencia_meses: 12, renovacao_automatica: false }, "2026-11-21"), "encerrado");
  });
});

describe("máscaras e código", () => {
  it("mascara CPF e destino", () => {
    assert.equal(mascararCpf("123.456.789-09"), "***.456.789-**");
    assert.equal(mascararDestino("31999998888"), "(**) *****-8888");
    assert.equal(mascararDestino("joao@empresa.com"), "jo***@empresa.com");
  });
  it("código sempre com 6 dígitos", () => {
    assert.equal(gerarCodigo(() => 0.000001), "000001");
    assert.equal(gerarCodigo(() => 0.999999).length, 6);
  });
});

import { htmlParaBlocos, textoSeguroPdf, telefoneInternacional } from "./contratos";
describe("PDF e Autentique", () => {
  it("HTML volta a blocos", () => {
    const b = htmlParaBlocos('<section><h2>ANEXO I</h2>\n<h3>CLÁUSULA</h3>\n<p>a &lt;b&gt;<br/>c &amp; d</p></section>');
    assert.deepEqual(b, [{ tipo: "h2", texto: "ANEXO I" }, { tipo: "h3", texto: "CLÁUSULA" }, { tipo: "p", texto: "a <b>\nc & d" }]);
  });
  it("texto seguro para a fonte do PDF", () => {
    assert.equal(textoSeguroPdf("Ação – “ok”  item ☺"), "Ação – “ok” • item ");
  });
  it("telefone internacional", () => {
    assert.equal(telefoneInternacional("(31) 99999-8888"), "+5531999998888");
    assert.equal(telefoneInternacional("5531999998888"), "+5531999998888");
    assert.equal(telefoneInternacional("123"), null);
  });
});
