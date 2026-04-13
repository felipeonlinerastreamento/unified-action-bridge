import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";

export const Route = createFileRoute("/atendimentos")({
  component: AtendimentosPage,
});

function AtendimentosPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Atendimentos</h1>
            <p className="text-sm text-muted-foreground">Lista de chamados via GSystem</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por contato, número..." className="pl-8" />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Configure um canal GSystem em Configurações para listar os atendimentos.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
