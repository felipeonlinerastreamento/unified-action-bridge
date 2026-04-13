import { createFileRoute, redirect } from "@tanstack/react-router";
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
  navigate({ to: "/dashboard" });
  return null;
}
