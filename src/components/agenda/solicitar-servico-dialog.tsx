import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPinned, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listarAtividades } from "@/lib/seu-instalador.functions";
import { asList } from "./shared";
import { SolicitacoesDisponibilidade } from "./solicitacoes-disponibilidade";
import { SolicitacoesRegistrar, type Prefill } from "./solicitacoes-registrar";
import { SolicitacoesDirecionar } from "./solicitacoes-direcionar";

type TabKey = "disponibilidade" | "registrar" | "direcionar";

const TABS: { key: TabKey; label: string; icon: typeof Search }[] = [
  { key: "disponibilidade", label: "Verificar disponibilidade", icon: Search },
  { key: "registrar", label: "Registrar solicitação", icon: Plus },
  { key: "direcionar", label: "Direcionar por região", icon: MapPinned },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  technicians: any[];
  defaultDate: string;
  onCreated: () => void;
  onOpenOs: (activity: any) => void;
}

export function SolicitarServicoDialog({
  open,
  onOpenChange,
  technicians,
  defaultDate,
  onCreated,
  onOpenOs,
}: Props) {
  const fetchAtividades = useServerFn(listarAtividades);
  const [tab, setTab] = useState<TabKey>("disponibilidade");
  const [date, setDate] = useState(defaultDate);
  const [duration, setDuration] = useState(60);
  const [prefill, setPrefill] = useState<Prefill>(null);

  const atividadesQuery = useQuery({
    queryKey: ["si-dialog-atividades", date],
    enabled: open && !!date,
    queryFn: () => fetchAtividades({ data: { scheduledFrom: date, scheduledTo: date, page: 1, pageSize: 100 } }),
    staleTime: 30_000,
  });
  const activities = asList(atividadesQuery.data);

  const consumePrefill = useCallback(() => setPrefill(null), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar serviço</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-2">
          {tab === "disponibilidade" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <SolicitacoesDisponibilidade
                activities={activities}
                technicians={technicians}
                loading={atividadesQuery.isLoading}
                duration={duration}
                onDurationChange={setDuration}
                technicianFilter=""
                onPickSlot={(technicianId, time) => {
                  setPrefill({ technicianId, time });
                  setTab("registrar");
                }}
                onOpenOs={onOpenOs}
              />
            </div>
          )}

          {tab === "registrar" && (
            <SolicitacoesRegistrar
              date={date}
              onDateChange={setDate}
              technicians={technicians}
              activities={activities}
              prefill={prefill}
              onConsumePrefill={consumePrefill}
              onCreated={onCreated}
              onOpenOs={onOpenOs}
            />
          )}

          {tab === "direcionar" && (
            <SolicitacoesDirecionar
              technicians={technicians}
              defaultDate={date}
              onCreated={(activity) => {
                onCreated();
                if (activity) onOpenOs(activity);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
