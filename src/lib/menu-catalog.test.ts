import { describe, expect, test } from "bun:test";
import { MENU_CATALOG, URL_TO_MENU_SLUG, DEFAULT_OPERATOR_MENUS, canAccessAgendaPath } from "./menu-catalog";

describe("Liberação individual da Agenda", () => {
  for (const submenu of ["atividades", "timeline", "mapa", "solicitacoes"]) {
    test(`${submenu} tem permissão própria e só abre quando liberado`, () => {
      const slug = `agenda.${submenu}`;
      const path = `/agenda/${submenu}`;
      expect(MENU_CATALOG.some((item) => item.slug === slug)).toBe(true);
      expect(URL_TO_MENU_SLUG[path]).toBe(slug);
      expect(canAccessAgendaPath(path, (allowed) => allowed === slug)).toBe(true);
      expect(canAccessAgendaPath(path, () => false)).toBe(false);
      expect(DEFAULT_OPERATOR_MENUS.includes(slug)).toBe(false);
    });
  }
  test("liberar Timeline não libera Mapa nem Solicitações", () => {
    const canSee = (slug: string) => slug === "agenda.timeline";
    expect(canAccessAgendaPath("/agenda/timeline", canSee)).toBe(true);
    expect(canAccessAgendaPath("/agenda/mapa", canSee)).toBe(false);
    expect(canAccessAgendaPath("/agenda/solicitacoes", canSee)).toBe(false);
  });
});