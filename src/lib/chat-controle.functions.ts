import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAuditLog } from "@/lib/audit.server";
import { getRequestHeader } from "@tanstack/react-start/server";

const SHEETS_GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function clientInfo() {
  try {
    const ip =
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      null;
    const ua = getRequestHeader("user-agent") || null;
    return { ip, ua };
  } catch {
    return { ip: null, ua: null };
  }
}

async function getUserName(supabase: any, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle();
    return data?.name ?? null;
  } catch {
    return null;
  }
}

async function audit(params: {
  supabase: any;
  userId: string;
  event_type: string;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const userName = await getUserName(params.supabase, params.userId);
    const { ip, ua } = clientInfo();
    await writeAuditLog({
      user_id: params.userId,
      user_name: userName,
      event_category: "central_atendimento",
      event_type: params.event_type,
      target_type: "chat_controle_link",
      target_id: params.target_id ?? null,
      target_label: params.target_label ?? null,
      metadata: params.metadata ?? {},
      ip_address: ip,
      user_agent: ua,
    });
  } catch (err) {
    console.error("[chat-controle audit] failed:", err);
  }
}

function sheetsHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const sheetsKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !sheetsKey) {
    throw new Error(
      "Conector do Google Sheets não configurado. Peça ao administrador para conectar o Google na área de Conectores.",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": sheetsKey,
    "Content-Type": "application/json",
  };
}

function driveHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) {
    throw new Error(
      "Conector do Google Drive não configurado. Peça ao administrador para conectar o Google Drive na área de Conectores.",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
    "Content-Type": "application/json",
  };
}

async function readGatewayError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return `${res.status} ${res.statusText}: ${text.slice(0, 400)}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

const createSchema = z.object({
  chatId: z.string().uuid().optional().nullable(),
  ticketId: z.string().uuid().optional().nullable(),
  contactName: z.string().max(255).optional().nullable(),
  contactPhone: z.string().max(64).optional().nullable(),
  protocol: z.string().max(64).optional().nullable(),
  companyName: z.string().max(255).optional().nullable(),
}).refine((d) => !!d.chatId || !!d.ticketId, { message: "chatId ou ticketId é obrigatório" });

export const createChatControleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createSchema.parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const titleBase = data.protocol
      ? `Atendimento ${data.protocol}`
      : data.contactName
        ? `Atendimento — ${data.contactName}`
        : "Atendimento — Controle";
    const title = data.contactName && data.protocol
      ? `${titleBase} — ${data.contactName}`
      : titleBase;

    // 1. Create spreadsheet
    const createRes = await fetch(`${SHEETS_GATEWAY}/spreadsheets`, {
      method: "POST",
      headers: sheetsHeaders(),
      body: JSON.stringify({ properties: { title } }),
    });
    if (!createRes.ok) {
      throw new Error(`Falha ao criar a planilha (Sheets): ${await readGatewayError(createRes)}`);
    }
    const created = (await createRes.json()) as {
      spreadsheetId: string;
      spreadsheetUrl: string;
    };
    const spreadsheetId = created.spreadsheetId;
    const spreadsheetUrl = created.spreadsheetUrl;

    // 2. Pre-fill header + values
    const nowBr = new Date().toLocaleString("pt-BR");
    const values = [
      ["Atendimento", "Contato", "Telefone", "Empresa", "Data"],
      [
        data.protocol ?? "",
        data.contactName ?? "",
        data.contactPhone ?? "",
        data.companyName ?? "",
        nowBr,
      ],
    ];
    try {
      const fillRes = await fetch(
        `${SHEETS_GATEWAY}/spreadsheets/${spreadsheetId}/values/A1:E2?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: sheetsHeaders(),
          body: JSON.stringify({ range: "A1:E2", majorDimension: "ROWS", values }),
        },
      );
      if (!fillRes.ok) {
        console.warn("[createChatControleSheet] header fill failed:", await readGatewayError(fillRes));
      }
    } catch (err) {
      console.warn("[createChatControleSheet] header fill exception:", err);
    }

    // 3. Set "anyone with link can edit"
    try {
      const permRes = await fetch(`${DRIVE_GATEWAY}/files/${spreadsheetId}/permissions`, {
        method: "POST",
        headers: driveHeaders(),
        body: JSON.stringify({ role: "writer", type: "anyone" }),
      });
      if (!permRes.ok) {
        console.warn(
          "[createChatControleSheet] permission set failed:",
          await readGatewayError(permRes),
        );
      }
    } catch (err) {
      console.warn("[createChatControleSheet] permission set exception:", err);
    }

    // 4. Upsert into chat_controle_links
    const label = data.contactName
      ? `Planilha — ${data.contactName}`
      : data.protocol
        ? `Planilha — ${data.protocol}`
        : "Planilha de controle";

    const targetCol = data.chatId ? "chat_id" : "ticket_id";
    const targetVal = data.chatId ?? data.ticketId!;
    const { data: existing } = await supabase
      .from("chat_controle_links")
      .select("id")
      .eq(targetCol, targetVal)
      .maybeSingle();

    let rowId: string;
    if (existing?.id) {
      const { data: updated, error } = await supabase
        .from("chat_controle_links")
        .update({ url: spreadsheetUrl, label, updated_by: userId })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      rowId = updated.id;
    } else {
      const { data: inserted, error } = await supabase
        .from("chat_controle_links")
        .insert({
          chat_id: data.chatId ?? null,
          ticket_id: data.ticketId ?? null,
          url: spreadsheetUrl,
          label,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      rowId = inserted.id;
    }

    // 5. Audit
    await audit({
      supabase,
      userId,
      event_type: "controle_link.create",
      target_id: rowId,
      target_label: label,
      metadata: {
        chat_id: data.chatId ?? null,
        ticket_id: data.ticketId ?? null,
        spreadsheet_id: spreadsheetId,
        url: spreadsheetUrl,
        protocol: data.protocol ?? null,
        contact_name: data.contactName ?? null,
        company_name: data.companyName ?? null,
        source: "google_sheets_connector",
      },
    });

    return { id: rowId, url: spreadsheetUrl, label, spreadsheetId };
  });

