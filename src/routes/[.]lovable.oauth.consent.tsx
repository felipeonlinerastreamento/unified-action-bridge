import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: any }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as any).oauth as OAuthNamespace;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { authorization_id } = Route.useSearch();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signedIn || !authorization_id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await oauthApi().getAuthorizationDetails(authorization_id);
      if (cancelled) return;
      if (error) {
        setError(error.message ?? String(error));
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, authorization_id]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message ?? String(error));
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um endereço de retorno.");
      return;
    }
    window.location.href = target;
  }

  if (!authorization_id) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Pedido de autorização inválido (authorization_id ausente).</p>
      </Shell>
    );
  }

  if (signedIn === null) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </Shell>
    );
  }

  if (!signedIn) return <AuthForm />;

  const clientName = details?.client?.name ?? "o aplicativo";

  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        Conectar <span className="font-medium text-foreground">{clientName}</span> à sua conta do GS Hub. Ele poderá
        consultar seus dados com as mesmas permissões que você tem no sistema.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <Button disabled={busy || !details} onClick={() => decide(true)}>
          Autorizar
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
          Recusar
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Autorizar acesso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">{children}</CardContent>
      </Card>
    </main>
  );
}
