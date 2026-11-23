import { test } from "node:test";
import assert from "node:assert/strict";
import {
  situacaoDoGsystem, contatoDoGsystem, telefoneWhatsApp, faixaDeAtraso, montarInadimplencia,
  indicadoresInadimplencia, passoDevido, mensagemCobranca, CONFIG_PADRAO, type LancInad,
} from "./finance-inadimplencia";

const HOJE = "2026-11-23";
const L = (p: Partial<LancInad>): LancInad => ({
  id: Math.random().toString(36).slice(2), tipo: "receber", status: "aberto", valor: 100,
  vencimento: "2026-11-01", contraparte: "Cliente A", documento_contraparte: "12.345.678/0001-90", ...p,
});

test("situação do cliente no GSystem", () => {
  assert.deepEqual(situacaoDoGsystem({ Situacao: "Inativo" }), { texto: "Inativo", ativo: false });
  assert.deepEqual(situacaoDoGsystem({ Status: "Cancelado" }), { texto: "Cancelado", ativo: false });
  assert.deepEqual(situacaoDoGsystem({ Status: "Ativo" }), { texto: "Ativo", ativo: true });
  assert.deepEqual(situacaoDoGsystem({ Ativo: false }), { texto: "Inativo", ativo: false });
  assert.deepEqual(situacaoDoGsystem({ Nome: "X" }), { texto: null, ativo: null });
});

test("contato e telefone para WhatsApp", () => {
  assert.deepEqual(contatoDoGsystem({ Celular: "(31) 99999-8888", Email: "Fin@Cli.com.br; outro@x.com" }), { telefone: "31999998888", email: "fin@cli.com.br" });
  assert.equal(telefoneWhatsApp("(31) 99999-8888"), "5531999998888");
  assert.equal(telefoneWhatsApp("123"), null);
});

test("faixas de atraso", () => {
  assert.equal(faixaDeAtraso(1), "1-30");
  assert.equal(faixaDeAtraso(31), "31-60");
  assert.equal(faixaDeAtraso(90), "61-90");
  assert.equal(faixaDeAtraso(91), "90+");
});

test("monta inadimplentes por cliente com situação e sugestões", () => {
  const lanc = [
    L({ vencimento: "2026-11-01", valor: 100 }),
    L({ vencimento: "2026-07-01", valor: 200, perda_provavel: true }),
    L({ vencimento: "2026-12-10", valor: 50 }),                       // a vencer
    L({ vencimento: "2026-10-01", status: "pago", valor: 80 }),        // pago
    L({ documento_contraparte: "11.111.111/0001-11", contraparte: "Cliente B", vencimento: "2026-11-20", valor: 30 }),
  ];
  const r = montarInadimplencia(lanc, [{ documento: "12345678000190", nome: "Cliente A Ltda", ativo_gsystem: false, situacao_gsystem: "Inativo", telefone: "31999998888" }], [], HOJE);
  assert.equal(r.length, 2);
  const a = r[0];
  assert.equal(a.nome, "Cliente A Ltda");
  assert.equal(a.valor, 300);
  assert.equal(a.valorPerda, 200);
  assert.equal(a.qtd, 2);
  assert.equal(a.aVencer, 50);
  assert.equal(a.situacao, "inativo");
  assert.equal(a.faixa, "90+");
  assert.equal(a.porFaixa["1-30"], 100);
  assert.equal(a.porFaixa["90+"], 200);
  assert.ok(a.sugestoes.includes("inativo_com_saldo"));
  assert.ok(!a.sugestoes.includes("bloqueio")); // inativo não recebe aviso de bloqueio
  assert.equal(r[1].situacao, "sem_informacao");
  assert.ok(r[1].sugestoes.includes("sem_contato"));
});

