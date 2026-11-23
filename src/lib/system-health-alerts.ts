/**
 * Regras dos avisos de "Saúde do sistema" (sem banco; testadas em system-health-alerts.test.ts).
 * Evitam falso positivo: um problema só vira aviso depois de aparecer em N verificações seguidas
 * (`integration_fail_threshold`, padrão 2) e só é dado como resolvido depois de N verificações boas.
 * Se o mesmo problema já avisou e voltou ao normal há pouco (oscilação), o novo aviso espera
 * o problema durar `segurarOscilacaoMin` antes de notificar.
 */

export type MetaAlerta = { streak?: number; ok_streak?: number; notified?: boolean; silenced?: boolean };
export type AlertaAberto = { id: string; key: string; opened_at: string; metadata: MetaAlerta | null };

export type Acao =
  | { tipo: "abrir"; key: string; metadata: MetaAlerta; notificar: boolean }
  | { tipo: "atualizar"; id: string; key: string; metadata: MetaAlerta; notificar: boolean }
  | { tipo: "fechar"; id: string; key: string; notificar: boolean };

export function decidirAlertas(opts: {
  problemas: string[];
  abertos: AlertaAberto[];
  /** chaves que avisaram e foram resolvidas há pouco (dentro da janela de oscilação) */
  oscilaram: Set<string>;
  limite: number;
  agora: number;
  segurarOscilacaoMin?: number;
}): Acao[] {
  const limite = Math.max(1, Math.floor(opts.limite || 1));
  const segurar = (opts.segurarOscilacaoMin ?? 60) * 60_000;
  const atuais = new Set(opts.problemas);
  const porChave = new Map(opts.abertos.map((a) => [a.key, a]));
  const acoes: Acao[] = [];

  const podeAvisar = (key: string, streak: number, abertoDesde: number) => {
    if (streak < limite) return false;
    if (opts.oscilaram.has(key) && opts.agora - abertoDesde < segurar) return false;
    return true;
  };

  for (const key of atuais) {
    const a = porChave.get(key);
    if (!a) {
      const notificar = podeAvisar(key, 1, opts.agora);
      acoes.push({ tipo: "abrir", key, notificar, metadata: { streak: 1, ok_streak: 0, notified: notificar, silenced: opts.oscilaram.has(key) && !notificar ? true : undefined } });
      continue;
    }
    const m = a.metadata || {};
    const streak = (m.streak ?? 1) + 1;
    const notificar = !m.notified && podeAvisar(key, streak, Date.parse(a.opened_at));
    acoes.push({ tipo: "atualizar", id: a.id, key, notificar, metadata: { ...m, streak, ok_streak: 0, notified: !!m.notified || notificar } });
  }

  for (const a of opts.abertos) {
    if (atuais.has(a.key)) continue;
    const m = a.metadata || {};
    // Nunca avisou: some sem barulho na primeira verificação boa.
    if (!m.notified) { acoes.push({ tipo: "fechar", id: a.id, key: a.key, notificar: false }); continue; }
    const ok = (m.ok_streak ?? 0) + 1;
    if (ok >= limite) acoes.push({ tipo: "fechar", id: a.id, key: a.key, notificar: true });
    else acoes.push({ tipo: "atualizar", id: a.id, key: a.key, notificar: false, metadata: { ...m, ok_streak: ok } });
  }
  return acoes;
}

/**
 * Chamadas que contam como falha do GSystem: sem resposta (0), autenticação (401/403),
 * limite (429) e erro do servidor (5xx). 404/422 são pedido errado, não GSystem fora do ar.
 * Rastreio dos Correios também grava em integration_logs e não entra na conta.
 */
export function falhaDoGsystem(r: { endpoint?: string | null; status_code?: number | null; error_code?: string | null }): boolean {
  const s = Number(r.status_code || 0);
  return s === 0 || s === 401 || s === 403 || s === 429 || s >= 500 || r.error_code === "fatal_01";
}
export const chamadaDoGsystem = (r: { endpoint?: string | null }) => !String(r.endpoint || "").startsWith("/rastreio");
