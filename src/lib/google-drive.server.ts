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
    file.mimeType.includes("xml")
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
