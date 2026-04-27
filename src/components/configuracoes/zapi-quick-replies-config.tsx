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
import { Plus, Trash2, Zap, Bold, Code2, Pencil, X, Check } from "lucide-react";
import { QUICK_REPLY_VARIABLES } from "@/lib/quick-reply-vars";

export function ZapiQuickRepliesConfig() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ shortcut: "", label: "", content: "", is_global: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

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

  const insertVariable = (token: string) => {
    const ta = contentRef.current;
    const value = form.content;
    if (!ta) {
      setForm({ ...form, content: `${value}${token}` });
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    setForm({ ...form, content: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nada para editar");
      if (!form.shortcut.trim() || !form.content.trim()) throw new Error("Atalho e conteúdo são obrigatórios");
      const { data, error } = await supabase
        .from("zapi_quick_replies")
        .update({
          shortcut: form.shortcut.startsWith("/") ? form.shortcut : `/${form.shortcut}`,
          label: form.label || form.shortcut,
          content: form.content,
          is_global: form.is_global,
        })
        .eq("id", editingId)
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Sem permissão para editar essa resposta rápida.");
      }
    },
    onSuccess: () => {
      toast.success("Resposta rápida atualizada");
      setEditingId(null);
      setForm({ shortcut: "", label: "", content: "", is_global: true });
      qc.invalidateQueries({ queryKey: ["zapi-quick-replies"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      shortcut: r.shortcut || "",
      label: r.label || "",
      content: r.content || "",
      is_global: !!r.is_global,
    });
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => contentRef.current?.focus(), 300);
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ shortcut: "", label: "", content: "", is_global: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Respostas Rápidas</CardTitle>
        <CardDescription>Templates acessíveis via botão ⚡ ou digitando "/" no campo de mensagem.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={formRef} className={`grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded p-3 bg-muted/30 transition-all ${editingId ? "ring-2 ring-primary border-primary" : ""}`}>
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
            <div className="flex flex-wrap gap-1">
              {QUICK_REPLY_VARIABLES.map((v) => (
                <Button
                  key={v.token}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] font-mono gap-1"
                  onClick={() => insertVariable(v.token)}
                  title={`${v.label} — ${v.description}`}
                >
                  <Code2 className="h-3 w-3" /> {v.token}
                </Button>
              ))}
            </div>
            <Textarea
              ref={contentRef}
              rows={3}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Olá {nome_contato}, aqui é {primeiro_nome_operador}. Em que posso ajudar?"
            />
            <div className="rounded border bg-background/60 p-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Variáveis disponíveis</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
                {QUICK_REPLY_VARIABLES.map((v) => (
                  <div key={v.token} className="text-[10px] text-muted-foreground flex gap-1">
                    <code className="font-mono text-foreground">{v.token}</code>
                    <span>→ {v.description}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Use <code className="font-mono">*texto*</code> para negrito. Variáveis são substituídas no momento do envio.
              </p>
            </div>
          </div>
          <div className="md:col-span-3 flex items-center gap-2">
            <Switch checked={form.is_global} onCheckedChange={(v) => setForm({ ...form, is_global: v })} />
            <Label className="text-xs">Compartilhar com a equipe</Label>
          </div>
          {editingId ? (
            <>
              <Button
                className="md:col-span-1"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" /> Salvar
              </Button>
              <Button
                className="md:col-span-1"
                variant="outline"
                onClick={cancelEdit}
                disabled={updateMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            </>
          ) : (
            <Button className="md:col-span-2" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {replies.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma resposta rápida ainda.</p>}
          {replies.map((r) => (
            <div
              key={r.id}
              className={`flex items-start gap-2 border rounded p-2 ${editingId === r.id ? "border-primary bg-primary/5" : ""}`}
            >
              <Badge variant="outline" className="font-mono text-xs">{r.shortcut}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {r.label}
                  {r.is_global && <Badge variant="secondary" className="ml-1 text-[10px]">global</Badge>}
                  {editingId === r.id && <Badge className="ml-1 text-[10px]">editando</Badge>}
                </p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.content}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => startEdit(r)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteMutation.mutate(r.id)}
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
