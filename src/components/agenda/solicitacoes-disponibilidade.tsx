import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { minutesOfDaySP, pick, statusStyle } from "./shared";

const START_MIN = 7 * 60;
const END_MIN = 20 * 60;
const STEP = 30;
const SLOTS = Array.from({ length: (END_MIN - START_MIN) / STEP }, (_, i) => START_MIN + i * STEP);

function label(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function activityRange(a: any): { start: number; end: number } | null {
  const start = minutesOfDaySP(a?.scheduledAt);
  if (start === null) return null;
  const dur = Number(a?.durationMinutes ?? a?.duration ?? 60) || 60;
  return { start, end: start + dur };
}

function techIdOf(a: any): string {
  const v = a?.technicianId ?? a?.technician?.id ?? a?.technician;
  return v ? String(v) : "";
}

interface Props {
  activities: any[];
  technicians: any[];
  loading: boolean;
  duration: number;
  onDurationChange: (v: number) => void;
  technicianFilter: string;
  onPickSlot: (technicianId: string, time: string) => void;
  onOpenOs: (activity: any) => void;
}

export function SolicitacoesDisponibilidade({
  activities,
  technicians,
  loading,
  duration,
  onDurationChange,
  technicianFilter,
  onPickSlot,
  onOpenOs,
}: Props) {
  const rows = useMemo(() => {
    const list = technicians.filter((t: any) => !technicianFilter || String(t.id) === technicianFilter);
    return list.map((t: any) => {
      const id = String(t.id);
      const name = pick(t, ["name", "nome", "fullName"], id);
      const blocks = activities
        .filter((a) => techIdOf(a) === id)
        .map((a) => ({ activity: a, range: activityRange(a) }))
        .filter((b) => b.range) as { activity: any; range: { start: number; end: number } }[];
      return { id, name, blocks };
    });
  }, [technicians, activities, technicianFilter]);

  const busyAt = (blocks: { range: { start: number; end: number } }[], from: number, to: number) =>
    blocks.some((b) => b.range.start < to && b.range.end > from);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando agenda dos técnicos...
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="p-8 text-sm text-muted-foreground">Nenhum técnico encontrado.</p>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">Disponibilidade dos técnicos</CardTitle>
            <CardDescription>
              Espaços em verde comportam {duration} minutos. Clique para registrar a solicitação nesse horário.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Duração</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={duration}
              onChange={(e) => onDurationChange(Number(e.target.value))}
            >
              {[30, 60, 90, 120, 180, 240].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="flex border-b border-border pb-1">
            <div className="w-48 shrink-0 text-xs font-medium text-muted-foreground">Técnico</div>
            <div className="flex flex-1">
              {SLOTS.map((s) => (
                <div key={s} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {s % 60 === 0 ? label(s) : ""}
                </div>
              ))}
            </div>
          </div>

          {rows.map((row) => (
            <div key={row.id} className="flex items-center border-b border-border/60 py-1">
              <div className="w-48 shrink-0 truncate pr-2 text-sm font-medium">{row.name}</div>
              <div className="flex flex-1 gap-[1px]">
                {SLOTS.map((slot) => {
                  const occupied = row.blocks.find((b) => b.range.start < slot + STEP && b.range.end > slot);
                  if (occupied) {
                    const st = statusStyle(String(occupied.activity?.status ?? ""));
                    return (
                      <button
                        key={slot}
                        type="button"
                        title={`${label(slot)} — ${pick(occupied.activity, ["identifier", "title"], "OS")}`}
                        onClick={() => onOpenOs(occupied.activity)}
                        className={`h-7 flex-1 rounded-[2px] ${st.bg} opacity-90 hover:opacity-100`}
                      />
                    );
                  }
                  const fits = slot + duration <= END_MIN && !busyAt(row.blocks, slot, slot + duration);
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!fits}
                      title={fits ? `Livre às ${label(slot)}` : "Sem espaço para a duração escolhida"}
                      onClick={() => onPickSlot(row.id, label(slot))}
                      className={`h-7 flex-1 rounded-[2px] ${
                        fits
                          ? "bg-status-done/25 hover:bg-status-done/50 cursor-pointer"
                          : "bg-muted/60 cursor-not-allowed"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
