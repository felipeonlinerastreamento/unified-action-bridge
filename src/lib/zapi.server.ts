// Server-only Z-API REST helpers. Never import from client code.
// Backed by `zapi_chats` and `zapi_messages` tables in Supabase.

const ZAPI_BASE = "https://api.z-api.io";

// Envios feitos pelo operador podem demorar mais que o limite curto usado
// pelas rotinas automáticas (webhook).
const TEXT_SEND_TIMEOUT_MS = 30000;
const MEDIA_SEND_TIMEOUT_MS = 60000;

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

function isTimeoutError(err: unknown): boolean {
  const name = (err as any)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

export async function zapiFetch(
  channel: ZapiChannelCreds,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
  opts?: { timeoutMs?: number; retryOnNetworkError?: boolean; maxAttempts?: number }
): Promise<any> {
  // Content-Type só quando há corpo: em consultas GET o cabeçalho provocava
  // redirecionamento em loop na borda da Z-API.
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (channel.zapi_client_token) headers["Client-Token"] = channel.zapi_client_token;

  // Timeout padrão curto (8s) para rotinas automáticas/webhook, que precisam
  // responder rápido. Envios feitos pelo operador passam um limite maior.
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const payload = body ? JSON.stringify(body) : undefined;
  const maxAttempts = opts?.retryOnNetworkError ? (opts?.maxAttempts ?? 2) : 1;
  const isRead = method === "GET";

  let res: Response | undefined;
  let lastDetail = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // A Z-API às vezes responde com redirecionamento para a mesma URL
      // definindo um cookie; o fetch padrão entra em loop ("Too many redirects").
      // Seguimos manualmente, reenviando os cookies recebidos.
      const signal = AbortSignal.timeout(timeoutMs);
      let url = zapiUrl(channel, path);
      let cookie = "";
      for (let hop = 0; hop < 6; hop++) {
        const h: Record<string, string> = { ...headers };
        if (cookie) h["Cookie"] = cookie;
        const r = await fetch(url, { method, headers: h, body: payload, signal, redirect: "manual" });
        if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
          const setCookie = r.headers.get("set-cookie");
          const loc = r.headers.get("location")!;
          console.warn(`[zapi] redirect ${r.status} hop ${hop}`, {
            sameUrl: loc === url,
            locHost: (() => { try { return new URL(loc, url).host + new URL(loc, url).protocol; } catch { return "?"; } })(),
            hasCookie: !!setCookie,
            server: r.headers.get("server"),
            cfRay: r.headers.get("cf-ray"),
          });
          if (setCookie) {
            const pairs = setCookie.split(/,(?=[^;]+=)/).map((c) => c.split(";")[0].trim()).filter(Boolean);
            cookie = [cookie, ...pairs].filter(Boolean).join("; ");
          }
          url = new URL(r.headers.get("location")!, url).toString();
          await r.body?.cancel();
          continue;
        }
        res = r;
        break;
      }
      if (!res) throw new TypeError("Z-API redirecionou repetidamente");
      break;
    } catch (err: any) {
      lastDetail = [err?.name, err?.message, err?.cause?.message || err?.cause?.code]
        .filter(Boolean)
        .join(" - ")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[,\s]+$/g, "")
        .slice(0, 160);
      console.error(`[zapi] ${method} ${path} tentativa ${attempt}/${maxAttempts} falhou:`, lastDetail);
      if (isTimeoutError(err) && !isRead) {
        // Nunca repetir envio após timeout: a mensagem pode ter sido entregue.
        throw new Error(
          "O WhatsApp demorou demais para responder. A mensagem pode não ter sido entregue — confira a conversa antes de reenviar."
        );
      }
      if (attempt >= maxAttempts) {
        throw new Error(
          isTimeoutError(err)
            ? `O WhatsApp demorou demais para responder (${Math.round(timeoutMs / 1000)}s).`
            : `Falha de conexão com o WhatsApp. Detalhe: ${lastDetail || "desconhecido"}`
        );
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (!res) throw new Error(`Falha de conexão com o WhatsApp. Detalhe: ${lastDetail || "desconhecido"}`);

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
  if (/@lid$/i.test(raw) || /^lid:/i.test(raw)) {
    const lidDigits = raw.replace(/\D/g, "");
    return lidDigits ? `${lidDigits}@lid` : raw;
  }
  if (/-group$/i.test(raw)) return raw;
  if (/@g\.us$/i.test(raw)) return raw.replace(/@g\.us$/i, "-group");

  // Grupo no formato <criador>-<timestamp> (com hífen): apenas anexa -group.
  if (/^\d+-\d+$/.test(raw)) return `${raw}-group`;

  let digits = raw.replace(/\D/g, "");
  if (digits.length > 15) {
    // Grupo legado salvo sem hífen. Tenta remontar usando o padrão BR de
    // criador (55 + DDD + 9 + 8 dígitos = 13 dígitos), seguido do timestamp.
    if (/^55[1-9][0-9]9[0-9]{19,}$/.test(digits) || /^55[1-9][0-9]9[0-9]{10,}$/.test(digits)) {
      if (digits.length > 13) {
        return `${digits.slice(0, 13)}-${digits.slice(13)}-group`;
      }
    }
    return `${digits}-group`;
  }

  // Número BR salvo sem DDI (10 ou 11 dígitos: DDD + número) → prefixa 55.
  if (/^[1-9][0-9]([6-9][0-9]{7}|9[0-9]{8})$/.test(digits)) {
    digits = "55" + digits;
  }

  // BR mobile: ensure the leading "9" after DDD (canonical 13 digits)
  // 12 digits "55DD[6-9]XXXXXXX" → "55DD9[6-9]XXXXXXX"
  if (/^55[1-9][0-9][6-9][0-9]{7}$/.test(digits)) {
    digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
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
  if (opts?.messageId) {
    payload.messageId = opts.messageId;
    console.log("[zapiSendText] payload com citação", {
      phone: payload.phone,
      messageId: opts.messageId,
      messagePreview: message.slice(0, 60),
    });
  }
  return zapiFetch(channel, "/send-text", "POST", payload, {
    timeoutMs: TEXT_SEND_TIMEOUT_MS,
    retryOnNetworkError: true,
  });
}

/**
 * Z-API só aceita áudio em OGG/Opus (ou MP3) no /send-audio. O cliente já
 * grava em OGG/Opus real (opus-recorder). Apenas garante o cabeçalho correto
 * caso algum browser legado entregue outro tipo.
 */
function normalizeAudioDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?,(.+)$/);
  if (!m) return dataUrl;
  const mime = m[1].toLowerCase();
  const payload = m[2];
  if (mime === "audio/ogg" || mime === "audio/mpeg" || mime === "audio/mp3") return dataUrl;
  // Fallback (não deveria ocorrer): repassa como ogg/opus.
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
  const mediaOpts = { timeoutMs: MEDIA_SEND_TIMEOUT_MS };
  if (kind === "audio") {
    return zapiFetch(channel, "/send-audio", "POST", {
      phone: zapiRecipientPhone(phone),
      audio: normalizeAudioDataUrl(dataUrl),
      viewOnce: false,
      waveform: true,
    }, mediaOpts);
  }
  if (kind === "image") {
    return zapiFetch(channel, "/send-image", "POST", {
      phone: zapiRecipientPhone(phone),
      image: dataUrl,
      caption: opts?.caption || "",
    }, mediaOpts);
  }
  if (kind === "video") {
    return zapiFetch(channel, "/send-video", "POST", {
      phone: zapiRecipientPhone(phone),
      video: dataUrl,
      caption: opts?.caption || "",
    }, mediaOpts);
  }
  // document — Z-API requires extension in path
  const ext = (opts?.extension || (opts?.fileName?.split(".").pop() ?? "pdf")).toLowerCase();
  return zapiFetch(channel, `/send-document/${encodeURIComponent(ext)}`, "POST", {
    phone: zapiRecipientPhone(phone),
    document: dataUrl,
    fileName: opts?.fileName || `arquivo.${ext}`,
  }, mediaOpts);
}

