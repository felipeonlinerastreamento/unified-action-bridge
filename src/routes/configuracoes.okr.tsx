import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { OkrCyclesManagement } from "@/components/okr/cycles-management";
import { Target } from "lucide-react";

export const Route = createFileRoute("/configuracoes/okr")({
  component: OkrConfigPage,
  head: () => ({ meta: [{ title: "Configurações — OKR" }] }),
});

function OkrConfigPage() {
  return (
    <AppLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">OKR — Ciclos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Crie e gerencie os ciclos de OKR (trimestral, mensal ou customizado).
        </p>
        <OkrCyclesManagement />
      </div>
    </AppLayout>
  );
}
