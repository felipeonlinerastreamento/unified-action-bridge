import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Send, Trash2, AlertTriangle, User } from "lucide-react";
import { toast } from "sonner";
import {
  getTopGamificAiHistory,
  sendTopGamificAiMessage,
  clearTopGamificAiHistory,
  type TopGamificAiMessage,
} from "@/lib/topgamific-ai.functions";

export const Route = createFileRoute("/assistente-ia")({
  head: () => ({
    meta: [
      { title: "Assistente IA | Tire dúvidas sobre sua gamificação" },
      {
        name: "description",
        content:
          "Converse com o assistente de inteligência artificial da plataforma de gamificação e tire dúvidas sobre lançamentos, pontos e desafios.",
      },
      { property: "og:title", content: "Assistente IA | Gamificação" },
      {
        property: "og:description",
        content:
          "Assistente de IA integrado à plataforma de gamificação, com histórico de conversa salvo por usuário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistenteIaPage,
});

function AssistenteIaPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <AssistenteIaContent />
    </AppLayout>
  );
}

function formatTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AssistenteIaContent() {
  const fetchHistory = useServerFn(getTopGamificAiHistory);
  const sendMessage = useServerFn(sendTopGamificAiMessage);
  const clearHistory = useServerFn(clearTopGamificAiHistory);
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<TopGamificAiMessage[]>({
    queryKey: ["topgamific-ai-history"],
    queryFn: () => fetchHistory({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: (message: string) => sendMessage({ data: { message } }),
    onSuccess: (result) => {
      setPending(null);
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível falar com o assistente.");
        return;
      }
      queryClient.setQueryData<TopGamificAiMessage[]>(
        ["topgamific-ai-history"],
        (old) => [...(old ?? []), ...result.messages],
      );
    },
    onError: () => {
      setPending(null);
      toast.error("Não foi possível enviar sua mensagem.");
    },
    onSettled: () => textareaRef.current?.focus(),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearHistory({ data: undefined }),
    onSuccess: () => {
      queryClient.setQueryData(["topgamific-ai-history"], []);
      toast.success("Conversa limpa.");
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  const busy = mutation.isPending;

  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setPending(text);
    mutation.mutate(text);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Assistente IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Converse com o assistente da plataforma de gamificação. Seu histórico fica salvo.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending || messages.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Limpar conversa
        </Button>
      </div>

      <Card className="flex flex-col h-[calc(100vh-16rem)] min-h-[420px]">
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Conversa
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-12 w-1/2 ml-auto" />
            </div>
          ) : messages.length === 0 && !pending ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <Bot className="h-10 w-10 text-primary/60" />
              <p className="text-sm">
                Faça uma pergunta sobre seus lançamentos, pontos ou desafios.
              </p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
              {pending && (
                <MessageRow
                  message={{
                    id: "pending",
                    role: "user",
                    content: pending,
                    createdAt: new Date().toISOString(),
                  }}
                />
              )}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                  <Bot className="h-4 w-4" />
                  Pensando...
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </CardContent>
        <div className="border-t p-3 flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Escreva sua mensagem..."
            className="min-h-[52px] max-h-40 resize-none"
            disabled={busy}
          />
          <Button onClick={handleSend} disabled={busy || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        As respostas vêm da plataforma de gamificação e podem conter imprecisões.
      </p>
    </div>
  );
}

function RatingBar({ message }: { message: TopGamificAiMessage }) {
  const rate = useServerFn(rateTopGamificAiMessage);
  const queryClient = useQueryClient();
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(message.ratingComment ?? "");

  const apply = (rating: -1 | 1 | null, text?: string) => {
    queryClient.setQueryData<TopGamificAiMessage[]>(
      ["topgamific-ai-history"],
      (old) =>
        (old ?? []).map((m) =>
          m.id === message.id
            ? { ...m, rating, ratingComment: rating === null ? null : (text ?? m.ratingComment) }
            : m,
        ),
    );
    rate({ data: { id: message.id, rating, comment: text ?? comment } })
      .then((r) => {
        if (!r?.ok) toast.error("Não foi possível salvar sua avaliação.");
      })
      .catch(() => toast.error("Não foi possível salvar sua avaliação."));
  };

  const handle = (value: -1 | 1) => {
    if (message.rating === value) {
      setShowComment(false);
      apply(null);
      return;
    }
    apply(value);
    if (value === -1) setShowComment(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted-foreground mr-1">Esta resposta ajudou?</span>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${message.rating === 1 ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
          onClick={() => handle(1)}
          aria-label="Avaliar como útil"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${message.rating === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground"}`}
          onClick={() => handle(-1)}
          aria-label="Avaliar como não útil"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
        {message.rating !== null && !showComment && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground"
            onClick={() => setShowComment(true)}
          >
            {message.ratingComment ? "Editar comentário" : "Comentar"}
          </Button>
        )}
      </div>
      {showComment && (
        <div className="flex items-end gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte o que faltou ou o que funcionou bem (opcional)"
            className="min-h-[40px] max-h-28 resize-none text-xs"
          />
          <Button
            size="sm"
            onClick={() => {
              apply(message.rating ?? 1, comment.trim());
              setShowComment(false);
              toast.success("Avaliação registrada.");
            }}
          >
            Salvar
          </Button>
        </div>
      )}
      {!showComment && message.ratingComment && (
        <p className="text-[11px] text-muted-foreground italic">"{message.ratingComment}"</p>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: TopGamificAiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={`max-w-[80%] space-y-1 ${isUser ? "text-right" : ""}`}>
        <div
          className={
            isUser
              ? "inline-block rounded-lg px-3 py-2 bg-primary text-primary-foreground whitespace-pre-wrap text-sm text-left"
              : "inline-block rounded-lg px-3 py-2 bg-muted text-foreground whitespace-pre-wrap text-sm"
          }
        >
          {message.content}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {formatTime(message.createdAt)}
        </div>
      </div>
      {isUser && (
        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
