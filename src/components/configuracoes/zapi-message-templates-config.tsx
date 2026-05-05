import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageSquare, Bold, Save } from "lucide-react";

const DEFAULT_FINALIZACAO = `Seu atendimento foi finalizado e desde já agradecemos pela atenção.\n\nSe você precisar de suporte no futuro, fique à vontade para falar conosco.\n\nTenha um ótimo dia!\n\nProtocolo desse atendimento: {protocolo}\n\nEsta é uma mensagem automática e não precisa responder.`;

const TEMPLATE_KEYS: Array<{ key: string; label: string; description: string; vars: string[]; defaultContent: string }> = [
  {
    key: "finalizacao",
    label: "Mensagem de finalização do atendimento",
    description: "Enviada automaticamente ao cliente quando o operador finaliza o atendimento (somente quando o CSAT está desativado).",
    vars: ["{protocolo}", "{nome_contato}", "{nome_operador}"],
    defaultContent: DEFAULT_FINALIZACAO,
  },
];

export function ZapiMessageTemplatesConfig() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const { data: templates = [] } = useQuery({
    queryKey: ["zapi-message-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("zapi_message_templates" as any).select("*");
      return (data as any[]) || [];
    },
  });

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const meta of TEMPLATE_KEYS) {
      const existing = templates.find((t: any) => t.key === meta.key);
      next[meta.key] = (existing?.content && existing.content.trim()) || meta.defaultContent;
    }
    setDrafts((prev) => ({ ...next, ...prev }));
  }, [templates]);

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const existing = templates.find((t: any) => t.key === key);
      if (existing) {
        const { error } = await supabase
          .from("zapi_message_templates" as any)
          .update({ content: drafts[key] ?? "", updated_by: session?.user.id })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const meta = TEMPLATE_KEYS.find((t) => t.key === key);
        const { error } = await supabase.from("zapi_message_templates" as any).insert({
          key,
          label: meta?.label || key,
          content: drafts[key] ?? "",
          updated_by: session?.user.id,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Mensagem salva");
      qc.invalidateQueries({ queryKey: ["zapi-message-templates"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const wrapBold = (key: string) => {
    const ta = refs.current[key];
    const value = drafts[key] ?? "";
    if (!ta) {
      setDrafts({ ...drafts, [key]: `${value}*texto em negrito*` });
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "texto em negrito";
    const next = `${value.slice(0, start)}*${selected}*${value.slice(end)}`;
    setDrafts({ ...drafts, [key]: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + 1, start + 1 + selected.length);
    });
  };

  const insertVar = (key: string, token: string) => {
    const ta = refs.current[key];
    const value = drafts[key] ?? "";
    if (!ta) {
      setDrafts({ ...drafts, [key]: `${value}${token}` });
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    setDrafts({ ...drafts, [key]: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Mensagens Automáticas</CardTitle>
        <CardDescription>
          Edite os textos enviados automaticamente pelo sistema (ex.: encerramento de atendimento).
          Use variáveis como <code>{`{protocolo}`}</code> e <code>*texto*</code> para negrito (formato WhatsApp).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {TEMPLATE_KEYS.map((meta) => (
          <div key={meta.key} className="space-y-2 border rounded p-3 bg-muted/30">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label className="text-sm font-semibold">{meta.label}</Label>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => wrapBold(meta.key)}
                title="Envolver seleção com *negrito*"
              >
                <Bold className="h-3 w-3" /> Negrito
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {meta.vars.map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] font-mono"
                  onClick={() => insertVar(meta.key, v)}
                >
                  {v}
                </Button>
              ))}
            </div>
            <Textarea
              ref={(el) => { refs.current[meta.key] = el; }}
              rows={8}
              value={drafts[meta.key] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [meta.key]: e.target.value })}
              placeholder="Digite o conteúdo da mensagem..."
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(meta.key)}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
