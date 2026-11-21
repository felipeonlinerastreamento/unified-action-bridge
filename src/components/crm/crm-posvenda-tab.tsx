import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Loader2, Phone, Search, AlertTriangle, CheckCircle2, BookOpen, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDataBR, hojeSP } from "@/lib/finance";
import { atualizarCarteira } from "@/lib/posvenda.functions";
import {
  CADENCIA_LABEL, CANAIS, INTERESSES, ROTEIROS, classeDe, metricasPosVenda, proximoContato, resumoPorClasse,
  riscoDe, saudeCliente, situacaoContato, somaDias, sugestoesCliente,
  type Classe, type ClienteCarteira, type ContatoPosVenda, type RoteiroKey,
} from "@/lib/posvenda";

// Tabelas novas ainda não estão nos tipos gerados.
const db = supabase as any;

type Cli = ClienteCarteira & {
  gsystem_cliente_key: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  decisor_nome: string | null;
  decisor_telefone: string | null;
  ativo: boolean;
};
type Contato = ContatoPosVenda & {
  id: string;
  canal: string;
  roteiro: string;
  resumo: string;
  proximo_passo: string | null;
  proximo_contato_em: string | null;
  frota_total: number | null;
  decisor_nome: string | null;
  interesses: string[] | null;
  created_at: string;
};

