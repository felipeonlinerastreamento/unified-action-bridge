import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const FALLBACK_QUOTES = [
  { content: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { content: "Comece onde você está. Use o que você tem. Faça o que você pode.", author: "Arthur Ashe" },
  { content: "A persistência é o caminho do êxito.", author: "Charles Chaplin" },
  { content: "Não espere por uma crise para descobrir o que é importante em sua vida.", author: "Platão" },
  { content: "Cada dia é uma nova oportunidade para crescer.", author: "Anônimo" },
  { content: "A excelência não é um ato, mas um hábito.", author: "Aristóteles" },
  { content: "Foque no progresso, não na perfeição.", author: "Anônimo" },
  { content: "Grandes coisas nunca vêm de zonas de conforto.", author: "Anônimo" },
  { content: "Seu único limite é você mesmo.", author: "Anônimo" },
  { content: "Acredite que você pode e você já está no meio do caminho.", author: "Theodore Roosevelt" },
  { content: "A jornada de mil milhas começa com um único passo.", author: "Lao Tsé" },
  { content: "Faça hoje o que os outros não querem, viva amanhã como os outros não podem.", author: "Anônimo" },
];

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function generateWithAI(seed: string): Promise<{ content: string; author: string } | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 1.1,
        messages: [
          {
            role: "system",
            content:
              "Você gera UMA frase motivacional curta, original e ÚNICA em português brasileiro para uma equipe de atendimento ao cliente. Varie temas (foco, persistência, gentileza, equipe, crescimento, propósito). Responda APENAS no formato JSON: {\"content\":\"frase\",\"author\":\"autor real ou Anônimo\"}. Nada além disso.",
          },
          {
            role: "user",
            content: `Gere uma frase motivacional totalmente nova e diferente de qualquer outra. Semente de aleatoriedade: ${seed}.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.content === "string" && parsed.content.trim()) {
      return { content: parsed.content.trim(), author: (parsed.author || "Anônimo").trim() };
    }
    return null;
  } catch (err) {
    console.error("AI quote generation failed:", err);
    return null;
  }
}

export const getDailyQuote = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid().optional() }).parse(data ?? {})
  )
  .handler(async ({ data }) => {
    const supabase = getServiceSupabase();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const userId = data.userId ?? null;

    // 1. Try existing quote for this user (or global) today
    const query = supabase
      .from("daily_motivational_quotes")
      .select("content, author, quote_date")
      .eq("quote_date", today);
    const { data: existing } = userId
      ? await query.eq("user_id", userId).maybeSingle()
      : await query.is("user_id", null).maybeSingle();

    if (existing) {
      return { content: existing.content, author: existing.author || "", date: today };
    }

    // 2. Generate new quote (AI or fallback) — seed with user+date for variety
    const seed = `${userId ?? "global"}-${today}-${Math.random().toString(36).slice(2, 10)}`;
    let generated = await generateWithAI(seed);
    if (!generated) {
      const idx = Math.floor(Math.random() * FALLBACK_QUOTES.length);
      generated = FALLBACK_QUOTES[idx];
    }

    // 3. Persist
    const { data: inserted, error: insertError } = await supabase
      .from("daily_motivational_quotes")
      .insert({
        quote_date: today,
        content: generated.content,
        author: generated.author,
        user_id: userId,
      })
      .select("content, author")
      .maybeSingle();

    if (insertError) {
      // Race: another request may have inserted; re-read
      const retryQuery = supabase
        .from("daily_motivational_quotes")
        .select("content, author")
        .eq("quote_date", today);
      const { data: retry } = userId
        ? await retryQuery.eq("user_id", userId).maybeSingle()
        : await retryQuery.is("user_id", null).maybeSingle();
      if (retry) return { content: retry.content, author: retry.author || "", date: today };
    }

    return {
      content: inserted?.content || generated.content,
      author: inserted?.author || generated.author,
      date: today,
    };
  });
