import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Loader2, Mail, RefreshCw, Upload, Paperclip, Calculator, ChevronDown, ChevronRight, Download, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDataBR } from "@/lib/finance";
import { lerPlanilhaDda, type ItemDda } from "@/lib/finance-fornecedores";
import { conferirLancamentoFn, decidirAprovacaoFn, importarDdaFn, lerEmailAgoraFn, statusEmailFinanceiroFn } from "@/lib/finance-fornecedores.functions";
import { fin, useFinInvalidate, type Lanc } from "./use-fin";
import { useAbrirAnexo } from "./lancamentos-tab";
import { TIPO_EVIDENCIA, useFornecedores } from "./fornecedores-tab";

const dh = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");

export function AprovacoesTab({ lancamentos }: { lancamentos: Lanc[] }) {
  const invalidate = useFinInvalidate();
  const abrirAnexo = useAbrirAnexo();
  const decidir = useServerFn(decidirAprovacaoFn);
  const conferir = useServerFn(conferirLancamentoFn);
  const forn = useFornecedores();
  const fornNome = (id?: string | null) => forn.data?.find((f) => f.id === id)?.nome;
  const pend = useMemo(() => lancamentos.filter((l) => l.tipo === "pagar" && l.aprovacao === "pendente" && l.status !== "cancelado")
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento))), [lancamentos]);
  const [sel, setSel] = useState<string[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [reprovar, setReprovar] = useState<string[] | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: evidPorLanc = {} } = useQuery({
    queryKey: ["fin-evidencias-pend", pend.map((p) => p.id).join(",")],
    enabled: pend.length > 0,
    queryFn: async () => {
      const ids = pend.map((p) => p.id);
      const out: Record<string, any[]> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await fin.from("fin_evidencias").select("*").in("lancamento_id", ids.slice(i, i + 200)).order("created_at");
        for (const e of data || []) (out[e.lancamento_id] ??= []).push(e);
      }
      return out;
    },
  });

  const aprovar = async (ids: string[]) => {
    setBusy(true);
    try { await decidir({ data: { ids, decisao: "aprovado" } }); toast.success(`${ids.length} conta(s) aprovada(s) para pagamento.`); setSel([]); invalidate(); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao aprovar."); }
    finally { setBusy(false); }
  };
  const confirmarReprovar = async () => {
    if (!reprovar) return;
    setBusy(true);
    try { await decidir({ data: { ids: reprovar, decisao: "reprovado", obs: motivo } }); toast.success("Reprovado."); setReprovar(null); setMotivo(""); setSel([]); invalidate(); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao reprovar."); }
    finally { setBusy(false); }
  };
  const reconferir = async (id: string) => {
    try { await conferir({ data: { id } }); toast.success("Conferência refeita."); invalidate(); } catch (e: any) { toast.error(e?.message ?? "Falha."); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Aguardando aprovação para pagamento ({pend.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" disabled={!sel.length || busy} onClick={() => aprovar(sel)}><Check className="h-4 w-4 mr-1" />Aprovar ({sel.length})</Button>
            <Button size="sm" variant="outline" disabled={!sel.length || busy} onClick={() => setReprovar(sel)}><X className="h-4 w-4 mr-1" />Reprovar</Button>
          </div>
        </CardHeader>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"><Checkbox checked={pend.length > 0 && sel.length === pend.length} onCheckedChange={(v) => setSel(v ? pend.map((p) => p.id) : [])} /></TableHead>
            <TableHead className="w-6" /><TableHead>Vencimento</TableHead><TableHead>Fornecedor</TableHead><TableHead className="text-right">Cobrado</TableHead><TableHead className="text-right">Esperado</TableHead><TableHead>Conferência</TableHead><TableHead>Alertas</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {!pend.length && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Nada aguardando aprovação.</TableCell></TableRow>}
            {pend.map((l) => {
              const ev = evidPorLanc[l.id] ?? [];
              const c = l.conferencia;
              return (
                <Fragment key={l.id}>
                  <TableRow>
                    <TableCell><Checkbox checked={sel.includes(l.id)} onCheckedChange={(v) => setSel((x) => (v ? [...x, l.id] : x.filter((i) => i !== l.id)))} /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setAberto(aberto === l.id ? null : l.id)}>{aberto === l.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDataBR(l.vencimento)}</TableCell>
                    <TableCell className="text-xs"><b>{fornNome(l.fornecedor_id) ?? l.contraparte ?? "—"}</b>{!l.fornecedor_id && <Badge variant="outline" className="ml-1 text-[10px]">sem cadastro</Badge>}<div className="text-muted-foreground truncate max-w-[220px]">{l.descricao}</div></TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{formatBRL(l.valor)}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">{l.valor_esperado != null ? formatBRL(l.valor_esperado) : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {!c || c.status === "sem_regra" ? <span className="text-muted-foreground">sem regra</span>
                        : c.status === "ok" ? <Badge variant="outline" className="border-emerald-500 text-emerald-700">confere</Badge>
                        : <Badge variant="outline" className={c.status === "acima" ? "border-red-500 text-red-700" : "border-amber-500 text-amber-700"}>{c.status === "acima" ? "↑" : "↓"} {formatBRL(Math.abs(c.diferenca ?? 0))} ({c.pct?.toLocaleString("pt-BR")}%)</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{ev.filter((e) => e.tipo !== "aprovacao").map((e) => <Badge key={e.id} variant="outline" className="mr-1 text-[10px] border-red-400 text-red-700" title={e.descricao}><ShieldAlert className="h-3 w-3 mr-0.5" />{TIPO_EVIDENCIA[e.tipo] ?? e.tipo}</Badge>)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(l.arquivo_path || l.arquivo_url) && <Button size="icon" variant="ghost" className="h-7 w-7" title="Abrir anexo" onClick={() => abrirAnexo(l)}><Paperclip className="h-4 w-4" /></Button>}
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Aprovar" disabled={busy} onClick={() => aprovar([l.id])}><Check className="h-4 w-4 text-emerald-600" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Reprovar" disabled={busy} onClick={() => setReprovar([l.id])}><X className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                  {aberto === l.id && (
                    <TableRow><TableCell colSpan={9} className="bg-muted/40 text-xs space-y-2">
                      {c?.itens?.length ? (
                        <div><b>Memória de cálculo{c.mes ? ` — competência ${c.mes.split("-").reverse().join("/")}` : ""}</b>
                          {c.itens.map((i, k) => <div key={k}>{i.descricao}: {i.quantidade} × {formatBRL(i.unitario)} = <b>{formatBRL(i.subtotal)}</b> <span className="text-muted-foreground">({i.fonte})</span></div>)}
                        </div>
                      ) : <div className="text-muted-foreground">Sem regra de cobrança para calcular o esperado. Cadastre o fornecedor e a regra na aba Fornecedores.</div>}
                      {c?.anteriores && <div>Média das cobranças anteriores: <b>{formatBRL(c.anteriores.media)}</b> ({c.anteriores.pct > 0 ? "+" : ""}{c.anteriores.pct.toLocaleString("pt-BR")}%)</div>}
                      {ev.map((e) => <div key={e.id}>• <b>{e.titulo}</b>: {e.descricao}</div>)}
                      {l.observacao && <div className="text-muted-foreground">{l.observacao}</div>}
                      {l.fornecedor_id && <Button size="sm" variant="outline" className="h-7" onClick={() => reconferir(l.id)}><Calculator className="h-3.5 w-3.5 mr-1" />Conferir de novo</Button>}
                    </TableCell></TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <EmailCard />
        <DdaCard />
      </div>
      <EvidenciasCard />

      <Dialog open={!!reprovar} onOpenChange={(o) => !o && setReprovar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reprovar {reprovar?.length} conta(s)</DialogTitle></DialogHeader>
          <Label>Motivo</Label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cobrou 12 veículos a mais; pedir nota corrigida." />
          <DialogFooter><Button variant="outline" onClick={() => setReprovar(null)}>Cancelar</Button><Button variant="destructive" disabled={!motivo.trim() || busy} onClick={confirmarReprovar}>Reprovar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailCard() {
  const qc = useQueryClient();
  const invalidate = useFinInvalidate();
  const testar = useServerFn(statusEmailFinanceiroFn);
  const ler = useServerFn(lerEmailAgoraFn);
  const { data: cfg, error } = useQuery({ queryKey: ["fin-email-config"], retry: false, queryFn: async () => { const r = await fin.from("fin_email_config").select("*").eq("id", 1).maybeSingle(); if (r.error) throw r.error; return r.data; } });
  const { data: msgs = [] } = useQuery({ queryKey: ["fin-email-msgs"], queryFn: async () => ((await fin.from("fin_email_mensagens").select("*").order("recebido_em", { ascending: false }).limit(30)).data || []) as any[] });
  const [x, setX] = useState<any>(null);
  const [teste, setTeste] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (cfg) setX({ ...cfg, ler_desde: String(cfg.ler_desde).slice(0, 10) }); }, [cfg]);

  if (error) return <Card><CardContent className="p-3 text-sm text-destructive">E-mail do financeiro: {(error as Error).message}. Confira se a migração 0065 foi aplicada.</CardContent></Card>;
  if (!x) return <Card><CardContent className="p-3"><Loader2 className="h-4 w-4 animate-spin" /></CardContent></Card>;

  const salvar = async () => {
    setBusy("salvar");
    const { error: e } = await fin.from("fin_email_config").update({ ativo: x.ativo, mailbox: x.mailbox.trim(), connection_key: x.connection_key, ler_desde: `${x.ler_desde}T00:00:00-03:00`, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(null);
    if (e) toast.error(e.message); else { toast.success("Configuração do e-mail salva."); qc.invalidateQueries({ queryKey: ["fin-email-config"] }); }
  };
  const doTestar = async () => {
    setBusy("testar");
    try { setTeste(await testar({ data: { mailbox: x.mailbox.trim(), connectionKey: x.connection_key } })); } catch (e: any) { toast.error(e?.message ?? "Falha."); }
    finally { setBusy(null); }
  };
  const doLer = async () => {
    setBusy("ler");
    try {
      const r: any = await ler();
      if (!r.ok) toast.error(r.motivo ?? "Leitura desligada.");
      else toast.success(`${r.lidos} e-mail(s) lido(s): ${r.lancados} lançado(s), ${r.ignorados} sem cobrança, ${r.erros} com erro${r.mais ? ". Há mais: clique de novo." : "."}`);
      qc.invalidateQueries({ queryKey: ["fin-email-msgs"] }); qc.invalidateQueries({ queryKey: ["fin-email-config"] }); invalidate();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao ler o e-mail."); }
    finally { setBusy(null); }
  };
  const resumo = cfg?.ultimo_resumo;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />E-mail do financeiro
        <Switch className="ml-auto" checked={!!x.ativo} onCheckedChange={(v) => setX({ ...x, ativo: v })} /></CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">A cada 30 minutos o sistema lê os e-mails com anexo dessa caixa: XML de nota fiscal é lido direto; PDF e imagem de boleto ou fatura passam pela leitura automática. Cada cobrança entra em Contas a pagar como "A revisar", ligada ao fornecedor, conferida e aguardando aprovação. Os e-mails não são marcados como lidos nem apagados.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2"><Label className="text-xs">Caixa</Label><Input className="h-8" value={x.mailbox} onChange={(e) => setX({ ...x, mailbox: e.target.value })} /></div>
          <div><Label className="text-xs">Ler e-mails a partir de</Label><Input type="date" className="h-8" value={x.ler_desde} onChange={(e) => setX({ ...x, ler_desde: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Conta Microsoft conectada</Label>
            <Select value={x.connection_key} onValueChange={(v) => setX({ ...x, connection_key: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{[...new Set([x.connection_key, ...(teste?.chaves ?? [])])].map((k: string) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>
        {teste && <p className={`text-xs ${teste.ok ? "text-emerald-700" : "text-destructive"}`}>{teste.ok ? `Conectado como ${teste.conta}; ${teste.recentes} e-mail(s) com anexo nos últimos 7 dias.` : teste.erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={salvar} disabled={!!busy}>{busy === "salvar" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
          <Button size="sm" variant="outline" onClick={doTestar} disabled={!!busy}>{busy === "testar" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Testar caixa</Button>
          <Button size="sm" variant="outline" onClick={doLer} disabled={!!busy}>{busy === "ler" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Ler agora</Button>
        </div>
        <p className="text-xs text-muted-foreground">Última leitura: {dh(cfg?.ultima_leitura_em)}{resumo ? ` · ${resumo.lancados} lançado(s), ${resumo.ignorados} ignorado(s), ${resumo.erros} erro(s)` : ""}</p>
        <div className="max-h-56 overflow-y-auto rounded border divide-y text-xs">
          {msgs.map((m) => (
            <div key={m.id} className="px-2 py-1">
              <Badge variant={m.status === "erro" ? "destructive" : "outline"} className="mr-1 text-[10px]">{({ lancado: "lançado", ignorado: "ignorado", duplicado: "duplicado", erro: "erro" } as any)[m.status]}</Badge>
              <b>{m.assunto || "(sem assunto)"}</b> <span className="text-muted-foreground">— {m.remetente} · {dh(m.recebido_em)}{m.motivo ? ` · ${m.motivo}` : ""}</span>
            </div>
          ))}
          {!msgs.length && <p className="p-2 text-muted-foreground">Nenhum e-mail lido ainda.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function DdaCard() {
  const invalidate = useFinInvalidate();
  const importar = useServerFn(importarDdaFn);
  const ref = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<ItemDda[] | null>(null);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  const ler = async (file?: File) => {
    if (!file) return;
    try {
      const XLSX: any = await import("@/vendor/xlsx/xlsx.mjs");
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: false, raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
      const r = lerPlanilhaDda(matriz);
      if (!r.itens.length) { toast.error("Não encontrei as colunas de beneficiário, vencimento e valor nessa planilha."); return; }
      setItens(r.itens); setNome(file.name); setRes(null);
    } catch (e: any) { toast.error(e?.message ?? "Não foi possível ler a planilha."); }
    finally { if (ref.current) ref.current.value = ""; }
  };
  const enviar = async () => {
    if (!itens) return;
    setBusy(true);
    try { const r = await importar({ data: { itens } }); setRes(r); setItens(null); invalidate(); toast.success("DDA conferido."); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao importar."); }
    finally { setBusy(false); }
  };
  const total = (itens ?? []).reduce((s, i) => s + i.valor, 0);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">DDA do banco (boletos emitidos contra o CNPJ)</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">No internet banking (Itaú, Bradesco ou Inter), exporte a lista de boletos do DDA em Excel ou CSV e envie aqui. O sistema confere com as contas a pagar: boleto do DDA sem cobrança vira conta "aguardando aprovação"; boleto recebido por e-mail que não está no DDA vira alerta (pode ser boleto falso).</p>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => ler(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => ref.current?.click()}><Upload className="h-4 w-4 mr-1" />Enviar planilha do DDA</Button>
        {itens && (
          <div className="rounded border p-2 space-y-2">
            <p className="text-xs"><b>{nome}</b>: {itens.length} boleto(s), {formatBRL(total)}, vencimentos de {formatDataBR(itens.map((i) => i.vencimento!).sort()[0])} a {formatDataBR(itens.map((i) => i.vencimento!).sort().pop()!)}.</p>
            <div className="max-h-40 overflow-y-auto text-xs divide-y">{itens.slice(0, 100).map((i) => <div key={i.chave}>{formatDataBR(i.vencimento)} · {i.beneficiario || i.documento} · <b>{formatBRL(i.valor)}</b></div>)}</div>
            <Button size="sm" onClick={enviar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Conferir com as contas a pagar</Button>
          </div>
        )}
        {res && <p className="text-xs">{res.casados} boleto(s) já estavam lançados e foram confirmados no DDA · {res.criados} novo(s) lançado(s) para aprovação · <span className={res.foraDoDda ? "text-destructive font-medium" : ""}>{res.foraDoDda} boleto(s) lançado(s) que não estão no DDA</span>.</p>}
      </CardContent>
    </Card>
  );
}

function EvidenciasCard() {
  const [tipo, setTipo] = useState("all");
  const { data: evid = [], error } = useQuery({
    queryKey: ["fin-evidencias-todas", tipo],
    retry: false,
    queryFn: async () => {
      let q = fin.from("fin_evidencias").select("*").order("created_at", { ascending: false }).limit(300);
      if (tipo !== "all") q = q.eq("tipo", tipo);
      const r = await q; if (r.error) throw r.error; return (r.data || []) as any[];
    },
  });
  const exportar = () => {
    const linhas = [["data", "tipo", "titulo", "descricao"], ...evid.map((e) => [new Date(e.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), TIPO_EVIDENCIA[e.tipo] ?? e.tipo, e.titulo, e.descricao ?? ""])];
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `evidencias-financeiro-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  if (error) return null;
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
        <CardTitle className="text-sm flex-1">Evidências</CardTitle>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os tipos</SelectItem>{Object.entries(TIPO_EVIDENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={exportar} disabled={!evid.length}><Download className="h-4 w-4 mr-1" />Exportar</Button>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto space-y-1 text-xs">
        {evid.map((e) => (
          <div key={e.id} className="border-b pb-1"><span className="text-muted-foreground">{dh(e.created_at)}</span> <Badge variant="outline" className="text-[10px]">{TIPO_EVIDENCIA[e.tipo] ?? e.tipo}</Badge> <b>{e.titulo}</b> — {e.descricao}</div>
        ))}
        {!evid.length && <p className="text-muted-foreground">Nenhuma evidência registrada.</p>}
      </CardContent>
    </Card>
  );
}
