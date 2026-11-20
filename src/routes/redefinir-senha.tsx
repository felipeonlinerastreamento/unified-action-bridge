import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import logoOnline from "@/assets/logo-online-horizontal.png";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Criar nova senha" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // O link do e-mail abre uma sessão de recuperação; só então a senha pode ser trocada.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pwd = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (pwd.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres."); return; }
    if (pwd !== confirm) { toast.error("As senhas não conferem."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logoOnline} alt="Online Rastreamento" className="mx-auto mb-4 h-16 w-auto object-contain" />
          <CardDescription>Criar nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">
              Abra esta página pelo link enviado ao seu e-mail. Se o link expirou, peça um novo em "Esqueci minha senha".
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
