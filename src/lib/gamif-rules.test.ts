import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { GAMIF_RELEASED, canSeeGamification, matchUsersByEmail, canAfford, levelFromXp, ruleAppliesOn, computeStreak, duelOutcome, validDuelStake, readingStatus, aggregateEntries, parseGamifSettings } from "./gamif-rules";

describe("acesso à Gamificação antes da liberação", () => {
  it("só admin vê enquanto não liberado", () => {
    assert.equal(canSeeGamification({ isAdmin: false }, false), false);
    assert.equal(canSeeGamification({ isAdmin: true }, false), true);
  });
  it("todos veem após liberar", () => {
    assert.equal(canSeeGamification({ isAdmin: false }, true), true);
  });
  it("liberada para todos desde a virada", () => {
    assert.equal(GAMIF_RELEASED, true);
    assert.equal(canSeeGamification({ isAdmin: false }), true);
  });
});

describe("mapeamento por e-mail", () => {
  it("liga ignorando maiúsculas/espaços e deixa sem par como pendente", () => {
    const r = matchUsersByEmail(
      [{ legacyId: "a", email: " Ana@X.com " }, { legacyId: "b", email: "bob@x.com" }, { legacyId: "c", email: null }],
      [{ userId: "u1", email: "ana@x.com" }],
    );
    assert.deepEqual(r.matched, [{ legacyId: "a", userId: "u1" }]);
    assert.deepEqual(r.pending, ["b", "c"]);
  });
  it("e-mail duplicado no Gestão Online não liga automaticamente", () => {
    const r = matchUsersByEmail([{ legacyId: "a", email: "x@x.com" }], [{ userId: "1", email: "x@x.com" }, { userId: "2", email: "X@x.com" }]);
    assert.deepEqual(r.duplicated, ["a"]);
    assert.deepEqual(r.matched, []);
  });
});

describe("resgate", () => {
  it("bloqueia saldo insuficiente e sem estoque", () => {
    assert.equal(canAfford(99, 100, null), false);
    assert.equal(canAfford(100, 100, 0), false);
    assert.equal(canAfford(100, 100, 1), true);
  });
});

describe("nível e regras automáticas", () => {
  it("1000 XP por nível", () => {
    assert.equal(levelFromXp(0).level, 1);
    assert.deepEqual(levelFromXp(2500), { level: 3, progress: 0.5 });
  });
  it("domingo é 7", () => {
    assert.equal(ruleAppliesOn([1, 2, 3, 4, 5], new Date(2026, 10, 22)), false);
    assert.equal(ruleAppliesOn([7], new Date(2026, 10, 22)), true);
  });
});

describe("nível configurável", () => {
  it("usa XP por nível das configurações", () => {
    assert.deepEqual(levelFromXp(1500, 500), { level: 4, progress: 0 });
    assert.equal(levelFromXp(999).level, 1);
  });
});

describe("sequência de dias", () => {
  it("conta até ontem quando hoje ainda não teve lançamento", () => {
    assert.deepEqual(computeStreak(["2026-11-17", "2026-11-18", "2026-11-19"], "2026-11-20"), { current: 3, best: 3 });
  });
  it("zera a atual após um dia sem lançamento e guarda a melhor", () => {
    assert.deepEqual(computeStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-18"], "2026-11-20"), { current: 0, best: 3 });
  });
});

describe("duelos", () => {
  it("acordo define vencedor; conflito vira disputa", () => {
    assert.equal(duelOutcome("venci", "perdi"), "desafiante");
    assert.equal(duelOutcome("perdi", "venci"), "desafiado");
    assert.equal(duelOutcome("venci", "venci"), "disputa");
    assert.equal(duelOutcome("venci", null), "aguardando");
  });
  it("aposta respeita teto e saldo", () => {
    assert.equal(validDuelStake(100, 50, 500), "Saldo insuficiente");
    assert.equal(validDuelStake(600, 1000, 500), "A aposta máxima é 500");
    assert.equal(validDuelStake(0, 1000, 500), "Informe uma aposta maior que zero");
    assert.equal(validDuelStake(100, 100, 500), null);
  });
});

describe("leitura de processos", () => {
  it("nova versão exige nova confirmação", () => {
    assert.equal(readingStatus(2, 3), "desatualizado");
    assert.equal(readingStatus(3, 3), "lido");
    assert.equal(readingStatus(null, 1), "pendente");
  });
});

describe("relatórios", () => {
  it("soma por pessoa separando ganho e perdido", () => {
    const r = aggregateEntries([
      { key: "Ana", coins: 100, xp: 50 },
      { key: "Ana", coins: -30, xp: 0 },
      { key: "Bia", coins: 10, xp: 200 },
    ]);
    assert.equal(r[0]?.key, "Bia");
    assert.deepEqual(r[1], { key: "Ana", coins: 70, xp: 50, count: 2, earned: 100, spent: 30 });
  });
});

describe("configurações", () => {
  it("aplica padrões e ignora valores inválidos", () => {
    const s = parseGamifSettings({ xp_per_level: -5, notify_new_mission: false, coin_name: "  " });
    assert.equal(s.xp_per_level, 1000);
    assert.equal(s.notify_new_mission, false);
    assert.equal(s.coin_name, "AtentaCoins");
    assert.equal(s.notifications_enabled, true);
  });
});
