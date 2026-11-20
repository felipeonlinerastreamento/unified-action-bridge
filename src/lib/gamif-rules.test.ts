import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { canSeeGamification, matchUsersByEmail, canAfford, levelFromXp, ruleAppliesOn } from "./gamif-rules";

describe("acesso à Gamificação antes da liberação", () => {
  it("só admin vê enquanto não liberado", () => {
    assert.equal(canSeeGamification({ isAdmin: false }, false), false);
    assert.equal(canSeeGamification({ isAdmin: true }, false), true);
  });
  it("todos veem após liberar", () => {
    assert.equal(canSeeGamification({ isAdmin: false }, true), true);
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
  it("e-mail duplicado no GS Hub não liga automaticamente", () => {
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
