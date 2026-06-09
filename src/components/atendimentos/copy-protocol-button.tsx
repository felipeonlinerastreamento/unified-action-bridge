import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CopyProtocolButtonProps {
  protocol: string;
  className?: string;
}

export function CopyProtocolButton({ protocol, className }: CopyProtocolButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(protocol);
      setCopied(true);
      toast.success("Protocolo copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Falha ao copiar protocolo");
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-6 w-6 ${className || ""}`}
      onClick={handleCopy}
      title="Copiar protocolo"
      aria-label="Copiar protocolo"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
