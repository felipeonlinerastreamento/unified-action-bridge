import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { testGsystemAuth } from "@/lib/gsystem-api.functions";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerenciamento de canais, estoque, integrações e usuários</p>
        </div>

        <Tabs defaultValue="integracoes">
          <TabsList>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            <TabsTrigger value="stock-rules">Estoque Mínimo</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="integracoes" className="mt-4 space-y-4">
            <GsystemConnectionTest />
            <ChannelsConfig />
          </TabsContent>
          <TabsContent value="stock-rules" className="mt-4">
            <StockRulesConfig />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoriesConfig />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Gestão de usuários e papéis — disponível para administradores.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function GsystemConnectionTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await testGsystemAuth({
        headers: { authorization: `Bearer ${session?.access_token}` },
      });
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
    setTesting(false);
  };

  const statusColor = testing
    ? "border-muted bg-muted/30"
    : result?.success
      ? "border-emerald-200 bg-emerald-50"
      : result
        ? "border-destructive/30 bg-destructive/10"
        : "border-muted";

  const statusIcon = testing ? (
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  ) : result?.success ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  ) : result ? (
    <XCircle className="h-5 w-5 text-destructive" />
  ) : (
    <WifiOff className="h-5 w-5 text-muted-foreground" />
  );

  const statusLabel = testing
    ? "Verificando..."
    : result?.success
      ? "Conectado"
      : result
        ? "Falha na conexão"
        : "Não verificado";

  return (
    <Card className={`mb-6 transition-colors ${statusColor}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <CardTitle className="text-base">Integração GSystem API</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {statusLabel}
              {result?.success && result?.workingField && (
                <> · Campo: <Badge variant="outline" className="ml-1 text-xs">{result.workingField}</Badge></>
              )}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wifi className="h-4 w-4 mr-1" />}
          {testing ? "Testando..." : "Testar Conexão"}
        </Button>
      </CardHeader>
      {result && !result.success && (
        <CardContent>
          <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
            <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">{result.message}</p>
              {result.attempts && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium opacity-70">Tentativas:</p>
                  {result.attempts.map((a: any, i: number) => (
                    <p key={i} className="text-xs font-mono">
                      {a.success ? "✅" : "❌"} {a.field} → HTTP {a.status}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ChannelsConfig() {
  const [channels, setChannels] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadChannels(); }, []);

  async function loadChannels() {
    const { data } = await supabase.from("channels").select("id, name, platform, is_active, created_at");
    setChannels(data || []);
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("channels").insert({
      name: fd.get("name") as string,
      token: fd.get("token") as string,
      platform: fd.get("platform") as string || "whatsapp",
    });
    if (error) toast.error(error.message);
    else { toast.success("Canal adicionado!"); setOpen(false); loadChannels(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Canais GSystem</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar Canal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Canal</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Canal</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>Token de Acesso (access-token)</Label>
                <Input name="token" type="password" required />
              </div>
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Input name="platform" defaultValue="whatsapp" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Adicionar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum canal configurado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((ch) => (
                <TableRow key={ch.id}>
                  <TableCell className="font-medium">{ch.name}</TableCell>
                  <TableCell>{ch.platform}</TableCell>
                  <TableCell>
                    <Badge variant={ch.is_active ? "default" : "secondary"} className={ch.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                      {ch.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(ch.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StockRulesConfig() {
  const [rules, setRules] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    const { data } = await supabase.from("inventory_min_rules").select("*");
    setRules(data || []);
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("inventory_min_rules").insert({
      item_name: fd.get("item_name") as string,
      min_quantity: Number(fd.get("min_quantity")),
      auto_ticket: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Regra criada!"); setOpen(false); loadRules(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Regras de Estoque Mínimo</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Regra de Mínimo</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Item</Label>
                <Input name="item_name" required />
              </div>
              <div className="space-y-2">
                <Label>Quantidade Mínima</Label>
                <Input name="min_quantity" type="number" min={1} required />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Criar Regra"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra configurada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qtd. Mínima</TableHead>
                <TableHead>Ticket Automático</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.item_name}</TableCell>
                  <TableCell>{rule.min_quantity}</TableCell>
                  <TableCell>{rule.auto_ticket ? "Sim" : "Não"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CategoriesConfig() {
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    const { data } = await supabase.from("inventory_categories").select("*");
    setCategories(data || []);
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("inventory_categories").insert({
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Categoria criada!"); setOpen(false); loadCategories(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Categorias de Estoque</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input name="description" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria criada</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cat.description || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
