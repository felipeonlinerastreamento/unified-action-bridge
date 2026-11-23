import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock, UserCog } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RhTela } from "@/components/rh/rh-tela";

export const Route = createFileRoute("/rh")({
  head: () => ({ meta: [{ title: "RH | Gestão Online" }, { name: "robots", content: "noindex" }] }),
  component: RhPage,
});

function RhPage() {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const admin = hasRole("admin");
  const acesso = useQuery({
    queryKey: ["rh-acesso", user?.id],
    enabled: !!user?.id && admin,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rh_allowed");
      if (error) return { ok: false, erro: error.message as string };
      return { ok: data === true, erro: null };
    },
  });
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      {!admin || (acesso.data && !acesso.data.ok && !acesso.data.erro) ? (
        <div className="max-w-md mx-auto mt-16 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">O RH é liberado somente para administradores.</p>
        </div>
      ) : acesso.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : acesso.data?.erro ? (
        <div className="max-w-xl mx-auto mt-16 text-center space-y-2">
          <h1 className="text-lg font-semibold">RH ainda não disponível</h1>
          <p className="text-sm text-muted-foreground">Aplique a migração 0072 no Lovable. Detalhe: {acesso.data.erro}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="h-6 w-6" /> RH</h1>
            <p className="text-sm text-muted-foreground">Colaboradores, faltas e ausências, férias, banco de horas, documentos, advertências, admissão e desligamento.</p>
          </div>
          <RhTela />
        </div>
      )}
    </AppLayout>
  );
}
