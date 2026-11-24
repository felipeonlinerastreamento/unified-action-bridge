/**
 * Modo teste (simulação). O navegador de um admin com o modo ligado manda o cabeçalho
 * `x-modo-teste: 1` em toda chamada ao servidor (middleware em src/lib/modo-teste.middleware.ts).
 * Os pontos de saída (Z-API, Outlook, GSystem, Autentique) consultam `modoTesteAtivo()`:
 * WhatsApp e e-mail viram prévia em `teste_envios` (e devolvem sucesso simulado);
 * gravações no GSystem e no Autentique são bloqueadas com prévia.
 * Rotinas automáticas (cron/webhook) não têm o cabeçalho e funcionam normalmente.
 */
import { getRequestHeader } from "@tanstack/react-start/server";

export const CABECALHO_MODO_TESTE = "x-modo-teste";

export function modoTesteAtivo(): boolean {
  try { return getRequestHeader(CABECALHO_MODO_TESTE) === "1"; } catch { return false; }
}

/** Id do usuário da requisição (só para registrar a prévia; a autorização é feita em outro lugar). */
function usuarioDaRequisicao(): string | null {
  try {
    const auth = getRequestHeader("authorization") || "";
    const parte = auth.replace(/^Bearer\s+/i, "").split(".")[1];
    if (!parte) return null;
    const json = JSON.parse(atob(parte.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" ? json.sub : null;
  } catch { return null; }
}

export class ModoTesteBloqueado extends Error {
  constructor(o: string) { super(`Modo teste: ${o} não foi enviado de verdade (prévia registrada em Modo teste › Prévias).`); }
}

export async function registrarPrevia(p: {
  canal: "whatsapp" | "email" | "gsystem" | "autentique";
  destino?: string | null;
  resumo: string;
  conteudo?: string | null;
  bloqueado?: boolean;
  detalhe?: unknown;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("teste_envios").insert({
      user_id: usuarioDaRequisicao(),
      canal: p.canal,
      destino: p.destino ?? null,
      resumo: p.resumo.slice(0, 300),
      conteudo: p.conteudo ? String(p.conteudo).slice(0, 8000) : null,
      bloqueado: !!p.bloqueado,
      detalhe: p.detalhe ?? null,
    });
  } catch (e) {
    console.warn("[modo-teste] prévia não registrada", e instanceof Error ? e.message : e);
  }
}

/** Resumo legível de um corpo de requisição (sem base64 gigante). */
export function resumoCorpo(body: unknown): string {
  try {
    return JSON.stringify(body, (_k, v) => (typeof v === "string" && v.length > 500 ? `${v.slice(0, 120)}… (${v.length} caracteres)` : v), 2).slice(0, 6000);
  } catch { return String(body).slice(0, 2000); }
}
