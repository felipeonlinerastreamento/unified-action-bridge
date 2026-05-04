import { lazy, Suspense, useState } from "react";
import { Smile, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// emoji-picker-react is heavy; load on demand
const EmojiPicker = lazy(() => import("emoji-picker-react"));

interface Props {
  onPick: (emoji: string) => void;
  size?: "sm" | "default" | "icon";
  disabled?: boolean;
  className?: string;
}

export function EmojiPickerButton({ onPick, size = "icon", disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const isSm = size === "sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size === "sm" ? "icon" : "icon"}
          title="Inserir emoji"
          disabled={disabled}
          className={`${isSm ? "h-8 w-8 shrink-0" : ""} ${className ?? ""}`}
        >
          <Smile className={isSm ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="p-0 w-auto border-none bg-transparent shadow-none"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-[350px] w-[300px] rounded-md border bg-background">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          }
        >
          <EmojiPicker
            onEmojiClick={(e) => {
              onPick(e.emoji);
              setOpen(false);
            }}
            width={320}
            height={400}
            searchPlaceHolder="Buscar emoji..."
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
