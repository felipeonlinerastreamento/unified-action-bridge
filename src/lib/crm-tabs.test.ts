import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { CRM_TABS, allowedCrmTabs, resolveCrmTab, withCrmParent } from "./crm-tabs";
import { MENU_CATALOG, DEFAULT_OPERATOR_MENUS, menuSectionOf } from "./menu-catalog";

describe("Liberação das abas do CRM", () => {
  test("cada aba do CRM aparece na lista de liberação por setor", () => {
    for (const t of CRM_TABS) {
      const entry = MENU_CATALOG.find((m) => m.slug === `crm.${t.key}`);
      assert.ok(entry, t.key);
      assert.equal(menuSectionOf(entry!), "crm");
    }
    assert.equal(CRM_TABS.length, 7);
  });
  test("só as abas marcadas aparecem", () => {
    const can = (s: string) => s === "crm.pipeline" || s === "crm.servicos-tecnicos";
    assert.deepEqual(allowedCrmTabs(can), ["pipeline", "servicos-tecnicos"]);
  });
  test("nenhuma aba marcada: o item CRM some", () => {
    assert.equal(withCrmParent(new Set(["crm", "central"])).has("crm"), false);
    assert.equal(withCrmParent(new Set(["crm.fluxos"])).has("crm"), true);
  });
  test("aba não liberada pela URL abre a primeira liberada", () => {
    assert.equal(resolveCrmTab("fluxos", ["pipeline", "contatos"]), "pipeline");
    assert.equal(resolveCrmTab("contatos", ["pipeline", "contatos"]), "contatos");
    assert.equal(resolveCrmTab("pipeline", []), null);
  });
  test("grupos sem restrição continuam com todas as abas", () => {
    for (const t of CRM_TABS) assert.equal(DEFAULT_OPERATOR_MENUS.includes(`crm.${t.key}`), true);
  });
});
