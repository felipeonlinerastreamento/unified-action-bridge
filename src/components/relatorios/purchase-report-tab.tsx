import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Building2,
  Repeat,
  DollarSign,
  Loader2,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { ReportKpiCard } from "./report-kpi-card";
import {
  exportToCSV,
  exportToPDF,
} from "./export-utils";
import {
  usePurchaseFlowConfig,
  usePurchaseSuppliers,
  usePurchaseItems,
} from "@/hooks/use-purchase-requests";

interface Props {
  dateFrom: string;
  dateTo: string;
}

interface HistoryRow {
  id: string;
  ticket_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  supplier_id: string | null;
  supplier_name: string | null;
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function PurchaseReportTab({ dateFrom, dateTo }: Props) {
  const { data: cfg } = usePurchaseFlowConfig();
  const { data: suppliers = [] } = usePurchaseSuppliers();
  const { data: catalog = [] } = usePurchaseItems(false);
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const threshold = cfg?.price_variation_threshold ?? 10;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["purchase-report", dateFrom, dateTo],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from("v_purchase_item_history" as any)
        .select("*")
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .gt("unit_price", 0)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (itemFilter !== "all" && r.item_name !== itemFilter) return false;
      if (supplierFilter !== "all" && r.supplier_id !== supplierFilter) return false;
      return true;
    });
  }, [rows, itemFilter, supplierFilter]);

  // Agregação por item
  const byItem = useMemo(() => {
    const map = new Map<string, {
      name: string;
      occurrences: number;
      qty: number;
      total: number;
      prices: number[];
      lastDate: string;
      lastPrice: number;
    }>();
    // sort by date asc to find first/last
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const r of sorted) {
      const key = r.item_name.toLowerCase();
      const e = map.get(key) || {
        name: r.item_name,
        occurrences: 0,
        qty: 0,
        total: 0,
        prices: [],
        lastDate: r.created_at,
        lastPrice: r.unit_price,
      };
      e.occurrences += 1;
      e.qty += Number(r.quantity);
      e.total += Number(r.unit_price) * Number(r.quantity);
      e.prices.push(Number(r.unit_price));
      e.lastDate = r.created_at;
      e.lastPrice = Number(r.unit_price);
      map.set(key, e);
    }
    return Array.from(map.values()).map((e) => {
      const min = Math.min(...e.prices);
      const max = Math.max(...e.prices);
      const avg = e.prices.reduce((a, b) => a + b, 0) / e.prices.length;
      const variation = avg > 0 ? ((e.lastPrice - avg) / avg) * 100 : 0;
      const saving = e.lastPrice < avg ? (avg - e.lastPrice) * e.qty : 0;
      const inflation = variation > threshold;
      return { ...e, min, max, avg, variation, saving, inflation };
    });
  }, [filtered, threshold]);

  // Frequência (últimos 30 dias)
  const frequency = useMemo(() => {
    const thirtyAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const map = new Map<string, { name: string; count: number }>();
    for (const r of filtered) {
      if (new Date(r.created_at).getTime() < thirtyAgo) continue;
      const key = r.item_name.toLowerCase();
      const e = map.get(key) || { name: r.item_name, count: 0 };
      e.count += 1;
      map.set(key, e);
    }
    return Array.from(map.values())
      .filter((e) => e.count >= 3)
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Concentração de fornecedores
  const supplierConcentration = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    let grand = 0;
    for (const r of filtered) {
      const id = r.supplier_id || "__none__";
      const name = r.supplier_name || "Sem fornecedor";
      const v = Number(r.unit_price) * Number(r.quantity);
      const e = map.get(id) || { name, total: 0 };
      e.total += v;
      map.set(id, e);
      grand += v;
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, share: grand > 0 ? (e.total / grand) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalSpend = useMemo(
    () => filtered.reduce((acc, r) => acc + Number(r.unit_price) * Number(r.quantity), 0),
    [filtered]
  );
  const totalSaving = useMemo(
    () => byItem.reduce((acc, e) => acc + e.saving, 0),
    [byItem]
  );
  const inflationCount = useMemo(
    () => byItem.filter((e) => e.inflation).length,
    [byItem]
  );

  const handleExportCSV = () => {
    const data = byItem.map((e) => ({
      Item: e.name,
      "Compras no período": e.occurrences,
      "Qtd. total": e.qty,
      "Último preço": e.lastPrice.toFixed(2),
      "Mín.": e.min.toFixed(2),
      "Máx.": e.max.toFixed(2),
      "Média": e.avg.toFixed(2),
      "Variação %": e.variation.toFixed(1),
      "Saving": e.saving.toFixed(2),
      "Alerta inflação": e.inflation ? "Sim" : "Não",
    }));
    exportToCSV(data, `compras-${dateFrom}-a-${dateTo}`);
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ReportKpiCard
          title="Gasto total no período"
          value={formatBRL(totalSpend)}
          icon={DollarSign}
          subtitle={`${filtered.length} compras`}
        />
        <ReportKpiCard
          title="Saving acumulado"
          value={formatBRL(totalSaving)}
          icon={TrendingDown}
          subtitle="vs. média histórica do item"
        />
        <ReportKpiCard
          title="Itens com alerta de inflação"
          value={inflationCount}
          icon={AlertCircle}
          subtitle={`acima de +${threshold}%`}
        />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Item</Label>
              <Select value={itemFilter} onValueChange={setItemFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os itens</SelectItem>
                  {catalog.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
                <FileSpreadsheet className="h-4 w-4" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Variação de preço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Variação de preço por item
              </CardTitle>
            </CardHeader>
            <CardContent>
              {byItem.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de compra no período.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Mín.</TableHead>
                      <TableHead className="text-right">Méd.</TableHead>
                      <TableHead className="text-right">Máx.</TableHead>
                      <TableHead className="text-right">Última</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byItem.map((e) => {
                      const above = e.variation > 0;
                      const exceeds = Math.abs(e.variation) > threshold;
                      const cls = !exceeds
                        ? ""
                        : above
                        ? "bg-red-50"
                        : "bg-emerald-50";
                      return (
                        <TableRow key={e.name} className={cls}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell className="text-right">{e.occurrences}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(e.min)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(e.avg)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(e.max)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatBRL(e.lastPrice)}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                exceeds
                                  ? above
                                    ? "bg-red-100 text-red-800 border-red-200"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : ""
                              }
                            >
                              {above ? "+" : ""}{e.variation.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Frequência */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat className="h-4 w-4" /> Frequência de compra (últimos 30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {frequency.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item com 3+ compras nos últimos 30 dias.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Compras (30d)</TableHead>
                      <TableHead>Sugestão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {frequency.map((f) => (
                      <TableRow key={f.name} className={f.count >= 5 ? "bg-amber-50" : ""}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-right">{f.count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {f.count >= 5
                            ? "Considere comprar em volume maior — economia em frete e preço unitário."
                            : "Frequência moderada."}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Concentração de fornecedores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Concentração de fornecedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supplierConcentration.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Volume (R$)</TableHead>
                      <TableHead className="text-right">% do total</TableHead>
                      <TableHead>Risco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierConcentration.map((s) => {
                      const high = s.share > 70;
                      return (
                        <TableRow key={s.name} className={high ? "bg-red-50" : ""}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatBRL(s.total)}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.share.toFixed(1)}%</TableCell>
                          <TableCell>
                            {high ? (
                              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                                <AlertCircle className="h-3 w-3 mr-1" /> Alta dependência
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">OK</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
