import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance } from "@/lib/finance.functions";

/** Margem real por cliente (Financeiro). */
export const margemPorClienteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinance((context as any).supabase);
    const { dadosMargem } = await import("@/lib/risco-margem.server");
    return dadosMargem();
  });

const cfgSchema = z.object({
  custo_chip_mensal: z.number().min(0),
  vida_util_meses: z.number().int().min(1).max(240),
  custo_equipamento_padrao: z.number().min(0),
  custo_visita: z.number().min(0),
  custo_chamado: z.number().min(0),
  imposto_pct: z.number().min(0).max(100),
});

/** Salva os parâmetros de custo da margem. */
export const salvarConfigMargemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cfgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase);
    const { error } = await supabase.from("margem_config")
      .upsert({ id: 1, ...data, updated_by: userId, updated_at: new Date().toISOString() } as any, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
