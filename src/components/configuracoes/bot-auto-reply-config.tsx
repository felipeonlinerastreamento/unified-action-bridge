import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Bot, Plus, Pencil, Trash2, FlaskConical, Lightbulb, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { testBotAutoReply, getBotAutoReplyInsights, suggestBotAutoReplyRules } from "@/lib/bot-auto-reply.functions";

type Settings = {
  id: string;
  is_enabled: boolean;
  observe_only: boolean;
  greeting_seconds: number;
  follow_up_minutes: number;
  start_hour: string;
  end_hour: string;
  max_replies_per_chat: number;
  channel_id: string | null;
  skip_when_ticket_open: boolean;
  fallback_enabled: boolean;
  fallback_text: string;
  ai_enabled: boolean;
  ai_min_confidence: number;
};

type Rule = {
  id: string;
  name: string;
  is_enabled: boolean;
  keywords: string[];
  reply_text: string;
  reply_text_complete: string | null;
  required_fields: string[];
  target_sector: string | null;
  priority: number;
  from_catalog: boolean;
  catalog_key: string | null;
  is_greeting: boolean;
  create_ticket: boolean;
  ticket_priority: string;
};

const SAUDACAO_TEXT = "Olá,\nFala com {{operatorName}},\n\nEm que posso ajudar?";

type CatalogEntry = {
  catalog_key: string;
  name: string;
  keywords: string[];
  reply_text: string;
  required_fields: string[];
  target_sector: string;
  is_greeting?: boolean;
};

