import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TestResult = {
  matched: boolean;
  ruleName: string | null;
  sector: string | null;
  replyPreview: string | null;
  requiredFields: string[];
  detectedPlate: string | null;
  detectedPeriod: string | null;
  detectedDocument: string | null;
  collected: Record<string, string>;
  missingFields: string[];
  dataComplete: boolean;
  willReply: boolean;
  isFallback?: boolean;
};

/** Testa uma frase contra as automações ativas, sem enviar nada ao cliente. */
export const testBotAutoReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; operatorName?: string; contactName?: string }) => input)
  .handler(async ({ data, context }): Promise<TestResult> => {
    const {
      matchRules,
      looksLikeOpenQuestion,
      seemsToNeedHelp,
      DEFAULT_FALLBACK_TEXT,
      renderReply,
      extractPlate,
      extractPeriod,
      extractDocument,
      collectFields,
      missingRequiredFields,
      FIELD_LABELS,
    } = await import("@/lib/bot-auto-reply.server");
    const { data: rules } = await context.supabase.from("bot_auto_reply_rules").select("*");
    const list = ((rules as any[]) || []).map((r) => ({
      ...r,
      keywords: r.keywords || [],
      required_fields: r.required_fields || [],
    }));
    const rule = matchRule(data.text, list as any);
    const collected = collectFields(data.text);
    const missing = rule ? missingRequiredFields(rule as any, collected) : [];
    const dataComplete = !!rule && (rule.required_fields || []).length > 0 && missing.length === 0;
    let template = rule
      ? dataComplete
        ? (rule as any).reply_text_complete || ""
        : rule.reply_text
      : "";
    if (rule && !dataComplete && missing.length > 0) {
      const got = Object.keys(collected).filter((k) => !missing.includes(k) && FIELD_LABELS[k]);
      if (got.length > 0) {
        const gotText = got.map((k) => `${FIELD_LABELS[k]} ${collected[k]}`).join(", ");
        const missText = missing.map((k) => FIELD_LABELS[k] || k).join(" e ");
        template = `Já anotei ${gotText}. Para seguir, me informe também ${missText}, por favor.`;
      }
    }
    const preview = rule
      ? renderReply(template, {
          operatorName: data.operatorName || "Operador",
          contactName: data.contactName || "Cliente",
          collected,
        })
      : null;
    return {
      matched: !!rule,
      ruleName: rule?.name ?? null,
      sector: rule?.target_sector ?? null,
      replyPreview: preview,
      requiredFields: rule?.required_fields || [],
      detectedPlate: extractPlate(data.text),
      detectedPeriod: extractPeriod(data.text),
      detectedDocument: extractDocument(data.text),
      collected,
      missingFields: missing,
      dataComplete,
      willReply: !!(preview && preview.trim()),
    };
  });

export type BotInsights = {
  totals: { sent: number; simulated: number; unmatched: number; skipped: number };
  topIntents: Array<{ name: string; count: number }>;
  unmatchedSamples: Array<{
    id: string;
    text: string;
    created_at: string;
    count: number;
    suggestedKeywords: string[];
  }>;
};

