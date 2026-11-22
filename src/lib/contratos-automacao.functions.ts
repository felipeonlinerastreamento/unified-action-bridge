/** Server fns das regras automáticas de Contratos (Configurações › Contratos, aba Reajustes, Financeiro e PDFs). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertContratos(supabase: any) {
  const { data, error } = await supabase.rpc("contratos_allowed");
  if (error) throw new Error(`Não foi possível conferir o acesso a Contratos: ${error.message}.`);
  if (data !== true) throw new Error("Você não tem acesso a Contratos.");
}
async function assertGestor(supabase: any, userId: string) {
  const [{ data: a }, { data: g }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "gestor" }),
  ]);
  if (a !== true && g !== true) throw new Error("Só administradores e gestores alteram as regras de Contratos.");
}

export const lerConfigContratosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertGestor(supabase, userId);
    const { lerConfigContratos } = await import("@/lib/contratos-automacao.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [cfg, { data: usuarios }, { data: existe, error }] = await Promise.all([
      lerConfigContratos(),
      (supabaseAdmin as any).from("profiles").select("user_id, name").eq("is_active", true).order("name"),
      (supabaseAdmin as any).from("contratos_config").select("id").eq("id", 1).maybeSingle(),
    ]);
    return { cfg, usuarios: (usuarios || []).map((u: any) => ({ id: u.user_id, nome: u.name })), pronto: !error && !!existe, erro: error?.message ?? null };
  });

const modo = z.enum(["autentique", "whatsapp", "email", "whatsapp_email"]);
const dias = z.array(z.number().int().min(1).max(365)).max(10);

export const salvarConfigContratosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    lembrete_ativo: z.boolean(), lembrete_dias: dias, lembrete_modo: modo, lembrete_avisar_responsavel: z.boolean(),
    vencimento_ativo: z.boolean(), vencimento_dias: dias, vencimento_avisar_responsavel: z.boolean(),
    vencimento_avisar_usuarios: z.array(z.string().uuid()).max(30), vencimento_fornecedores: z.boolean(),
    proposta_cria_rascunho: z.boolean(), financeiro_tolerancia_pct: z.number().min(0).max(100),
    reajuste_ativo: z.boolean(), reajuste_indice: z.enum(["IPCA", "IGPM", "INPC", "FIXO"]), reajuste_fixo_pct: z.number().min(-50).max(100),
    reajuste_aviso_dias: z.number().int().min(1).max(180), reajuste_mensagem: z.string().trim().min(10).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertGestor(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("contratos_config").update({ ...data, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error(`${error.message}. Confira se a migração 0062 foi aplicada.`);
    return { ok: true };
  });

export const rodarRotinaContratosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertGestor(supabase, userId);
    const { rotinaDiariaContratos } = await import("@/lib/contratos-automacao.server");
    return rotinaDiariaContratos(22_000);
  });

export const atualizarIndicesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertGestor(supabase, userId);
    const { atualizarIndices } = await import("@/lib/contratos-automacao.server");
    return atualizarIndices(true);
  });

/** Conferência com o Financeiro: só para quem tem acesso ao Financeiro. */
export const financeiroContratosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertContratos(supabase);
    const { data: fin } = await supabase.rpc("can_access_finance");
    if (fin !== true) return { permitido: false as const, porContrato: {}, tolerancia: 0 };
    const { financeiroDosContratos } = await import("@/lib/contratos-automacao.server");
    return { permitido: true as const, ...(await financeiroDosContratos()) };
  });

export const listarReajustesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertContratos((context as any).supabase);
    const { listarReajustes } = await import("@/lib/contratos-automacao.server");
    return listarReajustes();
  });

export const aplicarReajusteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), pct: z.number().min(-50).max(100),
    whatsapp: z.boolean(), email: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertContratos(supabase);
    await assertGestor(supabase, userId);
    const { aplicarReajuste } = await import("@/lib/contratos-automacao.server");
    return aplicarReajuste({ id: data.id, data: data.data, pct: data.pct, avisar: { whatsapp: data.whatsapp, email: data.email }, userId });
  });

export const pdfContratoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertContratos((context as any).supabase);
    const { pdfDoContrato } = await import("@/lib/contratos-automacao.server");
    return pdfDoContrato(data.id);
  });
