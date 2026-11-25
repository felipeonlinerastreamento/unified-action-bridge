import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Ban, Loader2, MessageCircle, RefreshCw, Send, ShieldAlert, TrendingDown, Plus, Trash2, Paperclip } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDataBR, hojeSP } from "@/lib/finance";
import {
  CONFIG_PADRAO, FAIXAS, MENSAGEM_ANTES_PADRAO, MENSAGEM_ATRASO_PADRAO, NOME_FAIXA, NOME_SUGESTAO,
  diasEntre, indicadoresInadimplencia, montarInadimplencia,
  type AcaoCobranca, type ClienteFin, type ClienteInadimplente, type ConfigCobranca, type Faixa,
} from "@/lib/finance-inadimplencia";
import { atualizarClientesFinanceiroFn, enviarCobrancaClienteFn, reguaCobrancaFn } from "@/lib/finance.functions";
import { fin, useFinInvalidate, type Lanc } from "./use-fin";
import { useAbrirAnexo } from "./lancamentos-tab";
import { NegativacoesCliente, ProtestoSerasaTab, useDocsNegativados } from "./protesto-serasa";
import { NOME_ORGAO } from "@/lib/finance-negativacao";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

const TIPOS_ACAO: Record<string, string> = {
  contato: "Contato", promessa: "Promessa de pagamento", acordo: "Acordo / parcelamento", nota: "Anotação",
  perda: "Marcado como perda provável", perda_desfeita: "Perda provável desfeita", bloqueio: "Bloqueio / suspensão",
  desbloqueio: "Desbloqueio", regua: "Régua automática",
  negativacao: "Serasa / SPC", protesto: "Protesto", baixa: "Baixa de protesto / negativação", anuencia: "Carta de anuência",
};
const RESULTADOS: Record<string, string> = {
  sem_resposta: "Sem resposta", vai_pagar: "Vai pagar", contestou: "Contestou a cobrança",
  sem_condicoes: "Sem condições de pagar", ja_pagou: "Diz que já pagou", enviado: "Mensagem enviada",
};
const SITUACAO: Record<string, { texto: string; cls: string }> = {
  ativo: { texto: "Ativo", cls: "border-emerald-500 text-emerald-700" },
  inativo: { texto: "Inativo", cls: "border-red-500 text-red-700" },
  sem_informacao: { texto: "Sem informação", cls: "text-muted-foreground" },
};
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function useInadDados() {
  const clientes = useQuery({
    queryKey: ["fin-clientes"],
    queryFn: async () => {
      const todos: ClienteFin[] = [];
      for (let de = 0; de < 50_000; de += 1000) {
        const { data, error } = await fin.from("fin_clientes").select("*").order("documento").range(de, de + 999);
        if (error) throw error;
        todos.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return todos;
    },
    retry: false,
  });
  const acoes = useQuery({
    queryKey: ["fin-cobranca-acoes"],
    queryFn: async () => {
      const { data, error } = await fin.from("fin_cobranca_acoes").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data || []) as AcaoCobranca[];
    },
    retry: false,
  });
  const config = useQuery({
    queryKey: ["fin-cobranca-config"],
    queryFn: async () => {
      const { data, error } = await fin.from("fin_cobranca_config").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    retry: false,
  });
  return { clientes, acoes, config };
}

/** Financeiro › Inadimplência: painel, clientes em atraso, régua de cobrança e sugestões. */
export function InadimplenciaTab({ lancamentos }: { lancamentos: Lanc[] }) {
  const hoje = hojeSP();
  const { clientes, acoes, config } = useInadDados();
  const cfg: ConfigCobranca = { ...CONFIG_PADRAO, ...(config.data ?? {}) };
  const lista = useMemo(
    () => montarInadimplencia(lancamentos as any, clientes.data ?? [], acoes.data ?? [], hoje, cfg),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lancamentos, clientes.data, acoes.data, hoje, cfg.dias_bloqueio, cfg.dias_perda],
  );
  const ind = useMemo(() => indicadoresInadimplencia(lancamentos as any, lista, hoje), [lancamentos, lista, hoje]);
  const [sub, setSub] = useState("clientes");
  const [aberto, setAberto] = useState<string | null>(null);
  const cliente = lista.find((c) => c.chave === aberto) ?? null;
  const semMigracao = clientes.error || acoes.error || config.error;

  return (
    <div className="space-y-4">
      {semMigracao && (
        <Card className="border-amber-500"><CardContent className="pt-4 text-sm flex gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
          A parte de cobrança ainda não está disponível (aplique a migração 0070 no Lovable). O painel abaixo já usa as contas a receber.</CardContent></Card>
      )}
      <Indicadores ind={ind} />
      <Tabs value={sub} onValueChange={setSub}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="clientes">Clientes em atraso ({lista.length})</TabsTrigger>
          <TabsTrigger value="sugestoes">Sugestões ({lista.filter((c) => c.sugestoes.some((s) => s !== "sem_contato")).length})</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          <TabsTrigger value="protesto">Protesto e Serasa</TabsTrigger>
          <TabsTrigger value="regua">Régua de cobrança</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="mt-4"><ListaClientes lista={lista} onAbrir={setAberto} /></TabsContent>
        <TabsContent value="sugestoes" className="mt-4"><Sugestoes lista={lista} cfg={cfg} onAbrir={setAberto} /></TabsContent>
        <TabsContent value="evolucao" className="mt-4"><Evolucao ind={ind} /></TabsContent>
        <TabsContent value="protesto" className="mt-4"><ProtestoSerasaTab lancamentos={lancamentos} lista={lista} onAbrirCliente={setAberto}
          criterio={{ diasMinimo: Number(config.data?.neg_dias_minimo ?? 60), valorMinimo: Number(config.data?.neg_valor_minimo ?? 100), prazoDiasUteis: Number(config.data?.prazo_baixa_dias_uteis ?? 5) }} /></TabsContent>
        <TabsContent value="regua" className="mt-4"><Regua cfg={config.data} /></TabsContent>
      </Tabs>
      {cliente && <ClienteDialog lista={lista} lancamentos={lancamentos} c={cliente} acoes={(acoes.data ?? []).filter((a) => a.documento === (cliente.documento ?? cliente.chave))} fc={(clientes.data ?? []).find((x) => x.documento === cliente.documento) ?? null} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Indicadores({ ind }: { ind: ReturnType<typeof indicadoresInadimplencia> }) {
  const total = ind.totalVencido || 1;
  const cards = [
    { t: "Vencido em aberto", v: formatBRL(ind.totalVencido), d: `${ind.clientes} cliente(s)` },
    { t: "Inadimplência 12 meses", v: `${ind.taxa12m.toLocaleString("pt-BR")}%`, d: "do valor que venceu e segue em aberto" },
    { t: "Inativos com saldo", v: formatBRL(ind.valorInativos), d: `${ind.clientesInativos} cliente(s)` },
    { t: "Recuperado no mês", v: formatBRL(ind.recuperadoMes), d: "pago neste mês, já vencido" },
    { t: "Atraso médio (90 dias)", v: `${ind.atrasoMedioPago.toLocaleString("pt-BR")} dia(s)`, d: "das faturas pagas" },
    { t: "Perda provável", v: formatBRL(ind.totalPerda), d: "marcada para o DRE" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.t}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{c.t}</div><div className="text-lg font-semibold">{c.v}</div><div className="text-[11px] text-muted-foreground">{c.d}</div></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-4 space-y-2">
        <div className="text-sm font-medium">Por faixa de atraso</div>
        {FAIXAS.map((f) => (
          <div key={f} className="flex items-center gap-2 text-sm">
            <div className="w-32 shrink-0">{NOME_FAIXA[f]}</div>
            <div className="flex-1 h-3 rounded bg-muted overflow-hidden"><div className={`h-full ${f === "90+" ? "bg-red-600" : f === "61-90" ? "bg-orange-500" : f === "31-60" ? "bg-amber-400" : "bg-yellow-300"}`} style={{ width: `${(ind.porFaixa[f] / total) * 100}%` }} /></div>
            <div className="w-32 text-right tabular-nums">{formatBRL(ind.porFaixa[f])}</div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}

function ListaClientes({ lista, onAbrir }: { lista: ClienteInadimplente[]; onAbrir: (k: string) => void }) {
  const negativados = useDocsNegativados();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const [faixa, setFaixa] = useState<"todas" | Faixa>("todas");
  const [soSemAcao, setSoSemAcao] = useState(false);
  const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtrada = lista.filter((c) =>
    (situacao === "todos" || c.situacao === situacao) &&
    (faixa === "todas" || c.faixa === faixa) &&
    (!soSemAcao || !c.ultimaAcao || c.ultimaAcao.tipo === "regua") &&
    (!q || c.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q) || (c.documento ?? "").includes(q.replace(/\D/g, "") || "§")));
  const sinais = (c: ClienteInadimplente) => [
    c.promessa ? (c.promessa.quebrada ? "Promessa vencida" : "Promessa") : "",
    c.acordo ? "Acordo" : "",
    ...(c.documento ? (negativados.get(c.documento) ?? []).map((o) => (o === "protesto" ? "Protestado" : NOME_ORGAO[o])) : []),
    c.reguaPausada ? "Régua pausada" : "",
    c.sugestoes.includes("sem_contato") ? "Sem contato" : "",
  ].filter(Boolean).join(", ");
  const colunas: TableColumn<ClienteInadimplente>[] = [
    { id: "cliente", label: "Cliente", value: (c) => c.nome },
    { id: "documento", label: "CPF/CNPJ", value: (c) => c.documento ?? "" },
    { id: "situacao", label: "Situação", value: (c) => SITUACAO[c.situacao].texto },
    { id: "vencido", label: "Vencido", value: (c) => c.valor },
    { id: "faturas", label: "Faturas", value: (c) => c.qtd },
    { id: "atraso", label: "Atraso", value: (c) => c.diasMaisAntigo },
    { id: "contato", label: "Último contato", value: (c) => (c.ultimaAcao ? TIPOS_ACAO[c.ultimaAcao.tipo] ?? c.ultimaAcao.tipo : "") },
    { id: "sinais", label: "Sinais", value: sinais },
  ];
  const tabela = useTableColumns("fin-inadimplencia", colunas, filtrada);
  const visiveis = tabela.filteredRows;
  const th = (id: string) => <ColumnFilterHeader column={colunas.find((c) => c.id === id)!} state={tabela} />;
  const total = visiveis.reduce((s, c) => s + c.valor, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="w-60"><Label className="text-xs">Buscar</Label><Input placeholder="Nome ou CPF/CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <div className="w-44"><Label className="text-xs">Situação no GSystem</Label>
            <Select value={situacao} onValueChange={setSituacao}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="todos">Todos</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="inativo">Inativos</SelectItem><SelectItem value="sem_informacao">Sem informação</SelectItem>
            </SelectContent></Select></div>
          <div className="w-44"><Label className="text-xs">Atraso mais antigo</Label>
            <Select value={faixa} onValueChange={(v) => setFaixa(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="todas">Todas as faixas</SelectItem>{FAIXAS.map((f) => <SelectItem key={f} value={f}>{NOME_FAIXA[f]}</SelectItem>)}
            </SelectContent></Select></div>
          <label className="flex items-center gap-2 text-sm pb-2"><Checkbox checked={soSemAcao} onCheckedChange={(v) => setSoSemAcao(!!v)} />Sem contato registrado</label>
          <div className="ml-auto text-sm text-muted-foreground pb-2">{visiveis.length} cliente(s) · <b className="text-foreground">{formatBRL(total)}</b></div>
        </div>
        <TableToolbar state={tabela} fileName="inadimplencia" semColunas><div className="mr-auto text-xs">{th("documento")}</div></TableToolbar>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{th("cliente")}</TableHead><TableHead>{th("situacao")}</TableHead><TableHead className="text-right">{th("vencido")}</TableHead>
            <TableHead className="text-right">{th("faturas")}</TableHead><TableHead className="text-right">{th("atraso")}</TableHead><TableHead>{th("contato")}</TableHead><TableHead>{th("sinais")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {visiveis.slice(0, 500).map((c) => (
              <TableRow key={c.chave} className="cursor-pointer" onClick={() => onAbrir(c.chave)}>
                <TableCell className="font-medium">{c.nome}<div className="text-[11px] text-muted-foreground">{c.documento ?? "sem CPF/CNPJ"}</div></TableCell>
                <TableCell><Badge variant="outline" className={SITUACAO[c.situacao].cls} title={c.situacaoTexto ?? undefined}>{SITUACAO[c.situacao].texto}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(c.valor)}{c.valorPerda > 0 && <div className="text-[11px] text-red-700">perda {formatBRL(c.valorPerda)}</div>}</TableCell>
                <TableCell className="text-right">{c.qtd}</TableCell>
                <TableCell className="text-right">{c.diasMaisAntigo} d</TableCell>
                <TableCell className="text-sm">{c.ultimaAcao ? <>{TIPOS_ACAO[c.ultimaAcao.tipo] ?? c.ultimaAcao.tipo}<div className="text-[11px] text-muted-foreground">{dataHora(c.ultimaAcao.created_at)}</div></> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="space-x-1">
                  {c.promessa && <Badge variant="outline" className={c.promessa.quebrada ? "border-red-500 text-red-700" : "border-emerald-500 text-emerald-700"}>{c.promessa.quebrada ? "Promessa vencida" : `Promessa ${formatDataBR(c.promessa.data)}`}</Badge>}
                  {c.acordo && <Badge variant="outline">Acordo</Badge>}
                  {c.documento && (negativados.get(c.documento) ?? []).map((o) => <Badge key={o} variant="outline" className="border-red-500 text-red-700">{o === "protesto" ? "Protestado" : NOME_ORGAO[o]}</Badge>)}
                  {c.reguaPausada && <Badge variant="outline">Régua pausada</Badge>}
                  {c.sugestoes.includes("sem_contato") && <Badge variant="outline" className="text-muted-foreground">Sem contato</Badge>}
                </TableCell>
              </TableRow>
            ))}
            {!visiveis.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum cliente em atraso com esses filtros.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {visiveis.length > 500 && <p className="text-xs text-muted-foreground mt-2">Mostrando os 500 maiores. Use os filtros para ver os demais.</p>}
      </CardContent>
    </Card>
  );
}

function Sugestoes({ lista, cfg, onAbrir }: { lista: ClienteInadimplente[]; cfg: ConfigCobranca; onAbrir: (k: string) => void }) {
  const grupos: { chave: ClienteInadimplente["sugestoes"][number]; icone: any; desc: string }[] = [
    { chave: "inativo_com_saldo", icone: TrendingDown, desc: "Saíram e deixaram saldo: cobrar, negociar ou marcar como perda." },
    { chave: "promessa_quebrada", icone: AlertTriangle, desc: "A data prometida passou e a fatura segue em aberto." },
    { chave: "bloqueio", icone: Ban, desc: `Ativos com atraso de ${cfg.dias_bloqueio} dias ou mais, sem promessa em vigor. Decisão caso a caso: nada é bloqueado automaticamente.` },
    { chave: "perda", icone: ShieldAlert, desc: `Atraso de ${cfg.dias_perda} dias ou mais: avaliar marcar como perda provável (aparece separado no DRE).` },
    { chave: "sem_contato", icone: MessageCircle, desc: "Sem telefone nem e-mail: a régua não alcança. Completar o contato de cobrança." },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {grupos.map((g) => {
        const itens = lista.filter((c) => c.sugestoes.includes(g.chave));
        const Icone = g.icone;
        return (
          <Card key={g.chave}>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icone className="h-4 w-4" />{NOME_SUGESTAO[g.chave]} <Badge variant="outline">{itens.length}</Badge>
              <span className="ml-auto font-normal text-muted-foreground">{formatBRL(itens.reduce((s, c) => s + c.valor, 0))}</span></CardTitle>
              <CardDescription>{g.desc}</CardDescription></CardHeader>
            <CardContent className="space-y-1 max-h-72 overflow-y-auto">
              {itens.slice(0, 50).map((c) => (
                <button key={c.chave} className="w-full flex justify-between text-sm py-1 border-b last:border-0 hover:bg-muted/50 px-1 rounded text-left" onClick={() => onAbrir(c.chave)}>
                  <span className="truncate">{c.nome}</span><span className="tabular-nums shrink-0 ml-2">{formatBRL(c.valor)} · {c.diasMaisAntigo} d</span>
                </button>
              ))}
              {!itens.length && <p className="text-sm text-muted-foreground">Nenhum cliente.</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Evolucao({ ind }: { ind: ReturnType<typeof indicadoresInadimplencia> }) {
  const max = Math.max(1, ...ind.meses.map((m) => m.faturado));
  const nomeMes = (m: string) => { const [a, mm] = m.split("-"); return `${mm}/${a.slice(2)}`; };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Últimos 12 meses, por mês de vencimento</CardTitle>
        <CardDescription className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-emerald-600 inline-block rounded-sm" />Pago em dia</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-amber-400 inline-block rounded-sm" />Pago com atraso</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-red-600 inline-block rounded-sm" />Em aberto</span>
        </CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2 h-48">
          {ind.meses.map((m) => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${nomeMes(m.mes)}: ${formatBRL(m.faturado)} · ${m.taxa}% em aberto`}>
              <div className="w-full flex flex-col-reverse rounded overflow-hidden" style={{ height: `${(m.faturado / max) * 100}%` }}>
                <div className="bg-emerald-600" style={{ flexGrow: m.pagoEmDia }} />
                <div className="bg-amber-400" style={{ flexGrow: m.pagoAtraso }} />
                <div className="bg-red-600" style={{ flexGrow: m.emAberto }} />
              </div>
              <div className="text-[10px] text-muted-foreground">{nomeMes(m.mes)}</div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Venceu</TableHead><TableHead className="text-right">Pago em dia</TableHead><TableHead className="text-right">Pago com atraso</TableHead><TableHead className="text-right">Em aberto</TableHead><TableHead className="text-right">% em aberto</TableHead></TableRow></TableHeader>
            <TableBody>{ind.meses.map((m) => (
              <TableRow key={m.mes}><TableCell>{nomeMes(m.mes)}</TableCell><TableCell className="text-right">{formatBRL(m.faturado)}</TableCell><TableCell className="text-right">{formatBRL(m.pagoEmDia)}</TableCell>
                <TableCell className="text-right">{formatBRL(m.pagoAtraso)}</TableCell><TableCell className="text-right">{formatBRL(m.emAberto)}</TableCell><TableCell className="text-right">{m.taxa.toLocaleString("pt-BR")}%</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Regua({ cfg }: { cfg: any }) {
  const qc = useQueryClient();
  const regua = useServerFn(reguaCobrancaFn);
  const atualizarClientes = useServerFn(atualizarClientesFinanceiroFn);
  const [form, setForm] = useState<any>(null);
  const atual = form ?? {
    ativo: !!cfg?.ativo, passos: (cfg?.passos?.length ? cfg.passos : CONFIG_PADRAO.passos) as ConfigCobranca["passos"],
    mensagem_antes: cfg?.mensagem_antes ?? "", mensagem_atraso: cfg?.mensagem_atraso ?? "",
    whatsapp_channel_id: cfg?.whatsapp_channel_id ?? "", email_channel_id: cfg?.email_channel_id ?? "",
    valor_minimo: String(cfg?.valor_minimo ?? 0), so_ativos: !!cfg?.so_ativos,
    dias_bloqueio: String(cfg?.dias_bloqueio ?? 30), dias_perda: String(cfg?.dias_perda ?? 180),
    neg_dias_minimo: String(cfg?.neg_dias_minimo ?? 60), neg_valor_minimo: String(cfg?.neg_valor_minimo ?? 100), prazo_baixa_dias_uteis: String(cfg?.prazo_baixa_dias_uteis ?? 5),
  };
  const set = (k: string, v: any) => setForm({ ...atual, [k]: v });
  const [busy, setBusy] = useState<string | null>(null);
  const [previa, setPrevia] = useState<any[] | null>(null);
  const canaisWa = useQuery({ queryKey: ["fin-canais-wa"], queryFn: async () => (await fin.from("channels").select("id, name").eq("is_active", true).not("zapi_instance_id", "is", null).order("name")).data ?? [] });
  const canaisEmail = useQuery({ queryKey: ["fin-canais-email"], queryFn: async () => (await fin.from("email_channels").select("id, email_address").order("email_address")).data ?? [] });
  const envios = useQuery({ queryKey: ["fin-cobranca-envios"], queryFn: async () => (await fin.from("fin_cobranca_envios").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [], retry: false });
  const colEnvios: TableColumn<any>[] = [
    { id: "quando", label: "Quando", value: (e) => dataHora(e.created_at) },
    { id: "passo", label: "Passo", value: (e) => (Number(e.passo) < 0 ? `${-Number(e.passo)} dia(s) antes` : `D+${e.passo}`) },
    { id: "canal", label: "Canal", value: (e) => (e.canal === "whatsapp" ? "WhatsApp" : "E-mail") },
    { id: "destino", label: "Destino", value: (e) => e.destino ?? "" },
    { id: "situacao", label: "Situação", value: (e) => (e.status === "enviado" ? "Enviado" : e.status === "sem_contato" ? "Sem contato" : "Erro") },
  ];
  const tabEnvios = useTableColumns("fin-cobranca-envios", colEnvios, (envios.data ?? []) as any[]);
  const thE = (id: string) => <ColumnFilterHeader column={colEnvios.find((c) => c.id === id)!} state={tabEnvios} />;

  const salvar = async () => {
    setBusy("salvar");
    try {
      const passos = [...atual.passos].map((p: any) => ({ dias: Number(p.dias), whatsapp: !!p.whatsapp, email: !!p.email }))
        .filter((p) => Number.isFinite(p.dias)).sort((a, b) => a.dias - b.dias);
      const { error } = await fin.from("fin_cobranca_config").upsert({
        id: 1, ativo: atual.ativo, passos,
        mensagem_antes: atual.mensagem_antes.trim() || null, mensagem_atraso: atual.mensagem_atraso.trim() || null,
        whatsapp_channel_id: atual.whatsapp_channel_id || null, email_channel_id: atual.email_channel_id || null,
        valor_minimo: Number(String(atual.valor_minimo).replace(",", ".")) || 0, so_ativos: atual.so_ativos,
        dias_bloqueio: Number(atual.dias_bloqueio) || 30, dias_perda: Number(atual.dias_perda) || 180,
        ...(cfg && "neg_dias_minimo" in cfg ? {
          neg_dias_minimo: Number(atual.neg_dias_minimo) || 60, neg_valor_minimo: Number(String(atual.neg_valor_minimo).replace(",", ".")) || 0,
          prazo_baixa_dias_uteis: Number(atual.prazo_baixa_dias_uteis) || 5,
        } : {}),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success(atual.ativo ? "Régua salva e ligada: roda todo dia às 09:05." : "Régua salva (desligada).");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["fin-cobranca-config"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(null); }
  };
  const verPrevia = async () => {
    setBusy("previa");
    try { const r: any = await regua({ data: { simular: true } }); setPrevia(r.itens); }
    catch (e: any) { toast.error(e?.message ?? "Falha na prévia."); }
    finally { setBusy(null); }
  };
  const enviarAgora = async () => {
    setBusy("enviar");
    try {
      const r: any = await regua({ data: { simular: false } });
      (r.erros ? toast.error : toast.success)(`${r.enviados} mensagem(ns) enviada(s)${r.erros ? `, ${r.erros} com erro: ${r.ultimoErro}` : ""}.`);
      setPrevia(null);
      ["fin-cobranca-envios", "fin-cobranca-acoes", "fin-cobranca-config"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e: any) { toast.error(e?.message ?? "Falha ao enviar."); }
    finally { setBusy(null); }
  };
  const doAtualizarClientes = async () => {
    setBusy("clientes");
    try {
      const r: any = await atualizarClientes();
      if (!r.ok) throw new Error(r.error);
      toast.success(`${r.clientes} cliente(s) atualizados do GSystem: ${r.inativos} inativo(s)${r.semSituacao ? `, ${r.semSituacao} sem situação informada` : ""}.`);
      qc.invalidateQueries({ queryKey: ["fin-clientes"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha ao atualizar."); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">Régua de cobrança
            <Badge variant="outline" className={cfg?.ativo ? "bg-emerald-600 text-white border-transparent" : ""}>{cfg?.ativo ? "Ligada" : "Desligada"}</Badge></CardTitle>
          <CardDescription>
            Mensagens automáticas por WhatsApp e e-mail, todo dia às 09:05. Cada fatura recebe cada passo uma vez só. Ao ligar, dívidas antigas não
            são disparadas de uma vez: só entra a fatura que acabou de alcançar um passo (até 3 dias). Clientes com promessa em vigor, régua pausada ou
            faturas marcadas como perda não recebem.
            {cfg?.ultima_execucao_em && <> Última execução: {dataHora(cfg.ultima_execucao_em)} ({cfg.ultima_execucao?.enviados ?? 0} enviada(s)).</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={atual.ativo} onCheckedChange={(v) => set("ativo", v)} />Ligar a régua automática</label>
          <div className="space-y-2">
            <div className="text-sm font-medium">Passos (dias em relação ao vencimento; negativo = antes)</div>
            {atual.passos.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Input className="w-24" type="number" value={p.dias} onChange={(e) => set("passos", atual.passos.map((x: any, j: number) => j === i ? { ...x, dias: e.target.value } : x))} />
                <span className="w-28 text-muted-foreground">{Number(p.dias) < 0 ? `${-Number(p.dias)} dia(s) antes` : Number(p.dias) === 0 ? "no vencimento" : `D+${p.dias}`}</span>
                <label className="flex items-center gap-1"><Checkbox checked={!!p.whatsapp} onCheckedChange={(v) => set("passos", atual.passos.map((x: any, j: number) => j === i ? { ...x, whatsapp: !!v } : x))} />WhatsApp</label>
                <label className="flex items-center gap-1"><Checkbox checked={!!p.email} onCheckedChange={(v) => set("passos", atual.passos.map((x: any, j: number) => j === i ? { ...x, email: !!v } : x))} />E-mail</label>
                <Button size="icon" variant="ghost" onClick={() => set("passos", atual.passos.filter((_: any, j: number) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => set("passos", [...atual.passos, { dias: 15, whatsapp: true, email: true }])}><Plus className="h-4 w-4 mr-1" />Passo</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>WhatsApp que envia</Label>
              <Select value={atual.whatsapp_channel_id || "padrao"} onValueChange={(v) => set("whatsapp_channel_id", v === "padrao" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="padrao">O da Central (Configurações › CRM)</SelectItem>{(canaisWa.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent></Select></div>
            <div><Label>Caixa de e-mail que envia</Label>
              <Select value={atual.email_channel_id || "padrao"} onValueChange={(v) => set("email_channel_id", v === "padrao" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="padrao">A da Central (Configurações › CRM)</SelectItem>{(canaisEmail.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.email_address}</SelectItem>)}
              </SelectContent></Select></div>
            <div><Label>Valor mínimo da fatura (R$)</Label><Input value={atual.valor_minimo} onChange={(e) => set("valor_minimo", e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm pt-6"><Switch checked={atual.so_ativos} onCheckedChange={(v) => set("so_ativos", v)} />Não mandar para clientes inativos</label>
            <div><Label>Sugerir bloqueio a partir de (dias)</Label><Input type="number" value={atual.dias_bloqueio} onChange={(e) => set("dias_bloqueio", e.target.value)} /></div>
            <div><Label>Sugerir perda provável a partir de (dias)</Label><Input type="number" value={atual.dias_perda} onChange={(e) => set("dias_perda", e.target.value)} /></div>
            <div><Label>Candidato a protesto/Serasa a partir de (dias)</Label><Input type="number" value={atual.neg_dias_minimo} onChange={(e) => set("neg_dias_minimo", e.target.value)} /></div>
            <div><Label>… e saldo a partir de (R$)</Label><Input value={atual.neg_valor_minimo} onChange={(e) => set("neg_valor_minimo", e.target.value)} /></div>
            <div><Label>Prazo para dar baixa após o pagamento (dias úteis)</Label><Input type="number" value={atual.prazo_baixa_dias_uteis} onChange={(e) => set("prazo_baixa_dias_uteis", e.target.value)} /></div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div><Label>Mensagem antes do vencimento</Label><Textarea rows={4} placeholder={MENSAGEM_ANTES_PADRAO} value={atual.mensagem_antes} onChange={(e) => set("mensagem_antes", e.target.value)} /></div>
            <div><Label>Mensagem de atraso</Label><Textarea rows={4} placeholder={MENSAGEM_ATRASO_PADRAO} value={atual.mensagem_atraso} onChange={(e) => set("mensagem_atraso", e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Campos: {"{nome}"} (primeiro nome), {"{cliente}"}, {"{valor}"}, {"{vencimento}"}, {"{dias}"}, {"{link}"}, {"{linha_digitavel}"}, {"{link_linha}"} (boleto ou linha digitável, quando houver). Em branco usa o texto padrão.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={salvar} disabled={!!busy}>{busy === "salvar" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
            <Button size="sm" variant="outline" onClick={verPrevia} disabled={!!busy}>{busy === "previa" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Ver o que sairia hoje</Button>
            <Button size="sm" variant="outline" onClick={doAtualizarClientes} disabled={!!busy}>{busy === "clientes" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar situação e contatos do GSystem</Button>
          </div>
          {previa && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Prévia de hoje: {previa.filter((i) => !i.motivoPulo).length} fatura(s) receberiam mensagem{previa.some((i) => i.motivoPulo) ? `, ${previa.filter((i) => i.motivoPulo).length} pulada(s)` : ""}.</div>
              <div className="max-h-64 overflow-y-auto text-sm space-y-1">
                {previa.map((i) => (
                  <div key={i.lancamentoId} className={`flex flex-wrap gap-2 ${i.motivoPulo ? "text-muted-foreground line-through" : ""}`}>
                    <span className="font-medium">{i.cliente}</span><span>{formatBRL(i.valor)} · venc. {formatDataBR(i.vencimento)} · {i.passo < 0 ? `${-i.passo} dia(s) antes` : `D+${i.passo}`}</span>
                    <span className="text-xs">{i.canais.map((c: any) => `${c.canal === "whatsapp" ? "WhatsApp" : "e-mail"}${c.destino ? "" : " (sem contato)"}`).join(", ")}</span>
                    {i.motivoPulo && <span className="text-xs no-underline">({i.motivoPulo})</span>}
                  </div>
                ))}
                {!previa.length && <p className="text-muted-foreground">Nada para enviar hoje.</p>}
              </div>
              {previa.some((i) => !i.motivoPulo) && <Button size="sm" onClick={enviarAgora} disabled={!!busy}>{busy === "enviar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Enviar agora</Button>}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Últimos envios</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto space-y-2">
          <TableToolbar state={tabEnvios} fileName="regua-envios" semColunas count={tabEnvios.filteredRows.length} />
          <Table>
            <TableHeader><TableRow><TableHead>{thE("quando")}</TableHead><TableHead>{thE("passo")}</TableHead><TableHead>{thE("canal")}</TableHead><TableHead>{thE("destino")}</TableHead><TableHead>{thE("situacao")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {tabEnvios.filteredRows.map((e: any) => (
                <TableRow key={e.id}><TableCell>{dataHora(e.created_at)}</TableCell><TableCell>{Number(e.passo) < 0 ? `${-Number(e.passo)} dia(s) antes` : `D+${e.passo}`}</TableCell>
                  <TableCell>{e.canal === "whatsapp" ? "WhatsApp" : "E-mail"}</TableCell><TableCell className="text-xs">{e.destino ?? "—"}</TableCell>
                  <TableCell>{e.status === "enviado" ? <Badge variant="outline" className="border-emerald-500 text-emerald-700">Enviado</Badge> : e.status === "sem_contato" ? <Badge variant="outline">Sem contato</Badge> : <Badge variant="destructive" title={e.erro ?? ""}>Erro</Badge>}</TableCell></TableRow>
              ))}
              {!envios.data?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum envio ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ClienteDialog({ c, acoes, fc, onFechar, lista, lancamentos }: { c: ClienteInadimplente; acoes: AcaoCobranca[]; fc: ClienteFin | null; onFechar: () => void; lista: ClienteInadimplente[]; lancamentos: Lanc[] }) {
  const qc = useQueryClient();
  const invalidate = useFinInvalidate();
  const abrirAnexo = useAbrirAnexo();
  const enviarCobranca = useServerFn(enviarCobrancaClienteFn);
  const hoje = hojeSP();
  const doc = c.documento ?? c.chave;
  const [acao, setAcao] = useState({ tipo: "contato", canal: "whatsapp", resultado: "", data_promessa: "", valor: "", parcelas: "", primeiro_vencimento: "", observacao: "" });
  const [contato, setContato] = useState({ telefone: fc?.telefone_cobranca ?? "", email: fc?.email_cobranca ?? "", pausada: !!fc?.regua_pausada, observacao: fc?.observacao ?? "" });
  const [canais, setCanais] = useState({ whatsapp: true, email: true });
  const [busy, setBusy] = useState<string | null>(null);
  const recarregar = () => ["fin-cobranca-acoes", "fin-clientes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const registrar = async (tipo = acao.tipo, extra: Partial<AcaoCobranca> = {}) => {
    setBusy("acao");
    try {
      if (tipo === "promessa" && !acao.data_promessa && !extra.data_promessa) throw new Error("Informe a data prometida.");
      const { error } = await fin.from("fin_cobranca_acoes").insert({
        documento: doc, cliente_nome: c.nome, tipo,
        canal: ["contato", "promessa", "acordo"].includes(tipo) ? acao.canal || null : null,
        resultado: tipo === "contato" ? acao.resultado || null : null,
        data_promessa: tipo === "promessa" ? acao.data_promessa || null : null,
        valor: tipo === "acordo" && acao.valor ? Number(acao.valor.replace(/\./g, "").replace(",", ".")) : tipo === "promessa" ? c.valor : null,
        parcelas: tipo === "acordo" && acao.parcelas ? Number(acao.parcelas) : null,
        primeiro_vencimento: tipo === "acordo" ? acao.primeiro_vencimento || null : null,
        observacao: acao.observacao.trim() || null,
        lancamento_ids: c.faturas.map((f) => f.id),
        ...extra,
      });
      if (error) throw error;
      if (tipo === "promessa" && acao.data_promessa) {
        await fin.from("fin_lancamentos").update({ promessa_pagamento: acao.data_promessa }).in("id", c.faturas.map((f) => f.id));
        invalidate();
      }
      toast.success("Registrado.");
      setAcao({ ...acao, resultado: "", data_promessa: "", valor: "", parcelas: "", primeiro_vencimento: "", observacao: "" });
      recarregar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao registrar."); }
    finally { setBusy(null); }
  };
  const marcarPerda = async (ids: string[], perda: boolean) => {
    setBusy("perda");
    try {
      const { error } = await fin.from("fin_lancamentos").update({ perda_provavel: perda, perda_marcada_em: perda ? new Date().toISOString() : null }).in("id", ids);
      if (error) throw error;
      await fin.from("fin_cobranca_acoes").insert({ documento: doc, cliente_nome: c.nome, tipo: perda ? "perda" : "perda_desfeita", lancamento_ids: ids,
        valor: c.faturas.filter((f) => ids.includes(f.id)).reduce((s, f) => s + Number(f.valor), 0), observacao: `${ids.length} fatura(s)` });
      invalidate(); recarregar();
      toast.success(perda ? "Marcado como perda provável." : "Perda provável desfeita.");
    } catch (e: any) { toast.error(e?.message ?? "Falha."); }
    finally { setBusy(null); }
  };
  const salvarContato = async () => {
    if (!c.documento) { toast.error("Cliente sem CPF/CNPJ: complete o documento nas faturas."); return; }
    setBusy("contato");
    try {
      const { error } = await fin.from("fin_clientes").upsert({ documento: c.documento, nome: fc?.nome ?? c.nome, telefone_cobranca: contato.telefone.trim() || null,
        email_cobranca: contato.email.trim() || null, regua_pausada: contato.pausada, observacao: contato.observacao.trim() || null, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("Contato de cobrança salvo."); recarregar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(null); }
  };
  const cobrarAgora = async () => {
    if (!c.documento) { toast.error("Cliente sem CPF/CNPJ."); return; }
    setBusy("cobrar");
    try {
      const r: any = await enviarCobranca({ data: { documento: c.documento, whatsapp: canais.whatsapp, email: canais.email } });
      if (r.enviados.length) toast.success(`Cobrança enviada por ${r.enviados.join(" e ")}.`);
      if (r.erros.length) toast.error(r.erros.join(" · "));
      recarregar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao enviar."); }
    finally { setBusy(null); }
  };
  const naoPerda = c.faturas.filter((f) => !f.perda_provavel).map((f) => f.id);
  const comPerda = c.faturas.filter((f) => f.perda_provavel).map((f) => f.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{c.nome}<Badge variant="outline" className={SITUACAO[c.situacao].cls}>{c.situacaoTexto ?? SITUACAO[c.situacao].texto}</Badge></DialogTitle>
          <DialogDescription>
            {c.documento ?? "Sem CPF/CNPJ"} · vencido {formatBRL(c.valor)} em {c.qtd} fatura(s) · atraso de {c.diasMaisAntigo} dia(s)
            {c.aVencer > 0 && <> · a vencer {formatBRL(c.aVencer)}</>}
            {c.semFaturaDias != null && c.semFaturaDias > 45 && <> · sem fatura nova há {c.semFaturaDias} dia(s)</>}
          </DialogDescription>
        </DialogHeader>

        {c.sugestoes.length > 0 && <div className="flex flex-wrap gap-1">{c.sugestoes.map((s) => <Badge key={s} variant="outline" className="border-amber-500 text-amber-700">{NOME_SUGESTAO[s]}</Badge>)}</div>}

        <div className="space-y-2">
          <div className="flex items-center gap-2"><div className="text-sm font-medium">Faturas vencidas</div>
            <div className="ml-auto flex gap-2">
              {naoPerda.length > 0 && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => marcarPerda(naoPerda, true)}><ShieldAlert className="h-4 w-4 mr-1" />Marcar todas como perda provável</Button>}
              {comPerda.length > 0 && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => marcarPerda(comPerda, false)}>Desfazer perda</Button>}
            </div></div>
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Atraso</TableHead><TableHead>Origem</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{c.faturas.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{formatDataBR(f.vencimento)}{f.perda_provavel && <Badge variant="outline" className="ml-2 border-red-500 text-red-700 text-[10px]">Perda provável</Badge>}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(Number(f.valor))}</TableCell>
                <TableCell className="text-right">{f.vencimento ? diasEntre(f.vencimento, hoje) : 0} d</TableCell>
                <TableCell className="text-xs">{f.origem === "gsystem" ? "GSystem" : f.origem === "bomcontrole" ? "Bom Controle" : f.origem}</TableCell>
                <TableCell className="text-right space-x-1">
                  {f.arquivo_url && <Button size="sm" variant="ghost" onClick={() => abrirAnexo(f as any)}><Paperclip className="h-4 w-4 mr-1" />Boleto</Button>}
                  {f.linha_digitavel && <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(f.linha_digitavel!); toast.success("Linha digitável copiada."); }}>Copiar linha</Button>}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium">Cobrar agora</div>
            <p className="text-xs text-muted-foreground">Uma mensagem com todas as faturas vencidas e os links dos boletos. Destino: {c.telefone ?? "sem telefone"} · {c.email ?? "sem e-mail"}.</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1"><Checkbox checked={canais.whatsapp} onCheckedChange={(v) => setCanais({ ...canais, whatsapp: !!v })} />WhatsApp</label>
              <label className="flex items-center gap-1"><Checkbox checked={canais.email} onCheckedChange={(v) => setCanais({ ...canais, email: !!v })} />E-mail</label>
            </div>
            <Button size="sm" onClick={cobrarAgora} disabled={!!busy || (!canais.whatsapp && !canais.email)}>{busy === "cobrar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Enviar cobrança</Button>

            <div className="border-t pt-3 space-y-2">
              <div className="text-sm font-medium">Contato de cobrança</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label className="text-xs">Telefone (WhatsApp)</Label><Input placeholder={fc?.telefone ?? "do GSystem"} value={contato.telefone} onChange={(e) => setContato({ ...contato, telefone: e.target.value })} /></div>
                <div><Label className="text-xs">E-mail</Label><Input placeholder={fc?.email ?? "do GSystem"} value={contato.email} onChange={(e) => setContato({ ...contato, email: e.target.value })} /></div>
              </div>
              <Textarea rows={2} placeholder="Observação (ex.: falar com o financeiro, Sra. Ana)" value={contato.observacao} onChange={(e) => setContato({ ...contato, observacao: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><Switch checked={contato.pausada} onCheckedChange={(v) => setContato({ ...contato, pausada: v })} />Pausar a régua automática para este cliente</label>
              <Button size="sm" variant="outline" onClick={salvarContato} disabled={!!busy}>Salvar contato</Button>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium">Registrar</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label className="text-xs">O que aconteceu</Label>
                <Select value={acao.tipo} onValueChange={(v) => setAcao({ ...acao, tipo: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {["contato", "promessa", "acordo", "nota", "bloqueio", "desbloqueio"].map((t) => <SelectItem key={t} value={t}>{TIPOS_ACAO[t]}</SelectItem>)}
                </SelectContent></Select></div>
              {["contato", "promessa", "acordo"].includes(acao.tipo) && (
                <div><Label className="text-xs">Canal</Label>
                  <Select value={acao.canal} onValueChange={(v) => setAcao({ ...acao, canal: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="telefone">Telefone</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent></Select></div>
              )}
              {acao.tipo === "contato" && (
                <div><Label className="text-xs">Resultado</Label>
                  <Select value={acao.resultado || "nenhum"} onValueChange={(v) => setAcao({ ...acao, resultado: v === "nenhum" ? "" : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="nenhum">—</SelectItem>{Object.entries(RESULTADOS).filter(([k]) => k !== "enviado").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent></Select></div>
              )}
              {acao.tipo === "promessa" && <div><Label className="text-xs">Data prometida</Label><Input type="date" value={acao.data_promessa} onChange={(e) => setAcao({ ...acao, data_promessa: e.target.value })} /></div>}
              {acao.tipo === "acordo" && <>
                <div><Label className="text-xs">Valor do acordo (R$)</Label><Input value={acao.valor} onChange={(e) => setAcao({ ...acao, valor: e.target.value })} placeholder={c.valor.toFixed(2).replace(".", ",")} /></div>
                <div><Label className="text-xs">Parcelas</Label><Input type="number" value={acao.parcelas} onChange={(e) => setAcao({ ...acao, parcelas: e.target.value })} /></div>
                <div><Label className="text-xs">1º vencimento</Label><Input type="date" value={acao.primeiro_vencimento} onChange={(e) => setAcao({ ...acao, primeiro_vencimento: e.target.value })} /></div>
              </>}
            </div>
            <Textarea rows={3} placeholder={acao.tipo === "bloqueio" ? "Motivo e o que foi bloqueado/suspenso" : "Observação"} value={acao.observacao} onChange={(e) => setAcao({ ...acao, observacao: e.target.value })} />
            {acao.tipo === "acordo" && <p className="text-xs text-muted-foreground">O acordo fica registrado aqui. Lance as parcelas novas em Contas a receber e, se for o caso, cancele as faturas antigas no GSystem.</p>}
            {acao.tipo === "bloqueio" && <p className="text-xs text-muted-foreground">Registro da decisão. O bloqueio em si é feito na plataforma de rastreamento.</p>}
            <Button size="sm" onClick={() => registrar()} disabled={!!busy}>{busy === "acao" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Registrar</Button>
          </div>
        </div>

        <div className="rounded-md border p-3"><NegativacoesCliente cliente={c} lista={lista} lancamentos={lancamentos} /></div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Histórico de cobrança</div>
          {acoes.length ? acoes.map((a) => (
            <div key={a.id ?? a.created_at} className="text-sm border-b last:border-0 pb-1">
              <span className="text-muted-foreground">{dataHora(a.created_at)}</span> · <b>{TIPOS_ACAO[a.tipo] ?? a.tipo}</b>
              {a.canal && <> · {a.canal}</>}{a.resultado && <> · {RESULTADOS[a.resultado] ?? a.resultado}</>}
              {a.data_promessa && <> · para {formatDataBR(a.data_promessa)}</>}
              {a.tipo === "acordo" && a.valor != null && <> · {formatBRL(Number(a.valor))}{a.parcelas ? ` em ${a.parcelas}x` : ""}{a.primeiro_vencimento ? `, 1º venc. ${formatDataBR(a.primeiro_vencimento)}` : ""}</>}
              {a.observacao && <div className="text-muted-foreground">{a.observacao}</div>}
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
