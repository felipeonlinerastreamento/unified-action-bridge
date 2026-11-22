import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Play, RefreshCw, Bell, CalendarClock, FileSignature, Wallet, TrendingUp, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { atualizarIndicesFn, lerConfigContratosFn, rodarRotinaContratosFn, salvarConfigContratosFn } from "@/lib/contratos-automacao.functions";
import { CONFIG_PADRAO, INDICE_LABEL, VARIAVEIS_REAJUSTE, lerListaDias, type ConfigContratos, type Indice, type ModoEnvio } from "@/lib/contratos-automacao";

export const Route = createFileRoute("/configuracoes/contratos")({
  head: () => ({ meta: [{ title: "Configurações de Contratos — Gestão Online" }] }),
  component: Pagina,
});

const MODOS: { v: ModoEnvio; t: string }[] = [
  { v: "whatsapp", t: "WhatsApp da Central" },
  { v: "email", t: "E-mail" },
  { v: "whatsapp_email", t: "WhatsApp e e-mail" },
  { v: "autentique", t: "Pelo Autentique (contratos próprios vão por WhatsApp)" },
];
const dh = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nunca");

function Pagina() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  const gestor = hasRole("admin") || hasRole("gestor");
  return (
    <AppLayout>
      {gestor ? <Tela /> : (
        <div className="max-w-md mx-auto mt-16 text-center space-y-2"><Lock className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">Só administradores e gestores alteram as regras de Contratos.</p></div>
      )}
    </AppLayout>
  );
}

