import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcularDre, fluxoDeCaixa, formatBRL, formatDataBR, hojeSP, mesDe } from "@/lib/finance";
import type { Cat, Conta, Lanc } from "./use-fin";

export function FluxoTab({ lancamentos, contas }: { lancamentos: Lanc[]; contas: Conta[] }) {
  const hoje = hojeSP();
  const [agr, setAgr] = useState<"dia" | "semana" | "mes">("semana");
  const [de, setDe] = useState(mesDe(hoje));
  const [ate, setAte] = useState("");
  const saldoInicial = contas.filter((c) => c.ativo).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);
  const pontos = useMemo(() => fluxoDeCaixa(lancamentos, agr, saldoInicial, de || undefined, ate || undefined), [lancamentos, agr, saldoInicial, de, ate]);
  const rotulo = (p: string) => (agr === "mes" ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : agr === "semana" ? `Semana de ${formatDataBR(p)}` : formatDataBR(p));
  const max = Math.max(1, ...pontos.map((p) => Math.max(p.entradas, p.saidas)));

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
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="w-[30%]" />
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pontos.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem movimentos no período.</TableCell></TableRow>}
            {pontos.map((p) => (
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
  const [mes, setMes] = useState(mesDe(hojeSP()));
  const dre = useMemo(() => calcularDre(lancamentos, categorias, mes), [lancamentos, categorias, mes]);
  const variacao = (a: number, b: number) => (b ? `${(((a - b) / Math.abs(b)) * 100).toFixed(0)}%` : "—");
  const linhas = (tipo: "receita" | "despesa") => dre.linhas.filter((l) => l.tipo === tipo);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex items-center gap-2 text-sm">
          <span>Competência</span>
          <Input type="month" className="w-[170px]" value={mes.slice(0, 7)} onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)} />
          <span className="text-muted-foreground text-xs">Comparado com o mês anterior. Lançamentos cancelados ficam fora.</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">DRE gerencial</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Mês</TableHead><TableHead className="text-right">Mês anterior</TableHead><TableHead className="text-right">Variação</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {(["receita", "despesa"] as const).map((tipo) => (
              <Fragment key={tipo}>
                <TableRow key={`h-${tipo}`} className="bg-muted/40"><TableCell colSpan={4} className="font-semibold">{tipo === "receita" ? "Receitas" : "Despesas"}</TableCell></TableRow>
                {linhas(tipo).length === 0 && <TableRow key={`e-${tipo}`}><TableCell colSpan={4} className="text-muted-foreground text-sm">Nada lançado.</TableCell></TableRow>}
                {linhas(tipo).map((l) => (
                  <TableRow key={`${tipo}-${l.grupo}`}>
                    <TableCell className="pl-6">{l.grupo}</TableCell>
                    <TableCell className="text-right">{formatBRL(l.atual)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatBRL(l.anterior)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{variacao(l.atual, l.anterior)}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-semibold">Resultado (receitas − despesas)</TableCell>
              <TableCell className={`text-right font-bold ${dre.resultadoAtual < 0 ? "text-destructive" : "text-emerald-600"}`}>{formatBRL(dre.resultadoAtual)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{formatBRL(dre.resultadoAnterior)}</TableCell>
              <TableCell className="text-right text-muted-foreground">{variacao(dre.resultadoAtual, dre.resultadoAnterior)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
