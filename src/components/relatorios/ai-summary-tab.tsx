import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles, Send, Loader2, Copy, Check, Download, Trash2, History, FileText,
} from "lucide-react";
import { exportToCSV } from "@/components/relatorios/export-utils";

type Interaction = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
};

const STORAGE_KEY = "relatorios-resumo-ia-historico";

const SUGGESTIONS = [
  "Faça um resumo geral da operação no período.",
  "Quais operadores tiveram melhor e pior desempenho?",
  "Quais os principais motivos de atendimento e como reduzi-los?",
  "Onde estamos perdendo tempo na operação?",
];

export function AiSummaryTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Interaction[]>([]);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(next: Interaction[]) {
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50))); } catch { /* ignore */ }
  }

  // Contexto do período para alimentar a IA
  const { data: ctx } = useQuery({
    queryKey: ["ai-summary-context", dateFrom, dateTo],
    queryFn: async () => {
      const [ticketsRes, profilesRes] = await Promise.all([
        supabase
          .from("service_tickets")
          .select("attendance_id, status, sector, category, assigned_to, created_at, closed_at, plate")
          .gte("created_at", `${dateFrom}T00:00:00`)
          .lte("created_at", `${dateTo}T23:59:59`)
          .limit(3000),
        supabase.from("profiles").select("user_id, name"),
      ]);
      const tickets = (ticketsRes.data || []) as any[];
      const names = new Map<string, string>(
        ((profilesRes.data || []) as any[]).map((p) => [p.user_id, p.name || "Sem nome"])
      );
      const count = (fn: (t: any) => string | null | undefined) => {
        const m: Record<string, number> = {};
        tickets.forEach((t) => {
          const k = fn(t) || "—";
          m[k] = (m[k] || 0) + 1;
        });
        return m;
      };
      const durations = tickets
        .filter((t) => t.closed_at)
        .map((t) => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000)
        .filter((n) => n >= 0);
      return {
        total: tickets.length,
        porStatus: count((t) => t.status),
        porSetor: count((t) => t.sector),
        porCategoria: count((t) => t.category),
        porOperador: count((t) => (t.assigned_to ? names.get(t.assigned_to) || "Sem nome" : "Sem responsável")),
        finalizados: durations.length,
        tmaMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      };
    },
  });

  const contextText = useMemo(() => {
    if (!ctx) return "";
    const fmt = (o: Record<string, number>) =>
      Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}: ${v}`).join(", ");
    return [
      `Período analisado: ${dateFrom} a ${dateTo}`,
      `Total de atendimentos: ${ctx.total}`,
      `Finalizados: ${ctx.finalizados} | TMA: ${ctx.tmaMin} min`,
      `Por status — ${fmt(ctx.porStatus)}`,
      `Por setor — ${fmt(ctx.porSetor)}`,
      `Por categoria — ${fmt(ctx.porCategoria)}`,
      `Por operador — ${fmt(ctx.porOperador)}`,
    ].join("\n");
  }, [ctx, dateFrom, dateTo]);

  async function handleAsk(q?: string) {
    const text = (q ?? question).trim();
    if (!text || loading) return;
    setLoading(true);
    setAnswer("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const prompt = `Você é um analista de operação. Responda em português, de forma objetiva, com bullets e números quando possível.

## Dados do sistema (relatórios) no período:
${contextText || "(sem dados carregados)"}

## Pergunta do gestor:
${text}`;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ userMessage: prompt, mode: "analyze", feature: "relatorio-resumo" }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).error || `Erro ${resp.status}`);
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("Sem resposta da IA");
      const decoder = new TextDecoder();
      let acc = "";
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setAnswer(acc);
              answerRef.current?.scrollTo({ top: answerRef.current.scrollHeight });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      if (!acc) acc = "Sem resposta da IA.";
      setAnswer(acc);
      persist([
        { id: crypto.randomUUID(), question: text, answer: acc, createdAt: new Date().toISOString() },
        ...history,
      ]);
      setQuestion("");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao consultar IA");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Resposta copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  function exportAnswer() {
    if (!answer) { toast.error("Sem resposta para exportar"); return; }
    const content = `Resumo IA — ${dateFrom} a ${dateTo}\n\n${answer}`;
    const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumo-ia-${dateFrom}_${dateTo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Resumo exportado");
  }

  function exportHistory() {
    if (!history.length) { toast.error("Sem histórico para exportar"); return; }
    exportToCSV(
      history.map((h) => ({
        Data: new Date(h.createdAt).toLocaleString("pt-BR"),
        Pergunta: h.question,
        Resposta: h.answer.replace(/\n/g, " "),
      })),
      `historico-resumo-ia-${dateFrom}_${dateTo}`
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Resumo com IA
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {dateFrom} → {dateTo}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="text-xs h-7"
                disabled={loading}
                onClick={() => handleAsk(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAsk();
            }}
            placeholder="Pergunte algo sobre a operação, atendimentos, operadores, estoque… (Ctrl+Enter para enviar)"
            className="min-h-[90px] text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => handleAsk()} disabled={loading || !question.trim()} className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Perguntar
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyText(answer)} disabled={!answer} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              Copiar resposta
            </Button>
            <Button size="sm" variant="outline" onClick={exportAnswer} disabled={!answer} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Resposta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={answerRef} className="max-h-[420px] overflow-y-auto text-sm prose prose-sm dark:prose-invert max-w-none">
            {answer ? (
              <ReactMarkdown>{answer}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground text-sm">
                {loading ? "Analisando dados do período…" : "Faça uma pergunta para gerar o resumo."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de interações
            <Badge variant="outline" className="text-[10px]">{history.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportHistory} disabled={!history.length} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar histórico
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => persist([])}
              disabled={!history.length}
              className="gap-1.5 text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma interação registrada ainda.</p>
          ) : (
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{h.question}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(h.createdAt).toLocaleString("pt-BR")}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => copyText(h.answer)}
                          aria-label="Copiar resposta"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                      {h.answer}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => setAnswer(h.answer)}
                    >
                      Ver resposta completa
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
