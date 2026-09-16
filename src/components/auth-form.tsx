import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";


// E-mails que possuem exceção de acesso quando o login global por e-mail está desativado.
const EMERGENCY_ALLOWED_EMAILS = [
  "patricia@onlinerastreamento",
  "contato.pats@gmail.com",
];

function isEmergencyEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return EMERGENCY_ALLOWED_EMAILS.some((allowed) => normalized.startsWith(allowed));
}

export function AuthForm() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);



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
