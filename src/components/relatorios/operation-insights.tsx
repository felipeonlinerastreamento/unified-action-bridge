// Diagnóstico automático da operação: pontos positivos, pontos de atenção,
// pontos negativos e ações de melhoria — derivados do Resumo da Operação.
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exportToCSV } from "./export-utils";
import {
  AlertTriangle, CheckCircle2, Download, Lightbulb, Sparkles, XCircle,
} from "lucide-react";

export interface InsightRow {
  userId: string;
  userName: string;
  days: number;
  onlineMinutes: number;
  idleMinutes: number;
  workMinutes: number;
  idleBlocks: number;
  shiftMinutes: number;
  assumidos: number;
  transferidosRecebidos: number;
  filaTratados: number;
  finalizados: number;
  messages: number;
}

interface Props {
  rows: InsightRow[];
  totals: {
    online: number; idle: number; work: number; blocks: number; shift: number;
    assumidos: number; transferidos: number; fila: number; finalizados: number;
    messages: number; occupancy: number; msgsPerHour: number;
  };
  threshold: number;
  shiftStart: string;
  shiftEnd: string;
  dateFrom: string;
  dateTo: string;
}

function fmtHm(minutes: number) {
  if (!minutes || minutes < 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h === 0 ? `${m}min` : `${h}h ${m}min`;
}

type Item = { text: string; detail?: string };

export function OperationInsights({
  rows, totals, threshold, shiftStart, shiftEnd, dateFrom, dateTo,
}: Props) {
  const analysis = useMemo(() => {
    const positives: Item[] = [];
    const attention: Item[] = [];
    const negatives: Item[] = [];
    const actions: Item[] = [];

    if (rows.length === 0) {
      return { positives, attention, negatives, actions, ranked: [] as Array<InsightRow & { occ: number; mph: number }> };
    }

    const [sh, sm] = shiftStart.split(":").map(Number);
    const [eh, em] = shiftEnd.split(":").map(Number);
    const windowMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

    const ranked = rows
      .map((r) => ({
        ...r,
        occ: r.onlineMinutes > 0 ? (r.workMinutes / r.onlineMinutes) * 100 : 0,
        mph: r.workMinutes > 0 ? r.messages / (r.workMinutes / 60) : 0,
        adherence: r.days > 0 && windowMinutes > 0
          ? Math.min(1, r.shiftMinutes / (r.days * windowMinutes)) : 0,
      }))
      .sort((a, b) => b.occ - a.occ);

    const avgOcc = totals.occupancy;
    const avgMph = totals.msgsPerHour;
    const idleShare = totals.online > 0 ? (totals.idle / totals.online) * 100 : 0;
    const finalizadosPorOperador = totals.finalizados / rows.length;
    const volumes = ranked.map((r) => r.messages);
    const maxVol = Math.max(...volumes, 0);
    const minVol = Math.min(...volumes);
    const totalVol = volumes.reduce((a, b) => a + b, 0);
    const shareTop = totalVol > 0 ? (maxVol / totalVol) * 100 : 0;
    const balanceGap = maxVol > 0 ? ((maxVol - minVol) / maxVol) * 100 : 0;
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const lowAdherence = ranked.filter((r) => r.adherence < 0.6);
    const highIdle = ranked.filter(
      (r) => r.onlineMinutes > 60 && r.idleMinutes / r.onlineMinutes > 0.5
    );
    const noClose = ranked.filter((r) => r.messages > 30 && r.finalizados === 0);

    // ---------- Pontos positivos ----------
    if (avgOcc >= 70) {
      positives.push({
        text: `Ocupação média saudável (${avgOcc.toFixed(0)}%)`,
        detail: `${fmtHm(totals.work)} em atendimento sobre ${fmtHm(totals.online)} logados.`,
      });
    }
    if (best && best.occ >= 60) {
      positives.push({
        text: `Melhor ocupação: ${best.userName} (${best.occ.toFixed(0)}%)`,
        detail: `${best.messages} interações e ${best.finalizados} finalizações no período.`,
      });
    }
    if (totals.finalizados > 0) {
      positives.push({
        text: `${totals.finalizados} atendimentos finalizados`,
        detail: `Média de ${finalizadosPorOperador.toFixed(1)} por operador.`,
      });
    }
    if (avgMph >= 15) {
      positives.push({
        text: `Ritmo de interação consistente (${avgMph.toFixed(1)} msg/h ativa)`,
      });
    }
    if (totals.fila > 0) {
      positives.push({
        text: `${totals.fila} chamados puxados da fila`,
        detail: "Indica postura ativa da equipe em vez de espera por distribuição.",
      });
    }
    if (balanceGap > 0 && balanceGap <= 40) {
      positives.push({
        text: "Distribuição de volume equilibrada entre operadores",
        detail: `Diferença de ${balanceGap.toFixed(0)}% entre o maior e o menor volume.`,
      });
    }

    // ---------- Pontos de atenção ----------
    if (idleShare >= 25 && idleShare < 45) {
      attention.push({
        text: `Tempo parado representa ${idleShare.toFixed(0)}% do tempo logado`,
        detail: `${totals.blocks} blocos de ${threshold}min sem nenhuma interação.`,
      });
    }
    if (shareTop >= 40 && rows.length > 1) {
      attention.push({
        text: `Concentração de volume: ${ranked.find((r) => r.messages === maxVol)?.userName} responde por ${shareTop.toFixed(0)}% das mensagens`,
        detail: "Risco de sobrecarga individual e dependência operacional.",
      });
    }
    if (lowAdherence.length > 0) {
      attention.push({
        text: `${lowAdherence.length} operador(es) com baixa aderência à janela ${shiftStart}–${shiftEnd}`,
        detail: lowAdherence.slice(0, 4).map((r) => `${r.userName} (${(r.adherence * 100).toFixed(0)}%)`).join(", "),
      });
    }
    if (totals.transferidos > 0 && totals.finalizados > 0 && totals.transferidos / totals.finalizados > 0.3) {
      attention.push({
        text: "Alto volume de transferências em relação às finalizações",
        detail: `${totals.transferidos} recebidos por transferência x ${totals.finalizados} finalizados — pode indicar roteamento inicial impreciso.`,
      });
    }
    if (avgMph > 0 && avgMph < 10) {
      attention.push({
        text: `Ritmo baixo de interação (${avgMph.toFixed(1)} msg por hora ativa)`,
        detail: "Verifique se há espera por terceiros, sistemas lentos ou atendimentos complexos.",
      });
    }

    // ---------- Pontos negativos ----------
    if (idleShare >= 45) {
      negatives.push({
        text: `Ociosidade crítica: ${idleShare.toFixed(0)}% do tempo logado sem interação`,
        detail: `${fmtHm(totals.idle)} parados em ${totals.blocks} blocos de ${threshold}min.`,
      });
    }
    if (avgOcc < 40) {
      negatives.push({
        text: `Ocupação média abaixo do aceitável (${avgOcc.toFixed(0)}%)`,
      });
    }
    highIdle.forEach((r) => {
      negatives.push({
        text: `${r.userName}: ${(100 - r.occ).toFixed(0)}% do tempo logado parado`,
        detail: `${fmtHm(r.idleMinutes)} ociosos em ${r.idleBlocks} blocos.`,
      });
    });
    noClose.forEach((r) => {
      negatives.push({
        text: `${r.userName} interagiu ${r.messages} vezes sem nenhuma finalização`,
        detail: "Atendimentos podem estar ficando abertos indevidamente.",
      });
    });
    if (worst && rows.length > 1 && worst.occ < 25) {
      negatives.push({
        text: `Menor desempenho: ${worst.userName} (${worst.occ.toFixed(0)}% de ocupação)`,
      });
    }
    if (balanceGap > 70 && rows.length > 1) {
      negatives.push({
        text: `Desbalanceamento de carga de ${balanceGap.toFixed(0)}% entre operadores`,
      });
    }

    // ---------- Aplicabilidade / ações ----------
    if (idleShare >= 25) {
      actions.push({
        text: "Reduzir blocos de ociosidade",
        detail: `Ativar alertas automáticos após ${threshold}min sem interação e revisar a distribuição de chats nesses horários.`,
      });
    }
    if (shareTop >= 40 && rows.length > 1) {
      actions.push({
        text: "Rebalancear a fila",
        detail: "Ajustar a regra de menor carga para considerar mensagens enviadas, não apenas chats abertos.",
      });
    }
    if (lowAdherence.length > 0) {
      actions.push({
        text: "Reforçar aderência à escala",
        detail: `Acompanhar login/logout diário dos operadores fora da janela ${shiftStart}–${shiftEnd}.`,
      });
    }
    if (noClose.length > 0) {
      actions.push({
        text: "Higienizar atendimentos abertos",
        detail: "Cobrar finalização/protocolo ao encerrar conversas e revisar chats sem fechamento.",
      });
    }
    if (totals.transferidos > 0 && totals.finalizados > 0 && totals.transferidos / totals.finalizados > 0.3) {
      actions.push({
        text: "Revisar roteamento inicial",
        detail: "Ajustar o bot/setor de entrada para reduzir transferências evitáveis.",
      });
    }
    actions.push({
      text: "Definir metas mensuráveis",
      detail: `Sugestão: ocupação ≥ 70%, ociosidade ≤ 20% do tempo logado e ≥ ${Math.max(1, Math.round(finalizadosPorOperador * 1.15))} finalizações por operador no mesmo intervalo.`,
    });
    actions.push({
      text: "Comparar semanas",
      detail: "Exportar este resumo semanalmente e acompanhar a evolução da ocupação por operador.",
    });

    if (positives.length === 0) {
      positives.push({ text: "Sem indicadores positivos relevantes no período selecionado." });
    }
    if (attention.length === 0) {
      attention.push({ text: "Nenhum ponto de atenção identificado no período." });
    }
    if (negatives.length === 0) {
      negatives.push({ text: "Nenhum indicador crítico identificado no período." });
    }

    return { positives, attention, negatives, actions, ranked };
  }, [rows, totals, threshold, shiftStart, shiftEnd]);

  const exportInsights = () => {
    const flat: Array<{ Categoria: string; Ponto: string; Detalhe: string }> = [];
    const push = (cat: string, items: Item[]) =>
      items.forEach((i) => flat.push({ Categoria: cat, Ponto: i.text, Detalhe: i.detail || "" }));
    push("Positivo", analysis.positives);
    push("Atenção", analysis.attention);
    push("Negativo", analysis.negatives);
    push("Aplicabilidade", analysis.actions);
    exportToCSV(flat, `diagnostico-operacao-${dateFrom}_${dateTo}`);
  };

  const Block = ({
    title, icon: Icon, items, tone,
  }: { title: string; icon: typeof CheckCircle2; items: Item[]; tone: string }) => (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tone}`} />
          <h4 className="text-sm font-semibold">{title}</h4>
          <Badge variant="outline" className="ml-auto text-[10px]">{items.length}</Badge>
        </div>
        <ul className="space-y-2">
          {items.map((i, idx) => (
            <li key={idx} className="text-xs leading-relaxed">
              <span className="font-medium text-foreground">{i.text}</span>
              {i.detail && <span className="block text-muted-foreground">{i.detail}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Diagnóstico da Operação
        </h3>
        <Button size="sm" variant="outline" onClick={exportInsights} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground text-center py-6">
              Sem dados suficientes para gerar o diagnóstico no período selecionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Block title="Pontos positivos" icon={CheckCircle2} items={analysis.positives} tone="text-emerald-600" />
          <Block title="Pontos de atenção" icon={AlertTriangle} items={analysis.attention} tone="text-amber-600" />
          <Block title="Pontos negativos" icon={XCircle} items={analysis.negatives} tone="text-destructive" />
          <Block title="Aplicabilidade para melhora" icon={Lightbulb} items={analysis.actions} tone="text-primary" />
        </div>
      )}
    </div>
  );
}
