import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Lock, WifiOff } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRcAccess, useRcData } from "@/components/reconnect/use-rc";
import { PainelTab } from "@/components/reconnect/painel-tab";
import { ResultadosTab } from "@/components/reconnect/resultados-tab";
import { ConfigTab, MensagensTab, NotificacoesTab, RecuperadosTab } from "@/components/reconnect/outras-abas";

export const Route = createFileRoute("/reconnect")({
  head: () => ({ meta: [{ title: "Reconnect | Gestão Online" }] }),
  component: ReconnectPage,
});

function ReconnectPage() {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const gestor = hasRole("admin") || hasRole("gestor");
  const acesso = useRcAccess(user?.id);
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      {acesso.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : acesso.data?.erro ? (
        <div className="max-w-lg mx-auto mt-16 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Reconnect ainda não está pronto no banco de dados</h1>
          <p className="text-sm text-muted-foreground">{gestor ? `O servidor respondeu: ${acesso.data.erro}. A migração 0057_reconnect precisa ser aplicada.` : "Fale com o administrador."}</p>
        </div>
      ) : acesso.data?.ok ? <ReconnectTela /> : (
        <div className="max-w-md mx-auto mt-16 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">O Reconnect é liberado para gestores e para os grupos de setor com o menu "Reconnect".</p>
        </div>
      )}
    </AppLayout>
  );
}

function ReconnectTela() {
  const d = useRcData(true);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><WifiOff className="h-6 w-6" /> Reconnect</h1>
        <p className="text-sm text-muted-foreground">Rastreadores que pararam de comunicar: importar planilhas, notificar clientes e acompanhar os recuperados.</p>
      </div>
      {d.error && <p className="text-sm text-destructive">Não foi possível carregar: {d.error.message}</p>}
      <Tabs defaultValue="painel">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
          <TabsTrigger value="recuperados">Recuperados</TabsTrigger>
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        {d.isLoading ? <Loader2 className="h-5 w-5 animate-spin mt-4" /> : (
          <>
            <TabsContent value="painel" className="mt-4"><PainelTab {...d} /></TabsContent>
            <TabsContent value="notificacoes" className="mt-4"><NotificacoesTab clients={d.clients} vehicles={d.vehicles} templates={d.templates} /></TabsContent>
            <TabsContent value="resultados" className="mt-4"><ResultadosTab /></TabsContent>
            <TabsContent value="recuperados" className="mt-4"><RecuperadosTab recovered={d.recovered} /></TabsContent>
            <TabsContent value="mensagens" className="mt-4"><MensagensTab templates={d.templates} /></TabsContent>
            <TabsContent value="config" className="mt-4"><ConfigTab importTemplates={d.importTemplates} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
