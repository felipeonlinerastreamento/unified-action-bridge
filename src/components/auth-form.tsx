import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

// E-mails que possuem exceção de acesso quando o login global por e-mail está desativado.
const EMERGENCY_ALLOWED_EMAILS = [
  "patricia@onlinerastreamento",
  "contato.pats@gmail.com",
];

function isEmergencyEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return EMERGENCY_ALLOWED_EMAILS.some((allowed) => normalized.startsWith(allowed));
}

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
    const emailStr = (fd.get("email") as string) || "";
    try {
      await signIn(emailStr, fd.get("password") as string);
      toast.success("Login realizado com sucesso!");
    } catch (err: any) {
      const errMsg = err.message || "";
      const normalizedErr = errMsg.toLowerCase();
      const looksLikeProviderDisabled =
        normalizedErr.includes("email logins are disabled") ||
        normalizedErr.includes("logins are disabled") ||
        normalizedErr.includes("disabled") ||
        normalizedErr.includes("signups not allowed") ||
        normalizedErr.includes("provider");
      if (looksLikeProviderDisabled && isEmergencyEmail(emailStr)) {
        toast.info("Acesso especial detectado... Autorizando...");
        try {
          const { executeEmergencyLogin } = await import("@/lib/auth-emergency.server");
          const res = await executeEmergencyLogin({ data: { email: emailStr, redirectTo: window.location.origin } });
          if (res?.url) {
            window.location.href = res.url;
            return;
          }
        } catch (emErr) {
          toast.error("Acesso especial falhou.");
        }
      } else {
        toast.error(errMsg || "Erro ao fazer login");
      }
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
