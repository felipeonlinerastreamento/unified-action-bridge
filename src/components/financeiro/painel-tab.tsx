import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDataBR, hojeSP, mesDe, statusVisivel } from "@/lib/finance";
import type { Cat, Lanc } from "./use-fin";

function addDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <Card className={alert ? "border-destructive/50" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold ${alert ? "text-destructive" : ""}`}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function PainelTab({ lancamentos, categorias, onRevisar }: { lancamentos: Lanc[]; categorias: Cat[]; onRevisar: () => void }) {
  const hoje = hojeSP();
  const d7 = addDias(hoje, 7);
  const d30 = addDias(hoje, 30);
  const mes = mesDe(hoje);

  const k = useMemo(() => {
    const ativos = lancamentos.filter((l) => l.status !== "cancelado");
    const sum = (arr: Lanc[]) => arr.reduce((s, l) => s + Number(l.valor || 0), 0);
    const abertos = ativos.filter((l) => l.status === "aberto");
    const pagar = abertos.filter((l) => l.tipo === "pagar");
    const receber = abertos.filter((l) => l.tipo === "receber");
    const vencidos = abertos.filter((l) => statusVisivel(l, hoje) === "vencido");
    const pagos = ativos.filter((l) => l.status === "pago" && (l.data_pagamento ?? "") >= mes);
    return {
      pagar7: sum(pagar.filter((l) => l.vencimento && l.vencimento >= hoje && l.vencimento <= d7)),
      pagar30: sum(pagar.filter((l) => l.vencimento && l.vencimento >= hoje && l.vencimento <= d30)),
      receber30: sum(receber.filter((l) => l.vencimento && l.vencimento >= hoje && l.vencimento <= d30)),
      vencidosPagar: vencidos.filter((l) => l.tipo === "pagar"),
      vencidosReceber: vencidos.filter((l) => l.tipo === "receber"),
      pagoMes: sum(pagos.filter((l) => l.tipo === "pagar")),
      recebidoMes: sum(pagos.filter((l) => l.tipo === "receber")),
      aRevisar: lancamentos.filter((l) => !l.revisado).length,
      proximos: pagar.filter((l) => l.vencimento && l.vencimento <= d7).sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? "")).slice(0, 10),
      sum,
    };
  }, [lancamentos, hoje, d7, d30, mes]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.tipo !== "pagar" || l.status === "cancelado" || mesDe(l.competencia ?? l.vencimento ?? "1900-01-01") !== mes) continue;
      const nome = categorias.find((c) => c.id === l.categoria_id)?.nome ?? "Sem categoria";
      m.set(nome, (m.get(nome) ?? 0) + Number(l.valor || 0));
    }
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const max = arr[0]?.[1] ?? 1;
    return { arr, max };
  }, [lancamentos, categorias, mes]);

  return (
    <div className="space-y-4">
      {k.aRevisar > 0 && (
        <button onClick={onRevisar} className="w-full text-left rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <b>{k.aRevisar}</b> comprovante(s) lido(s) automaticamente aguardando revisão. Clique para revisar.
        </button>
      )}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="A pagar nos próximos 7 dias" value={formatBRL(k.pagar7)} hint={`30 dias: ${formatBRL(k.pagar30)}`} />
        <Kpi label="A receber nos próximos 30 dias" value={formatBRL(k.receber30)} />
        <Kpi label="Vencidos a pagar" value={formatBRL(k.sum(k.vencidosPagar))} hint={`${k.vencidosPagar.length} conta(s) · a receber vencido: ${formatBRL(k.sum(k.vencidosReceber))}`} alert={k.vencidosPagar.length > 0} />
        <Kpi label="Pago no mês" value={formatBRL(k.pagoMes)} hint={`Recebido no mês: ${formatBRL(k.recebidoMes)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Gastos por categoria no mês</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {porCategoria.arr.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas lançadas neste mês.</p>}
            {porCategoria.arr.map(([nome, v]) => (
              <div key={nome} className="text-sm">
                <div className="flex justify-between"><span>{nome}</span><span className="font-medium">{formatBRL(v)}</span></div>
                <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.max(3, (v / porCategoria.max) * 100)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidos e vencendo em 7 dias</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {k.proximos.length === 0 && <p className="text-sm text-muted-foreground">Nada vencido ou vencendo nesta semana.</p>}
            {k.proximos.map((l) => (
              <div key={l.id} className="flex justify-between text-sm border-b last:border-0 py-1">
                <span className={statusVisivel(l, hoje) === "vencido" ? "text-destructive" : ""}>{formatDataBR(l.vencimento)} · {l.contraparte ?? l.descricao ?? "—"}</span>
                <span className="font-medium">{formatBRL(l.valor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
