import { FileText, Download } from "lucide-react";

type Props = {
  mediaUrl?: string | null;
  mediaType?: string | null;
  className?: string;
  compact?: boolean;
};

/**
 * Renders WhatsApp-like inline media bubbles for chat messages.
 * Supports: audio, image, video, document.
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
