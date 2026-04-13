import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Relatórios gerenciais e exportação</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Atendimentos por Período", desc: "Volume de atendimentos com filtros de data" },
            { title: "Performance por Atendente", desc: "Quantidade e tempo médio por operador" },
            { title: "Volume por Setor", desc: "Distribuição de atendimentos por setor" },
            { title: "Horários de Pico", desc: "Análise de horários com maior demanda" },
            { title: "Distribuição por Canal", desc: "Volume por canal de atendimento" },
            { title: "Movimentação de Estoque", desc: "Entradas, saídas e histórico de itens" },
          ].map((report) => (
            <Card key={report.title} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.desc}</p>
                <p className="text-xs text-muted-foreground mt-2">Configure um canal para gerar relatórios</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