async function lerTudo(tabela: string, monta: (q: any) => any) {
  const out: any[] = [];
  for (let i = 0; i < 50_000; i += 1000) {
    const { data, error } = await monta(db.from(tabela).select("*")).range(i, i + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function usePosVenda() {
  const carteira = useQuery({
    queryKey: ["posvenda-carteira"],
    queryFn: async () => (await lerTudo("crm_posvenda_carteira", (q) => q.eq("ativo", true).order("receita_mensal", { ascending: false }).order("id"))) as Cli[],
  });
  const desde = somaDias(hojeSP(), -365);
  const contatos = useQuery({
    queryKey: ["posvenda-contatos"],
    queryFn: async () => (await lerTudo("crm_posvenda_contatos", (q) => q.gte("data", desde).order("data", { ascending: false }).order("id"))) as Contato[],
  });
  return { carteira: carteira.data ?? [], contatos: contatos.data ?? [], isLoading: carteira.isLoading || contatos.isLoading, error: carteira.error || contatos.error };
}

const ClasseBadge = ({ c }: { c: Classe }) => (
  <Badge className={c === "A" ? "bg-emerald-600 hover:bg-emerald-600 text-white" : c === "B" ? "bg-sky-600 hover:bg-sky-600 text-white" : ""} variant={c === "C" ? "secondary" : "default"}>{c}</Badge>
);
const RiscoBadge = ({ saude }: { saude: number }) => {
  const r = riscoDe(saude);
  return <Badge variant={r === "alto" ? "destructive" : "outline"} className={r === "medio" ? "border-amber-500 text-amber-600" : ""}>{saude} · {r === "alto" ? "risco alto" : r === "medio" ? "atenção" : "saudável"}</Badge>;
};

export function CrmPosVendaTab() {
  const qc = useQueryClient();
  const { carteira, contatos, isLoading, error } = usePosVenda();
  const atualizar = useServerFn(atualizarCarteira);
  const [atualizando, setAtualizando] = useState(false);
  const [registrar, setRegistrar] = useState<{ cli: Cli; roteiro?: RoteiroKey } | null>(null);
  const [detalhe, setDetalhe] = useState<Cli | null>(null);
  const hoje = hojeSP();
  const recarregar = () => { qc.invalidateQueries({ queryKey: ["posvenda-carteira"] }); qc.invalidateQueries({ queryKey: ["posvenda-contatos"] }); };

  const doAtualizar = async () => {
    setAtualizando(true);
    try {
      const r = await atualizar();
      if (!r.ok) throw new Error(r.error || "Falha ao atualizar.");
      toast.success(`Carteira atualizada: ${r.clientes} clientes (${r.pj} PJ na base, ${r.comReceita} com faturamento).`);
      recarregar();
    } catch (e: any) { toast.error(e?.message ?? "Não foi possível atualizar a carteira."); }
    finally { setAtualizando(false); }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Carteira com todos os clientes PJ do GSystem e a receita das faturas. Classe A = quinzenal, B = mensal, C = trimestral.
        </p>
        <Button variant="outline" onClick={doAtualizar} disabled={atualizando}>
          {atualizando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar carteira
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">Erro ao carregar: {(error as Error).message}</p>}
      {carteira.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">A carteira ainda está vazia. Clique em <b>Atualizar carteira</b> para trazer os clientes do GSystem.</CardContent></Card>
      ) : (
        <Tabs defaultValue="agenda">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
            <TabsTrigger value="carteira">Carteira</TabsTrigger>
            <TabsTrigger value="painel">Painel</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="roteiros">Roteiros</TabsTrigger>
          </TabsList>
          <TabsContent value="agenda" className="mt-4"><Agenda carteira={carteira} hoje={hoje} onRegistrar={(cli, roteiro) => setRegistrar({ cli, roteiro })} onAbrir={setDetalhe} /></TabsContent>
          <TabsContent value="carteira" className="mt-4"><Carteira carteira={carteira} hoje={hoje} onAbrir={setDetalhe} /></TabsContent>
          <TabsContent value="painel" className="mt-4"><Painel carteira={carteira} contatos={contatos} hoje={hoje} /></TabsContent>
          <TabsContent value="historico" className="mt-4"><Historico carteira={carteira} contatos={contatos} /></TabsContent>
          <TabsContent value="roteiros" className="mt-4"><Roteiros /></TabsContent>
        </Tabs>
      )}
      {registrar && <RegistrarContato cli={registrar.cli} roteiroInicial={registrar.roteiro} onClose={() => setRegistrar(null)} onSalvo={recarregar} />}
      {detalhe && (
        <ClienteDialog cli={detalhe} contatos={contatos.filter((c) => c.carteira_id === detalhe.id)} hoje={hoje}
          onClose={() => setDetalhe(null)} onSalvo={recarregar} onRegistrar={(r) => { setRegistrar({ cli: detalhe, roteiro: r }); setDetalhe(null); }} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Agenda
function Agenda({ carteira, hoje, onRegistrar, onAbrir }: { carteira: Cli[]; hoje: string; onRegistrar: (c: Cli, r?: RoteiroKey) => void; onAbrir: (c: Cli) => void }) {
  const [filtro, setFiltro] = useState<"recorrentes" | "primeiro" | "risco">("recorrentes");
  const itens = useMemo(() => {
    const comInfo = carteira.map((c) => {
      const prox = proximoContato(c, hoje, c.proximo_contato_em);
      const saude = saudeCliente(c, hoje);
      return { c, prox, saude, sit: situacaoContato(prox, hoje), sug: sugestoesCliente(c, hoje) };
    });
    const ordClasse = (k: Classe) => ({ A: 0, B: 1, C: 2 })[k];
    let lista = comInfo;
    if (filtro === "primeiro") lista = comInfo.filter((x) => !x.c.diagnostico_em);
    else if (filtro === "risco") lista = comInfo.filter((x) => riscoDe(x.saude) === "alto");
    else lista = comInfo.filter((x) => !!x.c.diagnostico_em && x.sit !== "em_dia");
    return lista.sort((a, b) => ordClasse(classeDe(a.c)) - ordClasse(classeDe(b.c)) || a.saude - b.saude || b.c.receita_mensal - a.c.receita_mensal).slice(0, 200);
  }, [carteira, hoje, filtro]);
  const contar = (f: typeof filtro) => carteira.filter((c) => {
    if (f === "primeiro") return !c.diagnostico_em;
    if (f === "risco") return riscoDe(saudeCliente(c, hoje)) === "alto";
    return !!c.diagnostico_em && situacaoContato(proximoContato(c, hoje, c.proximo_contato_em), hoje) !== "em_dia";
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filtro === "recorrentes" ? "default" : "outline"} onClick={() => setFiltro("recorrentes")}>Contatos do dia e atrasados ({contar("recorrentes")})</Button>
        <Button size="sm" variant={filtro === "primeiro" ? "default" : "outline"} onClick={() => setFiltro("primeiro")}>Primeiro contato / diagnóstico ({contar("primeiro")})</Button>
        <Button size="sm" variant={filtro === "risco" ? "default" : "outline"} onClick={() => setFiltro("risco")}>Risco alto ({contar("risco")})</Button>
      </div>
      {itens.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Nada pendente nesta lista.</CardContent></Card>}
      {itens.map(({ c, prox, saude, sit, sug }) => (
        <Card key={c.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button className="text-left" onClick={() => onAbrir(c)}>
                <div className="font-medium flex items-center gap-2"><ClasseBadge c={classeDe(c)} />{c.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBRL(c.receita_mensal)}/mês · {CADENCIA_LABEL[classeDe(c)]} · último contato {c.ultimo_contato_em ? formatDataBR(c.ultimo_contato_em) : "nunca"}
                  {sit === "atrasado" && c.diagnostico_em ? <span className="text-destructive"> · atrasado desde {formatDataBR(prox)}</span> : sit === "hoje" ? " · hoje" : ""}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <RiscoBadge saude={saude} />
                <Button size="sm" onClick={() => onRegistrar(c, sug[0]?.roteiro)}><Phone className="h-4 w-4 mr-1" />Registrar contato</Button>
              </div>
            </div>
            {sug.length > 0 && (
              <ul className="text-sm space-y-0.5">
                {sug.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex gap-1.5">{s.prioridade === 1 ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> : <span className="w-4 shrink-0 text-center text-muted-foreground">•</span>}<span>{s.texto}</span></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Carteira
function Carteira({ carteira, hoje, onAbrir }: { carteira: Cli[]; hoje: string; onAbrir: (c: Cli) => void }) {
  const [q, setQ] = useState("");
  const [fClasse, setFClasse] = useState("all");
  const linhas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return carteira.filter((c) => (fClasse === "all" || classeDe(c) === fClasse) && (!t || `${c.nome} ${c.documento}`.toLowerCase().includes(t)));
  }, [carteira, q, fClasse]);
  const resumo = resumoPorClasse(carteira);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {resumo.map((r) => (
          <Card key={r.classe}><CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm"><ClasseBadge c={r.classe} /> {CADENCIA_LABEL[r.classe]}</div>
            <div className="text-lg font-semibold mt-1">{r.clientes} clientes</div>
            <div className="text-xs text-muted-foreground">{formatBRL(r.receita)}/mês · {r.participacao}% da receita</div>
          </CardContent></Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar cliente ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={fClasse} onValueChange={setFClasse}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as classes</SelectItem><SelectItem value="A">Classe A</SelectItem><SelectItem value="B">Classe B</SelectItem><SelectItem value="C">Classe C</SelectItem></SelectContent>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cliente</TableHead><TableHead>Classe</TableHead><TableHead className="text-right">Receita/mês</TableHead>
            <TableHead>Vencidas</TableHead><TableHead>Saúde</TableHead><TableHead>Último contato</TableHead><TableHead>Próximo</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {linhas.slice(0, 500).map((c) => {
              const prox = proximoContato(c, hoje, c.proximo_contato_em);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onAbrir(c)}>
                  <TableCell className="font-medium">{c.nome}{!c.diagnostico_em && <Badge variant="outline" className="ml-2 text-[10px]">sem diagnóstico</Badge>}</TableCell>
                  <TableCell><ClasseBadge c={classeDe(c)} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(c.receita_mensal)}</TableCell>
                  <TableCell>{c.vencidas_qtd ? <span className="text-destructive">{c.vencidas_qtd} · {formatBRL(c.vencidas_valor)}</span> : "—"}</TableCell>
                  <TableCell><RiscoBadge saude={saudeCliente(c, hoje)} /></TableCell>
                  <TableCell>{c.ultimo_contato_em ? formatDataBR(c.ultimo_contato_em) : "nunca"}</TableCell>
                  <TableCell className={situacaoContato(prox, hoje) === "atrasado" ? "text-destructive" : ""}>{formatDataBR(prox)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {linhas.length > 500 && <p className="text-xs text-muted-foreground">Mostrando 500 de {linhas.length}. Use a busca para filtrar.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Painel
function Painel({ carteira, contatos, hoje }: { carteira: Cli[]; contatos: Contato[]; hoje: string }) {
  const [periodo, setPeriodo] = useState("mes");
  const de = periodo === "semana" ? somaDias(hoje, -6) : periodo === "mes" ? `${hoje.slice(0, 7)}-01` : somaDias(hoje, -89);
  const m = metricasPosVenda(carteira, contatos, de, hoje, hoje);
  const kpis: { t: string; v: string; d: string; alerta?: boolean }[] = [
    { t: "Contatos realizados", v: String(m.contatosRealizados), d: `${m.clientesContatados} clientes · ${m.semResposta} sem resposta` },
    { t: "Carteira em dia", v: `${m.pctCarteiraEmDia}%`, d: "clientes sem contato atrasado" },
    { t: "Clientes A atrasados", v: String(m.atrasadosA), d: "meta: zero", alerta: m.atrasadosA > 0 },
    { t: "Base diagnosticada", v: `${m.pctDiagnosticados}%`, d: `${m.diagnosticados} de ${carteira.length} com primeiro contato` },
    { t: "NPS", v: m.nps == null ? "—" : String(m.nps), d: `${m.respostasNps} resposta(s) no período` },
    { t: "Oportunidades", v: String(m.oportunidades), d: `${formatBRL(m.valorOportunidades)} estimado` },
    { t: "Clientes em risco alto", v: String(m.riscoAlto), d: `${formatBRL(m.receitaEmRisco)}/mês em risco`, alerta: m.riscoAlto > 0 },
  ];
  return (
    <div className="space-y-3">
      <Select value={periodo} onValueChange={setPeriodo}>
        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="semana">Últimos 7 dias</SelectItem><SelectItem value="mes">Mês atual</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent>
      </Select>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.t}><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{k.t}</div>
            <div className={`text-2xl font-semibold ${k.alerta ? "text-destructive" : ""}`}>{k.v}</div>
            <div className="text-xs text-muted-foreground">{k.d}</div>
          </CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Clientes em risco alto (maior receita primeiro)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          {carteira.filter((c) => riscoDe(saudeCliente(c, hoje)) === "alto").sort((a, b) => b.receita_mensal - a.receita_mensal).slice(0, 15).map((c) => (
            <div key={c.id} className="flex justify-between gap-2"><span><ClasseBadge c={classeDe(c)} /> {c.nome}</span><span className="text-muted-foreground whitespace-nowrap">{formatBRL(c.receita_mensal)} · saúde {saudeCliente(c, hoje)}</span></div>
          ))}
          {m.riscoAlto === 0 && <p className="text-muted-foreground">Nenhum cliente em risco alto.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Histórico
function Historico({ carteira, contatos }: { carteira: Cli[]; contatos: Contato[] }) {
  const nome = useMemo(() => new Map(carteira.map((c) => [c.id, c.nome])), [carteira]);
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Roteiro</TableHead><TableHead>Canal</TableHead><TableHead>Resultado</TableHead><TableHead>Resumo</TableHead><TableHead>NPS</TableHead></TableRow></TableHeader>
        <TableBody>
          {contatos.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum contato registrado ainda.</TableCell></TableRow>}
          {contatos.slice(0, 300).map((c) => (
            <TableRow key={c.id}>
              <TableCell className="whitespace-nowrap">{formatDataBR(c.data)}</TableCell>
              <TableCell className="font-medium">{nome.get(c.carteira_id) ?? "—"}</TableCell>
              <TableCell>{ROTEIROS[c.roteiro as RoteiroKey]?.nome ?? c.roteiro}</TableCell>
              <TableCell>{CANAIS.find((x) => x.key === c.canal)?.label ?? c.canal}</TableCell>
              <TableCell>{c.resultado === "realizado" ? "Realizado" : c.resultado === "sem_resposta" ? "Sem resposta" : "Reagendado"}</TableCell>
              <TableCell className="max-w-[320px] truncate" title={c.resumo}>{c.resumo || "—"}</TableCell>
              <TableCell>{c.nps ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ------------------------------------------------------------------ Roteiros (documentação)
function Roteiros() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(Object.keys(ROTEIROS) as RoteiroKey[]).map((k) => (
        <Card key={k}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" />{ROTEIROS[k].nome}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-muted-foreground">{ROTEIROS[k].quando}</p>
            <ol className="list-decimal pl-5 space-y-0.5">{ROTEIROS[k].passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Registrar contato
function RegistrarContato({ cli, roteiroInicial, onClose, onSalvo }: { cli: Cli; roteiroInicial?: RoteiroKey; onClose: () => void; onSalvo: () => void }) {
  const hoje = hojeSP();
  const [f, setF] = useState({
    data: hoje,
    canal: "whatsapp",
    roteiro: (roteiroInicial ?? (cli.diagnostico_em ? "revisao" : "primeiro_contato")) as RoteiroKey,
    resultado: "realizado",
    resumo: "",
    sentimento: "",
    nps: "",
    proximo_passo: "",
    proximo_contato_em: "",
    oportunidade: "",
    oportunidade_valor: "",
    frota_total: cli.frota_total ? String(cli.frota_total) : "",
    decisor_nome: cli.decisor_nome ?? "",
    decisor_telefone: cli.decisor_telefone ?? "",
    interesses: (cli.interesses ?? []) as string[],
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));
  const roteiro = ROTEIROS[f.roteiro];
  const diagnostico = f.roteiro === "primeiro_contato";

  const salvar = async () => {
    if (f.resultado === "realizado" && !f.resumo.trim()) { toast.error("Escreva o resumo do contato."); return; }
    setSalvando(true);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await db.from("crm_posvenda_contatos").insert({
      carteira_id: cli.id,
      data: f.data,
      canal: f.canal,
      roteiro: f.roteiro,
      resultado: f.resultado,
      resumo: f.resumo.trim(),
      sentimento: f.sentimento || null,
      nps: f.nps === "" ? null : Number(f.nps),
      proximo_passo: f.proximo_passo.trim() || null,
      proximo_contato_em: f.proximo_contato_em || null,
      oportunidade: f.oportunidade.trim() || null,
      oportunidade_valor: f.oportunidade_valor ? Number(f.oportunidade_valor.replace(/\./g, "").replace(",", ".")) : null,
      frota_total: f.frota_total ? Number(f.frota_total) : null,
      decisor_nome: f.decisor_nome.trim() || null,
      decisor_telefone: f.decisor_telefone.trim() || null,
      interesses: diagnostico || f.interesses.length ? f.interesses : null,
      user_id: sess.session?.user.id,
    });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contato registrado.");
    onSalvo();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar contato · {cli.nome}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Data</Label><Input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></div>
          <div><Label>Canal</Label>
            <Select value={f.canal} onValueChange={(v) => set("canal", v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CANAIS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Resultado</Label>
            <Select value={f.resultado} onValueChange={(v) => set("resultado", v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="realizado">Realizado</SelectItem><SelectItem value="sem_resposta">Sem resposta</SelectItem><SelectItem value="reagendado">Reagendado</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div><Label>Roteiro</Label>
          <Select value={f.roteiro} onValueChange={(v) => set("roteiro", v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(ROTEIROS) as RoteiroKey[]).map((k) => <SelectItem key={k} value={k}>{ROTEIROS[k].nome}</SelectItem>)}</SelectContent></Select>
          <ol className="list-decimal pl-5 mt-2 text-xs text-muted-foreground space-y-0.5">{roteiro.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
        </div>
        {diagnostico && f.resultado === "realizado" && (
          <div className="grid gap-3 sm:grid-cols-3 rounded-md border p-3">
            <div><Label>Frota total (veículos)</Label><Input inputMode="numeric" value={f.frota_total} onChange={(e) => set("frota_total", e.target.value.replace(/\D/g, ""))} /></div>
            <div><Label>Decisor</Label><Input value={f.decisor_nome} onChange={(e) => set("decisor_nome", e.target.value)} /></div>
            <div><Label>Telefone do decisor</Label><Input value={f.decisor_telefone} onChange={(e) => set("decisor_telefone", e.target.value)} /></div>
            <div className="sm:col-span-3"><Label>Interesses</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {INTERESSES.map((i) => (
                  <label key={i.key} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={f.interesses.includes(i.key)} onCheckedChange={(v) => set("interesses", v ? [...f.interesses, i.key] : f.interesses.filter((x) => x !== i.key))} />{i.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <div><Label>Resumo da conversa</Label><Textarea rows={3} value={f.resumo} onChange={(e) => set("resumo", e.target.value)} placeholder="O que foi falado, reclamações, pedidos..." /></div>
        {f.resultado === "realizado" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Sentimento do cliente</Label>
              <Select value={f.sentimento} onValueChange={(v) => set("sentimento", v)}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="positivo">Positivo</SelectItem><SelectItem value="neutro">Neutro</SelectItem><SelectItem value="negativo">Negativo</SelectItem></SelectContent></Select>
            </div>
            <div><Label>NPS (0 a 10)</Label>
              <Select value={f.nps} onValueChange={(v) => set("nps", v)}><SelectTrigger><SelectValue placeholder="não perguntado" /></SelectTrigger>
                <SelectContent>{Array.from({ length: 11 }, (_, i) => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Oportunidade (solução oferecida)</Label><Input value={f.oportunidade} onChange={(e) => set("oportunidade", e.target.value)} placeholder="Ex.: 5 câmeras veiculares" /></div>
            <div><Label>Valor estimado (R$/mês)</Label><Input inputMode="decimal" value={f.oportunidade_valor} onChange={(e) => set("oportunidade_valor", e.target.value)} /></div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Próximo passo</Label><Input value={f.proximo_passo} onChange={(e) => set("proximo_passo", e.target.value)} /></div>
          <div><Label>Próximo contato</Label><Input type="date" value={f.proximo_contato_em} onChange={(e) => set("proximo_contato_em", e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">Em branco: {f.resultado === "realizado" ? `pela cadência (${CADENCIA_LABEL[classeDe(cli)].toLowerCase()})` : "em 2 dias"}.</p></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Ficha do cliente
function ClienteDialog({ cli, contatos, hoje, onClose, onSalvo, onRegistrar }: { cli: Cli; contatos: Contato[]; hoje: string; onClose: () => void; onSalvo: () => void; onRegistrar: (r?: RoteiroKey) => void }) {
  const [classeManual, setClasseManual] = useState<string>(cli.classe_manual ?? "auto");
  const [obs, setObs] = useState(cli.observacoes ?? "");
  const saude = saudeCliente(cli, hoje);
  const sug = sugestoesCliente(cli, hoje);
  const salvar = async () => {
    const { error } = await db.from("crm_posvenda_carteira").update({ classe_manual: classeManual === "auto" ? null : classeManual, observacoes: obs || null }).eq("id", cli.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente atualizado."); onSalvo(); onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ClasseBadge c={classeDe(cli)} />{cli.nome}</DialogTitle></DialogHeader>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Receita mensal</div>{formatBRL(cli.receita_mensal)}</div>
          <div><div className="text-xs text-muted-foreground">Faturas vencidas</div>{cli.vencidas_qtd ? `${cli.vencidas_qtd} · ${formatBRL(cli.vencidas_valor)}` : "nenhuma"}</div>
          <div><div className="text-xs text-muted-foreground">Saúde</div><RiscoBadge saude={saude} /></div>
          <div><div className="text-xs text-muted-foreground">Frota total</div>{cli.frota_total ?? "—"}</div>
          <div><div className="text-xs text-muted-foreground">Decisor</div>{cli.decisor_nome ?? "—"}{cli.decisor_telefone ? ` · ${cli.decisor_telefone}` : ""}</div>
          <div><div className="text-xs text-muted-foreground">Interesses</div>{(cli.interesses ?? []).map((k) => INTERESSES.find((i) => i.key === k)?.label ?? k).join(", ") || "—"}</div>
          <div><div className="text-xs text-muted-foreground">Cliente desde (faturas)</div>{formatDataBR(cli.primeira_fatura_em)}</div>
          <div><div className="text-xs text-muted-foreground">Último NPS</div>{cli.ultimo_nps ?? "—"}</div>
          <div><div className="text-xs text-muted-foreground">Próximo contato</div>{formatDataBR(proximoContato(cli, hoje, cli.proximo_contato_em))}</div>
        </div>
        {sug.length > 0 && (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="font-medium">Sugestões</div>
            {sug.map((s, i) => <button key={i} className="block text-left hover:underline" onClick={() => onRegistrar(s.roteiro)}>• {s.texto}</button>)}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Classe</Label>
            <Select value={classeManual} onValueChange={setClasseManual}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="auto">Automática ({cli.classe})</SelectItem><SelectItem value="A">A (quinzenal)</SelectItem><SelectItem value="B">B (mensal)</SelectItem><SelectItem value="C">C (trimestral)</SelectItem></SelectContent></Select>
          </div>
          <div className="sm:col-span-2"><Label>Observações</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium flex items-center gap-1"><History className="h-4 w-4" />Histórico de contatos</div>
          {contatos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato registrado.</p>}
          {contatos.map((c) => (
            <div key={c.id} className="text-sm border-l-2 pl-2 py-0.5">
              <div className="text-xs text-muted-foreground">{formatDataBR(c.data)} · {ROTEIROS[c.roteiro as RoteiroKey]?.nome ?? c.roteiro} · {CANAIS.find((x) => x.key === c.canal)?.label ?? c.canal}{c.nps != null ? ` · NPS ${c.nps}` : ""}</div>
              <div>{c.resultado !== "realizado" ? (c.resultado === "sem_resposta" ? "Sem resposta. " : "Reagendado. ") : ""}{c.resumo}</div>
              {c.oportunidade && <div className="text-xs">Oportunidade: {c.oportunidade}{c.oportunidade_valor ? ` · ${formatBRL(c.oportunidade_valor)}` : ""}</div>}
              {c.proximo_passo && <div className="text-xs text-muted-foreground">Próximo passo: {c.proximo_passo}</div>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onRegistrar(sug[0]?.roteiro)}><Phone className="h-4 w-4 mr-1" />Registrar contato</Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
