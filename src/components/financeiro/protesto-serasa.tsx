import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, FileText, Gavel, Loader2, Plus, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDataBR, hojeSP, parseValorBR } from "@/lib/finance";
import type { ClienteInadimplente } from "@/lib/finance-inadimplencia";
import {
  NOME_ORGAO, NOME_SITUACAO, avaliarNegativacao, candidatosNegativacao, emVigor, indicadoresNegativacao, textoCartaAnuencia,
  type AvaliacaoNeg, type LancNeg, type Negativacao, type Orgao, type SituacaoVisivel,
} from "@/lib/finance-negativacao";
import { fin, type Lanc } from "./use-fin";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

export type CriterioNeg = { diasMinimo: number; valorMinimo: number; prazoDiasUteis: number };

export function useNegativacoes() {
  return useQuery({
    queryKey: ["fin-negativacoes"],
    queryFn: async () => {
      const { data, error } = await fin.from("fin_negativacoes").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data || []) as Negativacao[];
    },
    retry: false,
  });
}

const VISIVEL: Record<SituacaoVisivel, { texto: string; cls: string }> = {
  preparando: { texto: "Em preparação", cls: "text-muted-foreground" },
  enviado: { texto: "Enviado", cls: "border-sky-500 text-sky-700" },
  ativo: { texto: "Negativado / protestado", cls: "border-red-500 text-red-700" },
  quitado_baixar: { texto: "Quitado: dar baixa", cls: "border-amber-500 text-amber-700" },
  baixa_atrasada: { texto: "Baixa atrasada", cls: "bg-red-600 text-white border-transparent" },
  baixado: { texto: "Baixado", cls: "border-emerald-500 text-emerald-700" },
  cancelado: { texto: "Cancelado", cls: "text-muted-foreground line-through" },
};

const mapaLancs = (lancamentos: Lanc[]) => new Map<string, LancNeg>(lancamentos.map((l) => [l.id, { id: l.id, status: l.status, valor: Number(l.valor), vencimento: l.vencimento, data_pagamento: l.data_pagamento }]));

async function registrarHistorico(n: Pick<Negativacao, "documento" | "cliente_nome" | "orgao" | "lancamento_ids" | "valor">, tipo: string, observacao: string) {
  await fin.from("fin_cobranca_acoes").insert({ documento: n.documento, cliente_nome: n.cliente_nome ?? null, tipo, observacao, lancamento_ids: n.lancamento_ids, valor: n.valor });
}

