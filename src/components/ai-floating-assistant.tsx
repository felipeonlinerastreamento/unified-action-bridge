import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Send,
  Loader2,
  GripHorizontal,
} from "lucide-react";

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiFloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Load enabled flag and subscribe to changes
  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("ai_assistant_config")
        .select("is_enabled")
        .limit(1)
        .maybeSingle();
      if (active) setIsEnabled(((data as any)?.is_enabled ?? true) as boolean);
    }
    load();
    const channel = supabase
      .channel("ai-assistant-config-flag")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_assistant_config" },
        (payload: any) => {
          const next = payload?.new?.is_enabled;
          if (typeof next === "boolean") setIsEnabled(next);
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize position on first open
  useEffect(() => {
    if (isOpen && !initialized.current) {
      setPosition({
        x: window.innerWidth - 420,
        y: window.innerHeight - 560,
      });
      initialized.current = true;
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsDragging(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, [isMaximized]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 100));
      const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 50));
      setPosition({ x, y });
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg: AiMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

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
          body: JSON.stringify({ userMessage: input, mode: "analyze" }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

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
              setMessages([
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
        setMessages([
          ...newMessages,
          { role: "assistant", content: "Sem resposta da IA." },
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao consultar IA");
      setMessages([
        ...newMessages,
        { role: "assistant", content: `Erro: ${err.message}` },
      ]);
    }
    setLoading(false);
  }

  // Hide entirely when assistant is disabled in admin settings
  if (isEnabled === false) return null;

  // FAB button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95"
        title="Assistente IA"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">Assistente IA</span>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
          className="ml-1 rounded-full p-0.5 hover:bg-primary-foreground/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const windowStyle = isMaximized
    ? { top: 0, left: 0, width: "100vw", height: "100vh" }
    : { top: position.y, left: position.x, width: 400, height: 520 };

  return (
    <div
      ref={windowRef}
      className={`fixed z-50 flex flex-col rounded-lg border bg-background shadow-2xl ${isMaximized ? "rounded-none" : ""}`}
      style={{
        ...windowStyle,
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between border-b bg-muted/50 px-3 py-2 ${isMaximized ? "" : "cursor-grab"} ${isDragging ? "cursor-grabbing" : ""} ${isMaximized ? "rounded-none" : "rounded-t-lg"}`}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Supervisor IA</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(true)} className="rounded p-1 hover:bg-muted" title="Minimizar">
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => setIsMaximized(!isMaximized)} className="rounded p-1 hover:bg-muted" title={isMaximized ? "Restaurar" : "Maximizar"}>
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" /> : <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => { setIsOpen(false); setIsMaximized(false); }} className="rounded p-1 hover:bg-destructive/20" title="Fechar">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Inicie uma conversa com a IA</p>
              <p className="text-xs mt-1 opacity-70">
                Ex: "Analise o tempo médio de atendimento"
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
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
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte ao supervisor..."
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button size="icon" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
