import { useMemo } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime, osAddress, pick, statusStyle } from "./shared";

/** Cidade (ou bairro) do endereço da OS. */
export function regionOf(activity: any): string {
  const a = activity?.addressData ?? activity?.location ?? activity;
  const city = pick(a, ["city", "cidade", "municipio"], "");
  if (city) return city;
  const district = pick(a, ["district", "neighborhood", "bairro"], "");
  if (district) return district;
  const address = osAddress(activity);
  if (address) {
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    const withUf = parts.find((p) => /\s-\s[A-Z]{2}$/.test(p));
    if (withUf) return withUf.replace(/\s-\s[A-Z]{2}$/, "").trim();
    if (parts.length >= 2) return parts[parts.length - 2]!;
  }
  return "";
}

function techNameOf(a: any): string {
  return pick(a, ["technicianName"], "") || pick(a?.technician ?? {}, ["name", "nome", "fullName"], "") || "Sem técnico";
}

function techIdOf(a: any): string {
  const v = a?.technicianId ?? a?.technician?.id;
  return v ? String(v) : "";
}

interface Props {
  activities: any[];
  loading: boolean;
  onOpenOs: (activity: any) => void;
  onScheduleHere: (technicianId: string, region: string) => void;
}

export function SolicitacoesRegiao({ activities, loading, onOpenOs, onScheduleHere }: Props) {
  const { groups, semRegiao } = useMemo(() => {
    const map = new Map<string, any[]>();
    const sem: any[] = [];
    for (const a of activities) {
      const region = regionOf(a);
      if (!region) {
        sem.push(a);
        continue;
      }
      const list = map.get(region) ?? [];
      list.push(a);
      map.set(region, list);
    }
    const groups = Array.from(map.entries())
      .map(([region, items]) => {
        const byTech = new Map<string, { id: string; name: string; count: number }>();
        for (const it of items) {
          const id = techIdOf(it);
          const name = techNameOf(it);
          const key = id || name;
          const cur = byTech.get(key) ?? { id, name, count: 0 };
          cur.count += 1;
          byTech.set(key, cur);
        }
        const techs = Array.from(byTech.values()).sort((a, b) => a.count - b.count);
        return { region, items, techs, suggested: techs.find((t) => t.id) ?? null };
      })
      .sort((a, b) => b.items.length - a.items.length);
    return { groups, semRegiao: sem };
  }, [activities]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando atendimentos do dia...
      </div>
    );
  }

  if (groups.length === 0 && semRegiao.length === 0) {
    return <p className="p-8 text-sm text-muted-foreground">Nenhum atendimento nesta data.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {groups.map((g) => (
          <Card key={g.region}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-primary" />
                  {g.region}
                  <Badge variant="secondary">{g.items.length} OS</Badge>
                </CardTitle>
                {g.suggested && (
                  <Button size="sm" variant="outline" onClick={() => onScheduleHere(g.suggested!.id, g.region)}>
                    Agendar nesta região
                  </Button>
                )}
              </div>
              <CardDescription>
                {g.suggested
                  ? `Sugestão: ${g.suggested.name} (${g.suggested.count} atendimento${g.suggested.count > 1 ? "s" : ""} na região)`
                  : "Sem técnico definido nesta região."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="mb-2 flex flex-wrap gap-1">
                {g.techs.map((t) => (
                  <Badge key={t.id || t.name} variant="outline" className="text-[11px]">
                    {t.name} · {t.count}
                  </Badge>
                ))}
              </div>
              {g.items.map((a: any) => {
                const st = statusStyle(String(a?.status ?? ""));
                return (
                  <button
                    key={String(a.id)}
                    type="button"
                    onClick={() => onOpenOs(a)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.bg}`} />
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">{formatTime(a.scheduledAt)}</span>
                    <span className="truncate font-medium">{pick(a, ["identifier", "title"], String(a.id))}</span>
                    <span className="truncate text-xs text-muted-foreground">{osAddress(a) || "sem endereço"}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sem região identificada</CardTitle>
          <CardDescription>{semRegiao.length} atendimento(s) sem endereço reconhecido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {semRegiao.length === 0 && <p className="text-sm text-muted-foreground">Nada pendente.</p>}
          {semRegiao.map((a: any) => (
            <button
              key={String(a.id)}
              type="button"
              onClick={() => onOpenOs(a)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
            >
              <span className="w-14 shrink-0 text-xs text-muted-foreground">{formatTime(a.scheduledAt)}</span>
              <span className="truncate">{pick(a, ["identifier", "title"], String(a.id))}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
