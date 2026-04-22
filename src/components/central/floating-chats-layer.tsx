import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X, MessageSquare } from "lucide-react";
import { useFloatingChats } from "./floating-chats-context";
import { FloatingChatWindow } from "./floating-chat-window";

interface Props {
  onOpenInPanel?: (chatId: string) => void;
}

export function FloatingChatsLayer({ onOpenInPanel }: Props) {
  const { chats, restore, closeChat } = useFloatingChats();

  const minimized = chats.filter((c) => c.minimized);
  const visible = chats.filter((c) => !c.minimized);

  return (
    <>
      {/* Floating windows */}
      {visible.map((c) => (
        <FloatingChatWindow key={c.chatId} state={c} onOpenInPanel={onOpenInPanel} />
      ))}

      {/* Dock of minimized chats */}
      {minimized.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[90] flex flex-row-reverse flex-wrap gap-2 max-w-[calc(100vw-32px)] justify-end">
          {minimized.map((c) => {
            const name = c.meta.name || `Chat ${c.chatId.slice(0, 6)}`;
            const initials = name.substring(0, 2).toUpperCase();
            const isDefaultAvatar = c.meta.avatar?.includes("avatar-default");
            return (
              <div
                key={c.chatId}
                onClick={() => restore(c.chatId)}
                className={`group cursor-pointer flex items-center gap-2 bg-background border rounded-full pl-1 pr-2 py-1 shadow-lg hover:shadow-xl hover:bg-accent transition-all ${
                  c.unread > 0 ? "ring-2 ring-primary animate-pulse" : ""
                }`}
                style={c.meta.slaColor ? { borderColor: c.meta.slaColor } : undefined}
                title={`Restaurar conversa com ${name}`}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-7 w-7">
                    {!isDefaultAvatar && c.meta.avatar && <AvatarImage src={c.meta.avatar} />}
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5">
                    <MessageSquare className="h-2 w-2 text-white" />
                  </div>
                </div>
                <span className="text-xs font-medium max-w-[120px] truncate">{name}</span>
                {c.unread > 0 && (
                  <Badge variant="default" className="text-[10px] h-4 min-w-[16px] px-1 justify-center">
                    {c.unread}
                  </Badge>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); closeChat(c.chatId); }}
                  className="rounded-full p-0.5 hover:bg-destructive/20 opacity-60 group-hover:opacity-100 transition-opacity"
                  title="Fechar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
