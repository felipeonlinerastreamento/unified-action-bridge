import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absenteismo, avisosRh, calendarioMes, diasDireitoFerias, diasUteis, faltasRecentes, formatarMinutos, periodosFerias,
  proximoAniversario, saldoBancoHoras, situacaoDocumento, somaMeses, textoOcorrencia, turnover,
  type Ausencia, type Colaborador, type Ferias,
} from "./rh";

const HOJE = "2026-11-23";
const C = (p: Partial<Colaborador>): Colaborador => ({ id: "c1", nome: "Ana", situacao: "ativo", tipo_contrato: "clt", data_admissao: "2024-03-10", ...p });
const A = (p: Partial<Ausencia>): Ausencia => ({ id: Math.random().toString(), colaborador_id: "c1", tipo: "falta_injustificada", data_inicio: "2026-11-02", data_fim: "2026-11-02", situacao: "aprovada", ...p });

test("datas", () => {
  assert.equal(diasUteis("2026-11-02", "2026-11-08"), 5);
  assert.equal(somaMeses("2024-01-31", 1), "2024-02-29");
  assert.equal(formatarMinutos(-125), "-2h05");
});

test("absenteísmo: só tipos que contam, atraso em minutos, período", () => {
  const colabs = [C({}), C({ id: "c2", nome: "Bia" })];
  const aus = [
    A({}),                                                                 // 8 h
    A({ tipo: "atraso", minutos: 90 }),                                    // 1,5 h
    A({ tipo: "folga" }),                                                  // não conta
    A({ colaborador_id: "c2", tipo: "atestado", data_inicio: "2026-10-30", data_fim: "2026-11-03" }), // 2 dias úteis em nov
    A({ tipo: "falta_justificada", situacao: "recusada" }),                // recusada não conta
  ];
  const r = absenteismo(colabs, aus, "2026-11-01", "2026-11-30");
  assert.equal(r.horasPrevistas, 2 * 21 * 8);
  assert.equal(r.horasPerdidas, 25.5);
  assert.equal(r.taxa, Math.round((25.5 / 336) * 10000) / 100);
  assert.equal(r.porColaborador.get("c2"), 16);
});

test("turnover", () => {
  const colabs = [C({}), C({ id: "c2", data_admissao: "2026-11-10" }), C({ id: "c3", situacao: "desligado", data_desligamento: "2026-11-15" }), C({ id: "c4" })];
  const t = turnover(colabs, "2026-11-01", "2026-11-30");
  assert.equal(t.admissoes, 1);
  assert.equal(t.desligamentos, 1);
  assert.equal(t.efetivoMedio, 3);
  assert.equal(t.taxa, 33.33);
});

test("férias: direito pela CLT art. 130", () => {
  assert.equal(diasDireitoFerias(5), 30);
  assert.equal(diasDireitoFerias(6), 24);
  assert.equal(diasDireitoFerias(23), 18);
  assert.equal(diasDireitoFerias(32), 12);
  assert.equal(diasDireitoFerias(33), 0);
});

test("férias: períodos, uso e vencimento", () => {
  const c = C({ data_admissao: "2024-03-10" });
  const ferias: Ferias[] = [{ id: "f1", colaborador_id: "c1", aquisitivo_inicio: "2024-03-10", data_inicio: "2025-07-01", data_fim: "2025-07-20", abono_dias: 10, situacao: "concluida" }];
  const aus = [A({ data_inicio: "2025-04-01", data_fim: "2025-04-07" })]; // 7 faltas no 2º período → 24 dias
  const p = periodosFerias(c, aus, ferias, HOJE, 60);
  assert.equal(p.length, 3);
  assert.equal(p[0].situacao, "quitada");                 // 20 + 10 abono = 30
  assert.equal(p[0].concessivoFim, "2026-03-09");
  assert.equal(p[1].inicio, "2025-03-10");
  assert.equal(p[1].faltas, 7);
  assert.equal(p[1].direito, 24);
  assert.equal(p[1].situacao, "a_gozar");                 // concessivo até 2027-03-09: mais de 60 dias
  assert.equal(p[2].situacao, "em_aquisicao");
  const venc = periodosFerias(C({ data_admissao: "2024-01-15" }), [], [], HOJE, 60);
  assert.equal(venc[0].situacao, "vencida");              // concessivo terminou em 2026-01-14
  assert.deepEqual(periodosFerias(C({ tipo_contrato: "pj" }), [], [], HOJE), []);
});

