import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { atualizarRiscoReconnect, resultadoReconnect } from "@/lib/reconnect.functions";
import { CRITICIDADE_LABEL, todaySP, type Criticidade } from "@/lib/reconnect";
import { Crit, COR } from "./painel-tab";

const brl = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const menosDias = (iso: string, d: number) => { const x = new Date(`${iso}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10); };
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

function Kpi({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-xl font-semibold">{valor}</p>
      {detalhe && <p className="text-[11px] text-muted-foreground">{detalhe}</p>}
    </CardContent></Card>
  );
}

export function ResultadosTab() {
  const hoje = todaySP();
  const [de, setDe] = useState(menosDias(hoje, 29));
  const [ate, setAte] = useState(hoje);
  const buscar = useServerFn(resultadoReconnect);
  const sincronizar = useServerFn(atualizarRiscoReconnect);
  const [sinc, setSinc] = useState(false);
  const q = useQuery({ queryKey: ["rc-resultado", de, ate], queryFn: () => buscar({ data: { de, ate } }) });
  const m = q.data;

  const atualizarRisco = async () => {
    setSinc(true);
    try {
      const r = await sincronizar();
      if (r.ok) toast.success(`Pós-venda atualizado: ${r.comPlacas} cliente(s) da carteira com placas sem comunicação.`);
      else toast.error(r.error ?? "Falha ao atualizar o Pós-venda.");
      q.refetch();
    } finally { setSinc(false); }
  };

  const maxSem = Math.max(1, ...(m?.semanas ?? []).map((s) => s.recuperados));

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-3 flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">De</Label><Input type="date" className="h-8 w-[150px]" value={de} max={ate} onChange={(e) => e.target.value && setDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" className="h-8 w-[150px]" value={ate} min={de} max={hoje} onChange={(e) => e.target.value && setAte(e.target.value)} /></div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => <Button key={d} size="sm" variant="outline" onClick={() => { setDe(menosDias(hoje, d - 1)); setAte(hoje); }}>{d} dias</Button>)}
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={atualizarRisco} disabled={sinc}>
          {sinc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar risco no Pós-venda
        </Button>
      </CardContent></Card>

      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
      {q.error && <p className="text-sm text-destructive">Não foi possível calcular: {(q.error as Error).message}</p>}

      {m && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <Kpi titulo="Recuperados no período" valor={String(m.recuperados)} detalhe={m.diasMedioParadoAntesDeVoltar != null ? `ficaram em média ${m.diasMedioParadoAntesDeVoltar} dias sem comunicar` : undefined} />
            <Kpi titulo="Voltaram após aviso" valor={String(m.recuperadosAposAviso)} detalhe={m.diasMedioAvisoAteVoltar != null ? `em média ${m.diasMedioAvisoAteVoltar} dias depois do aviso` : "aviso até 30 dias antes"} />
            <Kpi titulo="Taxa de retorno do aviso" valor={m.taxaRetornoAviso != null ? `${m.taxaRetornoAviso.toLocaleString("pt-BR")}%` : "—"} detalhe={`${m.placasAvisadas} placa(s) avisada(s) no período`} />
            <Kpi titulo="Sem comunicação agora" valor={String(m.paradasAgora)} detalhe={`${m.notificadasSemRetorno} já avisada(s) e sem retorno`} />
            {m.receita ? (
              <>
                <Kpi titulo="Receita em risco" valor={brl(m.receita.emRisco)} detalhe={`receita mensal de ${m.receita.clientesComReceita} cliente(s) com placas paradas · 31+ dias: ${brl(m.receita.emRisco31)}`} />
                <Kpi titulo="Receita protegida" valor={brl(m.receita.recuperada)} detalhe="receita mensal dos clientes com placas recuperadas no período" />
              </>
            ) : (
              <Card className="col-span-2"><CardContent className="p-3 text-xs text-muted-foreground">Os valores de receita aparecem para quem tem acesso ao Financeiro ou à aba Pós-venda do CRM.</CardContent></Card>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Recuperados por semana</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {m.semanas.map((s) => (
                    <div key={s.semana}>
                      <div className="flex justify-between"><span>Semana de {dataBR(s.semana)}</span><span><b>{s.recuperados}</b> · {s.aposAviso} após aviso</span></div>
                      <div className="h-2 rounded bg-muted flex overflow-hidden">
                        <div className="h-2 bg-emerald-600" style={{ width: `${(s.aposAviso / maxSem) * 100}%` }} title="Após aviso" />
                        <div className="h-2 bg-emerald-300" style={{ width: `${((s.recuperados - s.aposAviso) / maxSem) * 100}%` }} title="Sozinhos" />
                      </div>
                    </div>
                  ))}
                  {!m.semanas.length && <p className="text-muted-foreground">Nenhum veículo recuperado no período.</p>}
                  {!!m.semanas.length && <p className="text-[11px] text-muted-foreground">Verde escuro: voltaram depois do aviso. Verde claro: voltaram sem aviso.</p>}
                </CardContent>
              </Card>
              {m.receita && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Receita em risco por faixa (pior placa)</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {m.receita.porFaixa.map((f) => (
                      <div key={f.faixa} className="flex justify-between"><span className={`rounded border px-1.5 ${COR[f.faixa as Criticidade]}`}>{CRITICIDADE_LABEL[f.faixa as Criticidade]}</span><b>{brl(f.receita)}</b></div>
                    ))}
                    <p className="text-[11px] text-muted-foreground pt-1">Receita mensal média dos últimos 3 meses de faturas (carteira do Pós-venda). {m.vinculados} cliente(s) do Reconnect ligados à carteira.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Clientes que mais demoram para voltar</CardTitle></CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Placas paradas</TableHead><TableHead>Pior placa</TableHead><TableHead>Avisadas sem retorno</TableHead>{m.receita && <TableHead className="text-right">Receita mensal</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {m.clientesQueMaisDemoram.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="text-xs font-medium">{c.nome}</TableCell>
                      <TableCell>{c.placas}</TableCell>
                      <TableCell><Crit dias={c.diasMax} /></TableCell>
                      <TableCell>{c.notificadas}</TableCell>
                      {m.receita && <TableCell className="text-right text-xs">{c.receita ? brl(c.receita) : "—"}</TableCell>}
                    </TableRow>
                  ))}
                  {!m.clientesQueMaisDemoram.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma placa sem comunicação.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
