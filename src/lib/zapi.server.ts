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

  // Hard timeout para evitar que o webhook fique pendurado quando a Z-API
  // demora a responder (causava timeout do worker e Z-API parava de entregar
  // eventos). 8s é suficiente para chamadas normais.
  const res = await fetch(zapiUrl(channel, path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
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

function zapiRecipientPhone(phone: string): string {
  const raw = String(phone || "").trim();
  if (!raw) return raw;
  if (/-group$/i.test(raw)) return raw;
  if (/@g\.us$/i.test(raw)) return raw.replace(/@g\.us$/i, "-group");

  const digits = raw.replace(/\D/g, "");
  return digits.length > 15 ? `${digits}-group` : digits;
}

export async function zapiSendText(
  channel: ZapiChannelCreds,
  phone: string,
  message: string,
  opts?: { messageId?: string },
) {
  const payload: Record<string, unknown> = {
    phone: zapiRecipientPhone(phone),
    message,
  };
  // Z-API: passar messageId faz a mensagem ser enviada como resposta/citação
  if (opts?.messageId) payload.messageId = opts.messageId;
  return zapiFetch(channel, "/send-text", "POST", payload);
}

/**
 * Z-API só aceita áudio em OGG/Opus (ou MP3) no /send-audio. O MediaRecorder
 * em Chrome geralmente entrega `audio/webm;codecs=opus`. O payload Opus é
 * compatível — só o cabeçalho do data URL precisa ser reanunciado como ogg.
 */
function normalizeAudioDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?,(.+)$/);
  if (!m) return dataUrl;
  const mime = m[1].toLowerCase();
  const payload = m[2];
  if (mime === "audio/ogg" || mime === "audio/mpeg" || mime === "audio/mp3") return dataUrl;
  return `data:audio/ogg;codecs=opus;base64,${payload}`;
}

/**
 * Send media (audio, image, video, document) via Z-API.
 * `dataUrl` MUST be a base64 data URL (e.g. "data:audio/ogg;base64,...").
 */
export async function zapiSendMedia(
  channel: ZapiChannelCreds,
  phone: string,
  kind: "audio" | "image" | "video" | "document",
  dataUrl: string,
  opts?: { fileName?: string; caption?: string; extension?: string }
) {
  if (kind === "audio") {
    return zapiFetch(channel, "/send-audio", "POST", {
      phone: zapiRecipientPhone(phone),
      audio: normalizeAudioDataUrl(dataUrl),
      viewOnce: false,
      waveform: true,
    });
  }
  if (kind === "image") {
    return zapiFetch(channel, "/send-image", "POST", {
      phone: zapiRecipientPhone(phone),
      image: dataUrl,
      caption: opts?.caption || "",
    });
  }
  if (kind === "video") {
    return zapiFetch(channel, "/send-video", "POST", {
      phone: zapiRecipientPhone(phone),
      video: dataUrl,
      caption: opts?.caption || "",
    });
  }
  // document — Z-API requires extension in path
  const ext = (opts?.extension || (opts?.fileName?.split(".").pop() ?? "pdf")).toLowerCase();
  return zapiFetch(channel, `/send-document/${encodeURIComponent(ext)}`, "POST", {
    phone: zapiRecipientPhone(phone),
    document: dataUrl,
    fileName: opts?.fileName || `arquivo.${ext}`,
  });
}

export async function zapiGetStatus(channel: ZapiChannelCreds) {
  return zapiFetch(channel, "/status", "GET");
}

/**
 * Deletes a message in WhatsApp (for everyone) via Z-API.
 * `owner=true` quando a mensagem foi enviada por nós, `false` quando recebida.
 */
export async function zapiDeleteMessage(
  channel: ZapiChannelCreds,
  params: { messageId: string; phone: string; owner: boolean }
) {
  const qs = new URLSearchParams({
    messageId: params.messageId,
    phone: params.phone,
    owner: String(params.owner),
  }).toString();
  return zapiFetch(channel, `/messages?${qs}`, "DELETE");
}

function extractGroupName(payload: any): string | null {
  const candidates = [
    payload?.name,
    payload?.groupName,
    payload?.subject,
    payload?.chatName,
    payload?.group?.name,
    payload?.group?.subject,
    payload?.data?.name,
    payload?.data?.groupName,
    payload?.data?.subject,
  ];

  const name = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return name ? name.trim() : null;
}

export async function zapiGetGroupName(channel: ZapiChannelCreds, groupPhone: string): Promise<string | null> {
  const groupId = groupPhone.includes("@g.us") ? groupPhone : `${groupPhone}@g.us`;
  const paths = [
    `/group-metadata/${encodeURIComponent(groupId)}`,
    `/group-metadata/${encodeURIComponent(groupPhone)}`,
    `/groups/${encodeURIComponent(groupId)}`,
    `/groups/${encodeURIComponent(groupPhone)}`,
  ];

  for (const path of paths) {
    try {
      const payload = await zapiFetch(channel, path, "GET");
      const name = extractGroupName(payload);
      if (name) return name;
    } catch (error) {
      console.warn(`[zapi] cannot fetch group name via ${path}`, error);
    }
  }

  return null;
}
