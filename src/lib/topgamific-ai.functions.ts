import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchFiles, asksForFile } from "@/lib/ai-file-match";

export interface AiAttachment {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
}

const AI_API_BASE =
  "https://jyukercrhruslahpqlqi.supabase.co/functions/v1/public-api";
const AI_CHAT_URL = `${AI_API_BASE}/ai-chat`;
const AI_FEEDBACK_URL = `${AI_API_BASE}/ai-feedback`;

export interface TopGamificAiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  rating: -1 | 1 | null;
  ratingComment: string | null;
  attachments: AiAttachment[];
}

export interface TopGamificAiFeedbackItem {
  id: string;
  userName: string;
  rating: -1 | 1;
  comment: string | null;
  answer: string;
  question: string | null;
  ratedAt: string | null;
}

export interface TopGamificAiFeedbackResult {
  allowed: boolean;
  positive: number;
  negative: number;
  items: TopGamificAiFeedbackItem[];
}

export const getTopGamificAiFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopGamificAiFeedbackResult> => {
    const [{ data: isAdmin }, { data: isGestor }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor" }),
    ]);
    if (!isAdmin && !isGestor) {
      return { allowed: false, positive: 0, negative: 0, items: [] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rated } = await supabaseAdmin
      .from("topgamific_ai_messages")
      .select("id, user_id, content, rating, rating_comment, rated_at, created_at")
      .not("rating", "is", null)
      .order("rated_at", { ascending: false })
      .limit(100);

    const rows = rated ?? [];
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
    const nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .in("id", userIds);
      for (const p of profs ?? []) nameById.set(String((p as any).id), String((p as any).name ?? ""));
    }

    // Pergunta correspondente = última mensagem do usuário antes da resposta avaliada
    const items: TopGamificAiFeedbackItem[] = [];
    for (const r of rows as any[]) {
      const { data: prev } = await supabaseAdmin
        .from("topgamific_ai_messages")
        .select("content")
        .eq("user_id", r.user_id)
        .eq("role", "user")
        .lt("created_at", r.created_at)
        .order("created_at", { ascending: false })
        .limit(1);
      items.push({
        id: String(r.id),
        userName: nameById.get(String(r.user_id)) || "Usuário",
        rating: r.rating === 1 ? 1 : -1,
        comment: r.rating_comment ? String(r.rating_comment) : null,
        answer: String(r.content ?? ""),
        question: prev && prev[0] ? String((prev[0] as any).content ?? "") : null,
        ratedAt: r.rated_at ? String(r.rated_at) : null,
      });
    }

    return {
      allowed: true,
      positive: items.filter((i) => i.rating === 1).length,
      negative: items.filter((i) => i.rating === -1).length,
      items,
    };
  });

export interface TopGamificAiSendResult {
  ok: boolean;
  error: string | null;
  messages: TopGamificAiMessage[];
}

function toAttachment(f: any): AiAttachment {
  return {
    id: String(f.id),
    fileName: String(f.file_name ?? "arquivo"),
    fileSize: f.file_size != null ? Number(f.file_size) : null,
    mimeType: f.mime_type ? String(f.mime_type) : null,
  };
}

async function attachFiles(supabase: any, msgs: TopGamificAiMessage[], rows: any[]) {
  const ids = Array.from(new Set(rows.flatMap((r) => (r.attachment_ids ?? []) as string[])));
  if (ids.length === 0) return msgs;
  const { data } = await supabase
    .from("ai_assistant_files")
    .select("id, file_name, file_size, mime_type")
    .in("id", ids);
  const byId = new Map((data ?? []).map((f: any) => [String(f.id), toAttachment(f)]));
  return msgs.map((m, i) => ({
    ...m,
    attachments: ((rows[i]?.attachment_ids ?? []) as string[])
      .map((id) => byId.get(String(id)))
      .filter(Boolean) as AiAttachment[],
  }));
}

