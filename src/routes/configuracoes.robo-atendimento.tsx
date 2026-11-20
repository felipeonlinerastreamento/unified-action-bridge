import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { BotAutoReplyConfig } from "@/components/configuracoes/bot-auto-reply-config";

export const Route = createFileRoute("/configuracoes/robo-atendimento")({
  head: () => ({ meta: [{ title: "Robô de Atendimento | Configurações" }] }),
  component: RoboAtendimentoPage,
});

function RoboAtendimentoPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Bot className="h-6 w-6" /> Robô de Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Configure o primeiro atendimento automático das conversas do WhatsApp.
          </p>
        </div>
        <BotAutoReplyConfig />
      </div>
    </AppLayout>
  );
}
