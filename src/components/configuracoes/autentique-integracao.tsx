import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Copy, Download, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { importarAutentique, integracaoAutentique } from "@/lib/contratos.functions";

const dh = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nenhum ainda");

/** Configurações › Integrações: situação da conta Autentique, webhook e importação dos contratos existentes. */
export function AutentiqueIntegracao() {
  const status = useServerFn(integracaoAutentique);
  const importar = useServerFn(importarAutentique);
  const [importando, setImportando] = useState(false);
  const q = useQuery({ queryKey: ["autentique-integracao"], queryFn: () => status(), retry: false });
  const s = q.data as any;

  const doImportar = async () => {
    setImportando(true);
    try {
      const r = await importar();
      toast.success(`${r.novos} contrato(s) importado(s) do Autentique; ${r.existentes} já estavam no painel (${r.total} na conta).`);
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao importar do Autentique."); }
    finally { setImportando(false); }
  };

  const linha = (ok: boolean, texto: React.ReactNode) => (
    <div className="flex items-start gap-2 text-sm">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}<div>{texto}</div></div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Autentique — assinatura de contratos
          {s && (s.conta ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Conectado</Badge> : <Badge variant="destructive">{s.configurado ? "Erro" : "Não configurado"}</Badge>)}
          {s?.sandbox && <Badge variant="outline" className="border-amber-500 text-amber-600">Modo teste</Badge>}
        </CardTitle>
        <CardDescription>Envio de contratos para assinatura no Autentique e retorno automático pelo webhook.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {s && (
          <>
            {linha(s.configurado, s.configurado ? "Chave de API configurada (AUTENTIQUE_API_TOKEN)." : "Chave de API não configurada: cadastre AUTENTIQUE_API_TOKEN nas variáveis do projeto.")}
            {s.configurado && linha(!!s.conta, s.conta
              ? <>Conta: <b>{s.conta.name}</b> ({s.conta.email}){s.conta.organization?.name ? ` · ${s.conta.organization.name}` : ""}
                {s.conta.subscription ? ` · ${s.conta.subscription.credits ?? 0} crédito(s), ${s.conta.subscription.documents ?? 0} documento(s) no plano` : ""}</>
              : <>A chave foi recusada: {s.erro}</>)}
            {s.configurado && (
              <div className="flex items-start gap-2 text-sm">
                {s.sandbox ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />}
                <div>{s.sandbox ? "Modo teste ligado (AUTENTIQUE_SANDBOX): documentos novos não valem juridicamente e somem em poucos dias." : "Modo produção: documentos enviados são válidos e consomem créditos."}</div>
              </div>
            )}
            {linha(s.segredoWebhook, s.segredoWebhook ? "Segredo do webhook configurado (assinatura conferida)." : "Sem segredo do webhook (opcional): o sistema confirma cada aviso consultando a API.")}
            <div className="text-sm space-y-1">
              <div className="text-muted-foreground">URL do webhook para cadastrar no painel do Autentique (eventos signature.accepted, signature.rejected, signature.viewed e document.finished):</div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted rounded px-2 py-1 break-all">{s.webhookUrl}</code>
                <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(s.webhookUrl); toast.success("URL copiada."); }}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            {s.conta && (
              <div className="text-sm text-muted-foreground">Contratos do Autentique no painel: <b className="text-foreground">{s.contratosNoPainel}</b> · último retorno recebido: {dh(s.ultimoRetorno)}</div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw className="h-4 w-4 mr-1" />Testar conexão</Button>
              {s.conta && <Button size="sm" onClick={doImportar} disabled={importando}>{importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Importar contratos do Autentique</Button>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
