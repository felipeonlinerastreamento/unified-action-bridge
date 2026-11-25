import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Link2, Undo2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDataBR, parseCsvExtrato, parseOfx, sugerirConciliacao } from "@/lib/finance";
import { fin, useFinInvalidate, type Conta, type Emp, type Lanc } from "./use-fin";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

type Item = { id: string; conta_bancaria_id: string; data: string; valor: number; descricao: string | null; fit_id: string | null; lancamento_id: string | null };

export function ConciliacaoTab({ lancamentos, contas, empresas }: { lancamentos: Lanc[]; contas: Conta[]; empresas: Emp[] }) {
  const invalidate = useFinInvalidate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [contaId, setContaId] = useState<string>("");
  const [novaConta, setNovaConta] = useState("");
  const [busy, setBusy] = useState(false);
  const [mostrar, setMostrar] = useState<"pendentes" | "conciliados">("pendentes");
  const conta = contaId || contas[0]?.id || "";

  const { data: itens = [], refetch } = useQuery({
    queryKey: ["fin-extrato", conta],
    enabled: !!conta,
    queryFn: async () => {
      const { data } = await fin.from("fin_extrato_itens").select("*").eq("conta_bancaria_id", conta).order("data", { ascending: false }).limit(2000);
      return (data || []) as Item[];
    },
  });

  const conciliados = useMemo(() => new Set(itens.map((i) => i.lancamento_id).filter(Boolean) as string[]), [itens]);
  const lancById = useMemo(() => new Map(lancamentos.map((l) => [l.id, l])), [lancamentos]);
  const candidatos = useMemo(() => lancamentos.map((l) => ({ ...l, ja_conciliado: conciliados.has(l.id) })), [lancamentos, conciliados]);
  const base = useMemo(() => itens.filter((i) => (mostrar === "pendentes" ? !i.lancamento_id : !!i.lancamento_id)), [itens, mostrar]);
  const lancTxt = (i: Item) => {
    const l = i.lancamento_id ? lancById.get(i.lancamento_id) : null;
    if (l) return `${l.contraparte ?? l.descricao ?? "—"} · venc. ${formatDataBR(l.vencimento)}`;
    const sug = sugerirConciliacao({ data: i.data, valor: Number(i.valor), descricao: i.descricao ?? "" }, candidatos);
    const s2 = sug ? lancById.get(sug.lancamentoId) : null;
    return s2 ? `Sugestão: ${s2.contraparte ?? s2.descricao ?? "—"}` : "Sem correspondência";
  };
  const colunas = useMemo<TableColumn<Item>[]>(() => [
    { id: "data", label: "Data", value: (i) => formatDataBR(i.data) },
    { id: "historico", label: "Histórico do banco", value: (i) => i.descricao ?? "" },
    { id: "valor", label: "Valor", value: (i) => Number(i.valor) },
    { id: "sentido", label: "Sentido", value: (i) => (Number(i.valor) < 0 ? "Saída" : "Entrada") },
    { id: "lancamento", label: "Lançamento", value: lancTxt },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [lancById, candidatos]);
  const tabela = useTableColumns("fin-conciliacao", colunas, base);
  const visiveis = tabela.filteredRows;
  const th = (id: string) => <ColumnFilterHeader column={colunas.find((c) => c.id === id)!} state={tabela} />;

  const criarConta = async () => {
    if (!novaConta.trim()) return;
    const { data, error } = await fin.from("fin_contas_bancarias").insert({ nome: novaConta.trim(), empresa_id: empresas.find((e) => e.codigo === "OR")?.id ?? null }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setNovaConta(""); setContaId(data.id); invalidate();
  };

  const importar = async (file?: File) => {
    if (!file || !conta) return;
    setBusy(true);
    try {
      const texto = await file.text();
      const lidos = /\.ofx$/i.test(file.name) || /<OFX>/i.test(texto) ? parseOfx(texto) : parseCsvExtrato(texto);
      if (!lidos.length) throw new Error("Não encontrei movimentos nesse arquivo (use OFX ou CSV com data, histórico e valor).");
      const rows = lidos.map((x) => ({
        conta_bancaria_id: conta, data: x.data, valor: x.valor, descricao: x.descricao, documento: x.documento ?? null,
        fit_id: x.fit_id ?? `${x.data}|${x.valor}|${x.descricao}`.slice(0, 200),
      }));
      const { error } = await fin.from("fin_extrato_itens").upsert(rows, { onConflict: "conta_bancaria_id,fit_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      toast.success(`${rows.length} movimento(s) lido(s). Repetidos são ignorados.`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const conciliar = async (item: Item, lancId: string) => {
    const l = lancById.get(lancId);
    const { data: u } = await fin.auth.getUser();
    const { error } = await fin.from("fin_extrato_itens").update({ lancamento_id: lancId, conciliado_em: new Date().toISOString(), conciliado_por: u?.user?.id ?? null }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    if (l && l.status === "aberto") {
      await fin.from("fin_lancamentos").update({ status: "pago", data_pagamento: item.data, valor_pago: Math.abs(item.valor), conta_bancaria_id: item.conta_bancaria_id }).eq("id", l.id);
    }
    toast.success("Conciliado.");
    refetch(); invalidate();
  };
  const desfazer = async (item: Item) => {
    const { error } = await fin.from("fin_extrato_itens").update({ lancamento_id: null, conciliado_em: null, conciliado_por: null }).eq("id", item.id);
    if (error) toast.error(error.message); else { refetch(); }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm">
          <Select value={conta} onValueChange={setContaId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
            <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}{c.banco ? ` · ${c.banco}` : ""}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="w-[200px]" placeholder="Nova conta (ex.: Santander PJ)" value={novaConta} onChange={(e) => setNovaConta(e.target.value)} />
          <Button variant="outline" size="sm" onClick={criarConta} disabled={!novaConta.trim()}><Plus className="h-4 w-4 mr-1" />Criar conta</Button>
          <input ref={fileRef} type="file" accept=".ofx,.csv,.txt" className="hidden" onChange={(e) => importar(e.target.files?.[0])} />
          <Button size="sm" className="ml-auto" disabled={!conta || busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}Importar extrato (OFX/CSV)
          </Button>
        </CardContent>
      </Card>

      {!conta ? (
        <p className="text-sm text-muted-foreground">Crie uma conta bancária para importar o extrato.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <Button size="sm" variant={mostrar === "pendentes" ? "default" : "outline"} onClick={() => setMostrar("pendentes")}>Pendentes <Badge variant="secondary" className="ml-1">{itens.filter((i) => !i.lancamento_id).length}</Badge></Button>
            <Button size="sm" variant={mostrar === "conciliados" ? "default" : "outline"} onClick={() => setMostrar("conciliados")}>Conciliados</Button>
            <div className="ml-auto flex items-center gap-3 text-xs">{th("sentido")}<TableToolbar state={tabela} fileName="conciliacao" semColunas count={visiveis.length} /></div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow><TableHead>{th("data")}</TableHead><TableHead>{th("historico")}</TableHead><TableHead className="text-right">{th("valor")}</TableHead><TableHead>{th("lancamento")}</TableHead><TableHead className="w-10" /></TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nada aqui.</TableCell></TableRow>}
                {visiveis.map((i) => {
                  const lig = i.lancamento_id ? lancById.get(i.lancamento_id) : null;
                  const sug = !i.lancamento_id ? sugerirConciliacao({ data: i.data, valor: Number(i.valor), descricao: i.descricao ?? "" }, candidatos) : null;
                  const s = sug ? lancById.get(sug.lancamentoId) : null;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-nowrap">{formatDataBR(i.data)}</TableCell>
                      <TableCell className="max-w-[320px] truncate" title={i.descricao ?? ""}>{i.descricao}</TableCell>
                      <TableCell className={`text-right font-medium ${Number(i.valor) < 0 ? "text-destructive" : "text-emerald-600"}`}>{formatBRL(i.valor)}</TableCell>
                      <TableCell className="text-sm">
                        {lig ? `${lig.contraparte ?? lig.descricao ?? "—"} · venc. ${formatDataBR(lig.vencimento)}`
                          : s ? <span>Sugestão: <b>{s.contraparte ?? s.descricao ?? "—"}</b> · venc. {formatDataBR(s.vencimento)}</span>
                          : <span className="text-muted-foreground">Sem correspondência</span>}
                      </TableCell>
                      <TableCell>
                        {lig ? <Button size="sm" variant="ghost" onClick={() => desfazer(i)} title="Desfazer"><Undo2 className="h-4 w-4" /></Button>
                          : s ? <Button size="sm" variant="outline" onClick={() => conciliar(i, s.id)}><Link2 className="h-4 w-4 mr-1" />Confirmar</Button>
                          : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="text-xs text-muted-foreground">A sugestão busca o mesmo valor, o mesmo sentido (saída = a pagar, entrada = a receber), data até 5 dias e nome parecido. Ao confirmar, o lançamento em aberto vira pago na data do extrato.</p>
        </>
      )}
    </div>
  );
}