function Tela() {
  const ler = useServerFn(lerConfigContratosFn);
  const salvar = useServerFn(salvarConfigContratosFn);
  const rodar = useServerFn(rodarRotinaContratosFn);
  const indices = useServerFn(atualizarIndicesFn);
  const q = useQuery({ queryKey: ["contratos-config"], queryFn: () => ler(), retry: false });
  const [c, setC] = useState<ConfigContratos>(CONFIG_PADRAO);
  const [lembDias, setLembDias] = useState("3, 7");
  const [vencDias, setVencDias] = useState("60, 30");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data?.cfg) return;
    setC(q.data.cfg as ConfigContratos);
    setLembDias((q.data.cfg.lembrete_dias || []).join(", "));
    setVencDias((q.data.cfg.vencimento_dias || []).join(", "));
  }, [q.data]);

  const set = <K extends keyof ConfigContratos>(k: K, v: ConfigContratos[K]) => setC((x) => ({ ...x, [k]: v }));

  const doSalvar = async () => {
    setBusy("salvar");
    try {
      await salvar({ data: {
        lembrete_ativo: c.lembrete_ativo, lembrete_dias: lerListaDias(lembDias), lembrete_modo: c.lembrete_modo, lembrete_avisar_responsavel: c.lembrete_avisar_responsavel,
        vencimento_ativo: c.vencimento_ativo, vencimento_dias: lerListaDias(vencDias), vencimento_avisar_responsavel: c.vencimento_avisar_responsavel,
        vencimento_avisar_usuarios: c.vencimento_avisar_usuarios, vencimento_fornecedores: c.vencimento_fornecedores,
        proposta_cria_rascunho: c.proposta_cria_rascunho, financeiro_tolerancia_pct: Number(c.financeiro_tolerancia_pct) || 0,
        reajuste_ativo: c.reajuste_ativo, reajuste_indice: c.reajuste_indice, reajuste_fixo_pct: Number(c.reajuste_fixo_pct) || 0,
        reajuste_aviso_dias: Math.max(1, Number(c.reajuste_aviso_dias) || 30), reajuste_mensagem: c.reajuste_mensagem,
      } });
      toast.success("Regras de Contratos salvas.");
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(null); }
  };
  const doRodar = async () => {
    setBusy("rodar");
    try {
      const r: any = await rodar();
      toast.success(`Rotina rodou: ${r.lembretes} lembrete(s), ${r.vencimentos} aviso(s) de vencimento, ${r.reajustes} aviso(s) de reajuste.${r.erros?.length ? ` ${r.erros.length} problema(s).` : ""}`);
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao rodar."); }
    finally { setBusy(null); }
  };
  const doIndices = async () => {
    setBusy("indices");
    try {
      const r: any = await indices();
      (r.erros?.length ? toast.error : toast.success)(r.erros?.length ? `Alguns índices falharam: ${r.erros.join("; ")}` : "Índices atualizados pelo Banco Central.");
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao atualizar."); }
    finally { setBusy(null); }
  };

  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const usuarios: { id: string; nome: string }[] = q.data?.usuarios ?? [];
  const resumo: any = (q.data?.cfg as any)?.ultima_rotina_resumo;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileSignature className="h-6 w-6" />Contratos — regras automáticas</h1>
          <p className="text-sm text-muted-foreground">A rotina roda todo dia às 08:20. Última vez: {dh((q.data?.cfg as any)?.ultima_rotina_em)}{resumo ? ` · ${resumo.lembretes ?? 0} lembrete(s), ${resumo.vencimentos ?? 0} vencimento(s), ${resumo.reajustes ?? 0} reajuste(s)` : ""}</p>
          {!q.data?.pronto && <p className="text-sm text-destructive">A migração 0062_contratos_automacoes ainda não foi aplicada no banco: as regras abaixo não serão salvas.</p>}
          {resumo?.erros?.length > 0 && <p className="text-xs text-amber-700">Últimos problemas: {resumo.erros.slice(0, 3).join(" · ")}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={doRodar} disabled={!!busy}>{busy === "rodar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}Rodar agora</Button>
          <Button onClick={doSalvar} disabled={!!busy}>{busy === "salvar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Salvar</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Lembrete de assinatura pendente
          <Switch className="ml-auto" checked={c.lembrete_ativo} onCheckedChange={(v) => set("lembrete_ativo", v)} /></CardTitle>
          <CardDescription>Reenvia o link para quem ainda não assinou, contando os dias desde o envio.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><Label>Dias depois do envio</Label><Input value={lembDias} onChange={(e) => setLembDias(e.target.value)} placeholder="3, 7" />
            <p className="text-[11px] text-muted-foreground mt-1">Um lembrete em cada dia da lista: {lerListaDias(lembDias).join(", ") || "nenhum"}.</p></div>
          <div><Label>Modo de envio</Label>
            <Select value={c.lembrete_modo} onValueChange={(v) => set("lembrete_modo", v as ModoEnvio)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODOS.map((m) => <SelectItem key={m.v} value={m.v}>{m.t}</SelectItem>)}</SelectContent>
            </Select></div>
          <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={c.lembrete_avisar_responsavel} onCheckedChange={(v) => set("lembrete_avisar_responsavel", !!v)} />Avisar quem criou o contrato (notificação no sistema)</label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />Aviso de vencimento
          <Switch className="ml-auto" checked={c.vencimento_ativo} onCheckedChange={(v) => set("vencimento_ativo", v)} /></CardTitle>
          <CardDescription>Avisa antes do fim da vigência para renovar, renegociar ou cancelar.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Dias antes do fim</Label><Input value={vencDias} onChange={(e) => setVencDias(e.target.value)} placeholder="60, 30" /></div>
            <div className="space-y-2 pt-5">
              <label className="flex items-center gap-2"><Checkbox checked={c.vencimento_avisar_responsavel} onCheckedChange={(v) => set("vencimento_avisar_responsavel", !!v)} />Avisar quem criou o contrato</label>
              <label className="flex items-center gap-2"><Checkbox checked={c.vencimento_fornecedores} onCheckedChange={(v) => set("vencimento_fornecedores", !!v)} />Incluir contratos com fornecedores</label>
            </div>
          </div>
          <div>
            <Label>Avisar também (vencimento e reajuste)</Label>
            <div className="mt-1 max-h-40 overflow-y-auto rounded border p-2 grid gap-1 sm:grid-cols-2">
              {usuarios.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-xs"><Checkbox checked={c.vencimento_avisar_usuarios.includes(u.id)}
                  onCheckedChange={(v) => set("vencimento_avisar_usuarios", v ? [...c.vencimento_avisar_usuarios, u.id] : c.vencimento_avisar_usuarios.filter((x) => x !== u.id))} />{u.nome}</label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileSignature className="h-4 w-4" />Contrato a partir da proposta aceita
          <Switch className="ml-auto" checked={c.proposta_cria_rascunho} onCheckedChange={(v) => set("proposta_cria_rascunho", v)} /></CardTitle>
          <CardDescription>Quando o cliente aceita a proposta no CRM, cria o rascunho do contrato com cliente, CNPJ, contato e valores, e avisa o vendedor para revisar e enviar.</CardDescription></CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" />Conferência com o Financeiro</CardTitle>
          <CardDescription>Na lista de contratos (só para quem tem acesso ao Financeiro), compara o valor mensal do contrato com a média faturada no GSystem (clientes) ou paga nas contas a pagar (fornecedores) nos últimos 3 meses.</CardDescription></CardHeader>
        <CardContent className="text-sm">
          <div className="max-w-xs"><Label>Tolerância (%)</Label><Input type="number" min={0} max={100} step="0.5" value={c.financeiro_tolerancia_pct} onChange={(e) => set("financeiro_tolerancia_pct", Number(e.target.value))} />
            <p className="text-[11px] text-muted-foreground mt-1">Diferenças até esse percentual aparecem como "ok".</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Reajuste anual
          <Switch className="ml-auto" checked={c.reajuste_ativo} onCheckedChange={(v) => set("reajuste_ativo", v)} /></CardTitle>
          <CardDescription>No aniversário de cada contrato com cliente, calcula o reajuste e lista em Contratos › Reajustes para aplicar e avisar o cliente.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Índice</Label>
              <Select value={c.reajuste_indice} onValueChange={(v) => set("reajuste_indice", v as Indice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(INDICE_LABEL) as Indice[]).map((i) => <SelectItem key={i} value={i}>{INDICE_LABEL[i]}</SelectItem>)}</SelectContent>
              </Select></div>
            {c.reajuste_indice === "FIXO"
              ? <div><Label>Percentual fixo (%)</Label><Input type="number" step="0.01" value={c.reajuste_fixo_pct} onChange={(e) => set("reajuste_fixo_pct", Number(e.target.value))} /></div>
              : <div><Label>Acumulado 12 meses</Label>
                  <div className="flex items-center gap-2 h-9">
                    {c.indices?.[c.reajuste_indice] ? <Badge variant="outline">{c.indices[c.reajuste_indice]!.pct.toLocaleString("pt-BR")}% até {c.indices[c.reajuste_indice]!.ate.split("-").reverse().join("/")}</Badge> : <span className="text-xs text-muted-foreground">ainda não buscado</span>}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={doIndices} disabled={!!busy} title="Buscar no Banco Central">{busy === "indices" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
                  </div></div>}
            <div><Label>Avisar com antecedência (dias)</Label><Input type="number" min={1} max={180} value={c.reajuste_aviso_dias} onChange={(e) => set("reajuste_aviso_dias", Number(e.target.value))} /></div>
          </div>
          <div><Label>Mensagem ao cliente</Label><Textarea rows={4} value={c.reajuste_mensagem} onChange={(e) => set("reajuste_mensagem", e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Variáveis: {VARIAVEIS_REAJUSTE.join(" ")}</p></div>
          <p className="text-[11px] text-muted-foreground">Os índices vêm das séries do Banco Central (IPCA 433, IGP-M 189, INPC 188) e são atualizados uma vez por dia pela rotina.</p>
        </CardContent>
      </Card>
    </div>
  );
}