export async function zapiGetStatus(channel: ZapiChannelCreds) {
  // Leitura de status: tolera oscilação momentânea de rede (até 3 tentativas, 15 s).
  return zapiFetch(channel, "/status", "GET", undefined, {
    retryOnNetworkError: true,
    maxAttempts: 3,
    timeoutMs: 15000,
  });
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

function extractGroupPhoto(payload: any): string | null {
  const candidates = [
    payload?.groupPicture,
    payload?.picture,
    payload?.photo,
    payload?.image,
    payload?.imageUrl,
    payload?.profilePicture,
    payload?.profilePic,
    payload?.linkImage,
    payload?.group?.picture,
    payload?.group?.photo,
    payload?.group?.image,
    payload?.group?.imageUrl,
    payload?.group?.profilePicture,
    payload?.data?.picture,
    payload?.data?.photo,
    payload?.data?.image,
    payload?.data?.imageUrl,
    payload?.data?.profilePicture,
    payload?.data?.groupPicture,
  ];
  const photo = candidates.find(
    (value) => typeof value === "string" && /^https?:\/\//i.test(value.trim())
  );
  return photo ? photo.trim() : null;
}

export async function zapiGetGroupMetadata(
  channel: ZapiChannelCreds,
  groupPhone: string
): Promise<{ name: string | null; photo: string | null }> {
  const groupId = groupPhone.includes("@g.us") ? groupPhone : `${groupPhone}@g.us`;
  const paths = [
    `/group-metadata/${encodeURIComponent(groupId)}`,
    `/group-metadata/${encodeURIComponent(groupPhone)}`,
    `/groups/${encodeURIComponent(groupId)}`,
    `/groups/${encodeURIComponent(groupPhone)}`,
  ];

  // Orçamento total: as tentativas são sequenciais e cada fetch pode levar 8s.
  // Sem esse limite o webhook estourava o tempo do worker e a mensagem do
  // grupo era perdida.
  const deadline = Date.now() + 10_000;
  const outOfTime = () => Date.now() >= deadline;

  let name: string | null = null;
  let photo: string | null = null;
  for (const path of paths) {
    if (outOfTime()) break;
    try {
      const payload = await zapiFetch(channel, path, "GET");
      if (!name) name = extractGroupName(payload);
      if (!photo) photo = extractGroupPhoto(payload);
      if (name && photo) break;
    } catch (error) {
      console.warn(`[zapi] cannot fetch group metadata via ${path}`, error);
    }
  }

  if (!photo && !outOfTime()) {
    // Fallback: dedicated profile-picture endpoint used by Z-API for both
    // contacts and groups.
    const picPaths = [
      `/profile-picture?phone=${encodeURIComponent(groupId)}`,
      `/profile-picture?phone=${encodeURIComponent(groupPhone)}`,
    ];
    for (const path of picPaths) {
      if (outOfTime()) break;
      try {
        const payload = await zapiFetch(channel, path, "GET");
        const url = extractGroupPhoto(payload) || payload?.link || payload?.url || null;
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
          photo = url;
          break;
        }
      } catch (error) {
        console.warn(`[zapi] cannot fetch group picture via ${path}`, error);
      }
    }
  }


  return { name, photo };
}

export async function zapiGetGroupName(channel: ZapiChannelCreds, groupPhone: string): Promise<string | null> {
  return (await zapiGetGroupMetadata(channel, groupPhone)).name;
}

/**
 * Ativa/desativa rejeição automática de chamadas de voz/vídeo no número conectado.
 * Z-API: PUT /update-call-reject-auto  body { value: boolean }
 */
export async function zapiSetCallRejectAuto(channel: ZapiChannelCreds, enabled: boolean) {
  return zapiFetch(channel, "/update-call-reject-auto", "PUT", { value: !!enabled });
}

/**
 * Define a mensagem enviada após rejeitar automaticamente uma chamada.
 * Requer rejeição automática ativa. Z-API: PUT /update-call-reject-message
 */
export async function zapiSetCallRejectMessage(channel: ZapiChannelCreds, message: string) {
  return zapiFetch(channel, "/update-call-reject-message", "PUT", { value: message });
}
