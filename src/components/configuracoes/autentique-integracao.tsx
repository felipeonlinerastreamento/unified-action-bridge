import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Copy, Download, AlertTriangle, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { importarAutentique, integracaoAutentique, salvarConfigAutentique } from "@/lib/contratos.functions";

const dh = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nenhum ainda");

/** Configurações › Integrações: chave, situação da conta Autentique, webhook e importação dos contratos existentes. */
export function AutentiqueIntegracao() {
  const { hasRole } = useAuth();
  const admin = hasRole("admin");
  const status = useServerFn(integracaoAutentique);
  const salvar = useServerFn(salvarConfigAutentique);
  const importar = useServerFn(importarAutentique);
  const q = useQuery({ queryKey: ["autentique-integracao"], queryFn: () => status(), retry: false });
  const s = q.data as any;
  const [token, setToken] = useState("");
  const [segredo, setSegredo] = useState("");
  const [sandbox, setSandbox] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const modoTeste = sandbox ?? !!s?.sandbox;

  const doSalvar = async (apagar = false) => {
    setSalvando(true);
    try {
      const r = await salvar({ data: { token: apagar ? "" : token.trim() || undefined, sandbox: modoTeste, segredo: segredo.trim() || undefined } });
      if (r.ok) toast.success(`Autentique conectado${r.conta ? `: ${r.conta}` : ""}.`);
      else toast.error(apagar ? "Chave removida." : `Salvo, mas o Autentique recusou: ${r.erro}`);
      setToken(""); setSegredo(""); setSandbox(null);
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setSalvando(false); }
  };
  const doImportar = async () => {
    setImportando(true);
    try {
      const r = await importar();
      toast.success(`${r.novos} contrato(s) importado(s) do Autentique; ${r.existentes} já estavam no painel (${r.total} na conta).`);
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao importar do Autentique."); }
    finally { setImportando(false); }
  };

  // Situação sempre visível: carregando, erro, sem chave, chave recusada ou conectado.
  const situacao = q.isLoading ? { cor: "", texto: "Verificando…" }
    : q.error ? { cor: "destructive", texto: "Erro ao verificar" }
    : !s?.configurado ? { cor: "destructive", texto: "Não configurado" }
    : s?.conta ? { cor: "ok", texto: "Conectado" }
    : { cor: "destructive", texto: "Chave recusada" };

  const linha = (ok: boolean, texto: React.ReactNode) => (
    <div className="flex items-start gap-2 text-sm">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}<div>{texto}</div></div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          Autentique — assinatura de contratos
          <Badge variant={situacao.cor === "destructive" ? "destructive" : "outline"} className={situacao.cor === "ok" ? "bg-emerald-600 hover:bg-emerald-600 text-white border-transparent" : ""}>
            {q.isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{situacao.texto}
          </Badge>
          {s?.sandbox && <Badge variant="outline" className="border-amber-500 text-amber-600">Modo teste</Badge>}
        </CardTitle>
        <CardDescription>Envio de contratos para assinatura no Autentique e retorno automático pelo webhook.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

        {s && (
          <div className="space-y-2">
            {linha(!!s.configurado, s.configurado
              ? <>Chave configurada {s.origemToken === "ambiente" ? "nas variáveis do projeto" : "por esta tela"}{s.finalToken ? <> (termina em <b>…{s.finalToken}</b>)</> : null}.</>
              : "Nenhuma chave cadastrada.")}
            {s.configurado && linha(!!s.conta, s.conta
              ? <>Conta: <b>{s.conta.name}</b> ({s.conta.email}){s.conta.organization?.name ? ` · ${s.conta.organization.name}` : ""}
                {s.conta.subscription ? ` · ${s.conta.subscription.credits ?? 0} crédito(s), ${s.conta.subscription.documents ?? 0} documento(s) no plano` : ""}</>
              : <>O Autentique recusou a chave: {s.erro}</>)}
            {s.configurado && (
              <div className="flex items-start gap-2 text-sm">
                {s.sandbox ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />}
                <div>{s.sandbox ? "Modo teste: documentos novos não valem juridicamente e somem em poucos dias." : "Modo produção: documentos enviados são válidos e consomem créditos."}</div>
              </div>
            )}
            {linha(!!s.segredoWebhook, s.segredoWebhook ? "Segredo do webhook configurado (assinatura conferida)." : "Sem segredo do webhook (opcional): o sistema confirma cada aviso consultando a API.")}
            {s.conta && s.contratosNoPainel != null && (
              <div className="text-sm text-muted-foreground">Contratos do Autentique no painel: <b className="text-foreground">{s.contratosNoPainel}</b> · último retorno recebido: {dh(s.ultimoRetorno)}</div>
            )}
          </div>
        )}

        {admin && (
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium flex items-center gap-1"><KeyRound className="h-4 w-4" />{s?.configurado ? "Trocar a chave" : "Cadastrar a chave"}</div>
            {s?.origemToken === "ambiente" && <p className="text-xs text-muted-foreground">A chave das variáveis do projeto tem prioridade; a salva aqui só vale se ela for removida de lá.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Chave de API (token)</Label>
                <Input type="password" autoComplete="off" placeholder={s?.finalToken ? `…${s.finalToken}` : "Cole a chave gerada no painel do Autentique"} value={token} onChange={(e) => setToken(e.target.value)} /></div>
              <div><Label>Segredo do webhook (opcional)</Label>
                <Input type="password" autoComplete="off" placeholder={s?.segredoWebhook ? "•••••• (configurado)" : "Se o painel do Autentique fornecer"} value={segredo} onChange={(e) => setSegredo(e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={modoTeste} onCheckedChange={setSandbox} />Modo teste (sandbox — não consome créditos)</label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => doSalvar(false)} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar e testar</Button>
              {s?.origemToken === "tela" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => doSalvar(true)} disabled={salvando}>Remover chave</Button>}
            </div>
            <p className="text-xs text-muted-foreground">A chave fica guardada no servidor e nunca volta para a tela (só os 4 últimos caracteres).</p>
          </div>
        )}

        {s && (
          <div className="text-sm space-y-1">
            <div className="text-muted-foreground">URL do webhook para cadastrar no painel do Autentique (eventos signature.accepted, signature.rejected, signature.viewed e document.finished):</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted rounded px-2 py-1 break-all">{s.webhookUrl}</code>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(s.webhookUrl); toast.success("URL copiada."); }}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw className="h-4 w-4 mr-1" />Testar conexão</Button>
          {s?.conta && <Button size="sm" onClick={doImportar} disabled={importando}>{importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Importar contratos do Autentique</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
