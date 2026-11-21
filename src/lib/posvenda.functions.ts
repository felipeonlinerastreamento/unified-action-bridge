import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Atualiza a carteira do Pós-venda a partir do GSystem e das faturas. Quem tem a aba Pós-venda. */
export const atualizarCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase.rpc("crm_tab_allowed", { _tab: "posvenda" });
    if (error || data !== true) throw new Error("Você não tem acesso ao Pós-venda.");
    const { atualizarCarteiraPosVenda } = await import("@/lib/posvenda-carteira.server");
    return atualizarCarteiraPosVenda();
  });
