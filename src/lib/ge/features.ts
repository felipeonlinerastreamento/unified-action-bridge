// Gestão de funcionalidades por cliente.
// Regra: ADM cria → implementa → testa → valida → libera → cliente utiliza.
// O frontend apenas reflete a configuração; a autorização real está no banco (RLS).
import { useQuery } from "@tanstack/react-query";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";

export const FEATURES = {
  events: "events",
  eventsTelemetry: "events.telemetry",
  eventsFatigue: "events.fatigue",
  fleets: "fleets",
  reportsOperational: "reports.operational",
  drivers: "drivers",
  risk: "risk",
  riskTelemetry: "risk.telemetry",
  riskFatigue: "risk.fatigue",
  riskTrackers: "risk.trackers",
  riskBreathalyzers: "risk.breathalyzers",
  riskTag: "risk.tag",
  notifications: "notifications",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export interface FeatureAccess {
  /** true quando a funcionalidade está liberada para o contexto atual */
  has: (key: FeatureKey | string) => boolean;
  loading: boolean;
  /** true quando o usuário é ADM da plataforma (acesso a funcionalidades em desenvolvimento) */
  isAdminContext: boolean;
  enabledKeys: string[];
}

/**
 * Funcionalidades liberadas no contexto atual.
 * ADM da plataforma mantém acesso total (inclusive funcionalidades em teste/validação).
 */
export function useFeatures(): FeatureAccess {
  const { profile, isPlatformAdmin, impersonatedClient, loading: authLoading } = useAuth();
  const clientId = profile?.client_id ?? null;
  // Durante o acesso remoto à base do cliente (manutenção), o ADM passa a ver
  // exatamente o que o cliente vê: as funcionalidades liberadas para aquela base.
  const clientContext = !isPlatformAdmin || !!impersonatedClient;

  const { data, isLoading } = useQuery({
    queryKey: ["client-features", clientId],
    enabled: clientContext && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_client_features")
        .select("feature_key,is_enabled")
        .eq("client_id", clientId!);
      if (error) throw error;
      return (data ?? []).filter((r) => r.is_enabled).map((r) => r.feature_key);
    },
  });

  if (!clientContext) {
    return {
      has: () => true,
      loading: authLoading,
      isAdminContext: true,
      enabledKeys: Object.values(FEATURES),
    };
  }

  const keys = data ?? [];
  return {
    has: (key) => keys.includes(key),
    loading: authLoading || isLoading,
    isAdminContext: false,
    enabledKeys: keys,
  };
}

