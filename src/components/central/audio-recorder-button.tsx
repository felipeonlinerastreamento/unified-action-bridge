import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  onRecorded: (dataUrl: string, mimeType: string, durationMs: number) => Promise<void> | void;
  disabled?: boolean;
  size?: "sm" | "default" | "icon";
  className?: string;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

type Preview = {
  blobUrl: string;
  dataUrl: string;
  mime: string;
  durationMs: number;
};

export function AudioRecorderButton({ onRecorded, disabled, size = "icon", className }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  // Free the preview blob URL when discarded/replaced
  useEffect(() => {
    return () => {
      if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    };
  }, [preview?.blobUrl]);

  const handleStart = async () => {
    try {
      if (navigator.permissions) {
        try {
          // @ts-ignore - microphone is widely supported in Chromium
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            toast.error("Microfone bloqueado. Habilite nas configurações do navegador.");
            return;
          }
        } catch {
          // ignore — not all browsers support this
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          const finalMime = recorder.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: finalMime });
          const durationMs = Date.now() - startedAtRef.current;
          if (blob.size < 800) {
            toast.error("Áudio muito curto.");
            return;
          }
          const dataUrl = await blobToDataUrl(blob);
          const blobUrl = URL.createObjectURL(blob);
          setPreview({ blobUrl, dataUrl, mime: finalMime, durationMs });
        } catch (err: any) {
          toast.error(err?.message || "Falha ao processar áudio");
        } finally {
          stopTracks();
        }
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      recorder.start(250);
      setRecording(true);
    } catch (err: any) {
      stopTracks();
      if (err?.name === "NotAllowedError") {
        toast.error("Permissão do microfone negada.");
      } else if (err?.name === "NotFoundError") {
        toast.error("Nenhum microfone encontrado.");
      } else if (err?.name === "NotReadableError") {
        toast.error("Microfone em uso por outro aplicativo.");
      } else {
        toast.error(err?.message || "Não foi possível iniciar a gravação");
      }
    }
  };

  const handleStop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleDiscard = () => {
    if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
    setPreview(null);
  };

  const handleSend = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await onRecorded(preview.dataUrl, preview.mime, preview.durationMs);
      if (preview.blobUrl) URL.revokeObjectURL(preview.blobUrl);
      setPreview(null);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar áudio");
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Button size={size} variant="outline" disabled className={className} title="Enviando áudio...">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (preview) {
    return (
      <div className={cn("flex items-center gap-1.5 rounded-md border bg-background px-2 py-1", className)}>
        <audio
          src={preview.blobUrl}
          controls
          preload="metadata"
          className="h-8 max-w-[200px]"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDiscard}
          title="Excluir gravação"
          type="button"
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={handleSend}
          title="Enviar áudio"
          type="button"
          className="h-8 w-8"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (recording) {
    const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const ss = (elapsed % 60).toString().padStart(2, "0");
    return (
      <Button
        size={size === "icon" ? "default" : size}
        variant="destructive"
        onClick={handleStop}
        className={cn("gap-2", className)}
        title="Parar gravação"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
        <span className="text-xs tabular-nums">{mm}:{ss}</span>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant="outline"
      onClick={handleStart}
      disabled={disabled}
      className={className}
      title="Gravar áudio"
      type="button"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
