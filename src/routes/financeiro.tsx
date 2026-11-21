import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wallet, Loader2, Lock } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useFinanceAccess, useFinData } from "@/components/financeiro/use-fin";
import { PainelTab } from "@/components/financeiro/painel-tab";
import { LancamentosTab } from "@/components/financeiro/lancamentos-tab";
import { ComprovantesTab } from "@/components/financeiro/comprovantes-tab";
import { FluxoTab, DreTab } from "@/components/financeiro/relatorios-tabs";
import { ConciliacaoTab } from "@/components/financeiro/conciliacao-tab";
import { CadastrosTab } from "@/components/financeiro/cadastros-tab";

type FinSearch = { tab?: string };

export const Route = createFileRoute("/financeiro")({
  validateSearch: (s: Record<string, unknown>): FinSearch => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({ meta: [{ title: "Financeiro | Gestão Online" }, { name: "robots", content: "noindex" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <FinanceiroContent />
    </AppLayout>
  );
}

function FinanceiroContent() {
  const { canAccess, isLoading } = useFinanceAccess();
  const search = Route.useSearch();
  const [tab, setTab] = useState(search.tab ?? "painel");
  const data = useFinData(canAccess);

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!canAccess) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-2">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">O Financeiro é liberado somente para pessoas autorizadas.</p>
      </div>
    );
  }

  const aRevisar = data.lancamentos.filter((l) => !l.revisado).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Financeiro</h1>
        <p className="text-sm text-muted-foreground">Contas a pagar e a receber, comprovantes, fluxo de caixa, DRE e conciliação bancária.</p>
      </div>
      {data.error && <p className="text-sm text-destructive">Não foi possível carregar os dados: {data.error.message}</p>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="receber">Contas a receber</TabsTrigger>
          <TabsTrigger value="comprovantes">Comprovantes{aRevisar > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{aRevisar}</Badge>}</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="cadastros">Categorias</TabsTrigger>
        </TabsList>
        {data.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mt-4" />
        ) : (
          <>
            <TabsContent value="painel" className="mt-4"><PainelTab lancamentos={data.lancamentos} categorias={data.categorias} onRevisar={() => setTab("comprovantes")} /></TabsContent>
            <TabsContent value="pagar" className="mt-4"><LancamentosTab tipo="pagar" lancamentos={data.lancamentos} categorias={data.categorias} empresas={data.empresas} /></TabsContent>
            <TabsContent value="receber" className="mt-4"><LancamentosTab tipo="receber" lancamentos={data.lancamentos} categorias={data.categorias} empresas={data.empresas} /></TabsContent>
            <TabsContent value="comprovantes" className="mt-4"><ComprovantesTab lancamentos={data.lancamentos} categorias={data.categorias} empresas={data.empresas} /></TabsContent>
            <TabsContent value="fluxo" className="mt-4"><FluxoTab lancamentos={data.lancamentos} contas={data.contas} /></TabsContent>
            <TabsContent value="dre" className="mt-4"><DreTab lancamentos={data.lancamentos} categorias={data.categorias} /></TabsContent>
            <TabsContent value="conciliacao" className="mt-4"><ConciliacaoTab lancamentos={data.lancamentos} contas={data.contas} empresas={data.empresas} /></TabsContent>
            <TabsContent value="cadastros" className="mt-4"><CadastrosTab categorias={data.categorias} empresas={data.empresas} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
