import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAiGuidelines } from "@/lib/ai-guidelines";

/**
 * Gera um resumo curto do atendimento (chat) e grava como comentário no
 * chamado, quando "Resumo automático ao finalizar" estiver ativo nas
 * configurações do Assistente IA. Falhas nunca bloqueiam a finalização.
 */
export const gerarResumoAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; transcript: string }) => {
    if (!input?.ticketId || typeof input.ticketId !== "string") throw new Error("ticketId obrigatório");
    return { ticketId: input.ticketId, transcript: String(input.transcript || "").slice(-12000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cfg } = await supabase
      .from("ai_assistant_config")
      .select("is_enabled, auto_summary_enabled, tone, response_format, temperature, forbidden_topics, fallback_message")
      .limit(1)
      .maybeSingle();
    if (!cfg || cfg.is_enabled === false || !cfg.auto_summary_enabled) return { skipped: true as const };
    if (!data.transcript.trim()) return { skipped: true as const };

    let summary = "";
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const resp = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Você resume atendimentos de uma empresa de rastreamento veicular para o histórico interno do chamado. " +
          "Escreva de 2 a 3 linhas: motivo do contato, o que foi feito e o desfecho/pendência. " +
          "Não invente fatos que não estejam na conversa.\n\n" +
          buildAiGuidelines({ ...cfg, response_format: "topicos" }),
        input: `Conversa:\n${data.transcript}`,
      });
      for (const item of resp.output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content) if (c.type === "output_text") summary += c.text;
      }
      summary = summary.trim();
    } catch (err) {
      console.error("[ai-summary] gateway error", err instanceof Error ? err.message : err);
      return { skipped: true as const };
    }
    if (!summary) return { skipped: true as const };

    const { error } = await supabase.from("ticket_comments").insert({
      ticket_id: data.ticketId,
      user_id: userId,
      content: `Resumo automático (IA):\n${summary}`,
      comment_type: "system",
    } as any);
    if (error) {
      console.error("[ai-summary] insert failed", error.message);
      return { skipped: true as const };
    }
    return { skipped: false as const, summary };
  });
