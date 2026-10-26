// Helpers para Microsoft Graph (Outlook) via Lovable Connector Gateway

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

export const DEFAULT_CONNECTION_KEY = "MICROSOFT_OUTLOOK_API_KEY";

/** Nomes possíveis de chaves de conexão do Outlook vinculadas ao projeto. */
const CONNECTION_KEY_NAMES = [
  "MICROSOFT_OUTLOOK_API_KEY",
  "MICROSOFT_OUTLOOK_API_KEY_2",
  "MICROSOFT_OUTLOOK_API_KEY_3",
  "MICROSOFT_OUTLOOK_API_KEY_4",
  "MICROSOFT_OUTLOOK_API_KEY_5",
];

export function listOutlookConnectionKeys(): string[] {
  return CONNECTION_KEY_NAMES.filter((name) => (process.env[name] || "").trim().length > 0);
}

function getAuthHeaders(connectionKey: string = DEFAULT_CONNECTION_KEY) {
  const lovableKey =
    (process.env["LOVABLE_API_KEY"] || "").trim() ||
    (process.env["CUSTOM_LOVABLE_API_KEY"] || "").trim();
  if (!lovableKey) {
    throw new Error(
      "Chave da plataforma indisponível no servidor. Publique o app novamente para reativar a integração.",
    );
  }
  const connKey = (process.env[connectionKey] || "").trim();
  if (!connKey) {
    throw new Error(
      `Conta Microsoft não vinculada a este projeto (${connectionKey}). Abra Integrações e conecte a conta desta caixa de e-mail.`,
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

export interface OutlookMessage {
  id: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  receivedDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  conversationId?: string;
}

export interface OutlookProfile {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

function friendlyError(prefix: string, status: number, data: any): Error {
  const code = data?.error?.code || data?.type || "";
  if (status === 401) {
    return new Error(
      `${prefix}: acesso recusado pela Microsoft. A conta desta caixa precisa ser reconectada em Integrações.`,
    );
  }
  if (status === 403 || code === "ErrorAccessDenied") {
    return new Error(
      `${prefix}: a conta conectada não tem permissão para ler esta caixa. Conecte a própria conta desta caixa de e-mail.`,
    );
  }
  if (status === 404) {
    return new Error(`${prefix}: caixa de e-mail não encontrada na conta conectada.`);
  }
  const msg = data?.error?.message || data?.message || JSON.stringify(data);
  return new Error(`${prefix} [${status}]: ${msg}`);
}

export async function getOutlookProfile(connectionKey: string = DEFAULT_CONNECTION_KEY): Promise<OutlookProfile> {
  const res = await fetch(`${GATEWAY_URL}/me?$select=id,displayName,mail,userPrincipalName`, {
    headers: getAuthHeaders(connectionKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw friendlyError("Falha ao consultar a conta Microsoft", res.status, data);
  return data;
}

/** Caminho base do Graph para a caixa desejada. */
function mailboxPath(mailbox: string | null | undefined, connectedEmail: string | null | undefined) {
  const target = (mailbox || "").trim().toLowerCase();
  const own = (connectedEmail || "").trim().toLowerCase();
  if (!target || target === own) return "/me";
  return `/users/${encodeURIComponent(target)}`;
}

export interface MailboxContext {
  connectionKey: string;
  mailbox?: string | null;
  connectedEmail?: string | null;
}

export async function listUnreadMessages(ctx: MailboxContext, limit = 25): Promise<OutlookMessage[]> {
  const params = new URLSearchParams({
    "$filter": "isRead eq false",
    "$orderby": "receivedDateTime asc",
    "$top": String(limit),
    "$select": "id,internetMessageId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,hasAttachments,isRead,conversationId",
  });
  const base = mailboxPath(ctx.mailbox, ctx.connectedEmail);
  const res = await fetch(`${GATEWAY_URL}${base}/mailFolders/inbox/messages?${params.toString()}`, {
    headers: getAuthHeaders(ctx.connectionKey),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw friendlyError("Falha ao ler a caixa de entrada", res.status, data);
  return (data?.value ?? []) as OutlookMessage[];
}

export async function markMessageAsRead(ctx: MailboxContext, messageId: string): Promise<void> {
  const base = mailboxPath(ctx.mailbox, ctx.connectedEmail);
  const res = await fetch(`${GATEWAY_URL}${base}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: getAuthHeaders(ctx.connectionKey),
    body: JSON.stringify({ isRead: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw friendlyError("Falha ao marcar e-mail como lido", res.status, data);
  }
}

export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface InlineImage { name: string; contentType: string; base64: string; cid: string }

/** Responde (reply) a uma mensagem do Outlook mantendo a conversa. */
export async function replyToMessage(
  ctx: MailboxContext,
  messageId: string,
  html: string,
  images: InlineImage[] = [],
): Promise<void> {
  const base = mailboxPath(ctx.mailbox, ctx.connectedEmail);
  const headers = getAuthHeaders(ctx.connectionKey);
  // 1) cria rascunho de resposta
  const draftRes = await fetch(`${GATEWAY_URL}${base}/messages/${encodeURIComponent(messageId)}/createReply`, {
    method: "POST", headers, body: JSON.stringify({}),
  });
  const draft = await draftRes.json().catch(() => ({}));
  if (!draftRes.ok) throw friendlyError("Falha ao criar resposta", draftRes.status, draft);
  const quoted = draft?.body?.content || "";
  // 2) define corpo (nova resposta + histórico citado)
  const patchRes = await fetch(`${GATEWAY_URL}${base}/messages/${encodeURIComponent(draft.id)}`, {
    method: "PATCH", headers,
    body: JSON.stringify({ body: { contentType: "HTML", content: `${html}<br/>${quoted}` } }),
  });
  if (!patchRes.ok) throw friendlyError("Falha ao montar resposta", patchRes.status, await patchRes.json().catch(() => ({})));
  // 3) anexa imagens inline (assinatura)
  for (const img of images) {
    const aRes = await fetch(`${GATEWAY_URL}${base}/messages/${encodeURIComponent(draft.id)}/attachments`, {
      method: "POST", headers,
      body: JSON.stringify({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: img.name, contentType: img.contentType, contentBytes: img.base64,
        isInline: true, contentId: img.cid,
      }),
    });
    if (!aRes.ok) throw friendlyError("Falha ao anexar assinatura", aRes.status, await aRes.json().catch(() => ({})));
  }
  // 4) envia
  const sendRes = await fetch(`${GATEWAY_URL}${base}/messages/${encodeURIComponent(draft.id)}/send`, {
    method: "POST", headers,
  });
  if (!sendRes.ok) throw friendlyError("Falha ao enviar e-mail", sendRes.status, await sendRes.json().catch(() => ({})));
}
