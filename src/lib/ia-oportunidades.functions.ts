import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INSTRUCOES_IA, deveCriar, lerRespostaOportunidade, notasOportunidade, TIPOS_OPORTUNIDADE } from "@/lib/ia-oportunidades";

const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/**
 * Lê a conversa finalizada e, se a IA achar oportunidade de venda, cria a oportunidade no CRM
 * (Pipeline, origem "ia_chat") com a proposta sugerida nas observações, avisa o responsável e
 * registra no chamado. Fire-and-forget na finalização: falhas nunca bloqueiam o atendimento.
 */
export const detectarOportunidadeChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; transcript: string }) => {
    if (!input?.ticketId || typeof input.ticketId !== "string") throw new Error("ticketId obrigatório");
    return { ticketId: input.ticketId, transcript: String(input.transcript || "").slice(-12000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: cfg } = await db.from("ai_assistant_config").select("is_enabled, ia_oportunidades_ativo, ia_oportunidades_confianca").limit(1).maybeSingle();
    if (!cfg || cfg.is_enabled === false || cfg.ia_oportunidades_ativo === false) return { criada: false as const, motivo: "desativado" };
    // Precisa de algumas falas do cliente para valer a análise.
    if ((data.transcript.match(/^Cliente:/gm) ?? []).length < 2) return { criada: false as const, motivo: "conversa curta" };

    // O usuário precisa enxergar o chamado (RLS) — evita usar a função para ler chamados alheios.
    const { data: ticket } = await supabase.from("service_tickets")
      .select("id, protocol_number, contact_name, contact_phone, company_id").eq("id", data.ticketId).maybeSingle();
    if (!ticket) return { criada: false as const, motivo: "chamado não encontrado" };

    let texto = "";
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const resp = await generateResponse({ model: "openai/gpt-6-astra", instructions: INSTRUCOES_IA, input: `Conversa:\n${data.transcript}` });
      for (const item of resp.output ?? []) {
        if (item.type !== "message") continue;
        for (const c of item.content) if (c.type === "output_text") texto += c.text;
      }
    } catch (err) {
      console.error("[ia-oportunidades] gateway", err instanceof Error ? err.message : err);
      return { criada: false as const, motivo: "IA indisponível" };
    }
    const l = lerRespostaOportunidade(texto);
    if (!deveCriar(l, Number(cfg.ia_oportunidades_confianca ?? 0.6))) return { criada: false as const, motivo: "sem oportunidade" };

    const fone = soDigitos(ticket.contact_phone);
    let contato: any = null;
    if (fone.length >= 10) {
      const { data: cs } = await db.from("crm_contacts").select("id, name, phone, email, company_id").ilike("phone", `%${fone.slice(-8)}%`).limit(1);
      contato = cs?.[0] ?? null;
    }
    const companyId = ticket.company_id ?? contato?.company_id ?? null;
    let empresa: any = null;
    if (companyId) empresa = (await db.from("companies").select("id, name, cnpj").eq("id", companyId).maybeSingle()).data;

    // Não duplica: já existe oportunidade da IA aberta para o mesmo contato/empresa nos últimos 7 dias.
    const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
    let dup = db.from("crm_opportunities").select("id").eq("source", "ia_chat").eq("status", "open").gte("created_at", desde).limit(1);
    dup = companyId ? dup.eq("company_id", companyId) : fone ? dup.ilike("contact_phone", `%${fone.slice(-8)}%`) : dup.eq("contact_name", ticket.contact_name ?? "");
    if ((await dup).data?.length) return { criada: false as const, motivo: "já existe oportunidade aberta" };

    // Responsável: o pós-venda do cliente (carteira), senão quem finalizou o atendimento.
    let owner = userId as string;
    if (empresa?.cnpj) {
      const { data: cart } = await db.from("crm_posvenda_carteira").select("responsavel_id").eq("documento", soDigitos(empresa.cnpj)).maybeSingle();
      if (cart?.responsavel_id) owner = cart.responsavel_id;
    }
    const { data: stage } = await db.from("crm_pipeline_stages").select("id, default_probability")
      .eq("is_won", false).eq("is_lost", false).order("position").limit(1).maybeSingle();
    const protocolo = ticket.protocol_number ? `#${String(ticket.protocol_number).padStart(5, "0")}` : null;
    const titulo = `💡 ${l.titulo} — ${empresa?.name ?? contato?.name ?? ticket.contact_name ?? "cliente"}`.slice(0, 140);

    const { data: opp, error } = await db.from("crm_opportunities").insert({
      title: titulo,
      contact_id: contato?.id ?? null,
      company_id: companyId,
      company_name: empresa?.name ?? null,
      contact_name: contato?.name ?? ticket.contact_name ?? null,
      contact_phone: contato?.phone ?? ticket.contact_phone ?? null,
      contact_email: contato?.email ?? null,
      stage_id: stage?.id ?? null,
      probability: stage?.default_probability ?? null,
      expected_value: l.valor_mensal ?? 0,
      opportunity_type: l.tipo === "renovacao" ? "renewal" : "upsell",
      source: "ia_chat",
      status: "open",
      owner_id: owner,
      created_by: userId,
      notes: notasOportunidade(l, protocolo),
    }).select("id").maybeSingle();
    if (error || !opp) {
      console.error("[ia-oportunidades] insert", error?.message);
      return { criada: false as const, motivo: "falha ao gravar" };
    }

    await db.from("notifications").insert({
      user_id: owner,
      title: "💡 Oportunidade de venda na conversa",
      message: `${titulo.replace(/^💡 /, "")} (${TIPOS_OPORTUNIDADE[l.tipo]}). Proposta sugerida pronta em CRM › Oportunidades.`,
      type: "oportunidade_ia",
      show_as_popup: true,
      ticket_id: ticket.id,
      metadata: { opportunity_id: opp.id, confianca: l.confianca },
    });
    await db.from("ticket_comments").insert({
      ticket_id: ticket.id, user_id: userId, comment_type: "system",
      content: `💡 IA identificou oportunidade de venda: ${l.titulo}. ${l.resumo} (criada em CRM › Oportunidades)`,
    });
    return { criada: true as const, opportunityId: opp.id };
  });
