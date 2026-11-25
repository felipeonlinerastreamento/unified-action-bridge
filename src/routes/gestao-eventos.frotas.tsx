import { createFileRoute } from "@tanstack/react-router";
import { FEATURES } from "@/lib/ge/features";
import { FeatureGate } from "@/components/ge/feature-gate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/gestao-eventos/frotas")({
  component: ClientFleetsGated,
});

function ClientFleets() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // As políticas de acesso do banco já limitam o retorno às frotas
  // pelas quais o usuário é responsável (ou a todo o cliente, para admins).
  const { data: fleets } = useQuery({
    queryKey: ["my-fleets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_fleets")
        .select("id,client_id,name,code,location_name,city,state,is_active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["my-fleet-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_vehicles")
        .select("id,client_id,fleet_id,license_plate,chassis,tag,internal_id,location_name,city,state,is_active")
        .order("license_plate");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transfers } = useQuery({
    queryKey: ["my-fleet-transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_vehicle_fleet_transfers")
        .select("id,vehicle_id,from_fleet_name,to_fleet_name,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const fleetName = (id: string | null) => (fleets ?? []).find((f) => f.id === id)?.name ?? "Sem frota";

  const transfer = async (vehicleId: string, fleetId: string) => {
    const { error } = await supabase.from("ge_vehicles").update({ fleet_id: fleetId }).eq("id", vehicleId);
    if (error) return toast.error(error.message);
    toast.success("Veículo transferido de frota");
    void qc.invalidateQueries({ queryKey: ["my-fleet-vehicles"] });
    void qc.invalidateQueries({ queryKey: ["my-fleet-transfers"] });
    void qc.invalidateQueries({ queryKey: ["events"] });
  };

  const term = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const filtered = (vehicles ?? []).filter((v) =>
    !term ||
    [v.license_plate, v.chassis, v.tag, v.internal_id]
      .filter(Boolean)
      .some((x) => String(x).toUpperCase().replace(/[^A-Z0-9]/g, "").includes(term)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frotas</h1>
        <p className="text-sm text-muted-foreground">
          Frotas sob sua responsabilidade e os veículos alocados em cada uma.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Minhas frotas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Frota</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Local de atuação</TableHead>
                <TableHead>Veículos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(fleets ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma frota disponível para o seu acesso.</TableCell></TableRow>
              )}
              {(fleets ?? []).map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="text-sm">{f.code ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {[f.location_name, [f.city, f.state].filter(Boolean).join("/")].filter(Boolean).join(" — ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{(vehicles ?? []).filter((v) => v.fleet_id === f.id).length}</TableCell>
                  <TableCell><Badge variant={f.is_active ? "secondary" : "outline"}>{f.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Veículos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Pesquisar por placa, chassi, TAG ou identificador"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Frota atual</TableHead>
                  <TableHead>Local de atuação</TableHead>
                  <TableHead>Transferir para</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum veículo encontrado.</TableCell></TableRow>
                )}
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {v.license_plate ?? v.chassis ?? v.tag ?? v.internal_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{fleetName(v.fleet_id)}</TableCell>
                    <TableCell className="text-sm">
                      {[v.location_name, [v.city, v.state].filter(Boolean).join("/")].filter(Boolean).join(" — ") || "—"}
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded border bg-background px-2 text-xs"
                        value=""
                        onChange={(e) => e.target.value && transfer(v.id, e.target.value)}
                      >
                        <option value="">Selecionar frota</option>
                        {(fleets ?? []).filter((f) => f.id !== v.fleet_id).map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico de transferências</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(transfers ?? []).length === 0 && <p className="text-muted-foreground">Nenhuma transferência registrada.</p>}
          {(transfers ?? []).map((t) => {
            const v = (vehicles ?? []).find((x) => x.id === t.vehicle_id);
            return (
              <div key={t.id} className="rounded border p-2 text-xs">
                {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")} · {v?.license_plate ?? "veículo"} ·{" "}
                {t.from_fleet_name ?? "Sem frota"} → {t.to_fleet_name ?? "Sem frota"}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ClientFleetsGated() {
  return (
    <FeatureGate feature={FEATURES.fleets}>
      <ClientFleets />
    </FeatureGate>
  );
}
