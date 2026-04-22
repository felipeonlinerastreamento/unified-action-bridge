import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "gsystem-floating-chats";
const MAX_WINDOWS = 6;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 520;

export interface FloatingChatMeta {
  name?: string;
  phone?: string;
  avatar?: string;
  slaColor?: string;
  agentName?: string;
  sectorName?: string;
}

export interface FloatingChatState {
  chatId: string;
  channelId: string;
  meta: FloatingChatMeta;
  position: { x: number; y: number };
  size: { w: number; h: number };
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  unread: number;
}

interface FloatingChatsContextValue {
  chats: FloatingChatState[];
  openChat: (params: {
    chatId: string;
    channelId: string;
    meta?: FloatingChatMeta;
    position?: { x: number; y: number };
  }) => void;
  closeChat: (chatId: string) => void;
  minimize: (chatId: string) => void;
  restore: (chatId: string) => void;
  toggleMaximize: (chatId: string) => void;
  bringToFront: (chatId: string) => void;
  updatePosition: (chatId: string, position: { x: number; y: number }) => void;
  updateMeta: (chatId: string, meta: FloatingChatMeta) => void;
  setUnread: (chatId: string, unread: number) => void;
  isOpen: (chatId: string) => boolean;
}

const FloatingChatsContext = createContext<FloatingChatsContextValue | null>(null);

function clampPosition(x: number, y: number, w = DEFAULT_WIDTH, h = 60) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(0, window.innerWidth - 100);
  const maxY = Math.max(0, window.innerHeight - 50);
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
}

export function FloatingChatsProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<FloatingChatState[]>([]);
  const zCounter = useRef(100);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FloatingChatState[];
        if (Array.isArray(parsed)) {
          const restored = parsed.map((c) => ({ ...c, unread: 0 }));
          setChats(restored);
          zCounter.current = Math.max(100, ...restored.map((c) => c.zIndex || 100));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
      } catch {
        // ignore quota errors
      }
    }, 300);
    return () => clearTimeout(t);
  }, [chats]);

  const openChat = useCallback<FloatingChatsContextValue["openChat"]>(({ chatId, channelId, meta, position }) => {
    setChats((prev) => {
      const existing = prev.find((c) => c.chatId === chatId);
      if (existing) {
        zCounter.current += 1;
        return prev.map((c) =>
          c.chatId === chatId
            ? { ...c, minimized: false, zIndex: zCounter.current, meta: { ...c.meta, ...meta } }
            : c
        );
      }
      if (prev.length >= MAX_WINDOWS) {
        toast.error(`Limite de ${MAX_WINDOWS} janelas flutuantes atingido. Feche uma para abrir outra.`);
        return prev;
      }
      const offset = prev.length * 30;
      const initial = position
        ? clampPosition(position.x - 50, position.y - 20)
        : clampPosition(
            (typeof window !== "undefined" ? window.innerWidth - DEFAULT_WIDTH - 24 : 100) - offset,
            (typeof window !== "undefined" ? window.innerHeight - DEFAULT_HEIGHT - 24 : 100) - offset
          );
      zCounter.current += 1;
      return [
        ...prev,
        {
          chatId,
          channelId,
          meta: meta || {},
          position: initial,
          size: { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT },
          minimized: false,
          maximized: false,
          zIndex: zCounter.current,
          unread: 0,
        },
      ];
    });
  }, []);

  const closeChat = useCallback((chatId: string) => {
    setChats((prev) => prev.filter((c) => c.chatId !== chatId));
  }, []);

  const minimize = useCallback((chatId: string) => {
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, minimized: true, maximized: false } : c)));
  }, []);

  const restore = useCallback((chatId: string) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, minimized: false, zIndex: z, unread: 0 } : c)));
  }, []);

  const toggleMaximize = useCallback((chatId: string) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setChats((prev) =>
      prev.map((c) => (c.chatId === chatId ? { ...c, maximized: !c.maximized, minimized: false, zIndex: z } : c))
    );
  }, []);

  const bringToFront = useCallback((chatId: string) => {
    setChats((prev) => {
      const target = prev.find((c) => c.chatId === chatId);
      if (!target || target.zIndex === zCounter.current) return prev;
      zCounter.current += 1;
      const z = zCounter.current;
      return prev.map((c) => (c.chatId === chatId ? { ...c, zIndex: z, unread: 0 } : c));
    });
  }, []);

  const updatePosition = useCallback((chatId: string, position: { x: number; y: number }) => {
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, position: clampPosition(position.x, position.y) } : c)));
  }, []);

  const updateMeta = useCallback((chatId: string, meta: FloatingChatMeta) => {
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, meta: { ...c.meta, ...meta } } : c)));
  }, []);

  const setUnread = useCallback((chatId: string, unread: number) => {
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, unread } : c)));
  }, []);

  const isOpen = useCallback((chatId: string) => chats.some((c) => c.chatId === chatId), [chats]);

  return (
    <FloatingChatsContext.Provider
      value={{
        chats,
        openChat,
        closeChat,
        minimize,
        restore,
        toggleMaximize,
        bringToFront,
        updatePosition,
        updateMeta,
        setUnread,
        isOpen,
      }}
    >
      {children}
    </FloatingChatsContext.Provider>
  );
}

export function useFloatingChats() {
  const ctx = useContext(FloatingChatsContext);
  if (!ctx) {
    return {
      chats: [] as FloatingChatState[],
      openChat: () => {},
      closeChat: () => {},
      minimize: () => {},
      restore: () => {},
      toggleMaximize: () => {},
      bringToFront: () => {},
      updatePosition: () => {},
      updateMeta: () => {},
      setUnread: () => {},
      isOpen: () => false,
    } as FloatingChatsContextValue;
  }
  return ctx;
}
