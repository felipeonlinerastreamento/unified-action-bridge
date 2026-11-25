import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Search, Settings2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL } from "@/lib/finance";
import { faixaMargem, type ConfigMargem } from "@/lib/margem-cliente";
import { margemPorClienteFn, salvarConfigMargemFn } from "@/lib/margem.functions";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

const CAMPOS: { k: keyof ConfigMargem; label: string; ajuda: string }[] = [
  { k: "custo_chip_mensal", label: "Custo do chip por mês (R$)", ajuda: "Por equipamento com chip." },
  { k: "vida_util_meses", label: "Vida útil do equipamento (meses)", ajuda: "Depreciação: valor de aquisição ÷ meses." },
  { k: "custo_equipamento_padrao", label: "Valor do equipamento sem cadastro (R$)", ajuda: "Usado quando o GSystem não tem 'Valor Aquisição'." },
  { k: "custo_visita", label: "Custo por visita técnica (R$)", ajuda: "Serviço técnico concluído (média dos últimos 90 dias)." },
  { k: "custo_chamado", label: "Custo por chamado de atendimento (R$)", ajuda: "Horas da equipe por chamado (média dos últimos 90 dias)." },
  { k: "imposto_pct", label: "Impostos sobre o faturamento (%)", ajuda: "Simples/ISS etc. Deixe 0 para ignorar." },
];

