import { createMiddleware } from "@tanstack/react-start";

/**
 * Usuário de cliente da Gestão de eventos (login sem papel da equipe) só pode chamar funções de
 * servidor da própria Gestão de eventos (arquivos em src/lib/ge/). Várias funções do Gestão usam a
 * chave de serviço depois de conferir apenas o login; esta trava fecha esse caminho para clientes.
 * O banco já bloqueia o resto pelo RLS (is_active_staff), e esta é a segunda camada.
 */
const PERMITIDAS_PREFIXO = "src/lib/ge/";
const PERMITIDAS_ARQUIVOS = new Set<string>(["src/lib/audit.functions.ts"]);

const cache = new Map<string, { externo: boolean; ate: number }>();

function subDoToken(auth: string | null): string | null {
  try {
    const parte = (auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1];
    if (!parte) return null;
    const json = JSON.parse(atob(parte.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.sub === "string" ? json.sub : null;
  } catch { return null; }
}

async function ehClienteExterno(userId: string): Promise<boolean> {
  const c = cache.get(userId);
  if (c && c.ate > Date.now()) return c.externo;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: papeis }, { data: ge }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId).limit(1),
    db.from("ge_profiles").select("id").eq("id", userId).maybeSingle(),
  ]);
  const externo = !(papeis && papeis.length) && !!ge;
  cache.set(userId, { externo, ate: Date.now() + 60_000 });
  return externo;
}

export const travarClienteExterno = createMiddleware({ type: "function" }).server(async ({ next, serverFnMeta }) => {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  let auth: string | null = null;
  try { auth = getRequestHeader("authorization") ?? null; } catch { auth = null; }
  const uid = subDoToken(auth);
  if (uid) {
    const arquivo = String((serverFnMeta as any)?.filename ?? "");
    const liberada = arquivo.startsWith(PERMITIDAS_PREFIXO) || PERMITIDAS_ARQUIVOS.has(arquivo);
    if (!liberada) {
      let externo = false;
      try { externo = await ehClienteExterno(uid); } catch { externo = false; }
      if (externo) throw new Error("Acesso não permitido para usuários de clientes.");
    }
  }
  return next();
});
