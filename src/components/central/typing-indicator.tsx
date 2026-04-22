interface Props {
  name?: string;
  className?: string;
}

/**
 * Animated "typing…" bubble shown when the contact's presence is `composing`.
 * Driven by `zapi_chats.bot_state.is_typing` (updated by the Z-API webhook).
 */
export function TypingIndicator({ name, className = "" }: Props) {
  return (
    <div className={`flex justify-start ${className}`}>
      <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted text-foreground inline-flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {name ? `${name} está digitando` : "digitando"}
        </span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
        </span>
      </div>
    </div>
  );
}
