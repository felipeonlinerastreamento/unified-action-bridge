import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis, Legend, Tooltip,
} from "recharts";
import { ArrowDown, ArrowUp, Minus, Printer, ThumbsUp, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";
import {
  DEF, DIMENSOES, METRICAS, PESOS_PADRAO, comparacaoMedia, formatarValor, mediaEquipe,
  type Boletim, type Dimensao, type MetricaId, type ValoresOperador,
} from "@/lib/operator-scorecard";
import { formatDuration } from "@/lib/operator-metrics";

export type Semana = { semana: string; resolvidos: number; tmaMs: number | null; tmprMs: number | null; csat: number | null };
export type PorCategoria = { categoria: string; qtd: number; tmaMs: number | null; tmaEquipeMs: number | null };
export type PorHora = { hora: number; qtd: number };

const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];
const COR_QUADRANTE: Record<string, string> = { Referência: "default", Pressa: "secondary", Cuidadoso: "outline", Atenção: "destructive" };

/** Pesos da nota composta, guardados no navegador. */
export function usePesos() {
  const chave = "desempenho-pesos";
  const [pesos, setPesos] = useState<Record<Dimensao, number>>(PESOS_PADRAO);
  useEffect(() => {
    try { const r = localStorage.getItem(chave); if (r) setPesos({ ...PESOS_PADRAO, ...JSON.parse(r) }); } catch { /* ignore */ }
  }, []);
  const salvar = (p: Record<Dimensao, number>) => { setPesos(p); try { localStorage.setItem(chave, JSON.stringify(p)); } catch { /* ignore */ } };
  return [pesos, salvar] as const;
}

function Seta({ c }: { c: ReturnType<typeof comparacaoMedia> }) {
  if (c === "melhor") return <ArrowUp className="h-3.5 w-3.5 text-green-600" />;
  if (c === "pior") return <ArrowDown className="h-3.5 w-3.5 text-destructive" />;
  if (c === "igual") return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
}

function corNota(n: number | null | undefined) {
  if (n == null) return "text-muted-foreground";
  return n >= 70 ? "text-green-600" : n >= 40 ? "text-amber-600" : "text-destructive";
}

