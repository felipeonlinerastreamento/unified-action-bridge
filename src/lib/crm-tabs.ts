// Abas do menu CRM. Fonte única: a tela do CRM e a liberação por grupo de setor
// (Configurações > Usuários) leem esta lista, então uma aba nova aparece nos dois.
// A chave também é usada no servidor pela função `crm_tab_allowed(<chave>)`.

// "tarefas" foi retirada da tela (sem demanda). Os dados da tabela crm_tasks continuam no banco.
export const CRM_TABS = [
  { key: "pipeline", label: "Pipeline" },
  { key: "fluxos", label: "Fluxos" },
  { key: "aniversarios", label: "Aniversários" },
  { key: "contatos", label: "Contatos" },
  { key: "categorias", label: "Categorias" },
  { key: "servicos-tecnicos", label: "Serviços Técnicos" },
] as const;

export type CrmTabKey = (typeof CRM_TABS)[number]["key"];

export const crmTabSlug = (key: string) => `crm.${key}`;
export const CRM_TAB_SLUGS = CRM_TABS.map((t) => crmTabSlug(t.key));

/** Abas que a pessoa pode ver, na ordem da tela. */
export function allowedCrmTabs(canSeeMenu: (slug: string) => boolean): CrmTabKey[] {
  return CRM_TABS.filter((t) => canSeeMenu(crmTabSlug(t.key))).map((t) => t.key);
}

/** Aba a abrir: a pedida na URL se liberada; senão a primeira liberada; null se nenhuma. */
export function resolveCrmTab(requested: string | undefined, allowed: readonly string[]): string | null {
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] ?? null;
}

/** O item CRM do menu só existe se ao menos uma aba estiver liberada. */
export function withCrmParent(menus: Set<string>): Set<string> {
  const out = new Set(menus);
  if (CRM_TAB_SLUGS.some((s) => out.has(s))) out.add("crm");
  else out.delete("crm");
  return out;
}
