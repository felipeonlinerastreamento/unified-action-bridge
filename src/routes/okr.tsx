import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { OkrList } from "@/components/okr/okr-list";
import { Target } from "lucide-react";

export const Route = createFileRoute("/okr")({
  component: OkrPage,
  head: () => ({ meta: [{ title: "OKR — Objectives & Key Results" }] }),
});

function OkrPage() {
  return (
    <AppLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">OKR</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Objectives & Key Results — defina metas claras e acompanhe o progresso.
        </p>
        <OkrList />
      </div>
    </AppLayout>
  );
}
