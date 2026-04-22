import { Check, CheckCheck } from "lucide-react";

interface Props {
  status?: string;
  className?: string;
}

/**
 * WhatsApp-style delivery ticks:
 * - sent      → single check (muted)
 * - delivered → double check (muted)
 * - read      → double check (sky-blue)
 */
export function MessageStatusTicks({ status, className = "" }: Props) {
  const s = (status || "sent").toLowerCase();
  if (s === "read") {
    return <CheckCheck className={`h-3 w-3 text-sky-400 ${className}`} aria-label="Lido" />;
  }
  if (s === "delivered") {
    return <CheckCheck className={`h-3 w-3 ${className}`} aria-label="Entregue" />;
  }
  return <Check className={`h-3 w-3 ${className}`} aria-label="Enviado" />;
}