export function MargemTab() {
  const qc = useQueryClient();
  const ler = useServerFn(margemPorClienteFn);
  const q = useQuery({ queryKey: ["fin-margem"], queryFn: () => ler(), staleTime: 5 * 60_000 });
  const [busca, setBusca] = useState("");
  const [faixa, setFaixa] = useState<"todas" | "prejuizo" | "apertada">("todas");
  const [config, setConfig] = useState(false);

  const linhas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data?.linhas ?? []).filter((l) =>
      (!t || `${l.nome} ${l.documento}`.toLowerCase().includes(t)) && (faixa === "todas" || faixaMargem(l) === faixa));
  }, [q.data, busca, faixa]);

  type LinhaM = (typeof linhas)[number];
  const colunas = useMemo<TableColumn<LinhaM>[]>(() => [
    { id: "cliente", label: "Cliente", value: (l) => l.nome },
    { id: "classe", label: "Classe", value: (l) => l.classe },
    { id: "veiculos", label: "Veíc./chips", value: (l) => l.veiculos },
    { id: "receita", label: "Receita", value: (l) => l.receita },
    { id: "chips", label: "Chips", value: (l) => l.chips },
    { id: "equip", label: "Equip.", value: (l) => l.equipamentos },
    { id: "visitas", label: "Visitas", value: (l) => l.visitas },
    { id: "atend", label: "Atend.", value: (l) => l.atendimento },
    { id: "impostos", label: "Impostos", value: (l) => l.impostos },
    { id: "margem", label: "Margem", value: (l) => l.margem },
    { id: "risco", label: "Risco", value: (l) => l.risco_nota ?? null },
  ], []);
  const tabela = useTableColumns("fin-margem", colunas, linhas);
  const th = (id: string) => <ColumnFilterHeader column={colunas.find((c) => c.id === id)!} state={tabela} />;

  const tot = useMemo(() => {
    const ls = q.data?.linhas ?? [];
    const receita = ls.reduce((s, l) => s + l.receita, 0);
    const custo = ls.reduce((s, l) => s + l.custo_total, 0);
    return {
      receita, custo, margem: receita - custo,
      pct: receita > 0 ? Math.round(((receita - custo) / receita) * 1000) / 10 : 0,
      prejuizo: ls.filter((l) => faixaMargem(l) === "prejuizo").length,
      apertada: ls.filter((l) => faixaMargem(l) === "apertada").length,
    };
  }, [q.data]);

  const exportar = async () => {
    const XLSX: any = await import("@/vendor/xlsx/xlsx.mjs");
    const rows = linhas.map((l) => ({
      Cliente: l.nome, Documento: l.documento, Classe: l.classe, Veículos: l.veiculos, Chips: l.chips_qtd,
      "Visitas 90d": l.visitas_90d, "Chamados 90d": l.chamados_90d, Receita: l.receita, "Custo chips": l.chips,
      "Custo equipamentos": l.equipamentos, "Custo visitas": l.visitas, "Custo atendimento": l.atendimento,
      Impostos: l.impostos, "Custo total": l.custo_total, Margem: l.margem, "Margem %": l.margem_pct ?? "", "Risco cancelamento": l.risco_nota ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Margem");
    XLSX.writeFile(wb, `margem-por-cliente.xlsx`);
  };

  if (q.isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculando a margem de cada cliente…</div>;
  if (q.error) return <p className="text-sm text-destructive">Erro: {(q.error as Error).message} (se for a primeira vez, aplique a migração 0078).</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Margem mensal = receita (média das faturas dos últimos 3 meses) − chips − depreciação dos equipamentos − visitas técnicas − atendimento − impostos.
          Equipamentos e chips vêm do espelho do GSystem; chamados e visitas, dos últimos 90 dias.
          {q.data && q.data.semVinculo > 0 ? ` ${q.data.semVinculo} equipamento(s) com cliente que não bateu com a carteira ficaram de fora.` : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfig(true)}><Settings2 className="h-4 w-4 mr-1" />Custos</Button>
          <Button variant="outline" onClick={exportar} disabled={linhas.length === 0}><Download className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Receita mensal</div><div className="text-xl font-semibold">{formatBRL(tot.receita)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Custo mensal estimado</div><div className="text-xl font-semibold">{formatBRL(tot.custo)}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Margem total</div><div className="text-xl font-semibold">{formatBRL(tot.margem)} <span className="text-sm text-muted-foreground">({tot.pct}%)</span></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Clientes no prejuízo / margem &lt; 20%</div><div className="text-xl font-semibold"><span className="text-destructive">{tot.prejuizo}</span> / <span className="text-amber-600">{tot.apertada}</span></div></CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar cliente ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button size="sm" variant={faixa === "todas" ? "default" : "outline"} onClick={() => setFaixa("todas")}>Todos</Button>
        <Button size="sm" variant={faixa === "prejuizo" ? "default" : "outline"} onClick={() => setFaixa("prejuizo")}>Prejuízo</Button>
        <Button size="sm" variant={faixa === "apertada" ? "default" : "outline"} onClick={() => setFaixa("apertada")}>Margem &lt; 20%</Button>
      </div>
      <TableToolbar state={tabela} fileName="margem-por-cliente" semColunas count={tabela.filteredRows.length}>
        <div className="mr-auto flex items-center gap-4 text-xs">{th("classe")}</div>
      </TableToolbar>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{th("cliente")}</TableHead><TableHead className="text-right">{th("veiculos")}</TableHead><TableHead className="text-right">{th("receita")}</TableHead>
            <TableHead className="text-right">{th("chips")}</TableHead><TableHead className="text-right">{th("equip")}</TableHead><TableHead className="text-right">{th("visitas")}</TableHead>
            <TableHead className="text-right">{th("atend")}</TableHead><TableHead className="text-right">{th("impostos")}</TableHead><TableHead className="text-right">{th("margem")}</TableHead><TableHead>{th("risco")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {tabela.filteredRows.slice(0, 500).map((l) => {
              const f = faixaMargem(l);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}<div className="text-[11px] text-muted-foreground">Classe {l.classe} · {l.visitas_90d} visita(s) e {l.chamados_90d} chamado(s) em 90 dias</div></TableCell>
                  <TableCell className="text-right">{l.veiculos}/{l.chips_qtd}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(l.receita)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(l.chips)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(l.equipamentos)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(l.visitas)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(l.atendimento)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatBRL(l.impostos)}</TableCell>
                  <TableCell className={`text-right whitespace-nowrap font-medium ${f === "prejuizo" ? "text-destructive" : f === "apertada" ? "text-amber-600" : "text-emerald-700"}`}>
                    {formatBRL(l.margem)}{l.margem_pct != null && <div className="text-[11px]">{l.margem_pct}%</div>}
                  </TableCell>
                  <TableCell>{l.risco_nota != null ? <Badge variant={l.risco_nota >= 60 ? "destructive" : "outline"}>{l.risco_nota}</Badge> : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      {linhas.length > 500 && <p className="text-xs text-muted-foreground">Mostrando 500 de {linhas.length} (os de menor margem primeiro). Use a busca ou o Excel.</p>}
      {config && q.data && <ConfigDialog atual={q.data.config} onClose={() => setConfig(false)} onSalvo={() => qc.invalidateQueries({ queryKey: ["fin-margem"] })} />}
    </div>
  );
}

function ConfigDialog({ atual, onClose, onSalvo }: { atual: ConfigMargem; onClose: () => void; onSalvo: () => void }) {
  const salvar = useServerFn(salvarConfigMargemFn);
  const [v, setV] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setV(Object.fromEntries(CAMPOS.map((c) => [c.k, String(atual[c.k])]))); }, [atual]);
  const ok = async () => {
    setSalvando(true);
    try {
      const num = (k: keyof ConfigMargem) => Number(String(v[k] ?? "").replace(",", "."));
      await salvar({ data: {
        custo_chip_mensal: num("custo_chip_mensal"), vida_util_meses: Math.round(num("vida_util_meses")),
        custo_equipamento_padrao: num("custo_equipamento_padrao"), custo_visita: num("custo_visita"),
        custo_chamado: num("custo_chamado"), imposto_pct: num("imposto_pct"),
      } });
      toast.success("Custos salvos. Recalculando a margem…");
      onSalvo(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Valores inválidos."); }
    finally { setSalvando(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Custos usados na margem</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {CAMPOS.map((c) => (
            <div key={c.k} className="space-y-1">
              <Label>{c.label}</Label>
              <Input inputMode="decimal" value={v[c.k] ?? ""} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">{c.ajuda}</p>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={ok} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