test("bloqueio, perda e promessa", () => {
  const lanc = [L({ vencimento: "2026-04-01", valor: 500 })];
  const sem = montarInadimplencia(lanc, [{ documento: "12345678000190", ativo_gsystem: true, telefone: "31999998888" }], [], HOJE);
  assert.ok(sem[0].sugestoes.includes("bloqueio"));
  assert.ok(sem[0].sugestoes.includes("perda"));
  const comPromessa = montarInadimplencia(lanc, [{ documento: "12345678000190", ativo_gsystem: true, telefone: "x" }],
    [{ documento: "12345678000190", tipo: "promessa", data_promessa: "2026-11-30", created_at: "2026-11-20T10:00:00Z" }], HOJE);
  assert.ok(!comPromessa[0].sugestoes.includes("bloqueio"));
  assert.deepEqual(comPromessa[0].promessa, { data: "2026-11-30", quebrada: false });
  const quebrada = montarInadimplencia(lanc, [], [{ documento: "12345678000190", tipo: "promessa", data_promessa: "2026-11-10", created_at: "2026-11-05T10:00:00Z" }], HOJE);
  assert.ok(quebrada[0].sugestoes.includes("promessa_quebrada"));
});

test("indicadores", () => {
  const lanc = [
    L({ vencimento: "2026-10-10", valor: 100 }),                                                   // em aberto
    L({ vencimento: "2026-10-10", valor: 300, status: "pago", data_pagamento: "2026-10-10" }),     // em dia
    L({ vencimento: "2026-10-10", valor: 100, status: "pago", data_pagamento: "2026-11-05" }),     // atraso, pago neste mês
  ];
  const lista = montarInadimplencia(lanc, [], [], HOJE);
  const i = indicadoresInadimplencia(lanc, lista, HOJE);
  const out = i.meses.find((m) => m.mes === "2026-10")!;
  assert.equal(out.faturado, 500);
  assert.equal(out.emAberto, 100);
  assert.equal(out.pagoAtraso, 100);
  assert.equal(out.taxa, 20);
  assert.equal(i.taxa12m, 20);
  assert.equal(i.recuperadoMes, 100);
  assert.equal(i.totalVencido, 100);
  assert.equal(i.meses.length, 12);
});

test("régua: só o passo alcançado recente e não enviado", () => {
  const p = CONFIG_PADRAO.passos;
  assert.equal(passoDevido("2026-11-26", HOJE, p, new Set())?.dias, -3);   // lembrete 3 dias antes
  assert.equal(passoDevido("2026-11-20", HOJE, p, new Set())?.dias, 3);
  assert.equal(passoDevido("2026-11-20", HOJE, p, new Set(["3"])), null);  // já enviado
  assert.equal(passoDevido("2026-06-01", HOJE, p, new Set()), null);       // dívida antiga: não dispara ao ligar
  assert.equal(passoDevido("2026-12-20", HOJE, p, new Set()), null);       // longe do vencimento
});

test("mensagem de cobrança", () => {
  const m = mensagemCobranca(null, false, { nome: "Maria Souza", valor: 199.9, vencimento: "2026-11-10", hoje: HOJE, link: "https://b.co/1" });
  assert.match(m, /Olá, Maria!/);
  assert.match(m, /R\$\s?199,90/);
  assert.match(m, /10\/11\/2026 \(13 dia/);
  assert.match(m, /Boleto: https:\/\/b\.co\/1/);
});

test("DRE: perda provável vira despesa separada na competência", async () => {
  const { calcularDre, GRUPO_PERDA } = await import("./finance");
  const lanc: any[] = [
    { tipo: "receber", status: "aberto", valor: 300, competencia: "2026-10-01", categoria_id: null, perda_provavel: true },
    { tipo: "receber", status: "pago", valor: 700, competencia: "2026-10-01", categoria_id: null },
  ];
  const d = calcularDre(lanc, [], "2026-10-01");
  assert.equal(d.receitaAtual, 1000);
  assert.equal(d.linhas.find((l) => l.grupo === GRUPO_PERDA)?.atual, 300);
  assert.equal(d.resultadoAtual, 700);
});
