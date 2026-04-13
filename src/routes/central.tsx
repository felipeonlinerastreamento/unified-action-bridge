import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/central")({
  component: CentralPage,
});

function CentralPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Chat bidirecional via WhatsApp</p>
        </div>

        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
          {/* Chat list */}
          <div className="col-span-3 border rounded-lg overflow-auto">
            <div className="p-3 border-b">
              <input placeholder="Buscar conversa..." className="w-full px-3 py-2 text-sm border rounded-md bg-background" />
            </div>
            <div className="p-4 text-sm text-muted-foreground text-center">
              Configure um canal para ver conversas
            </div>
          </div>

          {/* Chat area */}
          <div className="col-span-6 border rounded-lg flex flex-col">
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa para iniciar
            </div>
            <div className="p-3 border-t flex gap-2">
              <input placeholder="Digite uma mensagem..." className="flex-1 px-3 py-2 text-sm border rounded-md bg-background" disabled />
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm" disabled>Enviar</button>
            </div>
          </div>

          {/* Contact panel */}
          <div className="col-span-3 border rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">Detalhes do contato</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
