import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Download, FileIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ticketId: string;
  userId: string | null;
}

const BUCKET = "ticket-attachments";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachmentsSection({ ticketId, userId }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["ticket-attachments", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo maior que 20MB");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${ticketId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("ticket_attachments").insert({
        ticket_id: ticketId,
        uploaded_by: userId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (insErr) throw insErr;

      toast.success("Arquivo anexado");
      queryClient.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
    } catch (e: any) {
      console.error("[attach] upload error:", e);
      toast.error(e.message || "Falha ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (att: any) => {
    if (!confirm(`Remover "${att.file_name}"?`)) return;
    try {
      await supabase.storage.from(BUCKET).remove([att.file_path]);
      const { error } = await supabase.from("ticket_attachments").delete().eq("id", att.id);
      if (error) throw error;
      toast.success("Anexo removido");
      queryClient.invalidateQueries({ queryKey: ["ticket-attachments", ticketId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao remover");
    }
  };

  const getPublicUrl = (path: string) =>
    supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Anexos ({attachments.length})
        </span>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Anexar
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum anexo.</p>
      ) : (
        <div className="space-y-1">
          {attachments.map((att: any) => {
            const isOwn = att.uploaded_by && att.uploaded_by === userId;
            return (
              <div
                key={att.id}
                className="flex items-center gap-2 text-xs border rounded-md px-2 py-1.5 bg-muted/30"
              >
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{att.file_name}</p>
                  <p className="text-muted-foreground">
                    {formatSize(att.file_size)} · {new Date(att.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <a
                  href={getPublicUrl(att.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.file_name}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {isOwn && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDelete(att)}
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
