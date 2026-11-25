import type { ReactNode } from "react";
import { useFeatures, type FeatureKey } from "@/lib/ge/features";

/**
 * Bloqueia o conteúdo quando a funcionalidade não está liberada para o cliente.
 * O bloqueio real também existe no banco (RLS) — esta camada é apenas a interface.
 */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { has, loading } = useFeatures();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!has(feature)) {
    return (
      <div className="rounded-md border p-6">
        <h1 className="text-lg font-semibold">Funcionalidade não disponível</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta funcionalidade não está habilitada para o seu acesso. Fale com o administrador da plataforma.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
