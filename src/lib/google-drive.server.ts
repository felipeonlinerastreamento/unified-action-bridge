const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

const STOPWORDS = new Set([
  "qual",
  "quais",
  "como",
  "onde",
  "para",
  "pelo",
  "pela",
  "dos",
  "das",
  "com",
  "sem",
  "uma",
  "uns",
  "umas",
  "que",
  "the",
  "and",
  "configuracao",
  "configuracoes",
  "arquivo",
  "arquivos",
  "pasta",
  "sobre",
  "favor",
  "preciso",
  "sistema",
  "informacao",
  "informacoes",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function extractKeywords(question: string): string[] {
  const words = normalize(question)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, 5);
}

function headers(): Record<string, string> | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

async function searchFiles(
  h: Record<string, string>,
  q: string,
  pageSize = 10,
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType,modifiedTime)",
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${GATEWAY}/drive/v3/files?${params.toString()}`, {
    headers: h,
  });
  if (!res.ok) {
    console.error(`Drive search failed [${res.status}]: ${await res.text()}`);
    return [];
  }
  const json: any = await res.json();
  return (json?.files ?? []) as DriveFile[];
}

async function readFile(
  h: Record<string, string>,
  file: DriveFile,
  maxChars = 6000,
): Promise<string | null> {
  const isGoogleDoc = file.mimeType.startsWith("application/vnd.google-apps");
  let url: string;
  if (isGoogleDoc) {
    if (
      !/document|spreadsheet|presentation/.test(file.mimeType) ||
      file.mimeType.includes("folder")
    ) {
      return null;
    }
    const mime = file.mimeType.includes("spreadsheet")
      ? "text/csv"
      : "text/plain";
    url = `${GATEWAY}/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(mime)}`;
  } else if (
    file.mimeType.startsWith("text/") ||
    file.mimeType.includes("json") ||
    file.mimeType.includes("csv") ||
    file.mimeType === "application/xml" ||
    file.mimeType === "text/xml"
  ) {
    url = `${GATEWAY}/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  } else {
    return null;
  }

  const res = await fetch(url, { headers: h });
  if (!res.ok) {
    console.error(`Drive read failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const text = await res.text();
  return text.slice(0, maxChars);
}

/**
 * Busca no Google Drive conectado conteúdo relevante para a pergunta
 * e devolve um bloco de contexto textual (ou null).
 */
export async function getDriveContext(question: string): Promise<string | null> {
  const h = headers();
  if (!h) return null;

  const keywords = extractKeywords(question);
  if (keywords.length === 0) return null;

  const found = new Map<string, DriveFile>();

  for (const kw of keywords) {
    const escaped = kw.replace(/'/g, "\\'");
    const files = await searchFiles(
      h,
      `trashed=false and (name contains '${escaped}' or fullText contains '${escaped}')`,
    );
    for (const f of files) {
      if (f.mimeType === "application/vnd.google-apps.folder") continue;
      if (!found.has(f.id)) found.set(f.id, f);
    }
    if (found.size >= 5) break;
  }

  if (found.size === 0) return null;

  const parts: string[] = [];
  for (const file of Array.from(found.values()).slice(0, 3)) {
    const content = await readFile(h, file);
    if (content && content.trim()) {
      parts.push(`### Arquivo: ${file.name}\n${content.trim()}`);
    } else {
      parts.push(`### Arquivo: ${file.name} (conteúdo não legível automaticamente)`);
    }
  }

  if (parts.length === 0) return null;

  return `Documentos internos encontrados no Google Drive da empresa (use-os como fonte principal para responder):\n\n${parts.join("\n\n")}`;
}

// ----- Gravação (Financeiro: anexos de lançamentos) ---------------------------------

export const driveConfigurado = () => headers() !== null;

async function driveJson(res: Response, oque: string) {
  const txt = await res.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* não-JSON */ }
  if (!res.ok) throw new Error(`Google Drive (${oque}): ${json?.error?.message || txt.slice(0, 200) || `HTTP ${res.status}`}`);
  return json;
}

/** Acha a subpasta pelo nome dentro de `parentId`; cria se não existir. */
export async function pastaDrive(parentId: string, nome: string): Promise<string> {
  const h = headers();
  if (!h) throw new Error("Google Drive não conectado (LOVABLE_API_KEY / GOOGLE_DRIVE_API_KEY).");
  const q = `'${parentId}' in parents and name = '${nome.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1", includeItemsFromAllDrives: "true", supportsAllDrives: "true" });
  const achou = await driveJson(await fetch(`${GATEWAY}/drive/v3/files?${params}`, { headers: h }), "buscar pasta");
  if (achou?.files?.[0]?.id) return achou.files[0].id;
  const criada = await driveJson(await fetch(`${GATEWAY}/drive/v3/files?supportsAllDrives=true&fields=id`, {
    method: "POST", headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  }), "criar pasta");
  return criada.id;
}

/** Envia um arquivo para a pasta do Drive; devolve id e link de visualização. */
export async function enviarArquivoDrive(parentId: string, nome: string, mime: string, bytes: Uint8Array): Promise<{ id: string; url: string }> {
  const h = headers();
  if (!h) throw new Error("Google Drive não conectado (LOVABLE_API_KEY / GOOGLE_DRIVE_API_KEY).");
  const limite = `fin${Math.random().toString(36).slice(2)}`;
  const enc = new TextEncoder();
  const meta = enc.encode(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [parentId] })}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`);
  const fim = enc.encode(`\r\n--${limite}--`);
  const corpo = new Uint8Array(meta.length + bytes.length + fim.length);
  corpo.set(meta, 0); corpo.set(bytes, meta.length); corpo.set(fim, meta.length + bytes.length);
  const r = await driveJson(await fetch(`${GATEWAY}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
    method: "POST", headers: { ...h, "Content-Type": `multipart/related; boundary=${limite}` }, body: corpo,
  }), "enviar arquivo");
  return { id: r.id, url: r.webViewLink || `https://drive.google.com/file/d/${r.id}/view` };
}
