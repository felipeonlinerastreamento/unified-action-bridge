import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { MENU_CATALOG, URL_TO_MENU_SLUG, DEFAULT_OPERATOR_MENUS, canAccessAgendaPath } from "./menu-catalog";

describe("Liberação individual da Agenda", () => {
  for (const submenu of ["atividades", "timeline", "mapa", "solicitacoes"]) {
    test(`${submenu} tem permissão própria e só abre quando liberado`, () => {
      const slug = `agenda.${submenu}`;
      const path = `/agenda/${submenu}`;
      assert.equal(MENU_CATALOG.some((item) => item.slug === slug), true);
      assert.equal(URL_TO_MENU_SLUG[path], slug);
      assert.equal(canAccessAgendaPath(path, (allowed) => allowed === slug), true);
      assert.equal(canAccessAgendaPath(path, () => false), false);
      assert.equal(DEFAULT_OPERATOR_MENUS.includes(slug), false);
    });
  }
  test("liberar Timeline não libera Mapa nem Solicitações", () => {
    const canSee = (slug: string) => slug === "agenda.timeline";
    assert.equal(canAccessAgendaPath("/agenda/timeline", canSee), true);
    assert.equal(canAccessAgendaPath("/agenda/mapa", canSee), false);
    assert.equal(canAccessAgendaPath("/agenda/solicitacoes", canSee), false);
  });
});