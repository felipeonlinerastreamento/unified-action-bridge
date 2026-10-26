import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";

/** Upload da imagem de assinatura usada nas respostas por e-mail. */
export function SignatureUpload({ userId }: { userId: string }) {
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("profiles").select("signature_image_url").eq("user_id", userId).maybeSingle();
      const p = (data as any)?.signature_image_url ?? null;
      if (!alive) return;
      setPath(p);
      if (p) {
        const { data: s } = await supabase.storage.from("user-signatures").createSignedUrl(p, 3600);
        if (alive) setPreview(s?.signedUrl ?? null);
      } else setPreview(null);
    })();
    return () => { alive = false; };
  }, [userId]);

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma imagem (PNG ou JPG).");
    if (file.size > 2 * 1024 * 1024) return toast.error("Imagem maior que 2 MB.");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const newPath = `${userId}/assinatura-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("user-signatures").upload(newPath, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ signature_image_url: newPath } as any).eq("user_id", userId);
      if (error) throw error;
      if (path) await supabase.storage.from("user-signatures").remove([path]);
      setPath(newPath);
      setPreview(URL.createObjectURL(file));
      toast.success("Assinatura salva");
    } catch (e: any) {
      toast.error("Erro ao salvar assinatura: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!path) return;
    setBusy(true);
    await supabase.from("profiles").update({ signature_image_url: null } as any).eq("user_id", userId);
    await supabase.storage.from("user-signatures").remove([path]);
    setPath(null); setPreview(null); setBusy(false);
    toast.success("Assinatura removida");
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-sm font-medium">Assinatura de e-mail</Label>
      <p className="text-xs text-muted-foreground">Imagem incluída no final das respostas enviadas por e-mail nos atendimentos.</p>
      {preview && <img src={preview} alt="Assinatura" className="max-h-32 max-w-full rounded border bg-background object-contain" />}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {path ? "Trocar imagem" : "Enviar imagem"}
            <input type="file" accept="image/png,image/jpeg,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          </label>
        </Button>
        {path && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
            <Trash2 className="h-4 w-4 mr-1" /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
