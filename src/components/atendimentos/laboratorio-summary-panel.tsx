import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, CheckCircle2, CalendarDays, Clock } from "lucide-react";

interface Props {
  tickets: any[];
}

/**
 * Painel resumo exibido quando o filtro de setor "Laboratorio" está ativo
 * no menu Atendimentos. Mostra status agregados de itens de liberação.
 */
export function LaboratorioSummaryPanel({ tickets }: Props) {
  const stats = useMemo(() => {
    let pending = 0;
    let released = 0;
    let overdue = 0;
    let dueToday = 0;
    let dueFuture = 0;
    let withoutDate = 0;
    const ticketsWithPending: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const t of tickets) {
      const items = Array.isArray(t.liberacao_items) ? t.liberacao_items : [];
      const p = items.filter((i: any) => i.status === "pendente").length;
      const r = items.filter((i: any) => i.status === "liberado").length;
      pending += p;
      released += r;
      if (p > 0) {
        ticketsWithPending.push(t);
        if (!t.liberacao_date) {
          withoutDate += p;
        } else {
          const d = new Date(t.liberacao_date);
          d.setHours(0, 0, 0, 0);
          if (d < today) overdue += p;
          else if (d.getTime() === today.getTime()) dueToday += p;
          else dueFuture += p;
        }
      }
    }
    return {
      pending,
      released,
      overdue,
      dueToday,
      dueFuture,
      withoutDate,
      ticketCount: ticketsWithPending.length,
    };
  }, [tickets]);

  if (stats.pending === 0 && stats.released === 0) {
    return (
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          Nenhum item de liberação registrado nos chamados deste setor.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">Resumo Laboratório — Liberação de Equipamentos</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={stats.pending}
          tone="primary"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atrasados"
          value={stats.overdue}
          tone="destructive"
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Hoje"
          value={stats.dueToday}
          tone="warning"
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Futuros"
          value={stats.dueFuture}
          tone="muted"
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Sem data"
          value={stats.withoutDate}
          tone="muted"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Liberados"
          value={stats.released}
          tone="success"
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {stats.ticketCount} chamado{stats.ticketCount === 1 ? "" : "s"} com itens pendentes.
      </div>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "destructive" | "warning" | "success" | "muted";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary border-primary/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium opacity-80">
        {icon} {label}
      </div>
      <div className="text-xl font-bold leading-tight mt-0.5">{value}</div>
    </div>
  );
}

/**
 * Badge inline para mostrar pendentes de liberação em um ticket individual.
 */
export function LiberacaoBadge({ ticket }: { ticket: any }) {
  const items = Array.isArray(ticket.liberacao_items) ? ticket.liberacao_items : [];
  if (items.length === 0) return null;
  const pending = items.filter((i: any) => i.status === "pendente").length;
  const released = items.filter((i: any) => i.status === "liberado").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let isOverdue = false;
  if (pending > 0 && ticket.liberacao_date) {
    const d = new Date(ticket.liberacao_date);
    d.setHours(0, 0, 0, 0);
    isOverdue = d < today;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {pending > 0 && (
        <Badge
          variant={isOverdue ? "destructive" : "secondary"}
          className="text-[10px] gap-0.5 h-5"
        >
          <Package className="h-2.5 w-2.5" />
          {pending} pend{pending === 1 ? "ente" : "entes"}
          {isOverdue && " (atrasado)"}
        </Badge>
      )}
      {released > 0 && (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-0.5 h-5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {released} liberado{released === 1 ? "" : "s"}
        </Badge>
      )}
    </div>
  );
}
