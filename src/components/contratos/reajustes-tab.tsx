import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aplicarReajusteFn, listarReajustesFn } from "@/lib/contratos-automacao.functions";

const brl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const data = (iso: string) => iso.split("-").reverse().join("/");

/** Contratos › Reajustes: aniversários próximos com o reajuste calculado, para aplicar e avisar o cliente. */
export function ReajustesTab({ gestor }: { gestor: boolean }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarReajustesFn);
  const aplicar = useServerFn(aplicarReajusteFn);
  const q = useQuery({ queryKey: ["contratos-reajustes"], queryFn: () => listar(), retry: false });
  const [pct, setPct] = useState<Record<string, string>>({});
  const [avisar, setAvisar] = useState<Record<string, { w: boolean; e: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const r = q.data;

  const doAplicar = async (id: string, dataAniv: string, base: number | null, temW: boolean, temE: boolean) => {
    const p = Number(String(pct[id] ?? base ?? "").replace(",", "."));
    if (!Number.isFinite(p)) { toast.error("Informe o percentual."); return; }
    const av = avisar[id] ?? { w: true, e: true };
    setBusy(id);
    try {
      const res: any = await aplicar({ data: { id, data: dataAniv, pct: p, whatsapp: av.w && temW, email: av.e && temE } });
      toast.success(`Reajuste aplicado: ${brl(res.de)} → ${brl(res.para)}${res.enviados.length ? `; cliente avisado por ${res.enviados.join(" e ")}` : ""}.`);
      if (Object.keys(res.erros || {}).length) toast.error(`Aviso não enviado: ${Object.values(res.erros).join("; ")}`);
      q.refetch();
      qc.invalidateQueries({ queryKey: ["contratos"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha ao aplicar."); }
    finally { setBusy(null); }
  };

  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message} Confira se a migração 0062 foi aplicada.</p>;
  if (!r) return null;

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-3 text-sm flex flex-wrap items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Índice: <b>{r.indiceLabel}</b>
        {r.pct != null ? <Badge variant="outline">{r.pct.toLocaleString("pt-BR")}%{r.info?.ate ? ` acumulado até ${r.info.ate.split("-").reverse().join("/")}` : ""}</Badge> : <span className="text-amber-700">índice ainda não buscado (Configurações › Contratos)</span>}
        <span className="text-xs text-muted-foreground ml-auto">Aniversários dos contratos com clientes assinados. Ajuste o percentual se negociou outro.</span>
      </CardContent></Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Aniversário</TableHead><TableHead className="text-right">Valor atual</TableHead><TableHead>%</TableHead><TableHead className="text-right">Novo valor</TableHead><TableHead>Avisar</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {r.itens.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum reajuste nos próximos dias.</TableCell></TableRow>}
            {r.itens.map((it) => {
              const p = Number(String(pct[it.id] ?? r.pct ?? "").replace(",", "."));
              const novo = it.valorAtual != null && Number.isFinite(p) ? Math.round(it.valorAtual * (1 + p / 100) * 100) / 100 : null;
              const av = avisar[it.id] ?? { w: true, e: true };
              return (
                <TableRow key={`${it.id}-${it.data}`}>
                  <TableCell>{it.numero}</TableCell>
                  <TableCell className="font-medium">{it.cliente}</TableCell>
                  <TableCell className="whitespace-nowrap">{data(it.data)} <span className="text-xs text-muted-foreground">{it.diasAte >= 0 ? `em ${it.diasAte}d` : `há ${-it.diasAte}d`}</span></TableCell>
                  <TableCell className="text-right">{brl(it.valorAtual)}</TableCell>
                  <TableCell><Input className="h-7 w-20" value={pct[it.id] ?? (r.pct != null ? String(r.pct) : "")} onChange={(e) => setPct((x) => ({ ...x, [it.id]: e.target.value }))} disabled={!gestor} /></TableCell>
                  <TableCell className="text-right font-medium">{brl(novo)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <label className="flex items-center gap-1"><Checkbox checked={av.w && it.temWhatsapp} disabled={!it.temWhatsapp} onCheckedChange={(v) => setAvisar((x) => ({ ...x, [it.id]: { ...av, w: !!v } }))} />WhatsApp</label>
                    <label className="flex items-center gap-1"><Checkbox checked={av.e && it.temEmail} disabled={!it.temEmail} onCheckedChange={(v) => setAvisar((x) => ({ ...x, [it.id]: { ...av, e: !!v } }))} />E-mail</label>
                  </TableCell>
                  <TableCell>
                    {gestor && <Button size="sm" disabled={busy === it.id || it.valorAtual == null} onClick={() => doAplicar(it.id, it.data, r.pct, it.temWhatsapp, it.temEmail)} title={it.valorAtual == null ? "Contrato sem valor mensal" : ""}>
                      {busy === it.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Aplicar
                    </Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