const upsertLinkSchema = z.object({
  id: z.string().uuid().optional(),
  chatId: z.string().uuid(),
  url: z.string().url().max(2048),
  label: z.string().max(255).optional().nullable(),
});

export const upsertChatControleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(upsertLinkSchema.parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    if (data.id) {
      const { data: before } = await supabase
        .from("chat_controle_links")
        .select("id, url, label")
        .eq("id", data.id)
        .maybeSingle();

      const { data: updated, error } = await supabase
        .from("chat_controle_links")
        .update({ url: data.url, label: data.label ?? null, updated_by: userId })
        .eq("id", data.id)
        .select("id, url, label")
        .single();
      if (error) throw new Error(error.message);

      await audit({
        supabase,
        userId,
        event_type: "controle_link.update",
        target_id: updated.id,
        target_label: updated.label || updated.url,
        metadata: {
          chat_id: data.chatId,
          before: before
            ? { url: before.url, label: before.label }
            : null,
          after: { url: updated.url, label: updated.label },
        },
      });
      return { id: updated.id, url: updated.url, label: updated.label };
    }

    const { data: inserted, error } = await supabase
      .from("chat_controle_links")
      .insert({
        chat_id: data.chatId,
        url: data.url,
        label: data.label ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, url, label")
      .single();
    if (error) throw new Error(error.message);

    await audit({
      supabase,
      userId,
      event_type: "controle_link.create",
      target_id: inserted.id,
      target_label: inserted.label || inserted.url,
      metadata: {
        chat_id: data.chatId,
        url: inserted.url,
        source: "manual_link",
      },
    });

    return { id: inserted.id, url: inserted.url, label: inserted.label };
  });

const deleteSchema = z.object({ id: z.string().uuid(), chatId: z.string().uuid().optional() });

export const deleteChatControleLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(deleteSchema.parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: before } = await supabase
      .from("chat_controle_links")
      .select("id, chat_id, url, label")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabase.from("chat_controle_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await audit({
      supabase,
      userId,
      event_type: "controle_link.delete",
      target_id: data.id,
      target_label: before?.label || before?.url || null,
      metadata: {
        chat_id: before?.chat_id ?? data.chatId ?? null,
        url: before?.url ?? null,
        label: before?.label ?? null,
      },
    });

    return { success: true };
  });

const openSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid().optional(),
  url: z.string().url().max(2048).optional(),
  label: z.string().max(255).optional().nullable(),
});

export const logChatControleOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(openSchema.parse)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    await audit({
      supabase,
      userId,
      event_type: "controle_link.open",
      target_id: data.id,
      target_label: data.label || data.url || null,
      metadata: { chat_id: data.chatId ?? null, url: data.url ?? null },
    });
    return { success: true };
  });
