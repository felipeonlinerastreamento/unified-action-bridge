/**
 * Tipos de notificação que cada contato de empresa pode receber (Empresas › Contatos).
 * Ficam no próprio contato, em `companies.contacts[].notificacoes` (lista de chaves).
 * Vários contatos podem ter o mesmo tipo marcado: todos recebem.
 */
export const NOTIFICACOES_CONTATO = [
  { key: "geral", label: "Notificações gerais" },
  { key: "sem_comunicacao", label: "Veículo sem comunicação" },
  { key: "financeiro", label: "Financeiro" },
] as const;

export type NotificacaoContato = (typeof NOTIFICACOES_CONTATO)[number]["key"];

const CHAVES = new Set<string>(NOTIFICACOES_CONTATO.map((n) => n.key));

export type ContatoEmpresa = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notificacoes?: unknown;
};

/** Normaliza a lista gravada no contato (ignora chaves desconhecidas e repetidas). */
export function notificacoesDoContato(c: ContatoEmpresa | null | undefined): NotificacaoContato[] {
  const v = c?.notificacoes;
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(String).filter((k) => CHAVES.has(k)))] as NotificacaoContato[];
}

export const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");
export const telefoneValido = (s: unknown) => digitos(s).length >= 10;
export const emailValido = (s: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? "").trim());

/** Telefones e e-mails dos contatos marcados com o tipo de notificação (sem repetição). */
export function destinatariosPorNotificacao(contatos: unknown, tipo: NotificacaoContato) {
  const lista = Array.isArray(contatos) ? (contatos as ContatoEmpresa[]) : [];
  const marcados = lista.filter((c) => c && notificacoesDoContato(c).includes(tipo));
  return {
    nomes: marcados.map((c) => String(c.name ?? "").trim()).filter(Boolean),
    phones: unirTelefones(marcados.map((c) => c.phone)),
    emails: unirEmails(marcados.map((c) => c.email)),
  };
}

/** Junta telefones válidos sem repetir (compara só os dígitos). */
export function unirTelefones(...listas: unknown[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const p of listas.flat(2)) {
    const d = digitos(p);
    if (d.length < 10 || vistos.has(d)) continue;
    vistos.add(d);
    out.push(String(p).trim());
  }
  return out;
}

/** Junta e-mails válidos sem repetir (sem diferenciar maiúsculas). */
export function unirEmails(...listas: unknown[]): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const e of listas.flat(2)) {
    const s = String(e ?? "").trim();
    if (!emailValido(s) || vistos.has(s.toLowerCase())) continue;
    vistos.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}
