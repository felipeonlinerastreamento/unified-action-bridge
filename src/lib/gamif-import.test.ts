import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mapTopUsers, entryValues, metricValues, balanceAdjustment, stableUuid, prepareTopImport, buildImportReport, redemptionStatus, missionStatus } from "./gamif-import";

const users = [
  { user_id: "u1", email: "ana@x.com", name: "Ana", is_active: true },
  { user_id: "u2", email: "bia@x.com", name: "Bia", is_active: true },
];

describe("ligação de usuários do TOP por e-mail", () => {
  it("liga pelo e-mail ignorando maiúsculas e deixa sem par como pendente", () => {
    const r = mapTopUsers(
      [{ user_id: "t1", email: " ANA@x.com", created_at: "1" }, { user_id: "t2", email: "zé@x.com", created_at: "2" }, { user_id: "t3", email: null, created_at: "3" }],
      users, [],
    );
    assert.deepEqual(r.map((m) => [m.legacyId, m.status, m.userId]), [["t1", "ligado", "u1"], ["t2", "pendente", null], ["t3", "pendente", null]]);
  });
  it("segundo perfil do TOP com o mesmo usuário do GS Hub fica como duplicado", () => {
    const r = mapTopUsers([{ user_id: "t1", email: "ana@x.com", created_at: "1" }, { user_id: "t2", email: "Ana@X.com", created_at: "2" }], users, []);
    assert.equal(r[0]?.status, "ligado");
    assert.equal(r[1]?.status, "duplicado");
  });
  it("ligação manual feita antes vale na reimportação", () => {
    const r = mapTopUsers([{ user_id: "t9", email: "outro@x.com", created_at: "1" }], users, [{ legacy_id: "t9", user_id: "u2", status: "ligado" }]);
    assert.equal(r[0]?.userId, "u2");
  });
});

describe("valores dos lançamentos", () => {
  it("métrica negativa desconta as moedas de penalidade", () => {
    assert.deepEqual(metricValues({ type: "negative", coins_penalty: 15, coins_reward: 10, points: 0 }), { coins: -15, xp: 0 });
  });
  it("usa o valor gravado no TOP e, sem ele, o da métrica", () => {
    const m = { type: "positive", coins_reward: 50, points: 2 };
    assert.deepEqual(entryValues({ coins_delta: 30, points_delta: null }, m), { coins: 30, xp: 2 });
    assert.deepEqual(entryValues({ coins_delta: null, points_delta: null }, m), { coins: 50, xp: 2 });
  });
  it("ajuste fecha o saldo igual ao do TOP", () => {
    assert.equal(balanceAdjustment(170, -920), 1090);
  });
  it("id do ajuste é sempre o mesmo para a mesma pessoa (não duplica ao repetir)", () => {
    assert.equal(stableUuid("top-adjust:a"), stableUuid("top-adjust:a"));
    assert.notEqual(stableUuid("top-adjust:a"), stableUuid("top-adjust:b"));
    assert.match(stableUuid("x"), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("situações do TOP viram as do GS Hub", () => {
    assert.equal(redemptionStatus("approved"), "aprovado");
    assert.equal(missionStatus("active"), "ativa");
  });
});

describe("preparação da importação", () => {
  const exp = {
    exported_at: "2026-11-20T16:00:00Z", counts: {},
    data: {
      profiles: [{ user_id: "t1", email: "ana@x.com", name: "Ana", coins: 70, total_points: 4, squad: "ADM", created_at: "1" }, { user_id: "t2", email: "x@y.com", name: "Zé", coins: 10, total_points: 0, squad: "Tecnico", created_at: "2" }],
      performance_metrics: [{ id: "m1", name: "Bom", type: "positive", coins_reward: 10, points: 1 }],
      user_performance_entries: [{ id: "e1", user_id: "t1", metric_id: "m1", coins_delta: null, points_delta: null, created_at: "2026-02-18T01:00:00Z" }],
      missions: [{ id: "mi1", title: "M", status: "active", target_squad: "ADM", reward: 300 }],
      tasks: [{ id: "k1", title: "T", created_by: "t2", assigned_to: "t1", status: "pending" }],
    },
  };
  const dir = { users, sectors: [{ id: "s-adm", name: "Administrativo" }], links: [] };
  const prep = prepareTopImport(exp, dir, "importer");
  it("ADM vira o setor Administrativo e Tecnico fica sem setor", () => {
    const missions = prep.payload["missions"] as { target_sector_id: string | null }[];
    assert.equal(missions[0]?.target_sector_id, "s-adm");
    assert.deepEqual(prep.unmatchedSquads, ["Tecnico"]);
  });
  it("lançamento usa a data de São Paulo e ajuste completa o saldo", () => {
    const e = (prep.payload["entries"] as { entry_date: string }[])[0];
    assert.equal(e?.entry_date, "2026-02-17");
    const adj = prep.payload["adjustments"] as { legacy_user_id: string; coins: number; xp: number }[];
    assert.deepEqual(adj.find((a) => a.legacy_user_id === "t1") && { c: adj.find((a) => a.legacy_user_id === "t1")?.coins, x: adj.find((a) => a.legacy_user_id === "t1")?.xp }, { c: 60, x: 3 });
  });
  it("tarefa com criador pendente fica em nome de quem importou", () => {
    const t = (prep.payload["tasks"] as { created_by: string; assigned_to: string | null }[])[0];
    assert.equal(t?.created_by, "importer");
    assert.equal(t?.assigned_to, "u1");
    const people = prep.payload["task_people"] as { created_by: string | null }[];
    assert.equal(people[0]?.created_by, null);
  });
  it("relatório compara saldo do TOP com o do GS Hub", () => {
    const rep = buildImportReport(exp, prep, {
      present: {},
      balances: [
        { legacy_id: "t1", user_id: "u1", status: "ligado", gs_name: "Ana", wallet_coins: 70, wallet_xp: 4, top_part_coins: 70, top_part_xp: 4 },
        { legacy_id: "t2", user_id: null, status: "pendente", gs_name: null, wallet_coins: null, wallet_xp: null, top_part_coins: 10, top_part_xp: 0 },
      ],
    });
    assert.equal(rep.users.linked.length, 1);
    assert.equal(rep.users.pending.length, 1);
    assert.ok(rep.balances.every((b) => b.ok));
  });
});
