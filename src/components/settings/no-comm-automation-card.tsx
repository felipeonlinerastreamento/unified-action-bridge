import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, X, Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import {
  getNoCommSettings,
  updateNoCommSettings,
  getNoCommRecentLogs,
} from "@/lib/no-comm-automation.functions";
import { useAuth } from "@/hooks/use-auth";

type Settings = {
  is_enabled: boolean;
  direction: "inbound" | "outbound" | "both";
  footer_template: string;
  keywords: string[];
  match_mode: "any" | "all";
  auto_close: boolean;
  category: string;
  final_status: string;
};

const DEFAULT: Settings = {
  is_enabled: false,
  direction: "both",
  footer_template: "Atendimento de protocolo: {numero do protocolo}",
  keywords: ["placas sem comunicação", "atraso de comunicação"],
  match_mode: "any",
  auto_close: true,
  category: "Sem comunicação",
  final_status: "finalizado",
};

export function NoCommAutomationCard() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const fetchFn = useServerFn(getNoCommSettings);
  const saveFn = useServerFn(updateNoCommSettings);
  const logsFn = useServerFn(getNoCommRecentLogs);

  const { data, isLoading } = useQuery({
    queryKey: ["no-comm-settings"],
    queryFn: () => fetchFn(),
  });
  const { data: logsData } = useQuery({
    queryKey: ["no-comm-logs"],
    queryFn: () => logsFn(),
    refetchInterval: 30_000,
  });

  const [form, setForm] = useState<Settings>(DEFAULT);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings as any;
      setForm({
        is_enabled: !!s.is_enabled,
        direction: s.direction,
        footer_template: s.footer_template,
        keywords: s.keywords || [],
        match_mode: s.match_mode,
        auto_close: !!s.auto_close,
        category: s.category,
        final_status: s.final_status,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: Settings) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("Automação atualizada");
      qc.invalidateQueries({ queryKey: ["no-comm-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const addKeyword = () => {
    const k = newKeyword.trim();
    if (!k) return;
    if (form.keywords.includes(k)) return;
    setForm({ ...form, keywords: [...form.keywords, k] });
    setNewKeyword("");
  };

  const removeKeyword = (k: string) => {
    setForm({ ...form, keywords: form.keywords.filter((x) => x !== k) });
  };

  const handleSave = () => {
    if (form.is_enabled && form.keywords.length === 0) {
      toast.error("Adicione ao menos uma palavra-chave.");
      return;
    }
    if (!form.footer_template.includes("{numero do protocolo}")) {
      toast.error("O rodapé deve conter {numero do protocolo}.");
      return;
    }
    mutation.mutate(form);
  };

  const disabled = !isAdmin || mutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Automação "Sem comunicação"</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Detecta o comunicado de placas sem comunicação, envia o rodapé com protocolo e finaliza o chamado.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="nc-enabled" className="text-sm">
                {form.is_enabled ? "Ativada" : "Desativada"}
              </Label>
              <Switch
                id="nc-enabled"
                checked={form.is_enabled}
                onCheckedChange={(v) => setForm({ ...form, is_enabled: v })}
                disabled={disabled || isLoading}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!isAdmin && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Apenas administradores podem alterar estas configurações.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Direção da mensagem</Label>
              <Select
                value={form.direction}
                onValueChange={(v: any) => setForm({ ...form, direction: v })}
                disabled={disabled}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Ambos (enviadas e recebidas)</SelectItem>
                  <SelectItem value="outbound">Apenas enviadas por nós</SelectItem>
                  <SelectItem value="inbound">Apenas recebidas do cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modo de combinação das palavras-chave</Label>
              <Select
                value={form.match_mode}
                onValueChange={(v: any) => setForm({ ...form, match_mode: v })}
                disabled={disabled}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Casar qualquer (uma já basta)</SelectItem>
                  <SelectItem value="all">Casar todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rodapé enviado após detectar o comunicado</Label>
            <Textarea
              value={form.footer_template}
              onChange={(e) => setForm({ ...form, footer_template: e.target.value })}
              rows={3}
              maxLength={500}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="px-1 py-0.5 rounded bg-muted">{"{numero do protocolo}"}</code> onde o número do protocolo deve aparecer.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Palavras-chave para detecção</Label>
            <div className="flex flex-wrap gap-2">
              {form.keywords.map((k) => (
                <Badge key={k} variant="secondary" className="gap-1 pr-1">
                  {k}
                  <button
                    onClick={() => removeKeyword(k)}
                    disabled={disabled}
                    className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Remover ${k}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {form.keywords.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma palavra-chave.</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova palavra ou frase-chave"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addKeyword(); }
                }}
                disabled={disabled}
                maxLength={120}
              />
              <Button type="button" variant="outline" onClick={addKeyword} disabled={disabled}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A comparação ignora acentos e maiúsculas/minúsculas.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label>Categoria do chamado ao finalizar</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                disabled={disabled}
                maxLength={80}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="nc-autoclose"
                checked={form.auto_close}
                onCheckedChange={(v) => setForm({ ...form, auto_close: v })}
                disabled={disabled}
              />
              <Label htmlFor="nc-autoclose" className="text-sm">Finalizar chamado</Label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={disabled || isLoading}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos disparos</CardTitle>
        </CardHeader>
        <CardContent>
          {!logsData?.logs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum disparo registrado ainda.
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              {logsData.logs.map((l: any) => (
                <div key={l.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {l.direction === "outbound" ? "Enviado" : "Recebido"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Protocolo {String(l.protocol_number ?? "—").padStart(5, "0")}
                      </span>
                      {l.matched_keyword && (
                        <span className="text-xs italic text-muted-foreground">
                          "{l.matched_keyword}"
                        </span>
                      )}
                    </div>
                    {l.message_excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {l.message_excerpt}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.triggered_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
