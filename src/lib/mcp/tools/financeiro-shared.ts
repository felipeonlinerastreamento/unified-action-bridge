import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

/** Cliente do usuário conectado + checagem da lista do Financeiro. */
export async function financeClient(ctx: ToolContext): Promise<{ supabase: any } | { error: string }> {
  if (!ctx.isAuthenticated()) return { error: "Não autenticado" };
  const supabase: any = supabaseForUser(ctx);
  const { data, error } = await supabase.rpc("can_access_finance");
  if (error || data !== true) return { error: "Sem acesso ao Financeiro (somente Felipe e Patrícia)." };
  return { supabase };
}

export const fail = (text: string): any => ({ content: [{ type: "text" as const, text }], isError: true });
export const ok = (obj: unknown): any => ({
  content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
  structuredContent: obj as Record<string, unknown>,
});
