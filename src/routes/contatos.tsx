import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground">Gestão de contatos via GSystem</p>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contato..." className="pl-8" />
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground text-center py-8">
              Configure um canal GSystem em Configurações para gerenciar contatos.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
