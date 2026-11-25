import { createFileRoute } from "@tanstack/react-router";
import { FEATURES } from "@/lib/ge/features";
import { FeatureGate } from "@/components/ge/feature-gate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Power, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao-eventos/admin/drivers")({
  component: DriversPageGated,
});

type Driver = {
  id: string;
  client_id: string;
  full_name: string;
  cpf: string;
  license_plate: string | null;
  is_active: boolean;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function formatCpf(cpf: string) {
  const d = onlyDigits(cpf).padEnd(11, "_").slice(0, 11);
  if (d.includes("_")) return onlyDigits(cpf);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += Number(d[i]) * (slice + 1 - i);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function DriversPage() {
  const { profile, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const clientId = profile?.client_id ?? (isPlatformAdmin ? selectedClientId || null : null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [plate, setPlate] = useState("");
  const [saving, setSaving] = useState(false);

  // Admin de plataforma sem cliente no perfil escolhe a base que quer administrar.
  const { data: clients } = useQuery({
    queryKey: ["drivers-clients"],
    enabled: isPlatformAdmin && !profile?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_clients")
        .select("id,name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });


  const { data: drivers, isLoading } = useQuery({
    queryKey: ["drivers", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_drivers")
        .select("id,client_id,full_name,cpf,license_plate,is_active")
        .eq("client_id", clientId!)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Driver[];
    },
  });

  // Frotas visíveis (RLS já limita às frotas de responsabilidade do usuário)
  const { data: fleets } = useQuery({
    queryKey: ["drivers-fleets", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_fleets")
        .select("id,name")
        .eq("client_id", clientId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["drivers-vehicles", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_vehicles")
        .select("id,license_plate,fleet_id")
        .eq("client_id", clientId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Motoristas identificados nos eventos e ainda não cadastrados na base
  const { data: detected } = useQuery({
    queryKey: ["drivers-detected", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_events")
        .select("driver_name,license_plate,event_time")
        .eq("client_id", clientId!)
        .not("driver_name", "is", null)
        .order("event_time", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map = new Map<string, { name: string; plate: string | null }>();
      for (const e of data ?? []) {
        const name = (e.driver_name ?? "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, { name, plate: e.license_plate ?? null });
      }
      return Array.from(map.values());
    },
  });

  const normPlate = (p?: string | null) => (p ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const fleetNameForPlate = (plate?: string | null) => {
    const n = normPlate(plate);
    if (n.length < 5) return null;
    const v = (vehicles ?? []).find((x) => {
      const vp = normPlate(x.license_plate);
      return vp.length >= 5 && (vp === n || n.includes(vp) || vp.includes(n));
    });
    if (!v?.fleet_id) return null;
    return (fleets ?? []).find((f) => f.id === v.fleet_id)?.name ?? null;
  };

  // Usuário responsável por frotas vê apenas motoristas das suas frotas
  const { data: myFleetIds } = useQuery({
    queryKey: ["drivers-my-fleets", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_fleet_responsibles")
        .select("fleet_id")
        .eq("user_id", profile!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.fleet_id);
    },
  });
  const fleetRestricted = !isPlatformAdmin && (myFleetIds?.length ?? 0) > 0;

  const registeredNames = new Set((drivers ?? []).map((d) => d.full_name.trim().toLowerCase()));
  const pendingDrivers = (detected ?? []).filter((d) => !registeredNames.has(d.name.toLowerCase()));

  const [fleetFilter, setFleetFilter] = useState<string>("all");
  const visibleDrivers = (drivers ?? []).filter((d) => {
    const fleetName = fleetNameForPlate(d.license_plate);
    if (fleetRestricted && !fleetName) return false;
    if (fleetFilter === "all") return true;
    return fleetName === fleetFilter;
  });



  const openCreate = (prefill?: { name?: string; plate?: string | null }) => {
    setEditing(null);
    setName(prefill?.name ?? "");
    setCpf("");
    setPlate(prefill?.plate ?? "");
    setDialogOpen(true);
  };


  const openEdit = (d: Driver) => {
    setEditing(d);
    setName(d.full_name);
    setCpf(formatCpf(d.cpf));
    setPlate(d.license_plate ?? "");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!clientId) return toast.error("Usuário sem cliente associado");
    if (!name.trim()) return toast.error("Informe o nome");
    const cpfDigits = onlyDigits(cpf);
    if (!isValidCpf(cpfDigits)) return toast.error("CPF inválido");
    const plateValue = plate.trim() ? plate.trim().toUpperCase() : null;

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("ge_drivers")
          .update({ full_name: name.trim(), cpf: cpfDigits, license_plate: plateValue })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Motorista atualizado");
      } else {
        const { error } = await supabase.from("ge_drivers").insert({
          client_id: clientId,
          full_name: name.trim(),
          cpf: cpfDigits,
          license_plate: plateValue,
        });
        if (error) {
          if (error.code === "23505") throw new Error("CPF já cadastrado para este cliente");
          throw error;
        }
        toast.success("Motorista cadastrado");
      }
      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ["drivers", clientId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (d: Driver) => {
    const { error } = await supabase
      .from("ge_drivers")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["drivers", clientId] });
  };

  const showClientPicker = isPlatformAdmin && !profile?.client_id;

  if (!clientId && !showClientPicker) {
    return <div className="text-muted-foreground">Você precisa estar associado a um cliente.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Motoristas</h1>
          <p className="text-sm text-muted-foreground">Cadastro de motoristas do cliente.</p>
        </div>
        <div className="flex items-center gap-2">
          {showClientPicker && (
            <select
              className="h-9 rounded border bg-background px-2 text-sm"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Selecione o cliente</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={fleetFilter}
            onChange={(e) => setFleetFilter(e.target.value)}
            aria-label="Filtrar por frota"
          >
            <option value="all">Todas as frotas</option>
            {(fleets ?? []).map((f) => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
          <Button onClick={() => openCreate()} disabled={!clientId}>
            <Plus className="mr-1 h-4 w-4" /> Novo motorista
          </Button>
        </div>
      </div>

      {pendingDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Motoristas identificados nos eventos ({pendingDrivers.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pendingDrivers.map((d) => (
              <Button
                key={d.name}
                size="sm"
                variant="outline"
                onClick={() => openCreate({ name: d.name, plate: d.plate })}
              >
                <Plus className="mr-1 h-3 w-3" />
                {d.name}
                {d.plate ? ` · ${d.plate}` : ""}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}



      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Placa do veículo</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && visibleDrivers.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum motorista cadastrado.</TableCell></TableRow>
              )}
              {visibleDrivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.full_name}</TableCell>
                  <TableCell className="font-mono text-sm">{formatCpf(d.cpf)}</TableCell>
                  <TableCell className="font-mono text-sm">{d.license_plate ?? "—"}</TableCell>
                  <TableCell className="text-sm">{fleetNameForPlate(d.license_plate) ?? "—"}</TableCell>
                  <TableCell>
                    {d.is_active ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggleActive(d)} aria-label={d.is_active ? "Desativar" : "Ativar"}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar motorista" : "Novo motorista"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João da Silva" maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
              />
            </div>
            <div className="space-y-1">
              <Label>Placa do veículo (opcional)</Label>
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="ABC1D23"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Usada para identificar o motorista automaticamente nos eventos da placa.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriversPageGated() {
  return (
    <FeatureGate feature={FEATURES.drivers}>
      <DriversPage />
    </FeatureGate>
  );
}