function mapRows(rows: any[]): TopGamificAiMessage[] {
  return (rows || []).map((r) => ({
    attachments: [],
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
    const { data: updated, error } = await context.supabase
      .from("topgamific_ai_messages")
      .update({
        rating: data.rating,
        rating_comment: data.rating === null ? null : data.comment,
        rated_at: data.rating === null ? null : new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("remote_conversation_id, remote_message_id")
      .maybeSingle();
    if (error) {
      console.error("Erro ao avaliar resposta:", error);
      return { ok: false };
    }

    // Repassa a avaliação para a plataforma Top Gamific (quando houver vínculo).
    const apiKey = process.env["TOPGAMIFIC_API_KEY"];
    const conversationId = (updated as any)?.remote_conversation_id as string | null;
    const userEmail = String((context.claims as any)?.email ?? "").trim();
    if (apiKey && conversationId && data.rating !== null) {
      try {
        const res = await fetch(AI_FEEDBACK_URL, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            message_id: (updated as any)?.remote_message_id ?? undefined,
            vote: data.rating === 1 ? "up" : "down",
            ...(userEmail ? { user_email: userEmail } : {}),
            ...(data.comment ? { comment: data.comment } : {}),
          }),
        });
        if (!res.ok) {
          console.error("[TopGamific] falha ao enviar avaliação:", res.status);
        }
      } catch (e) {
        console.error("[TopGamific] erro ao enviar avaliação:", e);
      }
    }

    return { ok: true };
  });

export const getTopGamificAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopGamificAiMessage[]> => {
    const { data } = await context.supabase
      .from("topgamific_ai_messages")
      .select(
        "id, role, content, created_at, rating, rating_comment, remote_conversation_id, remote_message_id, attachment_ids",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return attachFiles(context.supabase, mapRows(data ?? []), data ?? []);
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
  .inputValidator((input: { message: string; fileIds?: string[] }) => {
    const fileIds = Array.isArray(input?.fileIds)
      ? input.fileIds.map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 5)
      : [];
    const message = String(input?.message ?? "").trim() || (fileIds.length ? "Armazene este arquivo." : "");
    if (!message) throw new Error("Mensagem vazia.");
    return { message: message.slice(0, 4000), fileIds };
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
    const userEmail = String((context.claims as any)?.email ?? "").trim();

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

    // Arquivos anexados agora + acervo relevante para a pergunta
    let sentFiles: any[] = [];
    if (data.fileIds.length) {
      const { data: rows } = await context.supabase
        .from("ai_assistant_files")
        .select("id, file_name, file_size, mime_type, description")
        .in("id", data.fileIds);
      sentFiles = rows ?? [];
      if (sentFiles.length) {
        await context.supabase
          .from("ai_assistant_files")
          .update({ description: data.message.slice(0, 500) })
          .in("id", sentFiles.map((f) => f.id))
          .is("description", null);
      }
    }
    let matchedFiles: any[] = [];
    if (!sentFiles.length) {
      const { data: catalog } = await context.supabase
        .from("ai_assistant_files")
        .select("id, file_name, file_size, mime_type, description")
        .order("created_at", { ascending: false })
        .limit(300);
      const hits = matchFiles(data.message, (catalog ?? []) as any[]);
      matchedFiles = asksForFile(data.message) || hits.length ? hits : [];
    }
    const filesBlock = sentFiles.length
      ? `[Contexto] O usuário anexou e pediu para armazenar: ${sentFiles.map((f) => f.file_name).join(", ")}. O arquivo já foi salvo no acervo interno e ficará disponível para download em buscas futuras. Confirme o armazenamento.`
      : matchedFiles.length
        ? `[Contexto] Arquivos do acervo interno relacionados à pergunta (o sistema exibirá o botão de download abaixo da sua resposta): ${matchedFiles.map((f) => `${f.file_name}${f.description ? ` — ${f.description}` : ""}`).join("; ")}. Mencione que o arquivo está disponível para download.`
        : "";

    // A plataforma aceita apenas mensagens com role "user"/"assistant".
    // O contexto (nome + documentos internos) vai junto da pergunta atual.
    const contextBlocks = [
      userName
        ? `[Contexto] Você está conversando com ${userName}. Responda em português do Brasil, de forma objetiva.`
        : "",
      driveContext ? `[Contexto]\n${driveContext}` : "",
      filesBlock,
    ].filter(Boolean);

    const payloadMessages = [
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: contextBlocks.length
          ? `${contextBlocks.join("\n\n")}\n\n[Pergunta]\n${data.message}`
          : data.message,
      },
    ];


    let reply = "";
    let remoteConversationId: string | null = null;
    let remoteMessageId: string | null = null;
    try {
      const res = await fetch(AI_CHAT_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          messages: payloadMessages,
          ...(userEmail ? { user_email: userEmail } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        let msg = "";
        try {
          msg = String(JSON.parse(detail)?.error ?? "");
        } catch {
          msg = "";
        }
        console.error("[TopGamific] erro ai-chat:", res.status, detail);
        return {
          ok: false,
          error: msg || `A plataforma de gamificação respondeu com erro (${res.status}).`,
          messages: [],
        };
      }

      const json: any = await res.json();
      reply = String(json?.reply ?? json?.message ?? json?.content ?? "").trim();
      remoteConversationId = json?.conversation_id ? String(json.conversation_id) : null;
      remoteMessageId = json?.message_id ? String(json.message_id) : null;
      if (json?.saved === false) {
        console.error("[TopGamific] resposta não salva na plataforma. request_id:", json?.request_id);
      }
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
          attachment_ids: sentFiles.map((f) => f.id),
        },
        {
          user_id: context.userId,
          role: "assistant",
          content: reply,
          created_at: new Date(now + 1).toISOString(),
          remote_conversation_id: remoteConversationId,
          remote_message_id: remoteMessageId,
          attachment_ids: matchedFiles.map((f) => f.id),
        },
      ])
      .select(
        "id, role, content, created_at, rating, rating_comment, remote_conversation_id, remote_message_id, attachment_ids",
      );

    return {
      ok: true,
      error: null,
      messages: await attachFiles(context.supabase, mapRows(inserted ?? []), inserted ?? []),
    };
  });

export const getAiAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { data: f } = await context.supabase
      .from("ai_assistant_files")
      .select("file_path, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (!f) return { url: null };
    const { data: signed } = await context.supabase.storage
      .from("ai-attachments")
      .createSignedUrl(f.file_path, 600, { download: f.file_name });
    return { url: signed?.signedUrl ?? null };
  });
