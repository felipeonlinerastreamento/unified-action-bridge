/** Server fns de Fornecedores, Aprovações, e-mail do financeiro e DDA (só para quem tem acesso ao Financeiro). */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance } from "@/lib/finance.functions";

const mes = z.string().regex(/^\d{4}-\d{2}$/);

export const simularCobrancaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ fornecedorId: z.string().uuid(), mes }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinance((context as any).supabase);
    const { simularCobranca } = await import("@/lib/finance-fornecedores.server");
    return simularCobranca(data.fornecedorId, data.mes);
  });

export const conferirLancamentoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase);
    const { conferirLancamento } = await import("@/lib/finance-fornecedores.server");
    return { conferencia: await conferirLancamento(data.id, userId) };
  });

/** Aprovar ou reprovar para pagamento: admins e pessoas do setor financeiro (lista de acesso do Financeiro). */
export const decidirAprovacaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200), decisao: z.enum(["aprovado", "reprovado"]), obs: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase);
    if (data.decisao === "reprovado" && !data.obs) throw new Error("Informe o motivo da reprovação.");
    const { decidirAprovacao } = await import("@/lib/finance-fornecedores.server");
    for (const id of data.ids) await decidirAprovacao(id, data.decisao, data.obs || null, userId);
    return { ok: true, total: data.ids.length };
  });

export const lerEmailAgoraFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinance((context as any).supabase);
    const { lerEmailFinanceiro } = await import("@/lib/finance-fornecedores.server");
    return lerEmailFinanceiro(22_000);
  });

/** Contas Microsoft ligadas ao projeto e teste da caixa financeiro@. */
export const statusEmailFinanceiroFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mailbox: z.string().email().max(200), connectionKey: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinance((context as any).supabase);
    const { listOutlookConnectionKeys, getOutlookProfile, listMessagesSince } = await import("@/lib/outlook.server");
    const chaves = listOutlookConnectionKeys();
    try {
      const me = await getOutlookProfile(data.connectionKey);
      const msgs = await listMessagesSince({ connectionKey: data.connectionKey, mailbox: data.mailbox, connectedEmail: me.mail || me.userPrincipalName || null }, new Date(Date.now() - 7 * 86_400_000).toISOString(), 5);
      return { chaves, ok: true, conta: me.mail || me.userPrincipalName || null, recentes: msgs.length, erro: null };
    } catch (e: any) {
      return { chaves, ok: false, conta: null, recentes: 0, erro: String(e?.message ?? e) };
    }
  });

const itemDda = z.object({
  beneficiario: z.string().max(300), documento: z.string().max(20).nullable(), vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  valor: z.number().min(0).max(100_000_000), linha: z.string().max(60).nullable(), chave: z.string().max(200),
});
export const importarDdaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ itens: z.array(itemDda).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertFinance(supabase);
    const { importarDda } = await import("@/lib/finance-fornecedores.server");
    return importarDda(data.itens, userId);
  });
