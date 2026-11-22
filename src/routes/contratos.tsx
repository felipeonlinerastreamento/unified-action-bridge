import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ContratosTela } from "@/components/contratos/contratos-tela";

export const Route = createFileRoute("/contratos")({
  head: () => ({ meta: [{ title: "Contratos | Gestão Online" }, { name: "robots", content: "noindex" }] }),
  component: ContratosPage,
});

function ContratosPage() {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const gestor = hasRole("admin") || hasRole("gestor");
  const acesso = useQuery({
    queryKey: ["contratos-acesso", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("contratos_allowed");
      // Erro aqui quase sempre é a migração ainda não aplicada no banco.
      if (error) return { ok: false, erro: error.message as string };
      return { ok: data === true, erro: null };
    },
  });
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      {acesso.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : acesso.data?.erro ? (
        <div className="max-w-lg mx-auto mt-16 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Contratos ainda não está pronto no banco de dados</h1>
          <p className="text-sm text-muted-foreground">{gestor ? `O servidor respondeu: ${acesso.data.erro}. As migrações 0053 e 0054 precisam ser aplicadas.` : "Fale com o administrador."}</p>
        </div>
      ) : acesso.data?.ok || gestor ? <ContratosTela /> : (
        <div className="max-w-md mx-auto mt-16 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">Contratos é liberado para gestores e para os grupos de setor com o menu "Contratos".</p>
        </div>
      )}
    </AppLayout>
  );
}