const CATALOG: CatalogEntry[] = [
  {
    catalog_key: "relatorio",
    name: "Relatório de posições",
    keywords: ["relatorio", "relatório", "posições", "posicoes", "histórico", "historico"],
    reply_text: "Claro! Para gerar o relatório de posições, me informe a placa e o período desejado (data inicial e final).",
    required_fields: ["placa", "período"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "rastreamento",
    name: "Rastreamento / localização do veículo",
    keywords: ["rastreamento", "localização", "localizacao", "onde está", "onde esta", "localizar"],
    reply_text: "Vou verificar a localização. Me informe a placa do veículo, por favor.",
    required_fields: ["placa"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "sem_comunicacao",
    name: "Equipamento sem comunicação",
    keywords: ["sem comunicação", "sem comunicacao", "sem sinal", "offline", "não comunica", "nao comunica"],
    reply_text: "Entendi, vamos verificar o equipamento. Me informe a placa do veículo, por favor.",
    required_fields: ["placa"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "instalacao",
    name: "Instalação / agendamento",
    keywords: ["instalação", "instalacao", "agendar", "agendamento", "instalar"],
    reply_text: "Perfeito! Para agendar a instalação, me informe a cidade e o período desejado.",
    required_fields: ["cidade", "período desejado"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "financeiro",
    name: "Financeiro / 2ª via de boleto",
    keywords: ["boleto", "financeiro", "2ª via", "segunda via", "fatura", "pagamento"],
    reply_text: "Vou te ajudar com o financeiro. Me informe o CNPJ ou a razão social do cadastro, por favor.",
    required_fields: ["CNPJ ou razão social"],
    target_sector: "Financeiro",
  },
  {
    catalog_key: "app",
    name: "Suporte ao app / senha",
    keywords: ["app", "aplicativo", "senha", "login", "acesso", "entrar"],
    reply_text: "Vou te ajudar com o acesso ao app. Me informe o e-mail ou o usuário cadastrado, por favor.",
    required_fields: ["e-mail ou usuário"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "bloqueio",
    name: "Bloqueio / desbloqueio de veículo",
    keywords: ["bloqueio", "desbloqueio", "bloquear", "desbloquear"],
    reply_text: "Certo! Para bloqueio ou desbloqueio, me informe a placa do veículo, por favor.",
    required_fields: ["placa"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "saudacao",
    name: "Saudação sem assunto",
    keywords: ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "preciso de ajuda"],
    reply_text: SAUDACAO_TEXT,
    required_fields: [],
    target_sector: "Atendimento",
    is_greeting: true,
  },
];

const FIELD_OPTIONS: Array<{ key: string; label: string; auto: boolean }> = [
  { key: "cpf_cnpj", label: "CPF/CNPJ", auto: true },
  { key: "placa", label: "Placa", auto: true },
  { key: "periodo", label: "Período", auto: true },
  { key: "email", label: "E-mail / usuário", auto: true },
  { key: "cidade", label: "Cidade", auto: false },
];

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_OPTIONS.map((f) => [f.key, f.label]),
);

const canonicalField = (field: string): string | null => {
  const f = (field || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!f) return null;
  if (f.includes("cpf") || f.includes("cnpj") || f.includes("documento")) return "cpf_cnpj";
  if (f.includes("placa")) return "placa";
  if (f.includes("periodo") || f.includes("data")) return "periodo";
  if (f.includes("cidade")) return "cidade";
  if (f.includes("mail") || f.includes("usuario")) return "email";
  return null;
};

const toCanonicalList = (fields: string[]): string[] => [
  ...new Set((fields || []).map(canonicalField).filter((f): f is string => !!f)),
];

type RuleForm = {
  name: string;
  is_enabled: boolean;
  keywords: string;
  reply_text: string;
  reply_text_complete: string;
  required_fields: string[];
  target_sector: string;
  priority: number;
  is_greeting: boolean;
  create_ticket: boolean;
  ticket_priority: string;
};

const EMPTY_FORM: RuleForm = {
  name: "",
  is_enabled: true,
  keywords: "",
  reply_text: "",
  reply_text_complete: "",
  required_fields: [],
  target_sector: "Atendimento",
  priority: 100,
  is_greeting: false,
  create_ticket: false,
  ticket_priority: "media",
};

const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

export function BotAutoReplyConfig() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const { data: settings } = useQuery<Settings | null>({
    queryKey: ["bot-auto-reply-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bot_auto_reply_settings" as any)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data as any) || null;
    },
  });

  const { data: rules = [] } = useQuery<Rule[]>({
    queryKey: ["bot-auto-reply-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bot_auto_reply_rules" as any)
        .select("*")
        .order("priority", { ascending: true });
      return ((data as any[]) || []) as Rule[];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors-active"],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["bot-auto-reply-insights"],
    queryFn: () => getBotAutoReplyInsights({ data: { days: 30 } }),
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      if (!settings) return;
      const { error } = await supabase
        .from("bot_auto_reply_settings" as any)
        .update(patch as any)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bot-auto-reply-settings"] }),
    onError: (e: any) => toast.error(e?.message || "Não foi possível salvar"),
  });

  const patchSettings = (patch: Partial<Settings>) => {
    qc.setQueryData(["bot-auto-reply-settings"], (old: any) => (old ? { ...old, ...patch } : old));
    saveSettings.mutate(patch);
  };

  const enabledCatalogKeys = new Set(rules.map((r) => r.catalog_key).filter(Boolean) as string[]);

  const enableFromCatalog = async (entry: CatalogEntry) => {
    const { error } = await supabase.from("bot_auto_reply_rules" as any).insert({
      name: entry.name,
      keywords: entry.keywords,
      reply_text: entry.reply_text,
      required_fields: toCanonicalList(entry.required_fields),
      target_sector: entry.target_sector,
      from_catalog: true,
      catalog_key: entry.catalog_key,
      is_greeting: !!entry.is_greeting,
      priority: entry.is_greeting ? 900 : 100,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Automação "${entry.name}" habilitada`);
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-rules"] });
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      name: r.name,
      is_enabled: r.is_enabled,
      keywords: (r.keywords || []).join(", "),
      reply_text: r.reply_text,
      reply_text_complete: r.reply_text_complete || "",
      required_fields: toCanonicalList(r.required_fields || []),
      target_sector: r.target_sector || "Atendimento",
      priority: r.priority,
      is_greeting: r.is_greeting,
      create_ticket: r.create_ticket,
      ticket_priority: r.ticket_priority || "media",
    });
    setDialogOpen(true);
  };

  const toggleField = (key: string) =>
    setForm((f) => ({
      ...f,
      required_fields: f.required_fields.includes(key)
        ? f.required_fields.filter((k) => k !== key)
        : [...f.required_fields, key],
    }));

  const saveRule = async () => {
    if (!form.name.trim() || !form.reply_text.trim()) {
      toast.error("Preencha nome e texto de resposta");
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      is_enabled: form.is_enabled,
      keywords: splitList(form.keywords),
      reply_text: form.reply_text,
      reply_text_complete: form.reply_text_complete.trim() || null,
      required_fields: form.required_fields,
      target_sector: form.target_sector,
      priority: form.priority,
      is_greeting: form.is_greeting,
      create_ticket: form.create_ticket,
      ticket_priority: form.ticket_priority,
    };
    const { error } = editing
      ? await supabase.from("bot_auto_reply_rules" as any).update(payload).eq("id", editing.id)
      : await supabase.from("bot_auto_reply_rules" as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Automação atualizada" : "Automação criada");
    setDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-rules"] });
  };

  const toggleRule = async (r: Rule, v: boolean) => {
    await supabase.from("bot_auto_reply_rules" as any).update({ is_enabled: v }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-rules"] });
  };

  const removeRule = async (r: Rule) => {
    if (!confirm(`Excluir a automação "${r.name}"?`)) return;
    await supabase.from("bot_auto_reply_rules" as any).delete().eq("id", r.id);
    toast.success("Automação removida");
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-rules"] });
  };

  const runTest = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const res = await testBotAutoReply({ data: { text: testText } });
      setTestResult(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível testar");
    } finally {
      setTesting(false);
    }
  };

  const loadSuggestions = async () => {
    setSuggesting(true);
    try {
      const res = await suggestBotAutoReplyRules({ data: { days: 30 } });
      setSuggestions(res.suggestions);
      if (!res.suggestions.length) toast.info(res.note || "Sem sugestões por enquanto");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar sugestões");
    } finally {
      setSuggesting(false);
    }
  };

  const createFromSuggestion = async (s: any) => {
    const { error } = await supabase.from("bot_auto_reply_rules" as any).insert({
      name: s.name,
      keywords: s.keywords,
      reply_text: s.reply_text,
      required_fields: toCanonicalList(s.required_fields || []),
      target_sector: "Atendimento",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Automação criada a partir da sugestão");
    setSuggestions((prev) => prev.filter((x) => x !== s));
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-rules"] });
  };

  /** Cria uma automação já preenchida com a pergunta que o robô não entendeu. */
  const createFromQuestion = (sample: { text: string; suggestedKeywords: string[] }) => {
    const words = sample.suggestedKeywords.length ? sample.suggestedKeywords : [sample.text.trim()];
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      name: sample.text.trim().slice(0, 60),
      keywords: words.join(", "),
      reply_text: "",
    });
    setDialogOpen(true);
  };

  /** Adiciona as palavras da pergunta a uma automação existente. */
  const addQuestionToRule = async (
    ruleId: string,
    sample: { text: string; suggestedKeywords: string[] },
  ) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const words = sample.suggestedKeywords.length ? sample.suggestedKeywords : [sample.text.trim()];
    const merged = [...new Set([...(rule.keywords || []), ...words])];
    const { error } = await supabase
      .from("bot_auto_reply_rules" as any)
      .update({ keywords: merged })
      .eq("id", ruleId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pergunta adicionada à automação "${rule.name}"`);
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-rules"] });
    qc.invalidateQueries({ queryKey: ["bot-auto-reply-insights"] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Robô de Atendimento
          </CardTitle>
          <CardDescription>
            Recebe a conversa antes do operador, responde saudações e coleta os dados que faltam.
            As configurações valem para toda a empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Robô ativo</Label>
              <p className="text-sm text-muted-foreground">Liga ou desliga o atendimento automático.</p>
            </div>
            <Switch
              checked={!!settings?.is_enabled}
              onCheckedChange={(v) => patchSettings({ is_enabled: v })}
            />
          </div>

          {settings && !settings.is_enabled && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Robô inativo — silêncio total no WhatsApp</p>
              <p className="mt-1">
                Com o robô desligado, o sistema não envia nenhuma mensagem automática: nem
                resposta de fora do horário, nem menu de opções, nem cobrança de inatividade,
                nem pesquisa de satisfação ao finalizar. Só o operador fala com o cliente.
              </p>
            </div>
          )}


          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Modo observação</Label>
              <p className="text-sm text-muted-foreground">
                O robô identifica o assunto e registra, mas não envia nada ao cliente.
              </p>
            </div>
            <Switch
              checked={!!settings?.observe_only}
              onCheckedChange={(v) => patchSettings({ observe_only: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Não responder quem já tem chamado aberto</Label>
              <p className="text-sm text-muted-foreground">Evita mensagem automática em atendimentos em andamento.</p>
            </div>
            <Switch
              checked={!!settings?.skip_when_ticket_open}
              onCheckedChange={(v) => patchSettings({ skip_when_ticket_open: v })}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Resposta para dúvidas</Label>
                <p className="text-sm text-muted-foreground">
                  Quando a mensagem não for claramente um dos assuntos cadastrados (texto longo,
                  vários pedidos ou pergunta aberta), o robô envia apenas esta resposta.
                </p>
              </div>
              <Switch
                checked={settings?.fallback_enabled !== false}
                onCheckedChange={(v) => patchSettings({ fallback_enabled: v })}
              />
            </div>
            <Textarea
              rows={2}
              value={settings?.fallback_text ?? ""}
              placeholder="Um momento, por favor, que estou verificando."
              onChange={(e) => patchSettings({ fallback_text: e.target.value })}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Entendimento por IA</Label>
                <p className="text-sm text-muted-foreground">
                  Quando as palavras-chave não resolverem, a IA lê a mensagem e escolhe o assunto
                  mais provável do catálogo. Só quando ela também não tiver certeza é que entra a
                  resposta de dúvida.
                </p>
              </div>
              <Switch
                checked={settings?.ai_enabled !== false}
                onCheckedChange={(v) => patchSettings({ ai_enabled: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Certeza mínima da IA (%)</Label>
              <Input
                type="number"
                min={10}
                max={100}
                value={Math.round((settings?.ai_min_confidence ?? 0.6) * 100)}
                onChange={(e) =>
                  patchSettings({
                    ai_min_confidence:
                      Math.min(100, Math.max(10, Number(e.target.value) || 60)) / 100,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Quanto maior, mais conservador: a IA só responde quando tiver bastante certeza.
              </p>
            </div>
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Espera da saudação (segundos)</Label>
              <Input
                type="number"
                min={0}
                value={settings?.greeting_seconds ?? 10}
                onChange={(e) => patchSettings({ greeting_seconds: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Segunda cobrança (minutos)</Label>
              <Input
                type="number"
                min={0}
                value={settings?.follow_up_minutes ?? 10}
                onChange={(e) => patchSettings({ follow_up_minutes: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Início do horário de atuação</Label>
              <Input
                type="time"
                value={settings?.start_hour ?? "08:00"}
                onChange={(e) => patchSettings({ start_hour: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim do horário de atuação</Label>
              <Input
                type="time"
                value={settings?.end_hour ?? "18:00"}
                onChange={(e) => patchSettings({ end_hour: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Máximo de respostas por conversa</Label>
              <Input
                type="number"
                min={1}
                value={settings?.max_replies_per_chat ?? 2}
                onChange={(e) => patchSettings({ max_replies_per_chat: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" /> Testar uma mensagem
          </CardTitle>
          <CardDescription>
            Digite uma frase do cliente e veja qual automação responderia. Nada é enviado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Ex.: preciso do relatório da ABC1D23 de 01/09 a 10/09"
              onKeyDown={(e) => { if (e.key === "Enter") runTest(); }}
            />
            <Button onClick={runTest} disabled={testing}>{testing ? "Testando..." : "Testar"}</Button>
          </div>
          {testResult && (
            <div className="rounded-lg border p-4 text-sm space-y-2">
              {testResult.matched ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={testResult.isFallback ? "secondary" : "default"}>
                      {testResult.ruleName}
                    </Badge>
                    {testResult.sector && <Badge variant="outline">{testResult.sector}</Badge>}
                    {testResult.isFallback && (
                      <span className="text-xs text-muted-foreground">
                        Tratado como dúvida: o robô só avisa que está verificando.
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-line text-muted-foreground">{testResult.replyPreview}</p>
                  {!!testResult.requiredFields?.length && (
                    <p className="text-xs text-muted-foreground">
                      Dados pedidos:{" "}
                      {testResult.requiredFields
                        .map((f: string) => FIELD_LABEL[canonicalField(f) || ""] || f)
                        .join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Reconhecido na mensagem:{" "}
                    {Object.keys(testResult.collected || {}).length
                      ? Object.entries(testResult.collected as Record<string, string>)
                          .map(([k, v]) => `${FIELD_LABEL[k] || k}: ${v}`)
                          .join(" · ")
                      : "—"}
                  </p>
                  {!!testResult.missingFields?.length && (
                    <p className="text-xs text-muted-foreground">
                      Ainda falta:{" "}
                      {testResult.missingFields
                        .map((f: string) => FIELD_LABEL[f] || f)
                        .join(", ")}
                    </p>
                  )}
                  {testResult.dataComplete && (
                    <p className="text-xs text-muted-foreground">
                      {testResult.willReply
                        ? "O cliente já enviou tudo — o robô usaria a resposta de confirmação."
                        : "O cliente já enviou tudo e não há resposta de confirmação — o robô ficaria calado e passaria ao operador."}
                    </p>
                  )}

                </>
              ) : (
                <p className="text-muted-foreground">
                  Nenhuma automação responderia — a conversa seguiria direto para o operador.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de sugestões prontas</CardTitle>
          <CardDescription>
            Habilite com um clique. Cada uma já vem com texto e os dados que o robô deve pedir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATALOG.map((entry) => {
              const already = enabledCatalogKeys.has(entry.catalog_key);
              return (
                <div key={entry.catalog_key} className="flex flex-col gap-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{entry.name}</span>
                    <Button
                      size="sm"
                      variant={already ? "secondary" : "default"}
                      disabled={already}
                      onClick={() => enableFromCatalog(entry)}
                    >
                      {already ? "Habilitada" : "Habilitar"}
                    </Button>
                  </div>
                  {entry.required_fields.length ? (
                    <div className="flex flex-wrap gap-1">
                      {entry.required_fields.map((f) => (
                        <Badge key={f} variant="outline">{f}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem dados obrigatórios</span>
                  )}
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{entry.reply_text}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Automações ativas</CardTitle>
            <CardDescription>
              Edite nome, palavras-chave, texto, dados obrigatórios, fila de destino e prioridade.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Criar automação
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma automação. Habilite uma do catálogo acima ou crie uma nova.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.target_sector && <Badge variant="secondary">{r.target_sector}</Badge>}
                      {r.from_catalog && <Badge variant="outline">catálogo</Badge>}
                      {r.is_greeting && <Badge variant="outline">saudação</Badge>}
                    </div>
                    {!!(r.keywords || []).length && (
                      <p className="truncate text-xs text-muted-foreground">
                        Palavras-chave: {(r.keywords || []).join(", ")}
                      </p>
                    )}
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{r.reply_text}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={r.is_enabled} onCheckedChange={(v) => toggleRule(r, v)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeRule(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Perguntas mais frequentes (30 dias)
            </CardTitle>
            <CardDescription>
              Assuntos detectados, respostas enviadas e mensagens que o robô não entendeu.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={loadSuggestions} disabled={suggesting}>
            <Lightbulb className="mr-2 h-4 w-4" />
            {suggesting ? "Analisando..." : "Sugerir automações"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Respostas enviadas", value: insights?.totals.sent ?? 0 },
              { label: "Simuladas", value: insights?.totals.simulated ?? 0 },
              { label: "Sem automação", value: insights?.totals.unmatched ?? 0 },
              { label: "Ignoradas", value: insights?.totals.skipped ?? 0 },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">{k.value}</div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
              </div>
            ))}
          </div>

          {!!insights?.topIntents.length && (
            <div className="space-y-1">
              <Label>Assuntos mais detectados</Label>
              {insights.topIntents.map((i) => (
                <div key={i.name} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <span>{i.name}</span>
                  <Badge variant="secondary">{i.count}</Badge>
                </div>
              ))}
            </div>
          )}

          {!!insights?.unmatchedSamples.length && (
            <div className="space-y-2">
              <Label>Perguntas mais frequentes sem automação</Label>
              <p className="text-xs text-muted-foreground">
                Agrupadas por repetição. Crie uma automação nova ou aplique a pergunta a uma já existente.
              </p>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {insights.unmatchedSamples.map((m) => (
                  <div key={m.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{m.text}</p>
                      <Badge variant={m.count > 1 ? "default" : "secondary"}>{m.count}x</Badge>
                    </div>
                    {!!m.suggestedKeywords.length && (
                      <p className="text-xs text-muted-foreground">
                        Palavras-chave sugeridas: {m.suggestedKeywords.join(", ")}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => createFromQuestion(m)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Criar automação
                      </Button>
                      <Select onValueChange={(v) => addQuestionToRule(v, m)}>
                        <SelectTrigger className="h-8 w-[240px]">
                          <SelectValue placeholder="Aplicar a uma automação..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rules.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!suggestions.length && (
            <div className="space-y-2">
              <Label>Sugestões do sistema</Label>
              {suggestions.map((s, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Button size="sm" onClick={() => createFromSuggestion(s)}>Criar automação</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Palavras-chave: {(s.keywords || []).join(", ")}</p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{s.reply_text}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar automação" : "Nova automação"}</DialogTitle>
            <DialogDescription>Defina como o robô reconhece e responde este assunto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Palavras-chave (separadas por vírgula)</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Texto de resposta (quando falta o dado)</Label>
              <Textarea
                rows={4}
                value={form.reply_text}
                onChange={(e) => setForm({ ...form, reply_text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code>{"{{operatorName}}"}</code> (nome do operador responsável),{" "}
                <code>{"{{contactName}}"}</code> (nome do cliente) e os dados reconhecidos:{" "}
                <code>{"{{cpf_cnpj}}"}</code>, <code>{"{{placa}}"}</code>, <code>{"{{periodo}}"}</code>.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Resposta quando o dado já veio (opcional)</Label>
              <Textarea
                rows={3}
                value={form.reply_text_complete}
                onChange={(e) => setForm({ ...form, reply_text_complete: e.target.value })}
                placeholder="Ex.: Perfeito! Já recebi o CPF/CNPJ {{cpf_cnpj}}. Vou verificar e já te retorno."
              />
              <p className="text-xs text-muted-foreground">
                Em branco: o robô não responde nada quando o cliente já enviou tudo — a conversa segue direto para o operador.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dados obrigatórios</Label>
              <div className="flex flex-wrap gap-2">
                {FIELD_OPTIONS.map((f) => {
                  const active = form.required_fields.includes(f.key);
                  return (
                    <Button
                      key={f.key}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleField(f.key)}
                    >
                      {f.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                O robô reconhece sozinho CPF/CNPJ, placa, período e e-mail. Cidade sempre é pedida.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fila de destino</Label>
                <Select
                  value={form.target_sector}
                  onValueChange={(v) => setForm({ ...form, target_sector: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(sectors as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade (menor responde primeiro)</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_greeting}
                onCheckedChange={(v) => setForm({ ...form, is_greeting: v })}
              />
              <Label>É a saudação genérica (só responde se nada mais casar)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveRule}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
