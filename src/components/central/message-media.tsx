import { FileText, Download, User, Phone } from "lucide-react";

type Props = {
  mediaUrl?: string | null;
  mediaType?: string | null;
  className?: string;
  compact?: boolean;
};

/**
 * Parse a vCard string and extract display name + phone numbers.
 * Returns null when the input does not look like a vCard.
 */
function parseVCard(raw: string): { name: string | null; phones: string[] } | null {
  if (!raw || !/BEGIN:VCARD/i.test(raw)) return null;
  const lines = raw.split(/\r?\n/);
  let name: string | null = null;
  const phones: string[] = [];
  for (const line of lines) {
    const fnMatch = /^FN(?:;[^:]*)?:(.+)$/i.exec(line);
    if (fnMatch && !name) name = fnMatch[1].trim();
    const nMatch = /^N(?:;[^:]*)?:(.+)$/i.exec(line);
    if (nMatch && !name) {
      const parts = nMatch[1].split(";").filter(Boolean).reverse().join(" ").trim();
      if (parts) name = parts;
    }
    const telMatch = /^TEL(?:;[^:]*)?:(.+)$/i.exec(line);
    if (telMatch) {
      const phone = telMatch[1].trim();
      if (phone) phones.push(phone);
    }
    // waid in some vCards: item1.TEL;waid=5511...:+55 11 ...
    const waidMatch = /waid=(\d+)/i.exec(line);
    if (waidMatch && !phones.includes(waidMatch[1])) phones.push(waidMatch[1]);
  }
  return { name, phones };
}

/**
 * Renders WhatsApp-like inline media bubbles for chat messages.
 * Supports: audio, image, video, document, contact (vCard).
 */
export function MessageMediaContent({ mediaUrl, mediaType, className, compact }: Props) {
  if (!mediaUrl || !mediaType) return null;

  if (mediaType === "audio") {
    return (
      <audio
        controls
        preload="metadata"
        src={mediaUrl}
        className={`w-full ${compact ? "max-w-[220px] h-9" : "max-w-[280px]"} ${className || ""}`}
      />
    );
  }

  if (mediaType === "image") {
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className="block">
        <img
          src={mediaUrl}
          alt="imagem"
          className={`rounded-md object-cover ${compact ? "max-h-40" : "max-h-72"} ${className || ""}`}
          loading="lazy"
        />
      </a>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        controls
        preload="metadata"
        src={mediaUrl}
        className={`rounded-md ${compact ? "max-h-40" : "max-h-72"} ${className || ""}`}
      />
    );
  }

  if (mediaType === "contact") {
    // mediaUrl can be a vCard data URL (data:text/vcard;base64,...) or raw vCard string
    let vcardText = mediaUrl;
    if (mediaUrl.startsWith("data:")) {
      const commaIdx = mediaUrl.indexOf(",");
      const meta = mediaUrl.slice(0, commaIdx);
      const payload = mediaUrl.slice(commaIdx + 1);
      try {
        vcardText = meta.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
      } catch {
        vcardText = payload;
      }
    }
    const parsed = parseVCard(vcardText);
    const name = parsed?.name || "Contato";
    const phones = parsed?.phones || [];
    const href = mediaUrl.startsWith("data:")
      ? mediaUrl
      : `data:text/vcard;charset=utf-8,${encodeURIComponent(vcardText)}`;

    return (
      <div
        className={`flex flex-col gap-1 rounded-md border bg-background/50 px-3 py-2 ${compact ? "max-w-[240px]" : "max-w-[280px]"} ${className || ""}`}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            {phones.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{phones[0]}</span>
                {phones.length > 1 && <span className="opacity-60">+{phones.length - 1}</span>}
              </div>
            )}
          </div>
        </div>
        <a
          href={href}
          download={`${name.replace(/[^\w\-]+/g, "_") || "contato"}.vcf`}
          className="flex items-center justify-center gap-1 rounded border-t pt-1 text-xs text-primary hover:underline"
        >
          <Download className="h-3 w-3" /> Salvar contato
        </a>
      </div>
    );
  }

  // document
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-md border bg-background/50 px-2 py-1.5 text-xs hover:bg-background ${className || ""}`}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">Documento</span>
      <Download className="h-3.5 w-3.5 opacity-60" />
    </a>
  );
}
