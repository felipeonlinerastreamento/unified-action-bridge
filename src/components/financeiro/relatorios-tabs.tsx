import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcularDreMensal, fluxoDeCaixa, formatBRL, formatDataBR, hojeSP, mesAnterior, mesDe, mesesDoAno, type RegimeDre } from "@/lib/finance";
import type { Cat, Conta, Lanc } from "./use-fin";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

export function FluxoTab({ lancamentos, contas }: { lancamentos: Lanc[]; contas: Conta[] }) {
  const hoje = hojeSP();
  const [agr, setAgr] = useState<"dia" | "semana" | "mes">("semana");
  const [de, setDe] = useState(mesDe(hoje));
  const [ate, setAte] = useState("");
  const saldoInicial = contas.filter((c) => c.ativo).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
  const pontos = useMemo(() => fluxoDeCaixa(lancamentos, agr, saldoInicial, de || undefined, ate || undefined), [lancamentos, agr, saldoInicial, de, ate]);
  const rotulo = (p: string) => (agr === "mes" ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : agr === "semana" ? `Semana de ${formatDataBR(p)}` : formatDataBR(p));
  const max = Math.max(1, ...pontos.map((p) => Math.max(p.entradas, p.saidas)));
  type Ponto = (typeof pontos)[number];
  const colunas: TableColumn<Ponto>[] = [
    { id: "periodo", label: "Período", value: (p) => rotulo(p.periodo) },
    { id: "entradas", label: "Entradas", value: (p) => p.entradas },
    { id: "saidas", label: "Saídas", value: (p) => p.saidas },
    { id: "saldo", label: "Saldo", value: (p) => p.saldo },
    { id: "negativo", label: "Saldo negativo", value: (p) => (p.saldo < 0 ? "Sim" : "Não") },
  ];
  const tabela = useTableColumns("fin-fluxo", colunas, pontos);
  const th = (id: string) => <ColumnFilterHeader column={colunas.find((c) => c.id === id)!} state={tabela} />;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm">
          <Select value={agr} onValueChange={(v) => setAgr(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Por dia</SelectItem>
              <SelectItem value="semana">Por semana</SelectItem>
              <SelectItem value="mes">Por mês</SelectItem>
            </SelectContent>
          </Select>
          <span>de</span><Input type="date" className="w-[150px]" value={de} onChange={(e) => setDe(e.target.value)} />
          <span>até</span><Input type="date" className="w-[150px]" value={ate} onChange={(e) => setAte(e.target.value)} />
          <span className="ml-auto text-muted-foreground">Saldo inicial das contas: <b className="text-foreground">{formatBRL(saldoInicial)}</b></span>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Pagos entram na data do pagamento; em aberto entram no vencimento (projeção). Cancelados não entram.</p>
      <TableToolbar state={tabela} fileName="fluxo-de-caixa" semColunas><div className="mr-auto text-xs">{th("negativo")}</div></TableToolbar>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{th("periodo")}</TableHead>
              <TableHead className="text-right">{th("entradas")}</TableHead>
              <TableHead className="text-right">{th("saidas")}</TableHead>
              <TableHead className="w-[30%]" />
              <TableHead className="text-right">{th("saldo")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pontos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem movimentos no período.</TableCell></TableRow>}
            {tabela.filteredRows.map((p) => (
              <TableRow key={p.periodo}>
                <TableCell>{rotulo(p.periodo)}</TableCell>
                <TableCell className="text-right text-emerald-600">{formatBRL(p.entradas)}</TableCell>
                <TableCell className="text-right text-destructive">{formatBRL(p.saidas)}</TableCell>
                <TableCell>
                  <div className="h-1.5 rounded bg-emerald-500/70 mb-0.5" style={{ width: `${(p.entradas / max) * 100}%` }} />
                  <div className="h-1.5 rounded bg-destructive/70" style={{ width: `${(p.saidas / max) * 100}%` }} />
                </TableCell>
                <TableCell className={`text-right font-semibold ${p.saldo < 0 ? "text-destructive" : ""}`}>{formatBRL(p.saldo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function DreTab({ lancamentos, categorias }: { lancamentos: Lanc[]; categorias: Cat[] }) {
  const hoje = hojeSP();
  const [visao, setVisao] = useState<"mes" | "ano">("mes");
  const [regime, setRegime] = useState<RegimeDre>("competencia");
  const [mes, setMes] = useState(mesDe(hoje));
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));

  // Visão mês: mês escolhido x mês anterior, no regime escolhido.
  const mensal = useMemo(() => calcularDreMensal(lancamentos, categorias, [mesAnterior(mes), mes], regime), [lancamentos, categorias, mes, regime]);
  const anual = useMemo(() => calcularDreMensal(lancamentos, categorias, mesesDoAno(ano), regime), [lancamentos, categorias, ano, regime]);
  const variacao = (a: number, b: number) => (b ? `${(((a - b) / Math.abs(b)) * 100).toFixed(0)}%` : "—");
  const nomeMes = (m: string) => ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m.slice(5, 7)) - 1];

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm">
          <Select value={visao} onValueChange={(v) => setVisao(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="mes">Mês a mês</SelectItem><SelectItem value="ano">Ano (12 meses)</SelectItem></SelectContent>
          </Select>
          {visao === "mes" ? (
            <Input type="month" className="w-[170px]" value={mes.slice(0, 7)} onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)} />
          ) : (
            <Input type="number" className="w-[110px]" value={ano} onChange={(e) => setAno(Number(e.target.value) || ano)} />
          )}
          <Select value={regime} onValueChange={(v) => setRegime(v as RegimeDre)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="competencia">Regime de competência</SelectItem>
              <SelectItem value="caixa">Regime de caixa (pagos)</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">
            {regime === "competencia" ? "Pelo mês de competência de cada lançamento." : "Só o que foi pago/recebido, pela data do pagamento."} Cancelados ficam fora.
          </span>
        </CardContent>
      </Card>

      {visao === "mes" ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">DRE gerencial · {nomeMes(mes)}/{mes.slice(0, 4)}</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Mês</TableHead><TableHead className="text-right">Mês anterior</TableHead><TableHead className="text-right">Variação</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(["receita", "despesa"] as const).map((tipo) => (
                <Fragment key={tipo}>
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-semibold">{tipo === "receita" ? "Receitas" : "Despesas"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL((tipo === "receita" ? mensal.receitas : mensal.despesas)[1])}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatBRL((tipo === "receita" ? mensal.receitas : mensal.despesas)[0])}</TableCell>
                    <TableCell />
                  </TableRow>
                  {mensal.linhas.filter((l) => l.tipo === tipo).map((l) => (
                    <TableRow key={`${tipo}-${l.grupo}`}>
                      <TableCell className="pl-6">{l.grupo}</TableCell>
                      <TableCell className="text-right">{formatBRL(l.valores[1])}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatBRL(l.valores[0])}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{variacao(l.valores[1], l.valores[0])}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              <TableRow className="border-t-2">
                <TableCell className="font-semibold">Resultado (receitas − despesas)</TableCell>
                <TableCell className={`text-right font-bold ${mensal.resultado[1] < 0 ? "text-destructive" : "text-emerald-600"}`}>{formatBRL(mensal.resultado[1])}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatBRL(mensal.resultado[0])}</TableCell>
                <TableCell className="text-right text-muted-foreground">{variacao(mensal.resultado[1], mensal.resultado[0])}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <CardHeader className="pb-2"><CardTitle className="text-sm">DRE gerencial · {ano}</CardTitle></CardHeader>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Grupo</TableHead>
                {anual.meses.map((m) => <TableHead key={m} className="text-right">{nomeMes(m)}</TableHead>)}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["receita", "despesa"] as const).map((tipo) => {
                const tot = tipo === "receita" ? anual.receitas : anual.despesas;
                return (
                  <Fragment key={tipo}>
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>{tipo === "receita" ? "Receitas" : "Despesas"}</TableCell>
                      {tot.map((v, i) => <TableCell key={i} className="text-right">{v ? formatBRL(v) : "—"}</TableCell>)}
                      <TableCell className="text-right">{formatBRL(tot.reduce((a, b) => a + b, 0))}</TableCell>
                    </TableRow>
                    {anual.linhas.filter((l) => l.tipo === tipo).map((l) => (
                      <TableRow key={`${tipo}-${l.grupo}`}>
                        <TableCell className="pl-6">{l.grupo}</TableCell>
                        {l.valores.map((v, i) => <TableCell key={i} className="text-right">{v ? formatBRL(v) : "—"}</TableCell>)}
                        <TableCell className="text-right font-medium">{formatBRL(l.total)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Resultado</TableCell>
                {anual.resultado.map((v, i) => <TableCell key={i} className={`text-right ${v < 0 ? "text-destructive" : ""}`}>{v ? formatBRL(v) : "—"}</TableCell>)}
                <TableCell className="text-right">{formatBRL(anual.resultado.reduce((a, b) => a + b, 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
