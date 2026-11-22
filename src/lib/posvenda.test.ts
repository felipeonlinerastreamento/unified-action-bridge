import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  classificarABC, proximoContato, situacaoContato, saudeCliente, riscoDe, sugestoesCliente, metricasPosVenda,
  resumoPorClasse, classeDe, somaDias, type ClienteCarteira,
} from "./posvenda";

const HOJE = "2026-11-21";
const C = (p: Partial<ClienteCarteira>): ClienteCarteira => ({
  id: p.documento ?? "x", nome: "Cliente", documento: "x", receita_mensal: 1000, vencidas_valor: 0, vencidas_qtd: 0, classe: "B", ...p,
});

describe("classificarABC", () => {
  it("maior cliente é A; acumulado até 80% A, até 95% B, resto C; sem receita é C", () => {
    const m = classificarABC([
      { documento: "1", receita_mensal: 5000 },
      { documento: "2", receita_mensal: 3000 },
      { documento: "3", receita_mensal: 1000 },
      { documento: "4", receita_mensal: 600 },
      { documento: "5", receita_mensal: 400 },
      { documento: "6", receita_mensal: 0 },
    ]);
    // total 10000: 1 (antes 0%) A, 2 (antes 50%) A, 3 (antes 80%) B, 4 (antes 90%) B, 5 (antes 96%) C
    assert.deepEqual([...["1", "2", "3", "4", "5", "6"]].map((d) => m.get(d)), ["A", "A", "B", "B", "C", "C"]);
  });
});

describe("cadência e situação", () => {
  it("próximo contato = último + cadência da classe (manual vence a calculada)", () => {
    assert.equal(proximoContato(C({ classe: "A", ultimo_contato_em: "2026-11-01" }), HOJE), "2026-11-16");
    assert.equal(proximoContato(C({ classe: "C", classe_manual: "B", ultimo_contato_em: "2026-11-01" }), HOJE), "2026-12-01");
    assert.equal(proximoContato(C({}), HOJE), HOJE);
    assert.equal(proximoContato(C({}), HOJE, "2026-12-05"), "2026-12-05");
    assert.equal(classeDe({ classe: "C", classe_manual: "A" }), "A");
  });
  it("situação", () => {
    assert.equal(situacaoContato("2026-11-20", HOJE), "atrasado");
    assert.equal(situacaoContato(HOJE, HOJE), "hoje");
    assert.equal(situacaoContato("2026-11-30", HOJE), "em_dia");
    assert.equal(situacaoContato(null, HOJE), "atrasado");
  });
  it("somaDias vira o mês", () => {
    assert.equal(somaDias("2026-11-25", 10), "2026-12-05");
  });
});

describe("saúde e risco", () => {
  it("cliente em dia, sem vencidas e promotor fica 100", () => {
    assert.equal(saudeCliente(C({ ultimo_contato_em: "2026-11-15", ultimo_nps: 10 }), HOJE), 100);
  });
  it("vencidas, contato atrasado e detrator derrubam para risco alto", () => {
    const s = saudeCliente(C({ classe: "A", vencidas_valor: 2000, vencidas_qtd: 2, ultimo_contato_em: "2026-10-01", ultimo_nps: 4 }), HOJE);
    assert.ok(s < 50, `saúde ${s}`);
    assert.equal(riscoDe(s), "alto");
    assert.equal(riscoDe(60), "medio");
    assert.equal(riscoDe(80), "baixo");
  });
  it("placas paradas no Reconnect descontam pela pior placa e pelo aviso sem retorno", () => {
    const base = C({ ultimo_contato_em: "2026-11-15", ultimo_nps: 10 });
    assert.equal(saudeCliente({ ...base, rc_placas_paradas: 2, rc_dias_max: 8 }, HOJE), 95);
    assert.equal(saudeCliente({ ...base, rc_placas_paradas: 2, rc_dias_max: 35 }, HOJE), 80);
    assert.equal(saudeCliente({ ...base, rc_placas_paradas: 2, rc_dias_max: 35, rc_notificadas: 1 }, HOJE), 75);
    assert.equal(saudeCliente({ ...base, rc_placas_paradas: 0, rc_dias_max: 35 }, HOJE), 100);
    const sug = sugestoesCliente({ ...base, rc_placas_paradas: 3, rc_dias_max: 25, rc_notificadas: 1 }, HOJE);
    assert.ok(sug.some((x) => x.roteiro === "retencao" && x.texto.includes("3 placa(s)")));
  });
});

