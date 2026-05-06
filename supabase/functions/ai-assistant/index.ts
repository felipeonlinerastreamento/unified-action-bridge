import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { chatMessages, contactPhone, contactName, attendanceStartTime, userMessage, mode, feature } = await req.json();

    // ENFORCE authentication: every caller must present a valid Supabase JWT.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const callerUserId: string | null = userData?.user?.id ?? null;
    if (userError || !callerUserId) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch AI config (system prompt / knowledge base / enabled flag)
    const { data: configRows } = await supabase
      .from("ai_assistant_config")
      .select("system_prompt, is_enabled")
      .limit(1);
    const cfg = configRows?.[0] as any;
    if (cfg && cfg.is_enabled === false) {
      return new Response(
        JSON.stringify({ error: "Assistente IA está desativado nas configurações." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const knowledgeBase = cfg?.system_prompt || "";

    // Fetch knowledge docs file names for context
    const { data: knowledgeDocs } = await supabase
      .from("ai_knowledge_docs")
      .select("file_name")
      .limit(20);
    const docsContext = knowledgeDocs && knowledgeDocs.length > 0
      ? "\n\nDocumentos de referência na base de conhecimento: " + knowledgeDocs.map(d => d.file_name).join(", ")
      : "";

    // Fetch previous service tickets for this contact
    let previousTicketsContext = "";
    if (contactPhone) {
      const { data: tickets } = await supabase
        .from("service_tickets")
        .select("attendance_id, contact_name, status, notes, created_at, closed_at, company_id")
        .eq("contact_phone", contactPhone)
        .order("created_at", { ascending: false })
        .limit(10);

      if (tickets && tickets.length > 0) {
        previousTicketsContext = "\n\n## Histórico de atendimentos anteriores deste contato:\n" +
          tickets.map((t, i) => {
            const duration = t.closed_at
              ? `Duração: ${Math.round((new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000)} min`
              : "Em andamento";
            return `${i + 1}. [${t.status}] ${t.created_at} — ${duration}\n   Notas: ${t.notes || "Sem notas"}`;
          }).join("\n");
      }
    }

    // Calculate service time
    let serviceTimeContext = "";
    if (attendanceStartTime) {
      const startTime = new Date(attendanceStartTime);
      const now = new Date();
      const diffMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);
      serviceTimeContext = `\nTempo de atendimento atual: ${diffMinutes} minutos.`;
      if (diffMinutes > 15) {
        serviceTimeContext += " ⚠️ ATENÇÃO: Atendimento já ultrapassou 15 minutos. Oriente o operador a concluir ou escalar.";
      }
    }

    // Build the supervisor system prompt
    const supervisorPrompt = `Você é um SUPERVISOR DE ATENDIMENTO. Seu papel é instruir o operador de forma direta, objetiva e prática sobre como conduzir o atendimento atual.

## REGRAS DE COMPORTAMENTO:
1. Seja DIRETO e OBJETIVO — dê instruções claras, não faça perguntas retóricas.
2. Use frases curtas e imperativas: "Faça X", "Pergunte Y", "Ofereça Z".
3. Analise a conversa e identifique: o que o cliente precisa, qual o próximo passo, e possíveis riscos.
4. Se o cliente está insatisfeito, instrua o operador sobre como reverter a situação.
5. Se o atendimento está demorando, sugira encerramento ou escalação.
6. Sempre considere o histórico do cliente para personalizar a instrução.
7. NÃO escreva mensagens para enviar ao cliente — escreva instruções PARA O OPERADOR.
8. Formate suas respostas com bullet points para facilitar a leitura rápida.

## BASE DE CONHECIMENTO E APRENDIZAGEM:
${knowledgeBase || "(Nenhuma base de conhecimento configurada)"}
${docsContext}

## CONTEXTO DO ATENDIMENTO:
- Contato: ${contactName || "Desconhecido"} (${contactPhone || "Sem telefone"})${serviceTimeContext}
${previousTicketsContext}`;

    // Build messages array
    const messages: any[] = [
      { role: "system", content: supervisorPrompt },
    ];

    if (mode === "analyze") {
      messages.push({ role: "user", content: userMessage });
    } else {
      if (chatMessages && chatMessages.length > 0) {
        const chatSummary = chatMessages
          .slice(-30)
          .map((m: any) => `${m.isSentByMe ? "Operador" : "Cliente"}: ${m.text || "[mídia]"}`)
          .join("\n");
        messages.push({
          role: "user",
          content: `Conversa atual:\n${chatSummary}\n\n${userMessage || "Analise a conversa acima e dê instruções diretas ao operador sobre como proceder agora."}`,
        });
      } else if (userMessage) {
        messages.push({ role: "user", content: userMessage });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Estimate input tokens (~4 chars/token) for logging fallback
    const inputChars = messages.reduce((acc: number, m: any) => acc + (m.content?.length || 0), 0);
    const estInputTokens = Math.ceil(inputChars / 4);

    const modelName = "google/gemini-3-flash-preview";
    // Lovable AI Gateway pricing for gemini-flash-preview (approx, USD per 1M tokens)
    const PRICE_IN = 0.075 / 1_000_000;
    const PRICE_OUT = 0.30 / 1_000_000;

    // Tee the response body so we can count tokens while streaming to client
    const [clientStream, logStream] = response.body!.tee();

    // Background: count output tokens from SSE stream and log usage
    (async () => {
      try {
        const reader = logStream.getReader();
        const decoder = new TextDecoder();
        let outputText = "";
        let usageFromApi: any = null;
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).replace(/\r$/, "");
            buf = buf.slice(idx + 1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) outputText += delta;
              if (parsed.usage) usageFromApi = parsed.usage;
            } catch (_) { /* ignore */ }
          }
        }
        const inputTokens = usageFromApi?.prompt_tokens ?? estInputTokens;
        const outputTokens = usageFromApi?.completion_tokens ?? Math.ceil(outputText.length / 4);
        const totalTokens = usageFromApi?.total_tokens ?? (inputTokens + outputTokens);
        const cost = inputTokens * PRICE_IN + outputTokens * PRICE_OUT;

        await supabase.from("ai_usage_logs").insert({
          user_id: callerUserId,
          feature: feature || mode || "chat",
          model: modelName,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          estimated_cost_usd: cost,
          metadata: { contact_phone: contactPhone || null },
        });
      } catch (err) {
        console.error("usage log error:", err);
      }
    })();

    return new Response(clientStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
