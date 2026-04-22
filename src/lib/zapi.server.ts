// Server-only Z-API REST helpers. Never import from client code.
// Backed by `zapi_chats` and `zapi_messages` tables in Supabase.

const ZAPI_BASE = "https://api.z-api.io";

export interface ZapiChannelCreds {
  id: string;
  zapi_instance_id: string | null;
  token: string; // instance token (legacy 'token' column reused)
  zapi_client_token: string | null;
}

export async function loadZapiChannel(supabase: any, channelId: string): Promise<ZapiChannelCreds> {
  const { data, error } = await supabase
    .from("channels")
    .select("id, token, zapi_instance_id, zapi_client_token, is_active")
    .eq("id", channelId)
    .single();
  if (error || !data) throw new Error("Canal não encontrado");
  if (!data.zapi_instance_id || !data.token) {
    throw new Error("Canal Z-API não configurado: faltam instance_id ou token");
  }
  return data as ZapiChannelCreds;
}

function zapiUrl(channel: ZapiChannelCreds, path: string): string {
  return `${ZAPI_BASE}/instances/${channel.zapi_instance_id}/token/${channel.token}${path}`;
}

export async function zapiFetch(
  channel: ZapiChannelCreds,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (channel.zapi_client_token) headers["Client-Token"] = channel.zapi_client_token;

  const res = await fetch(zapiUrl(channel, path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!res.ok) {
    const msg = parsed?.error || parsed?.message || res.statusText;
    throw new Error(`Z-API ${res.status}: ${msg}`);
  }

  return parsed ?? { success: true };
}

export async function zapiSendText(channel: ZapiChannelCreds, phone: string, message: string) {
  return zapiFetch(channel, "/send-text", "POST", { phone, message });
}

export async function zapiGetStatus(channel: ZapiChannelCreds) {
  return zapiFetch(channel, "/status", "GET");
}
