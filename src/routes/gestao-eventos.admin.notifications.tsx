import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/gestao-eventos/admin/notifications")({
  component: NotificationsAdmin,
});

function NotificationsAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notificações</h1>
        <p className="text-sm text-muted-foreground">Configuração de envio por email e WhatsApp</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Em breve</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O envio por email exige a conexão com o Resend. Quando você habilitar o connector, esta tela permitirá configurar destinatários, tipo de disparo (imediato, após tratativa, resumo diário) e nível mínimo de risco.
        </CardContent>
      </Card>
    </div>
  );
}