test("banco de horas, documentos, faltas e aniversários", () => {
  assert.equal(saldoBancoHoras([{ colaborador_id: "c1", data: HOJE, minutos: 120 }, { colaborador_id: "c1", data: HOJE, minutos: -30 }]).get("c1"), 90);
  assert.equal(situacaoDocumento({ validade: "2026-11-01" }, HOJE), "vencido");
  assert.equal(situacaoDocumento({ validade: "2026-12-10" }, HOJE), "vencendo");
  assert.equal(situacaoDocumento({ validade: null }, HOJE), "sem_validade");
  assert.equal(faltasRecentes([A({ data_inicio: "2026-11-02", data_fim: "2026-11-04" }), A({ data_inicio: "2025-01-02", data_fim: "2025-01-02" })], HOJE, 90).get("c1"), 3);
  assert.deepEqual(proximoAniversario("1990-11-25", HOJE), { data: "2026-11-25", dias: 2, anos: 36 });
  assert.equal(proximoAniversario("1990-01-05", HOJE).data, "2027-01-05");
});

test("calendário: ausências e férias por dia", () => {
  const cal = calendarioMes("2026-11", [A({ data_inicio: "2026-10-30", data_fim: "2026-11-02" }), A({ tipo: "atraso", minutos: 30 })],
    [{ id: "f", colaborador_id: "c2", aquisitivo_inicio: "2025-01-01", data_inicio: "2026-11-02", data_fim: "2026-11-03", situacao: "planejada" }]);
  assert.equal(cal.get("2026-11-01")?.length, 1);
  assert.equal(cal.get("2026-11-02")?.length, 2);
  assert.equal(cal.get("2026-11-03")?.[0].tipo, "ferias");
  assert.equal(cal.get("2026-11-03")?.[0].pendente, true);
  assert.equal(cal.has("2026-10-30"), false);
});

test("avisos", () => {
  const colabs = [C({ data_admissao: "2024-01-15", data_nascimento: "1990-11-25" })];
  const av = avisosRh({
    colabs, hoje: HOJE,
    ausencias: [A({ data_inicio: "2026-11-02", data_fim: "2026-11-04" }), A({ tipo: "atestado", situacao: "pendente" })],
    ferias: [], horas: [{ colaborador_id: "c1", data: HOJE, minutos: 3000 }],
    documentos: [{ id: "d", colaborador_id: "c1", tipo: "CNH", validade: "2026-12-01" }],
  });
  const tipos = av.map((a) => a.tipo);
  for (const t of ["ferias_vencida", "faltas", "documento_vencendo", "banco_horas", "ausencia_pendente", "aniversario"]) assert.ok(tipos.includes(t as any), t);
  assert.equal(av[0].gravidade, 1);
});

test("texto de advertência e suspensão", () => {
  const a = textoOcorrencia({ empresa: "X", colaborador: "Ana", cargo: "Técnica", tipo: "advertencia_escrita", data: "2026-11-23", motivo: "atrasos repetidos" });
  assert.equal(a.titulo, "ADVERTÊNCIA DISCIPLINAR");
  assert.match(a.paragrafos[1], /23\/11\/2026, em razão de: atrasos repetidos/);
  const s = textoOcorrencia({ empresa: "X", colaborador: "Ana", tipo: "suspensao", data: "2026-11-23", motivo: "falta grave", diasSuspensao: 2 });
  assert.match(s.paragrafos[1], /por 2 dia\(s\)/);
});
