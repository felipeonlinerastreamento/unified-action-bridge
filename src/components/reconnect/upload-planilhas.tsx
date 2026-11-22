import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { autoDetect, buildRowsFromMatrix, normalizeClientKey, planImport, type Mapping, type VehicleRow } from "@/lib/reconnect";
import { useServerFn } from "@tanstack/react-start";
import { atualizarRiscoReconnect } from "@/lib/reconnect.functions";
import { logRc, rc, upsertEmBlocos, useRcInvalidate, type RcClient, type RcImportTemplate } from "./use-rc";

type Arquivo = { name: string; headers: string[]; rows: Record<string, unknown>[] };
const NONE = "__none__";

async function lerPlanilha(file: File): Promise<Arquivo> {
  const XLSX = await import("@/vendor/xlsx/xlsx.mjs");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const keys = Object.keys(ws).filter((k) => !k.startsWith("!"));
  if (keys.length) {
    const dec = keys.map((k) => XLSX.utils.decode_cell(k));
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(...dec.map((d: any) => d.r)), c: Math.max(...dec.map((d: any) => d.c)) } });
  }
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as unknown[][];
  const rows = buildRowsFromMatrix(matrix).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), v])));
  return { name: file.name, headers: rows.length ? Object.keys(rows[0]) : [], rows };
}

export type ResumoImportacao = { total: number; novos: number; atualizados: number; pulados: { rowNumber: number; rawPlate: string; rawClient: string; reason: string }[]; recuperados: number; avisos: { row: number; issue: string; value: string }[] };

