import { Button } from "@/components/ui/button";
import { EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "icon";
}

export function WhisperToggle({ active, onToggle, size = "icon" }: Props) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size={size === "icon" ? "icon" : "sm"}
      className={cn("shrink-0", active && "bg-amber-500 hover:bg-amber-600 text-white")}
      onClick={onToggle}
      title={active ? "Sussurro ativo (não vai para o cliente)" : "Sussurro: mensagem interna"}
    >
      {active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}
