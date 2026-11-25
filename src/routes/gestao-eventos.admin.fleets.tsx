import { createFileRoute } from "@tanstack/react-router";
import { FEATURES } from "@/lib/ge/features";
import { FeatureGate } from "@/components/ge/feature-gate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao-eventos/admin/fleets")({
  component: AdminFleetsGated,
});

type Fleet = {
  id: string;
  client_id: string;
  name: string;
  code: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
};

type Vehicle = {
  id: string;
  client_id: string;
  fleet_id: string | null;
  license_plate: string | null;
  chassis: string | null;
  tag: string | null;
  internal_id: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
};

function AdminFleets() {
  const { isPlatformAdmin, isClientAdmin, profile, impersonatedClient } = useAuth();
  const qc = useQueryClient();

  const forcedClientId = impersonatedClient
    ? impersonatedClient.id
    : !isPlatformAdmin
      ? profile?.client_id ?? null
      : null;

  const [selectedClient, setSelectedClient] = useState<string>("");
  const clientId = forcedClientId ?? (selectedClient || null);
  const canAccess = isPlatformAdmin || isClientAdmin;

  const { data: clients } = useQuery({
    queryKey: ["fleet-clients", forcedClientId ?? "all"],
    enabled: canAccess,
    queryFn: async () => {
      let q = supabase.from("ge_clients").select("id,name").order("name");
      if (forcedClientId) q = q.eq("id", forcedClientId);
      return (await q).data ?? [];
    },
  });

  const { data: fleets } = useQuery({
    queryKey: ["fleets", clientId],
    enabled: canAccess && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_fleets")
        .select("id,client_id,name,code,location_name,city,state,is_active")
        .eq("client_id", clientId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Fleet[];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["fleet-vehicles", clientId],
    enabled: canAccess && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_vehicles")
        .select("id,client_id,fleet_id,license_plate,chassis,tag,internal_id,location_name,city,state,is_active")
        .eq("client_id", clientId!)
        .order("license_plate");
      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
  });

  const { data: responsibles } = useQuery({
    queryKey: ["fleet-responsibles", clientId],
    enabled: canAccess && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_fleet_responsibles")
        .select("id,fleet_id,user_id")
        .eq("client_id", clientId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientUsers } = useQuery({
    queryKey: ["fleet-client-users", clientId],
    enabled: canAccess && !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_profiles")
        .select("id,full_name,email")
        .eq("client_id", clientId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const userLabel = (userId: string) => {
    const u = (clientUsers ?? []).find((x) => x.id === userId);
    return u?.full_name || u?.email || userId.slice(0, 8);
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["fleets"] });
    void qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
    void qc.invalidateQueries({ queryKey: ["fleet-responsibles"] });
    void qc.invalidateQueries({ queryKey: ["events"] });
  };

  // ----- criar frota -----
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fCity, setFCity] = useState("");
  const [fState, setFState] = useState("");
  const [savingFleet, setSavingFleet] = useState(false);

  const createFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;
    setSavingFleet(true);
    const { error } = await supabase.from("ge_fleets").insert({
      client_id: clientId,
      name: fName.trim(),
      code: fCode.trim() || null,
      location_name: fLocation.trim() || null,
      city: fCity.trim() || null,
      state: fState.trim().toUpperCase() || null,
    });
    setSavingFleet(false);
    if (error) return toast.error(error.message);
    toast.success("Frota criada");
    setFName(""); setFCode(""); setFLocation(""); setFCity(""); setFState("");
    invalidate();
  };

  const [editFleet, setEditFleet] = useState<Fleet | null>(null);
  const saveFleetEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFleet) return;
    const { error } = await supabase
      .from("ge_fleets")
      .update({
        name: editFleet.name.trim(),
        code: editFleet.code?.trim() || null,
        location_name: editFleet.location_name?.trim() || null,
        city: editFleet.city?.trim() || null,
        state: editFleet.state?.trim().toUpperCase() || null,
        is_active: editFleet.is_active,
      })
      .eq("id", editFleet.id);
    if (error) return toast.error(error.message);
    toast.success("Frota atualizada");
    setEditFleet(null);
    invalidate();
  };

  // ----- responsáveis -----
  const [respFleet, setRespFleet] = useState<Fleet | null>(null);
  const toggleResponsible = async (fleet: Fleet, userId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase
        .from("ge_fleet_responsibles")
        .insert({ fleet_id: fleet.id, user_id: userId, client_id: fleet.client_id });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("ge_fleet_responsibles")
        .delete()
        .eq("fleet_id", fleet.id)
        .eq("user_id", userId);
      if (error) return toast.error(error.message);
    }
    invalidate();
  };

  // ----- veículos -----
  const [vehFleet, setVehFleet] = useState<Fleet | null>(null);
  const [vPlate, setVPlate] = useState("");
  const [vChassis, setVChassis] = useState("");
  const [vTag, setVTag] = useState("");
  const [vInternal, setVInternal] = useState("");
  const [vLocation, setVLocation] = useState("");
  const [vCity, setVCity] = useState("");
  const [vState, setVState] = useState("");
  const [savingVehicle, setSavingVehicle] = useState(false);

  const addVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehFleet || !clientId) return;
    const plateNorm = vPlate.trim().toUpperCase();
    const existing = (vehicles ?? []).find(
      (v) => (v.license_plate ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "") === plateNorm.replace(/[^A-Z0-9]/g, ""),
    );
    setSavingVehicle(true);
    // Reutiliza veículo já cadastrado (não duplica): apenas realoca a frota.
    const { error } = existing
      ? await supabase
          .from("ge_vehicles")
          .update({
            fleet_id: vehFleet.id,
            location_name: vLocation.trim() || existing.location_name,
            city: vCity.trim() || existing.city,
            state: vState.trim().toUpperCase() || existing.state,
          })
          .eq("id", existing.id)
      : await supabase.from("ge_vehicles").insert({
          client_id: clientId,
          fleet_id: vehFleet.id,
          license_plate: plateNorm || null,
          chassis: vChassis.trim() || null,
          tag: vTag.trim() || null,
          internal_id: vInternal.trim() || null,
          location_name: vLocation.trim() || null,
          city: vCity.trim() || null,
          state: vState.trim().toUpperCase() || null,
        });
    setSavingVehicle(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Veículo existente vinculado à frota" : "Veículo cadastrado");
    setVPlate(""); setVChassis(""); setVTag(""); setVInternal(""); setVLocation(""); setVCity(""); setVState("");
    invalidate();
  };

  const transferVehicle = async (vehicleId: string, fleetId: string | null) => {
    const { error } = await supabase.from("ge_vehicles").update({ fleet_id: fleetId }).eq("id", vehicleId);
    if (error) return toast.error(error.message);
    toast.success("Veículo transferido");
    invalidate();
  };

  // ----- equipamentos -----
  const [equipVehicle, setEquipVehicle] = useState<Vehicle | null>(null);
  const { data: equipments } = useQuery({
    queryKey: ["vehicle-equipments", equipVehicle?.id],
    enabled: !!equipVehicle,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_vehicle_equipments")
        .select("id,imei,serial_number,tag,device_id,is_active")
        .eq("vehicle_id", equipVehicle!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [eImei, setEImei] = useState("");
  const [eSerial, setESerial] = useState("");
  const [eTag, setETag] = useState("");
  const [eDevice, setEDevice] = useState("");

  const addEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipVehicle) return;
    const { error } = await supabase.from("ge_vehicle_equipments").insert({
      vehicle_id: equipVehicle.id,
      client_id: equipVehicle.client_id,
      imei: eImei.trim() || null,
      serial_number: eSerial.trim() || null,
      tag: eTag.trim() || null,
      device_id: eDevice.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Equipamento vinculado");
    setEImei(""); setESerial(""); setETag(""); setEDevice("");
    void qc.invalidateQueries({ queryKey: ["vehicle-equipments", equipVehicle.id] });
  };

  if (!canAccess) {
    return <div className="text-muted-foreground">Apenas administradores podem gerenciar frotas.</div>;
  }

  const unassigned = (vehicles ?? []).filter((v) => !v.fleet_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frotas do Cliente</h1>
        <p className="text-sm text-muted-foreground">
          Cliente → Frota → Responsáveis → Veículos → Equipamentos → Local de atuação
        </p>
      </div>

      {isPlatformAdmin && !forcedClientId && (
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent>
            <select
              className="h-9 w-full max-w-md rounded border bg-background px-2 text-sm"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="">Selecione um cliente</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {!clientId ? (
        <div className="text-muted-foreground">Selecione um cliente para gerenciar as frotas.</div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Nova frota</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createFleet} className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1"><Label>Nome</Label><Input value={fName} onChange={(e) => setFName(e.target.value)} required /></div>
                <div className="space-y-1"><Label>Código</Label><Input value={fCode} onChange={(e) => setFCode(e.target.value)} /></div>
                <div className="space-y-1"><Label>Local de atuação</Label><Input value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="Unidade, filial, escritório..." /></div>
                <div className="space-y-1"><Label>Cidade</Label><Input value={fCity} onChange={(e) => setFCity(e.target.value)} /></div>
                <div className="space-y-1"><Label>UF</Label><Input value={fState} onChange={(e) => setFState(e.target.value)} maxLength={2} /></div>
                <div className="flex items-end"><Button type="submit" className="w-full" disabled={savingFleet}>{savingFleet ? "Salvando..." : "Criar frota"}</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Frotas</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Frota</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Local de atuação</TableHead>
                    <TableHead>Responsáveis</TableHead>
                    <TableHead>Veículos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(fleets ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Nenhuma frota cadastrada.</TableCell></TableRow>
                  )}
                  {(fleets ?? []).map((f) => {
                    const resp = (responsibles ?? []).filter((r) => r.fleet_id === f.id);
                    const veh = (vehicles ?? []).filter((v) => v.fleet_id === f.id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-sm">{f.code ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {[f.location_name, [f.city, f.state].filter(Boolean).join("/")].filter(Boolean).join(" — ") || "—"}
                        </TableCell>
                        <TableCell className="space-x-1 text-xs">
                          {resp.length === 0 ? <span className="text-muted-foreground">—</span> : resp.map((r) => (
                            <Badge key={r.id} variant="secondary">{userLabel(r.user_id)}</Badge>
                          ))}
                        </TableCell>
                        <TableCell className="text-sm">{veh.length}</TableCell>
                        <TableCell>
                          <Badge variant={f.is_active ? "secondary" : "outline"}>{f.is_active ? "Ativa" : "Inativa"}</Badge>
                        </TableCell>
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="outline" onClick={() => setEditFleet({ ...f })}>Editar</Button>
                          <Button size="sm" variant="outline" onClick={() => setRespFleet(f)}>Responsáveis</Button>
                          <Button size="sm" variant="outline" onClick={() => setVehFleet(f)}>Veículos</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Veículos sem frota ({unassigned.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Chassi</TableHead>
                    <TableHead>TAG</TableHead>
                    <TableHead>Interno</TableHead>
                    <TableHead>Frota</TableHead>
                    <TableHead>Equipamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassigned.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Todos os veículos estão alocados.</TableCell></TableRow>
                  )}
                  {unassigned.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.license_plate ?? "—"}</TableCell>
                      <TableCell className="text-sm">{v.chassis ?? "—"}</TableCell>
                      <TableCell className="text-sm">{v.tag ?? "—"}</TableCell>
                      <TableCell className="text-sm">{v.internal_id ?? "—"}</TableCell>
                      <TableCell>
                        <select
                          className="h-8 rounded border bg-background px-2 text-xs"
                          value=""
                          onChange={(e) => e.target.value && transferVehicle(v.id, e.target.value)}
                        >
                          <option value="">Alocar em...</option>
                          {(fleets ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setEquipVehicle(v)}>Equipamentos</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Editar frota */}
      <Dialog open={!!editFleet} onOpenChange={(o) => !o && setEditFleet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar frota</DialogTitle>
            <DialogDescription>Atualize dados e status da frota.</DialogDescription>
          </DialogHeader>
          {editFleet && (
            <form onSubmit={saveFleetEdit} className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={editFleet.name} onChange={(e) => setEditFleet({ ...editFleet, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Código</Label><Input value={editFleet.code ?? ""} onChange={(e) => setEditFleet({ ...editFleet, code: e.target.value })} /></div>
              <div className="space-y-1"><Label>Local de atuação</Label><Input value={editFleet.location_name ?? ""} onChange={(e) => setEditFleet({ ...editFleet, location_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Cidade</Label><Input value={editFleet.city ?? ""} onChange={(e) => setEditFleet({ ...editFleet, city: e.target.value })} /></div>
                <div className="space-y-1"><Label>UF</Label><Input maxLength={2} value={editFleet.state ?? ""} onChange={(e) => setEditFleet({ ...editFleet, state: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editFleet.is_active} onChange={(e) => setEditFleet({ ...editFleet, is_active: e.target.checked })} />
                Frota ativa
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditFleet(null)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Responsáveis */}
      <Dialog open={!!respFleet} onOpenChange={(o) => !o && setRespFleet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responsáveis — {respFleet?.name}</DialogTitle>
            <DialogDescription>
              Somente usuários do mesmo cliente podem ser responsáveis. Cada responsável vê apenas os veículos e eventos das frotas em que está vinculado.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {(clientUsers ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário vinculado a este cliente.</p>
            )}
            {(clientUsers ?? []).map((u) => {
              const checked = (responsibles ?? []).some((r) => r.fleet_id === respFleet?.id && r.user_id === u.id);
              return (
                <label key={u.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => respFleet && toggleResponsible(respFleet, u.id, e.target.checked)}
                  />
                  <span className="font-medium">{u.full_name || u.email}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Veículos da frota */}
      <Dialog open={!!vehFleet} onOpenChange={(o) => !o && setVehFleet(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Veículos — {vehFleet?.name}</DialogTitle>
            <DialogDescription>
              Informe a placa (ou outro identificador). Se o veículo já existir na base do cliente, ele será reaproveitado e apenas realocado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addVehicle} className="grid gap-3 rounded border bg-muted/30 p-3 md:grid-cols-4">
            <div className="space-y-1"><Label>Placa</Label><Input value={vPlate} onChange={(e) => setVPlate(e.target.value)} required /></div>
            <div className="space-y-1"><Label>Chassi</Label><Input value={vChassis} onChange={(e) => setVChassis(e.target.value)} /></div>
            <div className="space-y-1"><Label>TAG</Label><Input value={vTag} onChange={(e) => setVTag(e.target.value)} /></div>
            <div className="space-y-1"><Label>Identificador interno</Label><Input value={vInternal} onChange={(e) => setVInternal(e.target.value)} /></div>
            <div className="space-y-1"><Label>Local de atuação</Label><Input value={vLocation} onChange={(e) => setVLocation(e.target.value)} /></div>
            <div className="space-y-1"><Label>Cidade</Label><Input value={vCity} onChange={(e) => setVCity(e.target.value)} /></div>
            <div className="space-y-1"><Label>UF</Label><Input maxLength={2} value={vState} onChange={(e) => setVState(e.target.value)} /></div>
            <div className="flex items-end"><Button type="submit" className="w-full" disabled={savingVehicle}>Adicionar</Button></div>
          </form>
          <div className="max-h-72 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Transferir para</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(vehicles ?? []).filter((v) => v.fleet_id === vehFleet?.id).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.license_plate ?? v.chassis ?? v.tag ?? v.internal_id ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {[v.location_name, [v.city, v.state].filter(Boolean).join("/")].filter(Boolean).join(" — ") || "—"}
                    </TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded border bg-background px-2 text-xs"
                        value=""
                        onChange={(e) => e.target.value && transferVehicle(v.id, e.target.value === "none" ? null : e.target.value)}
                      >
                        <option value="">Selecionar frota</option>
                        <option value="none">Remover da frota</option>
                        {(fleets ?? []).filter((f) => f.id !== vehFleet?.id).map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setEquipVehicle(v)}>Equipamentos</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Equipamentos */}
      <Dialog open={!!equipVehicle} onOpenChange={(o) => !o && setEquipVehicle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Equipamentos — {equipVehicle?.license_plate ?? "veículo"}</DialogTitle>
            <DialogDescription>Um veículo pode ter mais de um equipamento instalado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addEquipment} className="grid grid-cols-2 gap-3 rounded border bg-muted/30 p-3">
            <div className="space-y-1"><Label>IMEI</Label><Input value={eImei} onChange={(e) => setEImei(e.target.value)} /></div>
            <div className="space-y-1"><Label>Nº de série</Label><Input value={eSerial} onChange={(e) => setESerial(e.target.value)} /></div>
            <div className="space-y-1"><Label>TAG</Label><Input value={eTag} onChange={(e) => setETag(e.target.value)} /></div>
            <div className="space-y-1"><Label>ID do dispositivo</Label><Input value={eDevice} onChange={(e) => setEDevice(e.target.value)} /></div>
            <div className="col-span-2"><Button type="submit" className="w-full">Vincular equipamento</Button></div>
          </form>
          <div className="space-y-2 text-sm">
            {(equipments ?? []).length === 0 && <p className="text-muted-foreground">Nenhum equipamento vinculado.</p>}
            {(equipments ?? []).map((eq) => (
              <div key={eq.id} className="rounded border p-2 text-xs">
                IMEI: {eq.imei ?? "—"} · Série: {eq.serial_number ?? "—"} · TAG: {eq.tag ?? "—"} · Dispositivo: {eq.device_id ?? "—"}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminFleetsGated() {
  return (
    <FeatureGate feature={FEATURES.fleets}>
      <AdminFleets />
    </FeatureGate>
  );
}
