import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, CheckCircle, AlertTriangle, Package, Headphones } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral operacional</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Atendimentos Abertos" value="—" icon={MessageSquare} description="Aguardando configuração do canal" />
          <KPICard title="Em Espera" value="—" icon={Clock} description="Aguardando atendente" />
          <KPICard title="Finalizados Hoje" value="—" icon={CheckCircle} description="Concluídos nas últimas 24h" />
          <KPICard title="Tempo Médio" value="—" icon={Headphones} description="Tempo médio de atendimento" />
        </div>

        {/* Alerts and Stock */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas de Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nenhum alerta ativo. Configure regras mínimas em Configurações.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Estoque Resumo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div>
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-xs text-muted-foreground">Disponíveis</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">0</p>
                  <p className="text-xs text-muted-foreground">Vinculados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure um canal GSystem em Configurações para visualizar os atendimentos.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function KPICard({ title, value, icon: Icon, description }: { title: string; value: string; icon: any; description: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
