import { createMiddleware } from "@tanstack/react-start";

/** Chave no navegador que liga o cabeçalho de modo teste (mantida em sincronia por useModoTeste). */
export const CHAVE_MODO_TESTE = "gestao_modo_teste";

export function modoTesteLocal(): boolean {
  try { return typeof window !== "undefined" && window.localStorage.getItem(CHAVE_MODO_TESTE) === "1"; } catch { return false; }
}

/** Middleware global: com o modo teste ligado neste navegador, avisa o servidor em toda chamada. */
export const anexarModoTeste = createMiddleware({ type: "function" }).client(async ({ next }) =>
  next({ headers: modoTesteLocal() ? { "x-modo-teste": "1" } : {} }),
);
