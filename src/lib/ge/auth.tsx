// Contexto de acesso da Gestão de eventos (mesma interface do projeto antigo "auth-context"),
// montado sobre o login do Gestão Online:
// - equipe interna com o menu "gestao-eventos" (ou admin/gestor) = ADM da plataforma (admin_platform);
// - usuário de cliente = papéis e cliente de ge_profiles/ge_user_roles.
// A autorização real continua no banco (RLS das tabelas ge_ via ge_has_role/ge_staff_allowed).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { geDb } from "@/lib/ge/db";

export type AppRole = "admin_platform" | "admin_client" | "admin_group" | "operator";

export interface AuthProfile {
  id: string;
  email: string;
  full_name: string | null;
  client_id: string | null;
  group_id: string | null;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isClientAdmin: boolean;
  /** true para a equipe do Gestão (não é usuário de cliente) */
  isStaff: boolean;
  hasRole: (r: AppRole) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  impersonatedClient: { id: string; name: string } | null;
  startImpersonation: (client: { id: string; name: string }) => void;
  stopImpersonation: () => void;
}

const IMPERSONATION_KEY = "ge_maintenance_client_access";
const AuthContext = createContext<AuthState | null>(null);

export function GeAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [impersonatedClient, setImpersonatedClient] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPERSONATION_KEY);
      if (raw) setImpersonatedClient(JSON.parse(raw) as { id: string; name: string });
    } catch { /* ignore */ }
  }, []);

  const carregar = useCallback(async (u: User) => {
    const { data: staff } = await (supabase as any).rpc("ge_staff_allowed");
    if (staff === true) {
      // Equipe: registra nome/e-mail para aparecer nas tratativas e entra como ADM da plataforma.
      await (supabase as any).rpc("ge_registrar_equipe").then(() => undefined, () => undefined);
      const { data: p } = await (supabase as any).from("profiles").select("name").eq("user_id", u.id).maybeSingle();
      setIsStaff(true);
      setRoles(["admin_platform"]);
      setProfile({ id: u.id, email: u.email ?? "", full_name: p?.name ?? u.email ?? null, client_id: null, group_id: null, is_active: true });
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      geDb.from("ge_profiles").select("id,email,full_name,client_id,group_id,is_active").eq("id", u.id).maybeSingle(),
      geDb.from("ge_user_roles").select("role").eq("user_id", u.id),
    ]);
    setIsStaff(false);
    setProfile((p as AuthProfile) ?? null);
    setRoles(((r as { role: AppRole }[]) ?? []).map((x) => x.role));
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!vivo) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await carregar(s.user).catch(() => undefined);
      if (vivo) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) { setProfile(null); setRoles([]); setIsStaff(false); }
    });
    return () => { vivo = false; subscription.unsubscribe(); };
  }, [carregar]);

  const refresh = async () => { if (user) await carregar(user); };
  const signOut = async () => {
    try { localStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
    setImpersonatedClient(null);
    await supabase.auth.signOut();
  };

  const isPlatformAdmin = roles.includes("admin_platform");
  const startImpersonation = (client: { id: string; name: string }) => {
    if (!isPlatformAdmin) return;
    try { localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(client)); } catch { /* ignore */ }
    setImpersonatedClient(client);
  };
  const stopImpersonation = () => {
    try { localStorage.removeItem(IMPERSONATION_KEY); } catch { /* ignore */ }
    setImpersonatedClient(null);
  };
  const activeImpersonation = isPlatformAdmin ? impersonatedClient : null;
  const effectiveProfile: AuthProfile | null =
    profile && activeImpersonation ? { ...profile, client_id: activeImpersonation.id, group_id: null } : profile;

  const value: AuthState = {
    user, session, profile: effectiveProfile, roles, loading,
    isAuthenticated: !!user,
    isPlatformAdmin,
    isClientAdmin: roles.includes("admin_client"),
    isStaff,
    hasRole: (r) => roles.includes(r),
    signOut, refresh,
    impersonatedClient: activeImpersonation,
    startImpersonation, stopImpersonation,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de GeAuthProvider");
  return ctx;
}
