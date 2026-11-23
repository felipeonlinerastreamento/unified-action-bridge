/** Domínio oficial dos links enviados a clientes (termos, propostas, contratos). */
export const DOMINIO_PUBLICO = "https://gestao.onlinerastreamento.com.br";

/**
 * Endereço base dos links públicos: usa o configurado, mas troca endereços internos
 * (*.lovable.app, lovableproject.com, localhost) ou vazios pelo domínio oficial.
 */
export function basePublica(configurado?: string | null): string {
  const b = String(configurado ?? "").trim().replace(/\/+$/, "");
  if (!b || !/^https?:\/\//i.test(b)) return DOMINIO_PUBLICO;
  if (/(\.lovable\.app|\.lovableproject\.com|\.lovable\.dev|localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(b)) return DOMINIO_PUBLICO;
  return b;
}