// ---------------------------------------------------------------------------
export function BoletimIndividual({ boletins, valores, detalhe, operadorId, onOperador }: {
  boletins: Boletim[];
  valores: ValoresOperador[];
  detalhe: (id: string) => { semanas: Semana[]; categorias: PorCategoria[]; horas: PorHora[] };
  operadorId: string;
  onOperador: (id: string) => void;
}) {
  const media = useMemo(() => mediaEquipe(valores), [valores]);
  const ordenados = [...boletins].sort((a, b) => a.operatorName.localeCompare(b.operatorName));
  const b = boletins.find((x) => x.operatorId === operadorId) ?? null;
  const d = useMemo(() => (b ? detalhe(b.operatorId) : null), [b, detalhe]);
  const posicao = b && b.nota != null
    ? [...boletins].filter((x) => x.nota != null).sort((x, y) => y.nota! - x.nota!).findIndex((x) => x.operatorId === b.operatorId) + 1
    : null;
  const comNota = boletins.filter((x) => x.nota != null).length;
  const cfg: ChartConfig = { resolvidos: { label: "Finalizados", color: CORES[0] }, tma: { label: "TMA (h)", color: CORES[1] }, csat: { label: "CSAT", color: CORES[2] }, tmpr: { label: "TMPR (min)", color: CORES[3] } };

  return (
    <div className="space-y-4 print:space-y-2">
      <Card className="print:hidden">
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[260px]">
            <Label className="text-xs">Operador</Label>
            <Select value={operadorId} onValueChange={onOperador}>
              <SelectTrigger><SelectValue placeholder="Escolha o operador" /></SelectTrigger>
              <SelectContent>{ordenados.map((o) => <SelectItem key={o.operatorId} value={o.operatorId}>{o.operatorName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {b && <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir / salvar PDF</Button>}
          <p className="text-xs text-muted-foreground">As comparações usam a média da equipe com os mesmos filtros (setor, categoria, origem e período).</p>
        </CardContent>
      </Card>

      {!b ? (
        <p className="text-sm text-muted-foreground">Escolha um operador para ver o boletim.</p>
      ) : (
        <>
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-center gap-6">
              <div>
                <div className="text-lg font-semibold">{b.operatorName}</div>
                <div className="text-xs text-muted-foreground">{posicao ? `${posicao}º de ${comNota} na nota composta` : "Sem dados suficientes para a nota"}</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${corNota(b.nota)}`}>{b.nota ?? "—"}</div>
                <div className="text-[11px] text-muted-foreground">Nota (0–100)</div>
              </div>
              {DIMENSOES.map((dm) => (
                <div key={dm.id} className="text-center">
                  <div className={`text-xl font-semibold ${corNota(b.dimensoes[dm.id])}`}>{b.dimensoes[dm.id] ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{dm.rotulo}</div>
                </div>
              ))}
              {b.quadrante && <Badge variant={COR_QUADRANTE[b.quadrante] as any}>{b.quadrante}</Badge>}
            </CardContent>
          </Card>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            {METRICAS.map((m) => {
              const v = b.valores[m.id];
              const c = comparacaoMedia(v, media[m.id], m.sentido);
              return (
                <Card key={m.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="text-[11px] text-muted-foreground leading-tight">{m.rotulo}</div>
                    <div className="flex items-center gap-1 text-lg font-semibold">{formatarValor(v, m.formato)}<Seta c={c} /></div>
                    <div className="text-[11px] text-muted-foreground">Equipe: {formatarValor(media[m.id], m.formato)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-green-600" />Pontos fortes</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {b.fortes.length ? b.fortes.map((id) => (
                  <div key={id}>• <b>{DEF[id].rotulo}</b>: {formatarValor(b.valores[id], DEF[id].formato)} (equipe {formatarValor(media[id], DEF[id].formato)})</div>
                )) : <p className="text-xs text-muted-foreground">Nenhuma métrica claramente acima da equipe no período.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" />Pontos a desenvolver</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                {b.aDesenvolver.length ? b.aDesenvolver.map((id) => (
                  <div key={id}>
                    <div>• <b>{DEF[id].rotulo}</b>: {formatarValor(b.valores[id], DEF[id].formato)} (equipe {formatarValor(media[id], DEF[id].formato)})</div>
                    <div className="text-xs text-muted-foreground pl-3">Sugestão: {DEF[id].sugestao}</div>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nenhuma métrica claramente abaixo da equipe no período.</p>}
              </CardContent>
            </Card>
          </div>

          {d && d.semanas.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução semana a semana</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={cfg} className="h-[240px] w-full">
                  <LineChart data={d.semanas.map((s) => ({
                    semana: s.semana.split("-").reverse().slice(0, 2).join("/"),
                    resolvidos: s.resolvidos,
                    tma: s.tmaMs != null ? +(s.tmaMs / 3_600_000).toFixed(1) : null,
                    tmpr: s.tmprMs != null ? +(s.tmprMs / 60_000).toFixed(1) : null,
                    csat: s.csat != null ? +s.csat.toFixed(2) : null,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semana" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="resolvidos" name="Finalizados" stroke={CORES[0]} connectNulls />
                    <Line type="monotone" dataKey="tma" name="TMA (h)" stroke={CORES[1]} connectNulls />
                    <Line type="monotone" dataKey="tmpr" name="TMPR (min)" stroke={CORES[3]} connectNulls />
                    <Line type="monotone" dataKey="csat" name="CSAT" stroke={CORES[2]} connectNulls />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por categoria de chamado</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Finalizados</TableHead><TableHead>TMA dele</TableHead><TableHead>TMA equipe</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {d?.categorias.length ? d.categorias.map((c) => (
                      <TableRow key={c.categoria}>
                        <TableCell className="text-xs">{c.categoria}</TableCell>
                        <TableCell className="text-xs">{c.qtd}</TableCell>
                        <TableCell className="text-xs">{c.tmaMs != null ? formatDuration(c.tmaMs) : "—"}</TableCell>
                        <TableCell className="text-xs">{c.tmaEquipeMs != null ? formatDuration(c.tmaEquipeMs) : "—"}</TableCell>
                        <TableCell><Seta c={comparacaoMedia(c.tmaMs, c.tmaEquipeMs ?? undefined, "menor")} /></TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="text-xs text-muted-foreground text-center">Sem chamados finalizados no período.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Horários em que mais atende</CardTitle></CardHeader>
              <CardContent>
                {d?.horas.some((h) => h.qtd > 0) ? (
                  <div className="flex items-end gap-1 h-40">
                    {d.horas.map((h) => {
                      const max = Math.max(...d.horas.map((x) => x.qtd), 1);
                      return (
                        <div key={h.hora} className="flex-1 flex flex-col items-center gap-1" title={`${h.hora}h: ${h.qtd}`}>
                          <div className="w-full rounded-t bg-primary/70" style={{ height: `${(h.qtd / max) * 100}%` }} />
                          <span className="text-[9px] text-muted-foreground">{h.hora}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Sem atendimentos no período.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ComparativoOperadores({ boletins, valores, pesos, onPesos }: {
  boletins: Boletim[];
  valores: ValoresOperador[];
  pesos: Record<Dimensao, number>;
  onPesos: (p: Record<Dimensao, number>) => void;
}) {
  const media = useMemo(() => mediaEquipe(valores), [valores]);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [metricaRanking, setMetricaRanking] = useState<"nota" | MetricaId>("nota");

  const colunas = useMemo<TableColumn<Boletim>[]>(() => [
    { id: "operador", label: "Operador", value: (b) => b.operatorName },
    { id: "nota", label: "Nota", value: (b) => b.nota },
    { id: "quadrante", label: "Perfil", value: (b) => b.quadrante ?? "" },
    ...DIMENSOES.map((d) => ({ id: `dim_${d.id}`, label: d.rotulo, value: (b: Boletim) => b.dimensoes[d.id] ?? null, defaultHidden: d.id === "negocio" })),
    ...METRICAS.map((m) => ({ id: m.id, label: m.rotulo, value: (b: Boletim) => b.valores[m.id] ?? null, defaultHidden: ["mensagens", "horas", "oportunidades", "posvenda", "inicio"].includes(m.id) })),
  ], []);
  const ordenados = useMemo(() => [...boletins].sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1)), [boletins]);
  const tabela = useTableColumns("desempenho-comparativo", colunas, ordenados);

  const ranking = useMemo(() => {
    if (metricaRanking === "nota") return ordenados.filter((b) => b.nota != null).map((b) => ({ nome: b.operatorName, valor: b.nota!, txt: String(b.nota) }));
    const m = DEF[metricaRanking];
    return boletins
      .filter((b) => b.valores[m.id] != null)
      .sort((a, b) => (m.sentido === "menor" ? a.valores[m.id]! - b.valores[m.id]! : b.valores[m.id]! - a.valores[m.id]!))
      .map((b) => ({ nome: b.operatorName, valor: b.notas[m.id] ?? 50, txt: formatarValor(b.valores[m.id], m.formato) }));
  }, [metricaRanking, boletins, ordenados]);

  const radar = DIMENSOES.filter((d) => pesos[d.id] > 0 || escolhidos.some((id) => boletins.find((b) => b.operatorId === id)?.dimensoes[d.id] != null)).map((d) => {
    const row: Record<string, string | number> = { dimensao: d.rotulo };
    for (const id of escolhidos) { const b = boletins.find((x) => x.operatorId === id); if (b) row[b.operatorName] = b.dimensoes[d.id] ?? 0; }
    return row;
  });
  const pontos = boletins
    .filter((b) => b.valores.resolvidos != null && b.dimensoes.qualidade != null)
    .map((b) => ({ x: b.valores.resolvidos!, y: b.dimensoes.qualidade!, nome: b.operatorName, quadrante: b.quadrante }));
  const medVol = media.resolvidos;

  const celula = (b: Boletim, id: string) => {
    if (id === "operador") return <TableCell key={id} className="text-xs font-medium whitespace-nowrap">{b.operatorName}</TableCell>;
    if (id === "nota") return <TableCell key={id} className={`text-xs font-semibold ${corNota(b.nota)}`}>{b.nota ?? "—"}</TableCell>;
    if (id === "quadrante") return <TableCell key={id} className="text-xs">{b.quadrante ? <Badge variant={COR_QUADRANTE[b.quadrante] as any}>{b.quadrante}</Badge> : "—"}</TableCell>;
    if (id.startsWith("dim_")) { const v = b.dimensoes[id.slice(4) as Dimensao]; return <TableCell key={id} className={`text-xs ${corNota(v)}`}>{v ?? "—"}</TableCell>; }
    const m = DEF[id as MetricaId];
    const c = comparacaoMedia(b.valores[m.id], media[m.id], m.sentido);
    return (
      <TableCell key={id} className={`text-xs whitespace-nowrap ${c === "melhor" ? "text-green-700" : c === "pior" ? "text-destructive" : ""}`}>
        {formatarValor(b.valores[m.id], m.formato)}
      </TableCell>
    );
  };

  const somaPesos = DIMENSOES.reduce((a, d) => a + (pesos[d.id] || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pesos da nota composta</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {DIMENSOES.map((d) => (
            <div key={d.id} className="space-y-1 w-28">
              <Label className="text-xs">{d.rotulo} (%)</Label>
              <Input type="number" min={0} max={100} value={pesos[d.id]} onChange={(e) => onPesos({ ...pesos, [d.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </div>
          ))}
          <span className={`text-xs ${somaPesos === 100 ? "text-muted-foreground" : "text-amber-600"}`}>Soma: {somaPesos}%{somaPesos !== 100 && " (a nota é proporcional, mas o ideal é somar 100)"}</span>
          <Button variant="ghost" size="sm" onClick={() => onPesos(PESOS_PADRAO)}>Restaurar padrão</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Comparação entre operadores</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <TableToolbar state={tabela} fileName="desempenho-comparativo" count={tabela.filteredRows.length} />
          <p className="text-[11px] text-muted-foreground">Verde = melhor que a média da equipe; vermelho = pior. Notas de 0 a 100 são a posição de cada um dentro da equipe filtrada. Para comparar de forma justa, filtre por setor.</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>{tabela.visibleColumns.map((c) => <TableHead key={c.id} className="text-xs"><ColumnFilterHeader column={c} state={tabela} /></TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {tabela.filteredRows.map((b) => <TableRow key={b.operatorId}>{tabela.visibleColumns.map((c) => celula(b, c.id))}</TableRow>)}
                <TableRow className="bg-muted/40">
                  {tabela.visibleColumns.map((c) => (
                    <TableCell key={c.id} className="text-xs font-medium">
                      {c.id === "operador" ? "Média da equipe" : DEF[c.id as MetricaId] ? formatarValor(media[c.id as MetricaId], DEF[c.id as MetricaId].formato) : ""}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm">Ranking</CardTitle>
            <Select value={metricaRanking} onValueChange={(v) => setMetricaRanking(v as any)}>
              <SelectTrigger className="h-8 w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nota">Nota composta</SelectItem>
                {METRICAS.filter((m) => m.sentido !== "neutra").map((m) => <SelectItem key={m.id} value={m.id}>{m.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {ranking.length ? ranking.map((r, i) => (
              <div key={r.nome} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-right text-muted-foreground">{i + 1}º</span>
                <span className="w-40 truncate">{r.nome}</span>
                <div className="flex-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(2, r.valor)}%` }} /></div>
                <span className="w-16 text-right font-medium">{r.txt}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">Sem dados para essa métrica.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume × qualidade</CardTitle></CardHeader>
          <CardContent>
            {pontos.length >= 2 ? (
              <>
                <ChartContainer config={{}} className="h-[260px] w-full">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="Finalizados" fontSize={11} label={{ value: "Finalizados", position: "insideBottom", offset: -10, fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" name="Qualidade" domain={[0, 100]} fontSize={11} />
                    <ZAxis range={[60, 60]} />
                    {medVol != null && <ReferenceLine x={medVol} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
                    <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ payload }) => {
                      const p: any = payload?.[0]?.payload;
                      return p ? <div className="rounded border bg-background p-2 text-xs shadow">{p.nome}<br />Finalizados {p.x} · Qualidade {p.y}<br />{p.quadrante}</div> : null;
                    }} />
                    <Scatter data={pontos} fill={CORES[0]} />
                  </ScatterChart>
                </ChartContainer>
                <p className="text-[11px] text-muted-foreground">Acima e à direita: Referência · abaixo e à direita: Pressa · acima e à esquerda: Cuidadoso · abaixo e à esquerda: Atenção.</p>
              </>
            ) : <p className="text-xs text-muted-foreground">É preciso pelo menos 2 operadores com finalizados e qualidade (CSAT ou reabertura).</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Radar: compare de 2 a 4 operadores</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[240px_1fr]">
          <div className="max-h-[280px] overflow-y-auto space-y-1">
            {ordenados.map((b) => (
              <label key={b.operatorId} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={escolhidos.includes(b.operatorId)}
                  disabled={!escolhidos.includes(b.operatorId) && escolhidos.length >= 4}
                  onCheckedChange={(v) => setEscolhidos((x) => (v ? [...x, b.operatorId] : x.filter((y) => y !== b.operatorId)))}
                />
                {b.operatorName}
              </label>
            ))}
          </div>
          {escolhidos.length >= 2 ? (
            <ChartContainer config={{}} className="h-[300px] w-full">
              <RadarChart data={radar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimensao" fontSize={11} />
                <PolarRadiusAxis domain={[0, 100]} fontSize={9} />
                {escolhidos.map((id, i) => {
                  const b = boletins.find((x) => x.operatorId === id);
                  return b ? <Radar key={id} name={b.operatorName} dataKey={b.operatorName} stroke={CORES[i]} fill={CORES[i]} fillOpacity={0.15} /> : null;
                })}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ChartContainer>
          ) : <p className="text-xs text-muted-foreground self-center">Marque de 2 a 4 operadores na lista.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
