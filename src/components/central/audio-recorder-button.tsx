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
  const recorderRef = useRef<any>(null);
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
          // @ts-ignore
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            toast.error("Microfone bloqueado. Habilite nas configurações do navegador.");
            return;
          }
        } catch {
          // ignore
        }
      }

      // Dynamic import — opus-recorder is browser-only and ships its own worker
      const RecorderMod: any = await import("opus-recorder");
      const Recorder = RecorderMod.default || RecorderMod;

      const recorder = new Recorder({
        encoderPath: "/opus-recorder/encoderWorker.min.js",
        encoderApplication: 2048, // VOIP
        encoderSampleRate: 16000, // WhatsApp voice notes
        numberOfChannels: 1,
        streamPages: false,
        encoderBitRate: 24000,
      });

      recorder.ondataavailable = (typedArray: Uint8Array) => {
        try {
          // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues
          const ab = new ArrayBuffer(typedArray.byteLength);
          new Uint8Array(ab).set(typedArray);
          const blob = new Blob([ab], { type: "audio/ogg" });
          const durationMs = Date.now() - startedAtRef.current;
          if (blob.size < 800) {
            toast.error("Áudio muito curto.");
            stopTracks();
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || "");
            const blobUrl = URL.createObjectURL(blob);
            setPreview({ blobUrl, dataUrl, mime: "audio/ogg", durationMs });
          };
          reader.readAsDataURL(blob);
        } catch (err: any) {
          toast.error(err?.message || "Falha ao processar áudio");
        } finally {
          stopTracks();
        }
      };

      await recorder.start();
      streamRef.current = recorder.stream || null;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      setRecording(true);
    } catch (err: any) {
      stopTracks();
      if (err?.name === "NotAllowedError") {
        toast.error("Permissão do microfone negada.");
      } else if (err?.name === "NotFoundError") {
        toast.error("Nenhum microfone encontrado.");
      } else {
        toast.error(err?.message || "Não foi possível iniciar a gravação");
      }
    }
  };

  const handleStop = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
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
