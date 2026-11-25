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
import { buildRowsFromMatrix, detectHeaderRow, detectarModelo, normalizarLinhas, normalizeClientKey, planImport, MAPEAMENTO_PADRAO, type Mapping, type ModeloPlanilha, type VehicleRow } from "@/lib/reconnect";
import { useServerFn } from "@tanstack/react-start";
import { atualizarRiscoReconnect } from "@/lib/reconnect.functions";
import { logRc, rc, upsertEmBlocos, useRcInvalidate, type RcClient, type RcImportTemplate } from "./use-rc";

type Arquivo = { name: string; headers: string[]; rows: Record<string, unknown>[]; linhaInicial: number; modelo: ModeloPlanilha };
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
  const headers = rows.length ? Object.keys(rows[0]) : [];
  // Cada planilha é reconhecida pelo próprio cabeçalho (cada sistema tem o seu modelo).
  return { name: file.name, headers, rows, linhaInicial: detectHeaderRow(matrix) + 2, modelo: detectarModelo(headers, rows) };
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
  const [descartar, setDescartar] = useState(true);
  const [maxDias, setMaxDias] = useState(2);
  const [importando, setImportando] = useState(false);
  const [drag, setDrag] = useState(false);
  const faltando = arquivos.filter((a) => !a.modelo.mapping.plate || !a.modelo.mapping.client);
  const setMapArquivo = (i: number, k: keyof Mapping, v: string) =>
    setArquivos((xs) => xs.map((a, j) => (j === i ? { ...a, modelo: { ...a.modelo, mapping: { ...a.modelo.mapping, [k]: v } } } : a)));

  const adicionar = async (files: FileList | File[] | null) => {
    if (!files || !(files as any).length) return;
    setLendo(true);
    try {
      const lidos: Arquivo[] = [];
      for (const f of Array.from(files)) {
        try { lidos.push(await lerPlanilha(f)); } catch (e: any) { toast.error(`${f.name}: ${e?.message ?? "não foi possível ler"}`); }
      }
      setArquivos((xs) => [...xs, ...lidos]);
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const importar = async () => {
    if (faltando.length) { toast.error(`Escolha as colunas de Placa e Cliente em: ${faltando.map((a) => a.name).join(", ")}`); return; }
    setImportando(true);
    try {
      // Todas as planilhas viram uma importação só (colunas padrão), cada uma lida pelo seu modelo.
      const rows = arquivos.flatMap((a) => normalizarLinhas(a.rows, a.modelo, a.name, a.linhaInicial));
      const mapping = MAPEAMENTO_PADRAO;
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

  const aplicarModelo = (i: number, id: string) => {
    const t = importTemplates.find((x) => x.id === id);
    if (!t) return;
    for (const k of ["plate", "client", "lastCommunication", "batteryVoltage"] as (keyof Mapping)[]) setMapArquivo(i, k, (t.mapping as any)[k] || "");
  };
  const Campo = ({ i, k, label, obrigatorio }: { i: number; k: keyof Mapping; label: string; obrigatorio?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}{obrigatorio && " *"}</Label>
      <Select value={arquivos[i].modelo.mapping[k] || NONE} onValueChange={(v) => setMapArquivo(i, k, v === NONE ? "" : v)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— não usar —</SelectItem>
          {arquivos[i].headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar planilhas</DialogTitle>
            <DialogDescription>{arquivos.reduce((s, a) => s + a.rows.length, 0)} linha(s) em {arquivos.length} arquivo(s). Confira as colunas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {arquivos.map((a, i) => (
              <div key={i} className="rounded border p-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium truncate max-w-[260px]" title={a.name}>{a.name}</span>
                  <Badge variant="secondary">{a.rows.length} linha(s)</Badge>
                  <Badge variant="outline">{a.modelo.nome}</Badge>
                  {importTemplates.length > 0 && (
                    <Select onValueChange={(id) => aplicarModelo(i, id)}>
                      <SelectTrigger className="h-7 w-[180px] text-xs"><SelectValue placeholder="Aplicar modelo salvo" /></SelectTrigger>
                      <SelectContent>{importTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <button className="ml-auto text-muted-foreground" onClick={() => setArquivos((x) => x.filter((_, j) => j !== i))} title="Tirar esta planilha"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Campo i={i} k="plate" label="Placa" obrigatorio />
                  <Campo i={i} k="client" label="Cliente" obrigatorio />
                  <Campo i={i} k="lastCommunication" label="Última comunicação" />
                  <Campo i={i} k="batteryVoltage" label="Bateria" />
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => inputRef.current?.click()}>+ Adicionar mais planilhas</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Cada planilha é lida pelo modelo do seu sistema. Placa é tirada de textos como "FIAT/STRADA TCA-8A29". Data em branco entra como <b>Sem comunicação</b>. Equipamento "Inativo" no relatório de equipamentos é ignorado.</p>
          <div className="flex items-center gap-2 text-sm rounded border p-2">
            <Checkbox id="rc-desc" checked={descartar} onCheckedChange={(v) => setDescartar(v === true)} />
            <label htmlFor="rc-desc">Descartar veículos com comunicação recente (até</label>
            <Input type="number" className="h-7 w-16" min={0} value={maxDias} onChange={(e) => setMaxDias(Number(e.target.value) || 0)} />
            <span>dias)</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArquivos([])} disabled={importando}>Cancelar</Button>
            <Button onClick={importar} disabled={importando || faltando.length > 0}>{importando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
