import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AI_TONE_OPTIONS,
  AI_FORMAT_OPTIONS,
  DEFAULT_TEMPERATURE,
  normalizeTemperature,
  creativityLabel,
} from "@/lib/ai-guidelines";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Save,
  Loader2,
  Upload,
  Trash2,
  FileText,
  Send,
  MessageSquare,
  Zap,
  BarChart3,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { AiCreditsPanel } from "@/components/configuracoes/ai-credits-panel";
import { CustomerAnalysisView } from "@/components/ai-manager/customer-analysis";
import { OperatorPerformanceView } from "@/components/ai-manager/operator-performance";

export const Route = createFileRoute("/configuracoes/assistente-ia")({
  component: AssistenteIaConfigPage,
});

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

function AssistenteIaConfigPage() {
  const { isAuthenticated, isLoading, hasRole, user } = useAuth();
  const [canAccessAiManager, setCanAccessAiManager] = useState<boolean>(true);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("can_access_ai_manager").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setCanAccessAiManager((data as any)?.can_access_ai_manager ?? true));
  }, [user?.id]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [tone, setTone] = useState("consultivo");
  const [responseFormat, setResponseFormat] = useState("topicos");
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [forbiddenTopics, setForbiddenTopics] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [suggestReplyEnabled, setSuggestReplyEnabled] = useState(true);
  const [autoSummaryEnabled, setAutoSummaryEnabled] = useState(false);
  const [oportunidadesEnabled, setOportunidadesEnabled] = useState(true);
  const [savingBehavior, setSavingBehavior] = useState(false);
  const [uploading, setUploading] = useState(false);

  // AI Chat state
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadConfig();
      loadDocs();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  async function loadConfig() {
    const { data } = await supabase
      .from("ai_assistant_config")
      .select("*")
      .limit(1);
    if (data && data.length > 0) {
      setSystemPrompt(data[0].system_prompt);
      setIsEnabled((data[0] as any).is_enabled ?? true);
      setConfigId(data[0].id);
      const row = data[0] as any;
      setTone(row.tone || "consultivo");
      setResponseFormat(row.response_format || "topicos");
      setTemperature(normalizeTemperature(row.temperature));
      setForbiddenTopics(row.forbidden_topics || "");
      setFallbackMessage(row.fallback_message || "");
      setSuggestReplyEnabled(row.suggest_reply_enabled ?? true);
      setAutoSummaryEnabled(row.auto_summary_enabled ?? false);
      setOportunidadesEnabled(row.ia_oportunidades_ativo ?? true);
    }
  }

  async function handleSaveBehavior() {
    if (!configId) {
      toast.error("Configuração não inicializada");
      return;
    }
    setSavingBehavior(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("ai_assistant_config")
      .update(({
        tone,
        response_format: responseFormat,
        temperature: normalizeTemperature(temperature),
        forbidden_topics: forbiddenTopics,
        fallback_message: fallbackMessage,
        suggest_reply_enabled: suggestReplyEnabled,
        auto_summary_enabled: autoSummaryEnabled,
        ia_oportunidades_ativo: oportunidadesEnabled,
        updated_at: new Date().toISOString(),
        updated_by: sess.session?.user?.id || null,
      }) as any)
      .eq("id", configId);
    if (error) toast.error(error.message);
    else toast.success("Comportamento da IA salvo!");
    setSavingBehavior(false);
  }

  async function handleToggleEnabled(next: boolean) {
    if (!configId) {
      toast.error("Configuração não inicializada");
      return;
    }
    setTogglingEnabled(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("ai_assistant_config")
      .update({
        is_enabled: next,
        updated_at: new Date().toISOString(),
        updated_by: sess.session?.user?.id || null,
      } as any)
      .eq("id", configId);
    if (error) {
      toast.error(error.message);
    } else {
      setIsEnabled(next);
      toast.success(next ? "Assistente ativado" : "Assistente desativado");
    }
    setTogglingEnabled(false);
  }

  async function loadDocs() {
    const { data } = await supabase
      .from("ai_knowledge_docs")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs(data || []);
  }

  async function handleSavePrompt() {
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    if (configId) {
      const { error } = await supabase
        .from("ai_assistant_config")
        .update({
          system_prompt: systemPrompt,
          updated_at: new Date().toISOString(),
          updated_by: sess.session?.user?.id || null,
        })
        .eq("id", configId);
      if (error) toast.error(error.message);
      else toast.success("Configuração salva!");
    }
    setSaving(false);
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const filePath = `docs/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("ai-knowledge")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const { error: dbError } = await supabase.from("ai_knowledge_docs").insert({
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      uploaded_by: sess.session?.user?.id || null,
    });

    if (dbError) toast.error(dbError.message);
    else {
      toast.success("Documento enviado!");
      loadDocs();
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDeleteDoc(doc: any) {
    await supabase.storage.from("ai-knowledge").remove([doc.file_path]);
    await supabase.from("ai_knowledge_docs").delete().eq("id", doc.id);
    toast.success("Documento removido");
    loadDocs();
  }

  async function handleAiSend() {
    if (!aiInput.trim() || aiLoading) return;

    const userMsg: AiMessage = { role: "user", content: aiInput };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            userMessage: aiInput,
            mode: "analyze",
          }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      // Stream response
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setAiMessages([
                ...newMessages,
                { role: "assistant", content: assistantContent },
              ]);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (!assistantContent) {
        setAiMessages([
          ...newMessages,
          { role: "assistant", content: "Sem resposta da IA." },
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar IA");
      setAiMessages([
        ...newMessages,
        { role: "assistant", content: `Erro: ${err.message}` },
      ]);
    }
    setAiLoading(false);
  }

  if (isLoading || !isAuthenticated) return null;

  const isAdmin = hasRole("admin");
  const isGestor = hasRole("gestor");
  // Gestores e administradores configuram o assistente; créditos seguem só para admin.
  const canManage = isAdmin || isGestor;

  // Gestores need the per-user flag (default true). Admins always see.
  const canSeeReport = isAdmin || (isGestor && canAccessAiManager);

  if (!isAdmin && !isGestor) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Acesso restrito a administradores e gestores.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6" /> Configuração do Assistente IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure o comportamento da IA, envie documentos de referência e interaja para ensinar métricas
          </p>
        </div>

        <Tabs defaultValue={canManage ? "config" : "manager"}>
          <TabsList>
            {canManage && <TabsTrigger value="config">Configuração</TabsTrigger>}
            {canManage && <TabsTrigger value="docs">Base de Conhecimento</TabsTrigger>}
            {canManage && <TabsTrigger value="chat">Chat com IA</TabsTrigger>}
            {canSeeReport && (
              <TabsTrigger value="manager">
                <BarChart3 className="h-3.5 w-3.5 mr-1" /> Relatório IA
              </TabsTrigger>
            )}
            {isAdmin && <TabsTrigger value="credits"><Zap className="h-3.5 w-3.5 mr-1" /> Créditos</TabsTrigger>}
          </TabsList>

          {canSeeReport && (
            <TabsContent value="manager" className="mt-4">
              <Tabs defaultValue="customers">
                <TabsList>
                  <TabsTrigger value="customers">Análise de Clientes</TabsTrigger>
                  <TabsTrigger value="operators">Performance de Operadores e Setores</TabsTrigger>
                </TabsList>
                <TabsContent value="customers" className="mt-4">
                  <CustomerAnalysisView />
                </TabsContent>
                <TabsContent value="operators" className="mt-4">
                  <OperatorPerformanceView />
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="credits" className="mt-4">
              <AiCreditsPanel />
            </TabsContent>
          )}

          {/* Config Tab */}
          <TabsContent value="config" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Status do Assistente</span>
                  <Badge variant={isEnabled ? "default" : "secondary"}>
                    {isEnabled ? "Ativo" : "Inativo"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="ai-enabled" className="text-sm font-medium">
                      Assistente IA habilitado
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Quando desativado, o botão flutuante e as respostas do supervisor IA ficam indisponíveis em todo o sistema. A configuração e a base de conhecimento são preservadas.
                    </p>
                  </div>
                  <Switch
                    id="ai-enabled"
                    checked={isEnabled}
                    onCheckedChange={handleToggleEnabled}
                    disabled={togglingEnabled || !configId}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Tom de voz e estilo de resposta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Perfil de comunicação</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AI_TONE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tamanho e formato padrão</Label>
                    <Select value={responseFormat} onValueChange={setResponseFormat}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AI_FORMAT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Nível de criatividade</Label>
                    <Badge variant="outline">{creativityLabel(temperature)} · {temperature.toFixed(2)}</Badge>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={[temperature]}
                    onValueChange={(v) => setTemperature(v[0] ?? DEFAULT_TEMPERATURE)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Estrito (só manuais)</span>
                    <span>Amplo / flexível</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" /> Regras de segurança (limites)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-forbidden">Tópicos proibidos / concessões bloqueadas</Label>
                  <Textarea
                    id="ai-forbidden"
                    rows={4}
                    value={forbiddenTopics}
                    onChange={(e) => setForbiddenTopics(e.target.value)}
                    placeholder={"Um por linha. Ex.:\nPrometer desconto\nCancelar ou excluir débitos\nInformar senhas ou credenciais de rastreadores"}
                  />
                  <p className="text-xs text-muted-foreground">A IA nunca responderá, prometerá ou orientará sobre esses temas.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-fallback">Conduta quando não encontrar a informação</Label>
                  <Textarea
                    id="ai-fallback"
                    rows={2}
                    value={fallbackMessage}
                    onChange={(e) => setFallbackMessage(e.target.value)}
                    placeholder="Ex.: Oriente o cliente a aguardar a transferência para o setor responsável."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Automações no atendimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="ai-suggest" className="text-sm font-medium">Sugestão de resposta ao operador</Label>
                    <p className="text-xs text-muted-foreground">Exibe o painel do supervisor IA na Central de Atendimento com orientações sobre a conversa.</p>
                  </div>
                  <Switch id="ai-suggest" checked={suggestReplyEnabled} onCheckedChange={setSuggestReplyEnabled} />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="ai-summary" className="text-sm font-medium">Resumo automático ao finalizar</Label>
                    <p className="text-xs text-muted-foreground">Ao finalizar um chat na Central, a IA grava um resumo de 2 a 3 linhas como comentário no chamado.</p>
                  </div>
                  <Switch id="ai-summary" checked={autoSummaryEnabled} onCheckedChange={setAutoSummaryEnabled} />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label htmlFor="ai-oport" className="text-sm font-medium">Oportunidades de venda nas conversas</Label>
                    <p className="text-xs text-muted-foreground">Ao finalizar um chat, a IA procura interesse de compra (mais veículos, câmera, telemetria, upgrade, indicação). Se achar, cria a oportunidade em CRM › Oportunidades com a proposta sugerida e avisa o responsável.</p>
                  </div>
                  <Switch id="ai-oport" checked={oportunidadesEnabled} onCheckedChange={setOportunidadesEnabled} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveBehavior} disabled={savingBehavior || !configId}>
                {savingBehavior ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar comportamento
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prompt de Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Defina as instruções, métricas e comportamentos esperados da IA. Este texto será usado como contexto base para todas as interações.
                </p>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={15}
                  placeholder="Ex: Você é um assistente comercial especializado em..."
                  className="font-mono text-sm"
                />
                <Button onClick={handleSavePrompt} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Docs Tab */}
          <TabsContent value="docs" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Documentos de Referência</CardTitle>
                <div>
                  <input
                    type="file"
                    id="doc-upload"
                    className="hidden"
                    accept=".pdf,.txt,.doc,.docx,.csv"
                    onChange={handleUploadDoc}
                  />
                  <Button
                    size="sm"
                    onClick={() => document.getElementById("doc-upload")?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Upload Documento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Envie manuais, scripts de atendimento, tabelas de preços e outros documentos. A IA usará esses materiais como referência.
                </p>
                {docs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Nenhum documento enviado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ""} •{" "}
                              {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDoc(doc)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-4">
            <Card className="h-[calc(100vh-16rem)] flex flex-col">
              <CardHeader className="shrink-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Chat com Assistente IA
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Converse com a IA para ensinar métricas, solicitar análises sobre equipe e testar comportamentos.
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 py-4">
                    {aiMessages.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Bot className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Inicie uma conversa com a IA</p>
                        <p className="text-xs mt-1">
                          Ex: "Analise o tempo médio de atendimento da equipe" ou "Como devo abordar clientes inativos?"
                        </p>
                      </div>
                    )}
                    {aiMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                <div className="border-t p-4 shrink-0">
                  <div className="flex gap-2">
                    <Input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Ensine métricas, peça análises..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAiSend();
                        }
                      }}
                    />
                    <Button onClick={handleAiSend} disabled={aiLoading || !aiInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
