import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_CHAT_URL =
  "https://jyukercrhruslahpqlqi.supabase.co/functions/v1/public-api/ai-chat";

export interface TopGamificAiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  rating: -1 | 1 | null;
  ratingComment: string | null;
}

export interface TopGamificAiSendResult {
  ok: boolean;
  error: string | null;
  messages: TopGamificAiMessage[];
}

function mapRows(rows: any[]): TopGamificAiMessage[] {
  return (rows || []).map((r) => ({
    id: String(r.id),
    role: r.role === "assistant" ? "assistant" : "user",
    content: String(r.content ?? ""),
    createdAt: String(r.created_at ?? ""),
    rating: r.rating === 1 ? 1 : r.rating === -1 ? -1 : null,
    ratingComment: r.rating_comment ? String(r.rating_comment) : null,
  }));
}

export const rateTopGamificAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; rating: -1 | 1 | null; comment?: string }) => ({
    id: String(input?.id ?? ""),
    rating: input?.rating === 1 ? 1 : input?.rating === -1 ? -1 : null,
    comment: String(input?.comment ?? "").trim().slice(0, 1000) || null,
  }))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    if (!data.id) return { ok: false };
    const { error } = await context.supabase
      .from("topgamific_ai_messages")
      .update({
        rating: data.rating,
        rating_comment: data.rating === null ? null : data.comment,
        rated_at: data.rating === null ? null : new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) {
      console.error("Erro ao avaliar resposta:", error);
      return { ok: false };
    }
    return { ok: true };
  });

export const getTopGamificAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopGamificAiMessage[]> => {
    const { data } = await context.supabase
      .from("topgamific_ai_messages")
      .select("id, role, content, created_at, rating, rating_comment")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return mapRows(data ?? []);
  });

export const clearTopGamificAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    await context.supabase
      .from("topgamific_ai_messages")
      .delete()
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const sendTopGamificAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { message: string }) => {
    const message = String(input?.message ?? "").trim();
    if (!message) throw new Error("Mensagem vazia.");
    return { message: message.slice(0, 4000) };
  })
  .handler(async ({ data, context }): Promise<TopGamificAiSendResult> => {
    const apiKey = process.env["TOPGAMIFIC_API_KEY"];
    if (!apiKey) {
      return {
        ok: false,
        error: "Chave de integração não configurada.",
        messages: [],
      };
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const userName = profile?.name?.trim() ?? "";

    const { data: historyRows } = await context.supabase
      .from("topgamific_ai_messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(40);

    const history = mapRows(historyRows ?? []);

    let driveContext: string | null = null;
    try {
      const { getDriveContext } = await import("@/lib/google-drive.server");
      driveContext = await getDriveContext(data.message);
    } catch (e) {
      console.error("Falha ao consultar o Google Drive:", e);
    }

    const payloadMessages = [
      ...(userName
        ? [
            {
              role: "system",
              content: `Você está conversando com ${userName}. Responda em português do Brasil, de forma objetiva, considerando os dados desse colaborador na plataforma Top Gamific.`,
            },
          ]
        : []),
      ...(driveContext
        ? [{ role: "system", content: driveContext }]
        : []),
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.message },
    ];

    let reply = "";
    try {
      const res = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ messages: payloadMessages }),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `A plataforma de gamificação respondeu com erro (${res.status}).`,
          messages: [],
        };
      }
      const json: any = await res.json();
      reply = String(json?.reply ?? json?.message ?? json?.content ?? "").trim();
    } catch {
      return {
        ok: false,
        error: "Não foi possível conectar ao assistente da gamificação.",
        messages: [],
      };
    }

    if (!reply) {
      return {
        ok: false,
        error: "O assistente não retornou resposta.",
        messages: [],
      };
    }

    const now = Date.now();
    const { data: inserted } = await context.supabase
      .from("topgamific_ai_messages")
      .insert([
        {
          user_id: context.userId,
          role: "user",
          content: data.message,
          created_at: new Date(now).toISOString(),
        },
        {
          user_id: context.userId,
          role: "assistant",
          content: reply,
          created_at: new Date(now + 1).toISOString(),
        },
      ])
      .select("id, role, content, created_at, rating, rating_comment");

    return { ok: true, error: null, messages: mapRows(inserted ?? []) };
  });
