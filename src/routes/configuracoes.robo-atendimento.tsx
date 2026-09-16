import { createFileRoute } from "@tanstack/react-router";
import { BotAutoReplyConfig } from "@/components/configuracoes/bot-auto-reply-config";

export const Route = createFileRoute("/configuracoes/robo-atendimento")({
  component: RoboAtendimentoPage,
});

function RoboAtendimentoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Robô de Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Configure o primeiro atendimento automático das conversas do WhatsApp.
          </p>
        </div>
        <BotAutoReplyConfig />
      </div>
    </div>
  );
}
