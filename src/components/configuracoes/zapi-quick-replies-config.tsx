import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Zap, Bold } from "lucide-react";

export function ZapiQuickRepliesConfig() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ shortcut: "", label: "", content: "", is_global: true });
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const wrapBold = () => {
    const ta = contentRef.current;
    const value = form.content;
    if (!ta) {
      setForm({ ...form, content: `${value}*texto em negrito*` });
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "texto em negrito";
    const next = `${value.slice(0, start)}*${selected}*${value.slice(end)}`;
    setForm({ ...form, content: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 1, start + 1 + selected.length);
    });
  };

  const { data: replies = [] } = useQuery({
    queryKey: ["zapi-quick-replies"],
    queryFn: async () => {
      const { data } = await supabase.from("zapi_quick_replies").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.shortcut.trim() || !form.content.trim()) throw new Error("Atalho e conteúdo são obrigatórios");
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("zapi_quick_replies").insert({
        shortcut: form.shortcut.startsWith("/") ? form.shortcut : `/${form.shortcut}`,
        label: form.label || form.shortcut,
        content: form.content,
        is_global: form.is_global,
        created_by: session?.user.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Resposta rápida criada");
      setForm({ shortcut: "", label: "", content: "", is_global: true });
      qc.invalidateQueries({ queryKey: ["zapi-quick-replies"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zapi_quick_replies").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Removida");
      qc.invalidateQueries({ queryKey: ["zapi-quick-replies"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Respostas Rápidas</CardTitle>
        <CardDescription>Templates acessíveis via botão ⚡ ou digitando "/" no campo de mensagem.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded p-3 bg-muted/30">
          <div className="md:col-span-3 space-y-1">
            <Label className="text-xs">Atalho</Label>
            <Input placeholder="/saudacao" value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} />
          </div>
          <div className="md:col-span-4 space-y-1">
            <Label className="text-xs">Rótulo</Label>
            <Input placeholder="Saudação inicial" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="md:col-span-12 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Conteúdo</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs gap-1"
                onClick={wrapBold}
                title="Envolver seleção com *negrito* (formato WhatsApp)"
              >
                <Bold className="h-3 w-3" /> Negrito
              </Button>
            </div>
            <Textarea
              ref={contentRef}
              rows={3}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Olá, em que posso ajudar?"
            />
            <p className="text-[10px] text-muted-foreground">
              Use <code className="font-mono">*texto*</code> para deixar em negrito no WhatsApp.
            </p>
          </div>
          <div className="md:col-span-3 flex items-center gap-2">
            <Switch checked={form.is_global} onCheckedChange={(v) => setForm({ ...form, is_global: v })} />
            <Label className="text-xs">Compartilhar com a equipe</Label>
          </div>
          <Button className="md:col-span-2" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {replies.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta rápida ainda.</p>}
          {replies.map((r) => (
            <div key={r.id} className="flex items-start gap-2 border rounded p-2">
              <Badge variant="outline" className="font-mono text-xs">{r.shortcut}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.label} {r.is_global && <Badge variant="secondary" className="ml-1 text-[10px]">global</Badge>}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.content}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
