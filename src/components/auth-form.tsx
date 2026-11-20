import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import logoOnline from "@/assets/logo-online-horizontal.png";

const REMEMBER_KEY = "gshub_login_email";

function readRemembered(): string {
  try { return localStorage.getItem(REMEMBER_KEY) ?? ""; } catch { return ""; }
}
function writeRemembered(email: string | null) {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* navegador sem armazenamento */ }
}

export function AuthForm() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  useEffect(() => {
    const saved = readRemembered();
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = email.trim();
    if (!target) { toast.error("Informe seu e-mail."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.");
      setMode("login");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const emailStr = (fd.get("email") as string) || "";
    try {
      await signIn(emailStr, fd.get("password") as string);
      writeRemembered(remember ? emailStr.trim() : null);
      toast.success("Login realizado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src={logoOnline}
            alt="Online Rastreamento"
            className="mx-auto mb-4 h-16 w-auto object-contain"
          />
          <CardDescription>Sistema Unificado de Chamados e Operação</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" name="email" type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Senha</Label>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMode("forgot")}>
                  Esqueci minha senha
                </button>
              </div>
              <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="login-remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
              <Label htmlFor="login-remember" className="text-sm font-normal cursor-pointer">Lembrar meu acesso neste computador</Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-muted-foreground">Informe seu e-mail. Enviaremos um link para você criar uma nova senha.</p>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:underline" onClick={() => setMode("login")}>
              Voltar ao login
            </button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