export function UploadPlanilhas({ vehicles, clients, importTemplates, onResumo }: {
  vehicles: VehicleRow[]; clients: RcClient[]; importTemplates: RcImportTemplate[]; onResumo: (r: ResumoImportacao) => void;
}) {
  const { user } = useAuth();
  const invalidate = useRcInvalidate();
  const atualizarRisco = useServerFn(atualizarRiscoReconnect);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [lendo, setLendo] = useState(false);
  const [mapping, setMapping] = useState<Mapping>({ plate: "", client: "", lastCommunication: "", batteryVoltage: "" });
  const [descartar, setDescartar] = useState(false);
  const [maxDias, setMaxDias] = useState(2);
  const [importando, setImportando] = useState(false);
  const [drag, setDrag] = useState(false);
  const headers = [...new Set(arquivos.flatMap((a) => a.headers))];

  const adicionar = async (files: FileList | File[] | null) => {
    if (!files || !(files as any).length) return;
    setLendo(true);
    try {
      const lidos: Arquivo[] = [];
      for (const f of Array.from(files)) {
        try { lidos.push(await lerPlanilha(f)); } catch (e: any) { toast.error(`${f.name}: ${e?.message ?? "não foi possível ler"}`); }
      }
      const todos = [...arquivos, ...lidos];
      setArquivos(todos);
      const hs = [...new Set(todos.flatMap((a) => a.headers))];
      setMapping((m) => (m.plate && m.client ? m : autoDetect(hs)));
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const importar = async () => {
    if (!mapping.plate || !mapping.client) { toast.error("Escolha as colunas de Placa e Cliente."); return; }
    setImportando(true);
    try {
      const rows = arquivos.flatMap((a) => a.rows);
      // Dados frescos do banco antes de importar (protege e-mails/telefones e anotações).
      const [{ data: recRows }, { data: anns }, { data: comps }] = await Promise.all([
        rc.from("rc_recovered_vehicles").select("plate").limit(20000),
        rc.from("rc_vehicle_annotations").select("plate, observation, created_at").order("created_at", { ascending: false }).limit(20000),
        rc.from("companies").select("id, name").limit(5000),
      ]);
      const recoveredPlates = new Map<string, number>();
      for (const r of recRows || []) recoveredPlates.set(r.plate, (recoveredPlates.get(r.plate) ?? 0) + 1);
      const annotations = new Map<string, string>();
      for (const a of anns || []) if (!annotations.has(a.plate)) annotations.set(a.plate, a.observation);
      const plan = planImport({ rows, mapping, discard: { enabled: descartar, maxDays: maxDias }, vehicles, clients, recoveredPlates, annotations });

      const companyByKey = new Map((comps || []).map((c: any) => [normalizeClientKey(c.name), c.id]));
      if (plan.newClients.length) {
        await upsertEmBlocos("rc_clients", plan.newClients.map((c) => ({
          id: c.id, name: c.name, name_key: normalizeClientKey(c.name), emails: [], phones: [], vehicle_count: plan.clientCounts.get(c.id) ?? 0,
          company_id: companyByKey.get(normalizeClientKey(c.name)) ?? null,
        })), "name_key");
      }
      await upsertEmBlocos("rc_vehicles", plan.vehiclesToUpsert);
      for (let i = 0; i < plan.previousSessionIdsToRemove.length; i += 300) {
        const { error } = await rc.from("rc_vehicles").delete().in("id", plan.previousSessionIdsToRemove.slice(i, i + 300));
        if (error) throw new Error(error.message);
      }
      if (plan.recovered.length) await upsertEmBlocos("rc_recovered_vehicles", plan.recovered.map((r) => ({ ...r, id: crypto.randomUUID() })));
      if (plan.skipped.length) await upsertEmBlocos("rc_skipped_rows", plan.skipped.map((s) => ({ id: crypto.randomUUID(), row_number: s.rowNumber, raw_plate: s.rawPlate, raw_client: s.rawClient, reason: s.reason })));
      for (const [clientId, n] of plan.clientCounts) await rc.from("rc_clients").update({ vehicle_count: n }).eq("id", clientId);
      await rc.from("rc_import_history").insert({
        imported_by: user?.email ?? "", user_id: user?.id ?? null, total_rows: rows.length, new_vehicles: plan.newVehicles, updated_vehicles: plan.updatedVehicles,
        skipped_count: plan.skipped.length, recovered_count: plan.recovered.length, warning_count: plan.warnings.length,
        skipped_details: plan.skipped, warning_details: plan.warnings.map((w) => ({ row: w.row, column: w.column, value: w.value, issue: w.issue, severity: w.severity })),
      });
      await logRc(user?.id, "upload", { newVehicles: plan.newVehicles, updatedVehicles: plan.updatedVehicles, skipped: plan.skipped.length, recovered: plan.recovered.length, warnings: plan.warnings.length, arquivos: arquivos.map((a) => a.name) });
      invalidate();
      atualizarRisco().catch(() => undefined); // placas paradas entram no risco do Pós-venda
      onResumo({ total: rows.length, novos: plan.newVehicles, atualizados: plan.updatedVehicles, pulados: plan.skipped, recuperados: plan.recovered.length, avisos: plan.warnings });
      setArquivos([]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na importação.");
    } finally {
      setImportando(false);
    }
  };

  const aplicarModelo = (id: string) => {
    const t = importTemplates.find((x) => x.id === id);
    if (t) setMapping({ plate: t.mapping.plate || "", client: t.mapping.client || "", lastCommunication: t.mapping.lastCommunication || "", batteryVoltage: t.mapping.batteryVoltage || "" });
  };
  const Campo = ({ k, label, obrigatorio }: { k: keyof Mapping; label: string; obrigatorio?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}{obrigatorio && " *"}</Label>
      <Select value={mapping[k] || NONE} onValueChange={(v) => setMapping((m) => ({ ...m, [k]: v === NONE ? "" : v }))}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— não usar —</SelectItem>
          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <Card
        className={`border-dashed ${drag ? "border-primary bg-primary/5" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); adicionar(e.dataTransfer.files); }}
      >
        <CardContent className="p-5 flex flex-wrap items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1 min-w-[220px] text-sm">
            <p className="font-medium">Arraste as planilhas aqui (.xlsx, .xls, .csv)</p>
            <p className="text-xs text-muted-foreground">Pode enviar várias de uma vez. As colunas de placa, cliente, última comunicação e bateria são reconhecidas sozinhas.</p>
          </div>
          <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => adicionar(e.target.files)} />
          <Button onClick={() => inputRef.current?.click()} disabled={lendo}>{lendo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}Selecionar planilhas</Button>
        </CardContent>
      </Card>

      <Dialog open={arquivos.length > 0} onOpenChange={(o) => !o && !importando && setArquivos([])}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar planilhas</DialogTitle>
            <DialogDescription>{arquivos.reduce((s, a) => s + a.rows.length, 0)} linha(s) em {arquivos.length} arquivo(s). Confira as colunas.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1">
            {arquivos.map((a, i) => (
              <Badge key={i} variant="secondary" className="gap-1">{a.name} · {a.rows.length}
                <button onClick={() => setArquivos((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => inputRef.current?.click()}>+ Adicionar mais planilhas</Button>
          </div>
          {importTemplates.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span>Modelo:</span>
              <Select onValueChange={aplicarModelo}>
                <SelectTrigger className="h-8 w-[240px]"><SelectValue placeholder="Carregar modelo de importação" /></SelectTrigger>
                <SelectContent>{importTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo k="plate" label="Placa" obrigatorio />
            <Campo k="client" label="Cliente" obrigatorio />
            <Campo k="lastCommunication" label="Última comunicação / dias" />
            <Campo k="batteryVoltage" label="Tensão da bateria" />
          </div>
          <div className="flex items-center gap-2 text-sm rounded border p-2">
            <Checkbox id="rc-desc" checked={descartar} onCheckedChange={(v) => setDescartar(v === true)} />
            <label htmlFor="rc-desc">Descartar veículos com comunicação recente (até</label>
            <Input type="number" className="h-7 w-16" min={0} value={maxDias} onChange={(e) => setMaxDias(Number(e.target.value) || 0)} />
            <span>dias)</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArquivos([])} disabled={importando}>Cancelar</Button>
            <Button onClick={importar} disabled={importando || !mapping.plate || !mapping.client}>{importando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
