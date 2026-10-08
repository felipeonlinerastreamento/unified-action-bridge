import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Gerencia a rolagem de uma área de chat (Radix ScrollArea):
 * - Abre a conversa sempre na última mensagem (scroll instantâneo).
 * - Novas mensagens rolam para o fim apenas se o usuário já estiver perto do fim.
 * - Expõe estado para um botão flutuante "ir para a última mensagem" com
 *   contador de mensagens novas enquanto o usuário lê o histórico.
 */
export function useChatScroll({
  chatKey,
  messageCount,
  lastMessageKey,
  enabled = true,
}: {
  chatKey: string | number | null | undefined;
  messageCount: number;
  lastMessageKey?: string | number | null;
  enabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const prevLastKeyRef = useRef<string | number | null | undefined>(undefined);

  const getViewport = useCallback(
    () =>
      rootRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]"
      ) ?? null,
    []
  );

  const scrollToBottom = useCallback(
    (smooth = false) => {
      const vp = getViewport();
      if (!vp) return;
      if (smooth) {
        vp.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
      } else {
        vp.scrollTop = vp.scrollHeight;
      }
    },
    [getViewport]
  );

  // Observa a posição da rolagem para saber se o usuário está no fim
  useEffect(() => {
    const vp = getViewport();
    if (!vp) return;
    const onScroll = () => {
      const near = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 80;
      nearBottomRef.current = near;
      setShowJump(!near);
      if (near) setNewCount(0);
    };
    vp.addEventListener("scroll", onScroll);
    onScroll();
    return () => vp.removeEventListener("scroll", onScroll);
  }, [chatKey, getViewport]);

  // Troca de conversa: vai direto ao fim (instantâneo, após render)
  useEffect(() => {
    nearBottomRef.current = true;
    prevCountRef.current = 0;
    prevLastKeyRef.current = undefined;
    setNewCount(0);
    setShowJump(false);
    if (!enabled) return;
    const raf = requestAnimationFrame(() => scrollToBottom(false));
    const t1 = setTimeout(() => scrollToBottom(false), 120);
    const t2 = setTimeout(() => scrollToBottom(false), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [chatKey, enabled, scrollToBottom]);

  // Chegada/carregamento de mensagens
  useEffect(() => {
    if (!enabled) return;
    const prevCount = prevCountRef.current;
    const prevLast = prevLastKeyRef.current;
    prevCountRef.current = messageCount;
    prevLastKeyRef.current = lastMessageKey ?? null;

    if (messageCount === 0) return;

    // Primeiro carregamento da conversa: pula direto ao fim
    if (prevCount === 0) {
      requestAnimationFrame(() => scrollToBottom(false));
      return;
    }

    // Mensagem nova no fim (o último item mudou)
    const lastChanged =
      lastMessageKey != null && prevLast !== undefined && lastMessageKey !== prevLast;
    if (lastChanged) {
      if (nearBottomRef.current) {
        scrollToBottom(true);
      } else {
        setNewCount((c) => c + 1);
      }
    }
    // Paginação de mensagens antigas (prepend) não altera o último item:
    // mantém a posição, sem puxar o usuário ao fim.
  }, [messageCount, lastMessageKey, enabled, scrollToBottom]);

  const jumpToBottom = useCallback(() => {
    scrollToBottom(true);
    setNewCount(0);
  }, [scrollToBottom]);

  return { rootRef, endRef, showJump, newCount, jumpToBottom };
}
