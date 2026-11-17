import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Link2, Unlink, Package, X } from "lucide-react";
import { toast } from "sonner";
import { computeKpis, summaryByModel, isReady, isAwaitingChip, hasTecnico, normStatus } from "@/lib/estoque-kpis";
import { vincularPlaca } from "@/lib/estoque.functions";

type Row = { codigo: number; serie: string | null; equipamento: string | null; raw: any };

const PAGE = 100;

function tecName(t: unknown): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  const o = t as any;
  return String(o.DisplayName ?? o.Nome ?? o.Name ?? "");
}

async function fetchAll(): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("gsystem_equipamentos")
      .select("codigo, serie, equipamento, raw")
      .order("codigo", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function EquipChipsTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["estoque-equip-chips"], queryFn: fetchAll, staleTime: 60_000 });
  const [fId, setFId] = useState("");
  const [fChip, setFChip] = useState("");
  const [fSerie, setFSerie] = useState("");
  const [fPlaca, setFPlaca] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fModelo, setFModelo] = useState("all");
  const [fTec, setFTec] = useState("all");
  const [page, setPage] = useState(0);
  const [linkRow, setLinkRow] = useState<{ row: Row; op: "vincular" | "desvincular" } | null>(null);
  const [kitRow, setKitRow] = useState<Row | null>(null);

  const raws = useMemo(() => rows.map((r) => r.raw ?? {}), [rows]);
  const kpis = useMemo(() => computeKpis(raws), [raws]);
  const summary = useMemo(() => summaryByModel(raws), [raws]);
  const statuses = useMemo(() => [...new Set(raws.map((r: any) => r.Status).filter(Boolean))].sort(), [raws]);
  const modelos = useMemo(() => [...new Set(raws.map((r: any) => r.Modelo).filter(Boolean))].sort(), [raws]);

  const filtered = useMemo(() => {
    const chipDigits = fChip.replace(/\D/g, "");
    return rows.filter((r) => {
      const x = r.raw ?? {};
      if (fId && !String(r.codigo).includes(fId.trim())) return false;
      if (chipDigits && !String(x.Chip ?? "").replace(/\D/g, "").includes(chipDigits)) return false;
      if (fSerie && !`${r.serie ?? ""} ${r.equipamento ?? ""}`.toLowerCase().includes(fSerie.toLowerCase().trim())) return false;
      if (fPlaca && !String(x.Placa ?? "").toUpperCase().includes(fPlaca.toUpperCase().replace(/[^A-Z0-9]/g, ""))) return false;
      if (fStatus === "pronto" && !isReady(x)) return false;
      if (fStatus === "aguardando" && !isAwaitingChip(x)) return false;
      if (fStatus !== "all" && fStatus !== "pronto" && fStatus !== "aguardando" && x.Status !== fStatus) return false;
      if (fModelo !== "all" && x.Modelo !== fModelo) return false;
      if (fTec === "com" && !hasTecnico(x)) return false;
      if (fTec === "sem" && hasTecnico(x)) return false;
      return true;
    });
  }, [rows, fId, fChip, fSerie, fPlaca, fStatus, fModelo, fTec]);

  const pageRows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const reset = () => setPage(0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi label="Prontos para instalação" hint="Equipamento + chip" value={kpis.ready} onClick={() => { setFStatus("pronto"); reset(); }} />
        <Kpi label="Aguardando chip" value={kpis.awaiting} onClick={() => { setFStatus("aguardando"); reset(); }} />
        <Kpi label="Com técnicos" value={kpis.tecnico} onClick={() => { setFTec("com"); reset(); }} />
        <Kpi label="Vinculados em veículos" value={kpis.linked} onClick={() => { setFStatus("Vinculado"); reset(); }} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Disponíveis por modelo</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {summary.map((s) => (
            <button key={s.modelo} onClick={() => { setFModelo(s.modelo); reset(); }}
              className={`rounded-md border px-3 py-1.5 text-left text-xs hover:bg-muted ${fModelo === s.modelo ? "border-primary bg-muted" : ""}`}>
              <div className="font-semibold">{s.modelo}</div>
              <div className="text-muted-foreground">{s.ready} com chip · {s.awaiting} sem chip</div>
            </button>
          ))}
          {!summary.length && !isLoading && <p className="text-sm text-muted-foreground">Nenhum equipamento disponível.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 grid gap-2 md:grid-cols-4 lg:grid-cols-8">
          <Input placeholder="ID equipamento" value={fId} onChange={(e) => { setFId(e.target.value); reset(); }} />
          <Input placeholder="Chip / ICCID / linha" value={fChip} onChange={(e) => { setFChip(e.target.value); reset(); }} />
          <Input placeholder="Série / IMEI" value={fSerie} onChange={(e) => { setFSerie(e.target.value); reset(); }} />
          <Input placeholder="Placa" value={fPlaca} onChange={(e) => { setFPlaca(e.target.value); reset(); }} />
          <Select value={fStatus} onValueChange={(v) => { setFStatus(v); reset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pronto">Prontos p/ instalação</SelectItem>
              <SelectItem value="aguardando">Aguardando chip</SelectItem>
              {statuses.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fModelo} onValueChange={(v) => { setFModelo(v); reset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos modelos</SelectItem>
              {modelos.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTec} onValueChange={(v) => { setFTec(v); reset(); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Técnico: todos</SelectItem>
              <SelectItem value="com">Com técnico</SelectItem>
              <SelectItem value="sem">Sem técnico</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" onClick={() => { setFId(""); setFChip(""); setFSerie(""); setFPlaca(""); setFStatus("all"); setFModelo("all"); setFTec("all"); reset(); }}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Série/IMEI</TableHead><TableHead>Modelo</TableHead>
                <TableHead>Chip</TableHead><TableHead>Status</TableHead><TableHead>Placa</TableHead>
                <TableHead>Cliente</TableHead><TableHead>Técnico</TableHead><TableHead>Plataforma</TableHead>
                <TableHead>Fornecedor</TableHead><TableHead>Parâmetros / Obs.</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhum equipamento encontrado.</TableCell></TableRow>
              ) : pageRows.map((r) => {
                const x = r.raw ?? {};
                const linked = normStatus(x.Status) === "vinculado";
                const params = x.Parametros && typeof x.Parametros === "object"
                  ? Object.entries(x.Parametros).map(([k, v]) => `${k}: ${String(v).slice(0, 10)}`).join(" · ") : "";
                return (
                  <TableRow key={r.codigo}>
                    <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                    <TableCell className="font-mono text-xs">{r.equipamento ?? r.serie}</TableCell>
                    <TableCell className="text-xs">{x.Modelo ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={x.Chip ?? ""}>{x.Chip ?? "—"}</TableCell>
                    <TableCell><Badge variant={linked ? "secondary" : "outline"}>{x.Status ?? "—"}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{x.Placa ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate" title={x.Cliente ?? ""}>{x.Cliente ?? x.Empresa ?? "—"}</TableCell>
                    <TableCell className="text-xs">{tecName(x.Tecnico) || "—"}</TableCell>
                    <TableCell className="text-xs">{x.Plataforma ?? "—"}</TableCell>
                    <TableCell className="text-xs">{x.Fornecedor ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={`${params} ${x.Observacao ?? ""}`}>{[params, x.Observacao].filter(Boolean).join(" · ") || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {linked ? (
                        <Button size="sm" variant="outline" onClick={() => setLinkRow({ row: r, op: "desvincular" })}><Unlink className="h-3.5 w-3.5 mr-1" />Desvincular</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setLinkRow({ row: r, op: "vincular" })}><Link2 className="h-3.5 w-3.5 mr-1" />Vincular</Button>
                      )}
                      <Button size="sm" variant="ghost" className="ml-1" onClick={() => setKitRow(r)} title="Acessórios do kit"><Package className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} equipamentos</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span>{page + 1} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>

      {linkRow && <LinkDialog row={linkRow.row} op={linkRow.op} onClose={() => setLinkRow(null)}
        onDone={() => { setLinkRow(null); qc.invalidateQueries({ queryKey: ["estoque-equip-chips"] }); qc.invalidateQueries({ queryKey: ["estoque-historico"] }); }} />}
      {kitRow && <KitDialog row={kitRow} onClose={() => setKitRow(null)} />}
    </div>
  );
}

function Kpi({ label, value, hint, onClick }: { label: string; value: number; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{label}{hint ? ` (${hint})` : ""}</p>
          <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
        </CardContent>
      </Card>
    </button>
  );
}

function LinkDialog({ row, op, onClose, onDone }: { row: Row; op: "vincular" | "desvincular"; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(vincularPlaca);
  const [placa, setPlaca] = useState(String(row.raw?.Placa ?? ""));
  const [sec, setSec] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await fn({ data: { codigo: String(row.codigo), placa, operacao: op, secundario: sec } });
      toast.success(op === "vincular" ? "Equipamento vinculado no GSystem." : "Equipamento desvinculado no GSystem.");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na operação.");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{op === "vincular" ? "Vincular à placa" : "Desvincular da placa"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Equipamento <b>{row.codigo}</b> · {row.equipamento ?? row.serie} · {row.raw?.Modelo}</p>
          <p className="text-muted-foreground">Chip: {row.raw?.Chip ?? "sem chip"}</p>
          <div><Label>Placa</Label><Input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC1D23" /></div>
          <div className="flex items-center gap-2"><Checkbox id="sec" checked={sec} onCheckedChange={(v) => setSec(!!v)} /><Label htmlFor="sec">Equipamento secundário</Label></div>
          <p className="text-xs text-muted-foreground">A alteração é gravada no GSystem e registrada no histórico com seu usuário e data/hora.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || placa.replace(/[^A-Z0-9]/gi, "").length < 5}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KitDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const codigo = String(row.codigo);
  const { data: catalog = [] } = useQuery({
    queryKey: ["accessory-catalog"],
    queryFn: async () => (await supabase.from("accessory_catalog").select("*").order("name")).data ?? [],
  });
  const { data: items = [] } = useQuery({
    queryKey: ["kit", codigo],
    queryFn: async () => (await supabase.from("equipment_kit_items").select("accessory_id, quantidade").eq("equipamento_codigo", codigo)).data ?? [],
  });
  const [busy, setBusy] = useState<string | null>(null);
  const setQty = async (accessoryId: string, qtd: number) => {
    setBusy(accessoryId);
    const { error } = await supabase.rpc("set_equipment_kit_item", { _codigo: codigo, _accessory: accessoryId, _qtd: qtd });
    setBusy(null);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["kit", codigo] });
    qc.invalidateQueries({ queryKey: ["accessory-catalog"] });
    qc.invalidateQueries({ queryKey: ["estoque-historico"] });
  };
  const qtyOf = (id: string) => items.find((i) => i.accessory_id === id)?.quantidade ?? 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Acessórios do kit · {row.codigo} ({row.raw?.Modelo})</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {catalog.filter((c) => c.ativo || qtyOf(c.id) > 0).map((c) => {
            const q = qtyOf(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <div className="font-medium">{c.name}{c.modelo ? ` · ${c.modelo}` : ""}</div>
                  <div className="text-xs text-muted-foreground">Saldo: {c.saldo}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={q === 0 || busy === c.id} onClick={() => setQty(c.id, q - 1)}>−</Button>
                  <span className="w-6 text-center font-semibold">{q}</span>
                  <Button size="sm" variant="outline" disabled={c.saldo <= 0 || busy === c.id} onClick={() => setQty(c.id, q + 1)}>+</Button>
                </div>
              </div>
            );
          })}
          {!catalog.length && <p className="text-sm text-muted-foreground">Cadastre acessórios na aba "Catálogo de Acessórios".</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
