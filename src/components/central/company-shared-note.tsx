import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StickyNote, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CompanySharedNoteProps {
  companyId: string;
}

export function CompanySharedNote({ companyId }: CompanySharedNoteProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["company-shared-note", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_shared_notes")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Reset imediato ao trocar de empresa — evita vazar texto entre empresas.
  useEffect(() => {
    setContent("");
    setDirty(false);
    dirtyRef.current = false;
  }, [companyId]);

  // Hidrata quando dados chegam; usa ref em vez de `dirty` como dependência
  // para que a troca de empresa não fique bloqueada por edição anterior.
  useEffect(() => {
    if (!dirtyRef.current) setContent(data?.content ?? "");
  }, [companyId, data?.content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: companyId,
        content,
        updated_by: user?.id ?? null,
        updated_by_name: profile?.name || user?.email || "",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("company_shared_notes")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação salva");
      dirtyRef.current = false;
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["company-shared-note", companyId] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar observação"),
  });

  const updatedLabel = data?.updated_at
    ? `Atualizado por ${data.updated_by_name || "—"} em ${new Date(data.updated_at).toLocaleString("pt-BR")}`
    : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <StickyNote className="h-3 w-3" /> Observação
      </p>
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          dirtyRef.current = true;
          setDirty(true);
        }}
        placeholder="Anotações compartilhadas sobre este contato/empresa. Visível para todos os usuários."
        rows={4}
        disabled={isLoading}
        className="text-sm resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground truncate">{updatedLabel}</p>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
