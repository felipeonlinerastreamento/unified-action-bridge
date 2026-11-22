import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Check, Download, Copy, Landmark, CalendarClock, Paperclip, ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDataBR, hojeSP } from "@/lib/finance";
import { dataPlanejada, linhaLote, montarAgenda, saldoProjetado, semana } from "@/lib/finance-agenda";
import { useAuth } from "@/hooks/use-auth";
import { fin, useFinInvalidate, type Conta, type Lanc } from "./use-fin";
import { useAbrirAnexo } from "./lancamentos-tab";

const DIA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const nomeDia = (iso: string) => DIA_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Financeiro › Agenda de pagamentos: o que pagar em cada dia, por conta bancária, para pagar em lote. */
export function AgendaTab({ lancamentos, contas }: { lancamentos: Lanc[]; contas: Conta[] }) {
  const { user } = useAuth();
  const invalidate = useFinInvalidate();
  const abrirAnexo = useAbrirAnexo();
  const hoje = hojeSP();
  const [desloc, setDesloc] = useState(0);
  const [livre, setLivre] = useState<{ de: string; ate: string } | null>(null);
  const per = livre ?? semana(hoje, desloc);
  const [sel, setSel] = useState<string[]>([]);
  const [dlg, setDlg] = useState<"conta" | "data" | "pagar" | null>(null);
  const [valorDlg, setValorDlg] = useState("");
  const [busy, setBusy] = useState(false);

  const agenda = useMemo(() => montarAgenda(lancamentos, per.de, per.ate, hoje), [lancamentos, per.de, per.ate, hoje]);
  const contaNome = (id: string | null) => (id ? contas.find((c) => c.id === id)?.nome ?? "Conta removida" : "Sem conta definida");
  const todos = agenda.dias.flatMap((d) => d.contas.flatMap((c) => c.itens));
  const selecionados = todos.filter((l) => sel.includes(l.id));
  const totalSel = selecionados.reduce((s, l) => s + Number(l.valor || 0), 0);

  // Alertas de boleto fora do DDA ou de valor divergente nas contas da agenda.
  const ids = todos.map((l) => l.id).join(",");
  const { data: alertas = {} } = useQuery({
    queryKey: ["fin-agenda-alertas", ids],
    enabled: todos.length > 0,
    queryFn: async () => {
      const out: Record<string, string[]> = {};
      const lista = todos.map((l) => l.id);
      for (let i = 0; i < lista.length; i += 200) {
        const { data } = await fin.from("fin_evidencias").select("lancamento_id, tipo, titulo").in("lancamento_id", lista.slice(i, i + 200)).in("tipo", ["boleto_fora_dda", "valor_divergente", "aumento_valor"]);
        for (const e of data || []) (out[e.lancamento_id] ??= []).push(e.titulo);
      }
      return out;
    },
  });

  // Saldo projetado de cada conta ao fim de cada dia.
  const projecao = useMemo(() => {
    const pag = new Map<string, number>();
    for (const d of agenda.dias) for (const c of d.contas) if (c.contaId) pag.set(`${d.data}|${c.contaId}`, (pag.get(`${d.data}|${c.contaId}`) ?? 0) + c.total);
    const datas = agenda.dias.map((d) => d.data);
    const out: Record<string, Record<string, number>> = {};
    for (const c of contas.filter((x) => x.ativo !== false)) out[c.id] = saldoProjetado(c, lancamentos, datas, pag, hoje);
    return out;
  }, [agenda, contas, lancamentos, hoje]);

  const toggle = (id: string, v: boolean) => setSel((x) => (v ? [...new Set([...x, id])] : x.filter((i) => i !== id)));
  const toggleGrupo = (itens: Lanc[], v: boolean) => setSel((x) => (v ? [...new Set([...x, ...itens.map((l) => l.id)])] : x.filter((i) => !itens.some((l) => l.id === i))));

  const atualizar = async (patch: Record<string, unknown>, msg: string) => {
    setBusy(true);
    const { error } = await fin.from("fin_lancamentos").update(patch).in("id", sel);
    setBusy(false);
    if (error) { toast.error(/data_programada|programado/.test(error.message) ? "A migração 0066 ainda não foi aplicada." : error.message); return false; }
    toast.success(msg); invalidate(); setDlg(null);
    return true;
  };
  const definirConta = () => atualizar({ conta_bancaria_id: valorDlg || null }, `${sel.length} conta(s) para pagar pela conta ${contaNome(valorDlg || null)}.`);
  const programar = () => atualizar({ data_programada: valorDlg || null, programado_por: user?.id ?? null, programado_em: new Date().toISOString() }, valorDlg ? `${sel.length} conta(s) programada(s) para ${formatDataBR(valorDlg)}.` : "Programação removida: volta a valer o vencimento.");
  const pagar = async () => {
    const data = valorDlg || hoje;
    setBusy(true);
    let ok = 0;
    for (const l of selecionados) {
      const { error } = await fin.from("fin_lancamentos").update({ status: "pago", data_pagamento: data, valor_pago: l.valor }).eq("id", l.id);
      if (error) { toast.error(`${l.contraparte ?? ""}: ${error.message}`); continue; }
      ok++;
      await fin.from("fin_evidencias").insert({ lancamento_id: l.id, fornecedor_id: l.fornecedor_id ?? null, tipo: "pagamento", titulo: "Pago pela agenda de pagamentos",
        descricao: `${l.contraparte ?? ""} ${formatBRL(l.valor)} pago em ${formatDataBR(data)} pela conta ${contaNome(l.conta_bancaria_id)}.`,
        dados: { valor: l.valor, data_pagamento: data, conta_bancaria_id: l.conta_bancaria_id, aprovacao: l.aprovacao ?? null, vencimento: l.vencimento } }).then(() => undefined, () => undefined);
    }
    setBusy(false);
    toast.success(`${ok} conta(s) marcada(s) como paga(s) em ${formatDataBR(data)}.`);
    setSel([]); setDlg(null); invalidate();
  };

  const exportar = async () => {
    const itens = selecionados.length ? selecionados : todos;
    if (!itens.length) { toast.error("Nada para exportar."); return; }
    const XLSX: any = await import("@/vendor/xlsx/xlsx.mjs");
    const ordenado = [...itens].sort((a, b) => contaNome(a.conta_bancaria_id).localeCompare(contaNome(b.conta_bancaria_id)) || String(dataPlanejada(a)).localeCompare(String(dataPlanejada(b))));
    const ws = XLSX.utils.json_to_sheet(ordenado.map((l) => linhaLote(l, contaNome(l.conta_bancaria_id))));
    ws["!cols"] = [{ wch: 11 }, { wch: 11 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 52 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    XLSX.writeFile(wb, `agenda-pagamentos-${per.de}-a-${per.ate}.xlsx`);
  };
  const copiarCodigos = async () => {
    const linhas = selecionados.filter((l) => l.linha_digitavel).map((l) => `${l.contraparte ?? ""}\t${formatBRL(l.valor)}\t${l.linha_digitavel}`);
    if (!linhas.length) { toast.error("Nenhum dos marcados tem linha digitável."); return; }
    try { await navigator.clipboard.writeText(linhas.join("\n")); toast.success(`${linhas.length} código(s) copiado(s).`); } catch { toast.error("Não foi possível copiar."); }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-3 flex flex-wrap items-end gap-2">
        <CalendarDays className="h-5 w-5 mb-1.5" />
        <Button size="icon" variant="outline" onClick={() => { setLivre(null); setDesloc(desloc - 1); }}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant={!livre && desloc === 0 ? "default" : "outline"} onClick={() => { setLivre(null); setDesloc(0); }}>Esta semana</Button>
        <Button variant={!livre && desloc === 1 ? "default" : "outline"} onClick={() => { setLivre(null); setDesloc(1); }}>Próxima</Button>
        <Button size="icon" variant="outline" onClick={() => { setLivre(null); setDesloc(desloc + 1); }}><ChevronRight className="h-4 w-4" /></Button>
        <div><Label className="text-xs">De</Label><Input type="date" className="h-9 w-[150px]" value={per.de} onChange={(e) => e.target.value && setLivre({ de: e.target.value, ate: per.ate < e.target.value ? e.target.value : per.ate })} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" className="h-9 w-[150px]" value={per.ate} min={per.de} onChange={(e) => e.target.value && setLivre({ de: per.de, ate: e.target.value })} /></div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">A pagar no período</p>
          <p className="text-xl font-semibold">{formatBRL(agenda.total)}</p>
        </div>
      </CardContent></Card>

      {contas.filter((c) => c.ativo !== false).length > 0 && agenda.dias.length > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {contas.filter((c) => c.ativo !== false).map((c) => {
            const p = projecao[c.id] ?? {};
            const fim = p[agenda.dias[agenda.dias.length - 1].data];
            const minimo = Math.min(...Object.values(p));
            const aPagar = agenda.dias.reduce((s, d) => s + (d.contas.find((g) => g.contaId === c.id)?.total ?? 0), 0);
            return (
              <Card key={c.id} className={minimo < 0 ? "border-destructive" : ""}><CardContent className="p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Landmark className="h-3.5 w-3.5" />{c.nome}</p>
                <p className="text-sm">A pagar: <b>{formatBRL(aPagar)}</b></p>
                <p className={`text-xs ${minimo < 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>Saldo estimado no fim: {fim != null ? formatBRL(fim) : "—"}{minimo < 0 ? " · fica negativo" : ""}</p>
              </CardContent></Card>
            );
          })}
        </div>
      )}

      {sel.length > 0 && (
        <Card className="border-primary/40 bg-primary/5"><CardContent className="p-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium px-1">{sel.length} marcada(s) · {formatBRL(totalSel)}</span>
          <Button size="sm" onClick={() => { setValorDlg(hoje); setDlg("pagar"); }}><Check className="h-4 w-4 mr-1" />Marcar como pagas</Button>
          <Button size="sm" variant="outline" onClick={() => { setValorDlg(""); setDlg("conta"); }}><Landmark className="h-4 w-4 mr-1" />Pagar pela conta…</Button>
          <Button size="sm" variant="outline" onClick={() => { setValorDlg(hoje); setDlg("data"); }}><CalendarClock className="h-4 w-4 mr-1" />Programar data</Button>
          <Button size="sm" variant="outline" onClick={copiarCodigos}><Copy className="h-4 w-4 mr-1" />Copiar códigos</Button>
          <Button size="sm" variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar lote</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSel([])}>Limpar</Button>
        </CardContent></Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Pagamentos de {formatDataBR(per.de)} a {formatDataBR(per.ate)}</CardTitle>
          {!sel.length && todos.length > 0 && <Button size="sm" variant="outline" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar tudo</Button>}
        </CardHeader>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"><Checkbox checked={todos.length > 0 && sel.length === todos.length} onCheckedChange={(v) => setSel(v ? todos.map((l) => l.id) : [])} /></TableHead>
            <TableHead>Favorecido</TableHead><TableHead>Descrição</TableHead><TableHead>Vencimento</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {agenda.dias.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum pagamento aprovado no período.</TableCell></TableRow>}
            {agenda.dias.map((d) => (
              <Fragment key={`${d.data}-${d.atrasado}`}>
                <TableRow className={d.atrasado ? "bg-destructive/10" : "bg-muted/60"}>
                  <TableCell><Checkbox checked={d.contas.every((c) => c.itens.every((l) => sel.includes(l.id)))} onCheckedChange={(v) => toggleGrupo(d.contas.flatMap((c) => c.itens), !!v)} /></TableCell>
                  <TableCell colSpan={4} className="font-semibold">{d.atrasado ? "Atrasadas (pagar hoje)" : `${formatDataBR(d.data)} · ${nomeDia(d.data)}${d.data === hoje ? " · hoje" : ""}`}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(d.total)}</TableCell><TableCell />
                </TableRow>
                {d.contas.map((g) => (
                  <Fragment key={`${d.data}-${g.contaId}`}>
                    <TableRow>
                      <TableCell><Checkbox checked={g.itens.every((l) => sel.includes(l.id))} onCheckedChange={(v) => toggleGrupo(g.itens, !!v)} /></TableCell>
                      <TableCell colSpan={4} className={`text-xs ${g.contaId ? "text-muted-foreground" : "text-amber-700"}`}><Landmark className="h-3.5 w-3.5 inline mr-1" />{contaNome(g.contaId)} · {g.itens.length} pagamento(s)
                        {g.contaId && projecao[g.contaId]?.[d.data] != null && <span className={projecao[g.contaId][d.data] < 0 ? "text-destructive ml-2" : "ml-2"}>saldo estimado depois: {formatBRL(projecao[g.contaId][d.data])}</span>}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(g.total)}</TableCell><TableCell />
                    </TableRow>
                    {g.itens.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="pl-6"><Checkbox checked={sel.includes(l.id)} onCheckedChange={(v) => toggle(l.id, !!v)} /></TableCell>
                        <TableCell className="text-sm font-medium">{l.contraparte ?? "—"}{l.aprovacao === "aprovado" && <Badge variant="outline" className="ml-2 text-[10px] border-emerald-500 text-emerald-700">aprovado</Badge>}
                          {(alertas[l.id] ?? []).map((a, i) => <Badge key={i} variant="outline" className="ml-1 text-[10px] border-red-400 text-red-700" title={a}><ShieldAlert className="h-3 w-3 mr-0.5" />{a}</Badge>)}</TableCell>
                        <TableCell className="text-xs max-w-[240px] truncate" title={l.descricao ?? ""}>{l.descricao ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDataBR(l.vencimento)}{l.data_programada && l.data_programada !== l.vencimento && <span className="text-muted-foreground"> (programado {formatDataBR(l.data_programada)})</span>}</TableCell>
                        <TableCell className="text-xs">{l.linha_digitavel ? "boleto" : l.tipo_documento ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{formatBRL(l.valor)}</TableCell>
                        <TableCell>{(l.arquivo_path || l.arquivo_url) && <Button size="icon" variant="ghost" className="h-7 w-7" title="Abrir anexo" onClick={() => abrirAnexo(l)}><Paperclip className="h-4 w-4" /></Button>}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      {(agenda.aguardando.length > 0 || agenda.reprovadas > 0) && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fora da agenda: {agenda.aguardando.length} aguardando aprovação ({formatBRL(agenda.totalAguardando)}){agenda.reprovadas ? ` · ${agenda.reprovadas} reprovada(s)` : ""}</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {agenda.aguardando.slice(0, 30).map((l) => <div key={l.id}>{formatDataBR(dataPlanejada(l))} · <b>{l.contraparte ?? "—"}</b> · {formatBRL(l.valor)}</div>)}
            <p className="text-muted-foreground pt-1">Aprove na aba Aprovações para entrarem na agenda.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dlg === "pagar" ? `Marcar ${sel.length} conta(s) como pagas` : dlg === "conta" ? "Pagar pela conta" : "Programar pagamento"}</DialogTitle></DialogHeader>
          {dlg === "conta" ? (
            <Select value={valorDlg || "none"} onValueChange={(v) => setValorDlg(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem conta definida</SelectItem>{contas.filter((c) => c.ativo !== false).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div><Label className="text-xs">{dlg === "pagar" ? "Data do pagamento" : "Pagar em (vazio volta para o vencimento)"}</Label><Input type="date" value={valorDlg} onChange={(e) => setValorDlg(e.target.value)} /></div>
          )}
          {dlg === "pagar" && <p className="text-xs text-muted-foreground">Total {formatBRL(totalSel)}. Cada pagamento fica registrado nas evidências. Se o extrato for importado depois, a conciliação reconhece estes pagamentos.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>Cancelar</Button>
            <Button disabled={busy} onClick={dlg === "pagar" ? pagar : dlg === "conta" ? definirConta : programar}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