/** Financeiro › Inadimplência › Protesto e Serasa. */
export function ProtestoSerasaTab({ lancamentos, lista, criterio, onAbrirCliente }: {
  lancamentos: Lanc[]; lista: ClienteInadimplente[]; criterio: CriterioNeg; onAbrirCliente: (chave: string) => void;
}) {
  const hoje = hojeSP();
  const q = useNegativacoes();
  const negs = q.data ?? [];
  const lancs = useMemo(() => mapaLancs(lancamentos), [lancamentos]);
  const avaliadas = useMemo(() => negs.map((n) => ({ n, a: avaliarNegativacao(n, lancs, hoje, criterio.prazoDiasUteis) })), [negs, lancs, hoje, criterio.prazoDiasUteis]);
  const ind = useMemo(() => indicadoresNegativacao(negs, lancs, hoje, criterio.prazoDiasUteis), [negs, lancs, hoje, criterio.prazoDiasUteis]);
  const candidatos = useMemo(() => candidatosNegativacao(lista, negs, hoje, criterio), [lista, negs, hoje, criterio]);
  const [orgao, setOrgao] = useState<"todos" | Orgao>("todos");
  const [sit, setSit] = useState<"abertos" | "todos" | SituacaoVisivel>("abertos");
  const [novo, setNovo] = useState<ClienteInadimplente | null | "vazio">(null);
  const [editar, setEditar] = useState<Negativacao | null>(null);
  const [carta, setCarta] = useState<Negativacao | null>(null);
  const baixar = avaliadas.filter((x) => x.a.visivel === "quitado_baixar" || x.a.visivel === "baixa_atrasada")
    .sort((a, b) => (a.a.diasParaPrazo ?? 0) - (b.a.diasParaPrazo ?? 0));

  const filtrados = avaliadas.filter(({ n, a }) =>
    (orgao === "todos" || n.orgao === orgao) &&
    (sit === "todos" || (sit === "abertos" ? !["baixado", "cancelado"].includes(a.visivel) : a.visivel === sit)));

  type Av = (typeof avaliadas)[number];
  const colunas: TableColumn<Av>[] = [
    { id: "cliente", label: "Cliente", value: ({ n }) => n.cliente_nome ?? n.documento ?? "" },
    { id: "documento", label: "CPF/CNPJ", value: ({ n }) => n.documento ?? "" },
    { id: "orgao", label: "Órgão", value: ({ n }) => NOME_ORGAO[n.orgao] },
    { id: "situacao", label: "Situação", value: ({ a }) => VISIVEL[a.visivel].texto },
    { id: "valor", label: "Valor", value: ({ n }) => Number(n.valor) },
    { id: "datas", label: "Datas", value: ({ n }) => [n.data_envio && `Envio ${formatDataBR(n.data_envio)}`, n.data_inclusao && `Inclusão ${formatDataBR(n.data_inclusao)}`, n.data_baixa && `Baixa ${formatDataBR(n.data_baixa)}`].filter(Boolean).join(" · ") },
    { id: "protocolo", label: "Protocolo", value: ({ n }) => [n.protocolo, n.cartorio].filter(Boolean).join(" · ") },
  ];
  const tabela = useTableColumns("fin-negativacoes", colunas, filtrados);
  const th = (id: string) => <ColumnFilterHeader column={colunas.find((c) => c.id === id)!} state={tabela} />;

  if (q.error) return <Card className="border-amber-500"><CardContent className="pt-4 text-sm">Aplique a migração 0071 no Lovable para usar esta parte.</CardContent></Card>;

  return (
    <div className="space-y-4">
      {baixar.length > 0 && (
        <Card className="border-red-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" />{baixar.length} registro(s) quitado(s) esperando baixa</CardTitle>
            <CardDescription>O cliente pagou. Pela Súmula 548 do STJ, a baixa da negativação é do credor em até 5 dias úteis após o pagamento. No protesto, entregue a carta de anuência para o cliente cancelar no cartório.</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {baixar.map(({ n, a }) => (
              <div key={n.id} className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 py-1">
                <Badge variant="outline" className={VISIVEL[a.visivel].cls}>{VISIVEL[a.visivel].texto}</Badge>
                <b>{n.cliente_nome ?? n.documento}</b><span>{NOME_ORGAO[n.orgao]}</span>
                <span className="text-muted-foreground">pago em {a.dataQuitacao ? formatDataBR(a.dataQuitacao) : "—"} · prazo {a.prazoBaixa ? formatDataBR(a.prazoBaixa) : "—"}{a.diasParaPrazo != null && (a.diasParaPrazo < 0 ? ` (${-a.diasParaPrazo} dia(s) atrasado)` : ` (faltam ${a.diasParaPrazo} dia(s))`)}</span>
                <span className="ml-auto flex gap-1">
                  {n.orgao === "protesto" && <Button size="sm" variant="outline" onClick={() => setCarta(n)}><FileText className="h-4 w-4 mr-1" />Carta de anuência</Button>}
                  <AcaoBaixa n={n} />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          { t: "Em vigor", v: String(ind.emVigor), d: formatBRL(ind.valorEmVigor) + " em aberto" },
          { t: "Serasa / SPC / Boa Vista", v: String(ind.porOrgao.serasa.qtd + ind.porOrgao.spc.qtd + ind.porOrgao.boa_vista.qtd), d: formatBRL(ind.porOrgao.serasa.valor + ind.porOrgao.spc.valor + ind.porOrgao.boa_vista.valor) },
          { t: "Protestos", v: String(ind.porOrgao.protesto.qtd), d: formatBRL(ind.porOrgao.protesto.valor) },
          { t: "Recuperado", v: formatBRL(ind.recuperado), d: `custos ${formatBRL(ind.custos)}` },
          { t: "Baixas pendentes", v: String(ind.baixasPendentes), d: ind.baixasAtrasadas ? `${ind.baixasAtrasadas} atrasada(s)` : "nenhuma atrasada" },
        ].map((c) => <Card key={c.t}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{c.t}</div><div className="text-lg font-semibold">{c.v}</div><div className="text-[11px] text-muted-foreground">{c.d}</div></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-2">
            <CardTitle className="text-base flex items-center gap-2 mr-auto"><Gavel className="h-4 w-4" />Registros</CardTitle>
            <div className="w-44"><Label className="text-xs">Órgão</Label>
              <Select value={orgao} onValueChange={(v) => setOrgao(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="todos">Todos</SelectItem>{(Object.keys(NOME_ORGAO) as Orgao[]).map((o) => <SelectItem key={o} value={o}>{NOME_ORGAO[o]}</SelectItem>)}
              </SelectContent></Select></div>
            <div className="w-48"><Label className="text-xs">Situação</Label>
              <Select value={sit} onValueChange={(v) => setSit(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="abertos">Em andamento</SelectItem><SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(VISIVEL) as SituacaoVisivel[]).map((s) => <SelectItem key={s} value={s}>{VISIVEL[s].texto}</SelectItem>)}
              </SelectContent></Select></div>
            <Button size="sm" onClick={() => setNovo("vazio")}><Plus className="h-4 w-4 mr-1" />Novo registro</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto space-y-2">
          <TableToolbar state={tabela} fileName="protesto-serasa" semColunas count={tabela.filteredRows.length}><div className="mr-auto text-xs">{th("documento")}</div></TableToolbar>
          <Table>
            <TableHeader><TableRow><TableHead>{th("cliente")}</TableHead><TableHead>{th("orgao")}</TableHead><TableHead>{th("situacao")}</TableHead><TableHead className="text-right">{th("valor")}</TableHead><TableHead>{th("datas")}</TableHead><TableHead>{th("protocolo")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {tabela.filteredRows.map(({ n, a }) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium"><button className="text-left hover:underline" onClick={() => { const c = lista.find((x) => x.documento === n.documento); if (c) onAbrirCliente(c.chave); }}>{n.cliente_nome ?? n.documento}</button><div className="text-[11px] text-muted-foreground">{n.documento}</div></TableCell>
                  <TableCell>{NOME_ORGAO[n.orgao]}</TableCell>
                  <TableCell><Badge variant="outline" className={VISIVEL[a.visivel].cls}>{VISIVEL[a.visivel].texto}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(n.valor))}{a.valorPago > 0 && <div className="text-[11px] text-emerald-700">pago {formatBRL(a.valorPago)}</div>}</TableCell>
                  <TableCell className="text-xs">
                    {n.data_envio && <div>Envio {formatDataBR(n.data_envio)}</div>}
                    {n.data_inclusao && <div>Inclusão {formatDataBR(n.data_inclusao)}</div>}
                    {n.data_baixa && <div>Baixa {formatDataBR(n.data_baixa)}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{n.protocolo ?? "—"}{n.cartorio && <div className="text-muted-foreground">{n.cartorio}</div>}</TableCell>
                  <TableCell className="text-right"><AcoesRegistro n={n} a={a} onEditar={() => setEditar(n)} onCarta={() => setCarta(n)} /></TableCell>
                </TableRow>
              ))}
              {!tabela.filteredRows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum registro.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Candidatos a negativar ou protestar <Badge variant="outline">{candidatos.length}</Badge>
          <span className="ml-auto font-normal text-muted-foreground">{formatBRL(candidatos.reduce((s, c) => s + c.valor, 0))}</span></CardTitle>
          <CardDescription>Atraso de {criterio.diasMinimo} dias ou mais e saldo a partir de {formatBRL(criterio.valorMinimo)}, sem registro em andamento, sem promessa em dia e sem acordo nos últimos 30 dias. Antes de incluir, confira se a cobrança foi feita e se o contrato prevê a negativação.</CardDescription></CardHeader>
        <CardContent className="space-y-1 max-h-80 overflow-y-auto">
          {candidatos.slice(0, 100).map((c) => (
            <div key={c.chave} className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 py-1">
              <button className="font-medium hover:underline text-left" onClick={() => onAbrirCliente(c.chave)}>{c.nome}</button>
              {c.situacao === "inativo" && <Badge variant="outline" className="border-red-500 text-red-700">Inativo</Badge>}
              <span className="text-muted-foreground">{formatBRL(c.valor)} · {c.qtd} fatura(s) · {c.diasMaisAntigo} dias{c.ultimaAcao ? ` · último contato ${formatDataBR(c.ultimaAcao.created_at.slice(0, 10))}` : " · sem contato registrado"}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setNovo(c)}>Registrar</Button>
            </div>
          ))}
          {!candidatos.length && <p className="text-sm text-muted-foreground">Nenhum candidato com esses critérios.</p>}
        </CardContent>
      </Card>

      {novo && <NegativacaoDialog cliente={novo === "vazio" ? null : novo} lista={lista} onFechar={() => setNovo(null)} />}
      {editar && <NegativacaoDialog neg={editar} lista={lista} onFechar={() => setEditar(null)} />}
      {carta && <CartaAnuenciaDialog n={carta} lancamentos={lancamentos} onFechar={() => setCarta(null)} />}
    </div>
  );
}

function useAtualizarNeg() {
  const qc = useQueryClient();
  return async (n: Negativacao, mud: Partial<Negativacao>, historico?: { tipo: string; texto: string }) => {
    const { error } = await fin.from("fin_negativacoes").update({ ...mud, updated_at: new Date().toISOString() }).eq("id", n.id);
    if (error) { toast.error(error.message); return false; }
    if (historico) await registrarHistorico(n, historico.tipo, historico.texto);
    ["fin-negativacoes", "fin-cobranca-acoes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    return true;
  };
}

function AcaoBaixa({ n }: { n: Negativacao }) {
  const atualizar = useAtualizarNeg();
  const [data, setData] = useState(hojeSP());
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setAberto(true)}><ShieldCheck className="h-4 w-4 mr-1" />Registrar baixa</Button>
      {aberto && (
        <Dialog open onOpenChange={(o) => !o && setAberto(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Baixa — {NOME_ORGAO[n.orgao]}</DialogTitle>
              <DialogDescription>{n.orgao === "protesto" ? "Registre quando o cancelamento do protesto foi feito (ou a carta de anuência entregue ao cliente)." : "Registre a data em que a baixa foi pedida no órgão."}</DialogDescription></DialogHeader>
            <div><Label>Data da baixa</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <DialogFooter><Button onClick={async () => { if (await atualizar(n, { situacao: "baixado", data_baixa: data }, { tipo: "baixa", texto: `Baixa ${NOME_ORGAO[n.orgao]} em ${formatDataBR(data)}` })) { toast.success("Baixa registrada."); setAberto(false); } }}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function AcoesRegistro({ n, a, onEditar, onCarta }: { n: Negativacao; a: AvaliacaoNeg; onEditar: () => void; onCarta: () => void }) {
  const atualizar = useAtualizarNeg();
  const hoje = hojeSP();
  const ehProtesto = n.orgao === "protesto";
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {n.situacao === "preparando" && <Button size="sm" variant="outline" onClick={() => atualizar(n, { situacao: "enviado", data_envio: n.data_envio ?? hoje }, { tipo: ehProtesto ? "protesto" : "negativacao", texto: `${ehProtesto ? "Apresentado ao cartório" : `Enviado ao ${NOME_ORGAO[n.orgao]}`} em ${formatDataBR(hoje)}` })}>{ehProtesto ? "Apresentado ao cartório" : "Marcar como enviado"}</Button>}
      {n.situacao === "enviado" && !a.quitado && <Button size="sm" variant="outline" onClick={() => atualizar(n, { situacao: "ativo", data_inclusao: n.data_inclusao ?? hoje }, { tipo: ehProtesto ? "protesto" : "negativacao", texto: `${ehProtesto ? "Protesto lavrado" : "Negativação incluída"} em ${formatDataBR(hoje)}` })}>{ehProtesto ? "Confirmar protesto" : "Confirmar inclusão"}</Button>}
      {(n.situacao === "ativo" || n.situacao === "enviado") && <AcaoBaixa n={n} />}
      {ehProtesto && n.situacao !== "cancelado" && n.situacao !== "preparando" && <Button size="sm" variant="ghost" onClick={onCarta}>Carta de anuência</Button>}
      <Button size="sm" variant="ghost" onClick={onEditar}>Editar</Button>
      {!["baixado", "cancelado"].includes(n.situacao) && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
        const motivo = window.prompt("Motivo do cancelamento (ex.: cliente pagou antes da inclusão, enviado por engano)");
        if (motivo == null) return;
        atualizar(n, { situacao: "cancelado", motivo_cancelamento: motivo || null } as any, { tipo: ehProtesto ? "protesto" : "negativacao", texto: `Registro cancelado${motivo ? `: ${motivo}` : ""}` });
      }}>Cancelar</Button>}
    </div>
  );
}

/** Novo registro (a partir de um cliente em atraso) ou edição. */
export function NegativacaoDialog({ cliente, neg, lista, onFechar }: { cliente?: ClienteInadimplente | null; neg?: Negativacao; lista: ClienteInadimplente[]; onFechar: () => void }) {
  const qc = useQueryClient();
  const [chave, setChave] = useState<string>(cliente?.chave ?? lista.find((c) => c.documento === neg?.documento)?.chave ?? "");
  const c = lista.find((x) => x.chave === chave) ?? null;
  const [f, setF] = useState<any>(() => neg ? { ...neg, valor: String(neg.valor).replace(".", ","), custo: neg.custo != null ? String(neg.custo).replace(".", ",") : "" } : {
    orgao: "serasa", situacao: "preparando", lancamento_ids: cliente?.faturas.map((x) => x.id) ?? [], data_envio: "", data_inclusao: "", protocolo: "", cartorio: "", cidade_uf: "", custo: "", observacao: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const faturas = c?.faturas ?? [];
  const selecionadas = faturas.filter((x) => (f.lancamento_ids as string[]).includes(x.id));
  const valorSel = selecionadas.reduce((s, x) => s + Number(x.valor), 0);

  const salvar = async () => {
    const documento = neg?.documento ?? c?.documento;
    if (!documento) { toast.error("Escolha um cliente com CPF/CNPJ."); return; }
    setBusy(true);
    try {
      const valor = neg && !c ? parseValorBR(f.valor) : (f.lancamento_ids.length ? valorSel : parseValorBR(f.valor));
      const payload: any = {
        documento, cliente_nome: neg?.cliente_nome ?? c?.nome ?? null, orgao: f.orgao, situacao: f.situacao,
        valor: valor || 0, lancamento_ids: f.lancamento_ids, data_envio: f.data_envio || null, data_inclusao: f.data_inclusao || null,
        protocolo: f.protocolo || null, cartorio: f.cartorio || null, cidade_uf: f.cidade_uf || null,
        custo: f.custo ? parseValorBR(f.custo) : null, data_quitacao: f.data_quitacao || null, observacao: f.observacao || null, updated_at: new Date().toISOString(),
      };
      const res = neg ? await fin.from("fin_negativacoes").update(payload).eq("id", neg.id) : await fin.from("fin_negativacoes").insert(payload);
      if (res.error) throw res.error;
      if (!neg) await registrarHistorico(payload, payload.orgao === "protesto" ? "protesto" : "negativacao", `Registro criado: ${NOME_ORGAO[payload.orgao as Orgao]} (${NOME_SITUACAO[payload.situacao as keyof typeof NOME_SITUACAO]}), ${formatBRL(payload.valor)}`);
      ["fin-negativacoes", "fin-cobranca-acoes"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(neg ? "Registro atualizado." : "Registro criado.");
      onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{neg ? "Editar registro" : "Novo registro de protesto / negativação"}</DialogTitle>
          <DialogDescription>O registro organiza o acompanhamento. A inclusão em si é feita no portal do órgão ou no cartório. A comunicação prévia ao cliente é feita pelo próprio órgão de proteção ao crédito.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          {!neg && (
            <div className="sm:col-span-2"><Label>Cliente</Label>
              <Select value={chave || "nenhum"} onValueChange={(v) => { setChave(v); const cc = lista.find((x) => x.chave === v); set("lancamento_ids", cc?.faturas.map((x) => x.id) ?? []); }}>
                <SelectTrigger><SelectValue placeholder="Escolha um cliente em atraso" /></SelectTrigger>
                <SelectContent>{lista.filter((x) => x.documento).slice(0, 300).map((x) => <SelectItem key={x.chave} value={x.chave}>{x.nome} · {formatBRL(x.valor)}</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div><Label>Órgão</Label>
            <Select value={f.orgao} onValueChange={(v) => set("orgao", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {(Object.keys(NOME_ORGAO) as Orgao[]).map((o) => <SelectItem key={o} value={o}>{NOME_ORGAO[o]}</SelectItem>)}
            </SelectContent></Select></div>
          <div><Label>Situação</Label>
            <Select value={f.situacao} onValueChange={(v) => set("situacao", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {Object.entries(NOME_SITUACAO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent></Select></div>
          {faturas.length > 0 ? (
            <div className="sm:col-span-2 space-y-1"><Label>Faturas incluídas ({formatBRL(valorSel)})</Label>
              <div className="rounded-md border p-2 max-h-40 overflow-y-auto space-y-1">
                {faturas.map((x) => (
                  <label key={x.id} className="flex items-center gap-2"><Checkbox checked={(f.lancamento_ids as string[]).includes(x.id)} onCheckedChange={(v) => set("lancamento_ids", v ? [...f.lancamento_ids, x.id] : f.lancamento_ids.filter((i: string) => i !== x.id))} />
                    venc. {formatDataBR(x.vencimento)} · {formatBRL(Number(x.valor))}</label>
                ))}
              </div></div>
          ) : (
            <div><Label>Valor (R$)</Label><Input value={f.valor ?? ""} onChange={(e) => set("valor", e.target.value)} /></div>
          )}
          <div><Label>{f.orgao === "protesto" ? "Apresentado ao cartório em" : "Enviado em"}</Label><Input type="date" value={f.data_envio ?? ""} onChange={(e) => set("data_envio", e.target.value)} /></div>
          <div><Label>{f.orgao === "protesto" ? "Protestado em" : "Incluído em"}</Label><Input type="date" value={f.data_inclusao ?? ""} onChange={(e) => set("data_inclusao", e.target.value)} /></div>
          <div><Label>Protocolo</Label><Input value={f.protocolo ?? ""} onChange={(e) => set("protocolo", e.target.value)} /></div>
          {f.orgao === "protesto" && <>
            <div><Label>Cartório</Label><Input value={f.cartorio ?? ""} onChange={(e) => set("cartorio", e.target.value)} placeholder="2º Tabelionato de Protesto" /></div>
            <div><Label>Cidade/UF</Label><Input value={f.cidade_uf ?? ""} onChange={(e) => set("cidade_uf", e.target.value)} /></div>
          </>}
          <div><Label>Custo (R$)</Label><Input value={f.custo ?? ""} onChange={(e) => set("custo", e.target.value)} placeholder="tarifa ou emolumentos" /></div>
          {neg && <div><Label>Quitação informada (se pago fora das faturas)</Label><Input type="date" value={f.data_quitacao ?? ""} onChange={(e) => set("data_quitacao", e.target.value)} /></div>}
          <div className="sm:col-span-2"><Label>Observação</Label><Textarea rows={2} value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onFechar}>Fechar</Button><Button onClick={salvar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CartaAnuenciaDialog({ n, lancamentos, onFechar }: { n: Negativacao; lancamentos: Lanc[]; onFechar: () => void }) {
  const atualizar = useAtualizarNeg();
  const emp = useQuery({ queryKey: ["fin-empresas"], queryFn: async () => (await fin.from("fin_empresas").select("*").order("codigo")).data ?? [] });
  const or = (emp.data ?? []).find((e: any) => e.codigo === "OR") ?? (emp.data ?? [])[0];
  const [cidade, setCidade] = useState(() => { try { return localStorage.getItem("fin-carta-cidade") ?? ""; } catch { return ""; } });
  const faturas = lancamentos.filter((l) => n.lancamento_ids.includes(l.id)).map((l) => ({ vencimento: l.vencimento, valor: Number(l.valor), numero: l.numero_documento }));
  const imprimir = async () => {
    try { localStorage.setItem("fin-carta-cidade", cidade); } catch { /* sem armazenamento */ }
    const t = textoCartaAnuencia({
      credor: { nome: or?.nome ?? "Online Rastreamento Ltda", cnpj: or?.cnpj ?? null, cidade: cidade || null },
      devedor: { nome: n.cliente_nome ?? n.documento, documento: n.documento }, neg: n, faturas, hoje: hojeSP(),
    });
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const w = window.open("", "_blank");
    if (!w) { toast.error("O navegador bloqueou a janela de impressão."); return; }
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Carta de anuência — ${esc(n.cliente_nome ?? n.documento)}</title>
      <style>body{font-family:Georgia,serif;font-size:12pt;line-height:1.6;max-width:16cm;margin:2.5cm auto;color:#111}h1{text-align:center;font-size:14pt;letter-spacing:.08em;margin-bottom:2em}p{text-align:justify;margin:0 0 1.2em}.ass{margin-top:4em;text-align:center}.linha{border-top:1px solid #111;width:10cm;margin:0 auto .3em}@media print{body{margin:0 auto}}</style></head><body>
      <h1>${esc(t.titulo)}</h1>${t.paragrafos.map((p) => `<p>${esc(p)}</p>`).join("")}<p>${esc(t.local)}</p>
      <div class="ass"><div class="linha"></div>${esc(or?.nome ?? "Online Rastreamento Ltda")}<br/>Representante legal<br/><small>(assinatura com firma reconhecida)</small></div>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
    await atualizar(n, { anuencia_emitida_em: new Date().toISOString() } as any, { tipo: "anuencia", texto: "Carta de anuência emitida" });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Carta de anuência</DialogTitle>
          <DialogDescription>Abre a carta pronta para imprimir. Ela precisa ser assinada pelo representante da empresa com firma reconhecida (ou enviada pela plataforma eletrônica dos cartórios). Confira o texto com o jurídico antes do primeiro uso.</DialogDescription></DialogHeader>
        <div className="space-y-2 text-sm">
          <div>Credor: <b>{or?.nome ?? "—"}</b>{or?.cnpj ? ` · ${or.cnpj}` : ""}</div>
          <div>Devedor: <b>{n.cliente_nome ?? n.documento}</b> · {n.documento}</div>
          <div>{faturas.length} título(s) · protocolo {n.protocolo ?? "não informado"}</div>
          {n.anuencia_emitida_em && <div className="text-muted-foreground">Já emitida em {new Date(n.anuencia_emitida_em).toLocaleDateString("pt-BR")}.</div>}
          <div><Label>Cidade (local da assinatura)</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Belo Horizonte" /></div>
        </div>
        <DialogFooter><Button onClick={imprimir}><FileText className="h-4 w-4 mr-1" />Abrir para imprimir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bloco no detalhe do cliente (aba Inadimplência). */
export function NegativacoesCliente({ cliente, lista, lancamentos }: { cliente: ClienteInadimplente; lista: ClienteInadimplente[]; lancamentos: Lanc[] }) {
  const q = useNegativacoes();
  const [novo, setNovo] = useState(false);
  const hoje = hojeSP();
  const lancs = useMemo(() => mapaLancs(lancamentos), [lancamentos]);
  if (q.error) return null;
  const doCliente = (q.data ?? []).filter((n) => n.documento === cliente.documento);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><div className="text-sm font-medium flex items-center gap-1"><Gavel className="h-4 w-4" />Protesto e Serasa</div>
        {cliente.documento && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-1" />Registrar</Button>}</div>
      {doCliente.length ? doCliente.map((n) => {
        const a = avaliarNegativacao(n, lancs, hoje);
        return (
          <div key={n.id} className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 pb-1">
            <Badge variant="outline" className={VISIVEL[a.visivel].cls}>{VISIVEL[a.visivel].texto}</Badge>
            <span>{NOME_ORGAO[n.orgao]} · {formatBRL(Number(n.valor))}</span>
            {n.data_inclusao && <span className="text-muted-foreground">desde {formatDataBR(n.data_inclusao)}</span>}
            {a.prazoBaixa && <span className="text-muted-foreground">baixa até {formatDataBR(a.prazoBaixa)}</span>}
          </div>
        );
      }) : <p className="text-sm text-muted-foreground">Nenhum registro.</p>}
      {novo && <NegativacaoDialog cliente={cliente} lista={lista} onFechar={() => setNovo(false)} />}
    </div>
  );
}

/** Documentos com negativação/protesto em vigor (para os selos da lista de clientes). */
export function useDocsNegativados(): Map<string, Orgao[]> {
  const q = useNegativacoes();
  return useMemo(() => {
    const m = new Map<string, Orgao[]>();
    for (const n of q.data ?? []) if (emVigor(n)) (m.get(n.documento) ?? m.set(n.documento, []).get(n.documento)!).push(n.orgao);
    return m;
  }, [q.data]);
}
