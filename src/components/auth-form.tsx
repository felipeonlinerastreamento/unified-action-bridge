import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#f35325" />
      <rect x="12" y="1" width="10" height="10" fill="#81bc06" />
      <rect x="1" y="12" width="10" height="10" fill="#05a6f0" />
      <rect x="12" y="12" width="10" height="10" fill="#ffba08" />
    </svg>
  );
}

export function AuthForm() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  const handleMicrosoft = async () => {
    setMsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("microsoft", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Erro ao entrar com Microsoft");
        setMsLoading(false);
        return;
      }
      if (result.redirected) return;
      toast.success("Login realizado com sucesso!");
    } catch {
      toast.error("Erro ao entrar com Microsoft");
    } finally {
      setMsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await signIn(fd.get("email") as string, fd.get("password") as string);
      toast.success("Login realizado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            GS
          </div>
          <CardTitle>GSystem Hub</CardTitle>
          <CardDescription>Sistema Unificado de Chamados e Operação</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input id="login-password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
