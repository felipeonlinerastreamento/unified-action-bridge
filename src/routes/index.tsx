import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/auth-form";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  // Redirect to dashboard
  return <MetaRedirect />;
}

function MetaRedirect() {
  const navigate = Route.useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("panel_only")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && (data as any)?.panel_only === true) {
          navigate({ to: "/painel-tv" });
          return;
        }
      }
      if (!cancelled) navigate({ to: "/dashboard" });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  return null;
}
