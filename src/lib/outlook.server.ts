// Helpers para Microsoft Graph (Outlook) via Lovable Connector Gateway

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

function getAuthHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const OUTLOOK_API_KEY = process.env.MICROSOFT_OUTLOOK_API_KEY;
  if (!OUTLOOK_API_KEY) throw new Error("MICROSOFT_OUTLOOK_API_KEY não configurada (conector Outlook não conectado)");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": OUTLOOK_API_KEY,
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

export async function getOutlookProfile(): Promise<OutlookProfile> {
  const res = await fetch(`${GATEWAY_URL}/me?$select=displayName,mail,userPrincipalName`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Outlook profile falhou [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function listUnreadMessages(limit = 25): Promise<OutlookMessage[]> {
  const params = new URLSearchParams({
    "$filter": "isRead eq false",
    "$orderby": "receivedDateTime asc",
    "$top": String(limit),
    "$select": "id,internetMessageId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,hasAttachments,isRead,conversationId",
  });
  const res = await fetch(`${GATEWAY_URL}/me/mailFolders/inbox/messages?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Listar mensagens falhou [${res.status}]: ${JSON.stringify(data)}`);
  }
  return (data?.value ?? []) as OutlookMessage[];
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/me/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isRead: true }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Marcar como lida falhou [${res.status}]: ${JSON.stringify(data)}`);
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