/** Painel: assuntos mais detectados e mensagens que o robô não entendeu. */
export const getBotAutoReplyInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number }) => input)
  .handler(async ({ data, context }): Promise<BotInsights> => {
    const days = Math.max(1, Math.min(90, data.days ?? 30));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: rows } = await context.supabase
      .from("bot_auto_reply_log")
      .select("id, rule_name, incoming_text, outcome, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    const { normalizeText } = await import("@/lib/bot-auto-reply.server");
    const STOPWORDS = new Set([
      "para","com","que","uma","uns","meu","minha","dos","das","por","não","nao","sim","por favor","favor",
      "bom","boa","dia","tarde","noite","você","voce","voces","vocês","preciso","quero","gostaria","pode",
      "poderia","estou","esta","está","tem","the","obrigado","obrigada","tudo","bem","aqui","isso","esse",
      "essa","como","qual","quais","onde","quando","mais","mas","porque","pra","sobre","fazer","favor",
    ]);
    const keywordsFrom = (text: string): string[] =>
      [
        ...new Set(
          normalizeText(text)
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .split(/\s+/)
            .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
        ),
      ].slice(0, 5);

    const list = (rows as any[]) || [];
    const totals = { sent: 0, simulated: 0, unmatched: 0, skipped: 0 };
    const intents = new Map<string, number>();
    const unmatched = new Map<
      string,
      { id: string; text: string; created_at: string; count: number }
    >();

    for (const r of list) {
      if (r.outcome === "sent") totals.sent++;
      else if (r.outcome === "simulated") totals.simulated++;
      else if (r.outcome === "unmatched") totals.unmatched++;
      else totals.skipped++;

      if (r.rule_name) intents.set(r.rule_name, (intents.get(r.rule_name) || 0) + 1);
      if (r.outcome === "unmatched" && r.incoming_text) {
        const key = normalizeText(r.incoming_text).slice(0, 120);
        if (!key) continue;
        const prev = unmatched.get(key);
        if (prev) prev.count++;
        else
          unmatched.set(key, {
            id: r.id,
            text: r.incoming_text,
            created_at: r.created_at,
            count: 1,
          });
      }
    }

    const unmatchedSamples = [...unmatched.values()]
      .sort((a, b) => b.count - a.count || (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 50)
      .map((s) => ({ ...s, suggestedKeywords: keywordsFrom(s.text) }));

    return {
      totals,
      topIntents: [...intents.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      unmatchedSamples,
    };
  });

export type RuleSuggestion = {
  name: string;
  keywords: string[];
  reply_text: string;
  required_fields: string[];
};

/** Sugere novas automações a partir das mensagens que o robô não entendeu. */
export const suggestBotAutoReplyRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number }) => input)
  .handler(async ({ data, context }): Promise<{ suggestions: RuleSuggestion[]; note?: string }> => {
    const days = Math.max(1, Math.min(90, data.days ?? 30));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: rows } = await context.supabase
      .from("bot_auto_reply_log")
      .select("incoming_text")
      .eq("outcome", "unmatched")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    const texts = ((rows as any[]) || [])
      .map((r) => String(r.incoming_text || "").trim())
      .filter((t) => t.length > 2);

    if (texts.length < 3) {
      return { suggestions: [], note: "Ainda não há mensagens suficientes sem automação." };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { suggestions: [], note: "Assistente indisponível no momento." };

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você organiza atendimentos de uma empresa de rastreamento veicular. " +
                "Agrupe as mensagens de clientes em até 5 assuntos recorrentes e proponha uma automação para cada. " +
                'Responda SOMENTE um JSON no formato {"suggestions":[{"name":"","keywords":[""],"reply_text":"","required_fields":[""]}]}. ' +
                "Os textos devem estar em português do Brasil, cordiais e objetivos.",
            },
            { role: "user", content: texts.slice(0, 120).join("\n") },
          ],
        }),
      });
      if (!res.ok) return { suggestions: [], note: "Não foi possível gerar sugestões agora." };
      const json: any = await res.json();
      const content = String(json?.choices?.[0]?.message?.content || "");
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return { suggestions: [], note: "Não foi possível gerar sugestões agora." };
      const parsed = JSON.parse(match[0]);
      const suggestions: RuleSuggestion[] = (parsed?.suggestions || [])
        .slice(0, 5)
        .map((s: any) => ({
          name: String(s?.name || "").slice(0, 80),
          keywords: Array.isArray(s?.keywords) ? s.keywords.map(String).slice(0, 12) : [],
          reply_text: String(s?.reply_text || "").slice(0, 600),
          required_fields: Array.isArray(s?.required_fields)
            ? s.required_fields.map(String).slice(0, 6)
            : [],
        }))
        .filter((s: RuleSuggestion) => s.name && s.reply_text);
      return { suggestions };
    } catch (err) {
      console.error("[bot-auto-reply] suggestions failed", err);
      return { suggestions: [], note: "Não foi possível gerar sugestões agora." };
    }
  });