describe("sugestões", () => {
  it("vencida e detrator vêm primeiro; satisfeito recebe oferta", () => {
    const s = sugestoesCliente(C({ vencidas_qtd: 1, vencidas_valor: 500, ultimo_nps: 5, ultimo_contato_em: "2026-11-15" }), HOJE);
    assert.equal(s[0].prioridade, 1);
    assert.ok(s.some((x) => x.roteiro === "financeiro"));
    assert.ok(!s.some((x) => x.roteiro === "oferta"));
    const ok = sugestoesCliente(C({ classe: "A", ultimo_nps: 10, ultimo_contato_em: "2026-11-15" }), HOJE);
    assert.ok(ok.some((x) => x.roteiro === "oferta"));
    assert.ok(ok.some((x) => x.roteiro === "indicacao"));
  });
  it("sem diagnóstico recebe primeiro contato (A com prioridade 1)", () => {
    const s = sugestoesCliente(C({ classe: "A" }), HOJE);
    assert.ok(s.some((x) => x.roteiro === "primeiro_contato" && x.prioridade === 1));
    assert.ok(!sugestoesCliente(C({ diagnostico_em: "2026-11-10", ultimo_contato_em: "2026-11-10" }), HOJE).some((x) => x.roteiro === "primeiro_contato"));
  });
  it("cliente novo sem contato recebe boas-vindas", () => {
    const s = sugestoesCliente(C({ primeira_fatura_em: "2026-11-01" }), HOJE);
    assert.ok(s.some((x) => x.roteiro === "boas_vindas"));
  });
});

describe("métricas", () => {
  it("contatos, NPS, carteira em dia, A atrasados e oportunidades", () => {
    const cart = [
      C({ id: "a", documento: "a", classe: "A", ultimo_contato_em: "2026-11-15" }),
      C({ id: "b", documento: "b", classe: "A", ultimo_contato_em: "2026-10-01" }),
      C({ id: "c", documento: "c", classe: "C", ultimo_contato_em: "2026-11-01", receita_mensal: 300 }),
    ];
    const m = metricasPosVenda(cart, [
      { carteira_id: "a", data: "2026-11-15", resultado: "realizado", nps: 10, oportunidade: "Câmera", oportunidade_valor: 450 },
      { carteira_id: "c", data: "2026-11-01", resultado: "realizado", nps: 5 },
      { carteira_id: "b", data: "2026-11-10", resultado: "sem_resposta" },
      { carteira_id: "b", data: "2026-10-01", resultado: "realizado", nps: 9 },
    ], "2026-11-01", "2026-11-30", HOJE);
    assert.equal(m.contatosRealizados, 2);
    assert.equal(m.semResposta, 1);
    assert.equal(m.clientesContatados, 2);
    assert.equal(m.nps, 0); // 1 promotor, 1 detrator
    assert.equal(m.atrasadosA, 1);
    assert.equal(m.pctCarteiraEmDia, 67);
    assert.equal(m.oportunidades, 1);
    assert.equal(m.valorOportunidades, 450);
    assert.equal(m.previstos, 2); // a (30/11) e b (atrasado); c só em fev
    assert.equal(m.diagnosticados, 0);
  });
  it("resumo por classe", () => {
    const r = resumoPorClasse([C({ classe: "A", receita_mensal: 800 }), C({ classe: "C", receita_mensal: 200 })]);
    assert.deepEqual(r.map((x) => [x.classe, x.clientes, x.participacao]), [["A", 1, 80], ["B", 0, 0], ["C", 1, 20]]);
  });
});
