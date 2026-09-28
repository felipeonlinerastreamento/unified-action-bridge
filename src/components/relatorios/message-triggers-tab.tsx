import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, Download } from "lucide-react";
import { exportToCSV } from "./export-utils";

type Props = { dateFrom: string; dateTo: string };

const norm = (s: string) => (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function MessageTriggersTab({ dateFrom, dateTo }: Props) {
  const [keyword, setKeyword] = useState("all");
  const [keywordSearch, setKeywordSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["message-trigger-logs-report", dateFrom, dateTo],
    queryFn: async () => {
      const from = new Date(`${dateFrom}T00:00:00`).toISOString();
      const to = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data } = await supabase
        .from("message_trigger_logs" as any)
        .select("*")
        .gte("triggered_at", from)
        .lte("triggered_at", to)
        .order("triggered_at", { ascending: false })
        .limit(1000);
      return (data as any[]) || [];
    },
  });

  const keywordOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    logs.forEach((l: any) => {
      const label = l.matched_keyword || "—";
      const k = norm(label);
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { label, count: 1 });
    });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [logs]);

  const filtered = useMemo(() => {
    const s = norm(keywordSearch);
    return logs.filter((l: any) => {
      const k = norm(l.matched_keyword || "—");
      if (keyword !== "all" && k !== keyword) return false;
      if (s && !k.includes(s)) return false;
      return true;
    });
  }, [logs, keyword, keywordSearch]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const ack = filtered.filter((l: any) => !!l.acknowledged_at).length;
    const pending = filtered.filter((l: any) => l.recipient_user_id && !l.acknowledged_at).length;
    const byRule: Record<string, number> = {};
    filtered.forEach((l: any) => {
      const k = l.rule_name || "—";
      byRule[k] = (byRule[k] || 0) + 1;
    });
    const top = Object.entries(byRule).sort((a, b) => b[1] - a[1])[0];
    return { total, ack, pending, topRule: top ? `${top[0]} (${top[1]})` : "—" };
  }, [filtered]);

  const exportCsv = () => {
    const rows = filtered.map((l: any) => ({
      Data: new Date(l.triggered_at).toLocaleString("pt-BR"),
      Regra: l.rule_name,
      Palavra: l.matched_keyword,
      Contato: l.contact_name || "",
      Telefone: l.phone || "",
      Trecho: l.message_excerpt || "",
      Destinatário: l.recipient_name || "",
      Visualizado: l.acknowledged_at ? new Date(l.acknowledged_at).toLocaleString("pt-BR") : "",
    }));
    exportToCSV(rows, `gatilhos-${dateFrom}-${dateTo}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-card">
        <div>
          <Label className="text-xs">Palavra</Label>
          <Select value={keyword} onValueChange={setKeyword}>
            <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as palavras</SelectItem>
              {keywordOptions.map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label} ({v.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Buscar palavra</Label>
          <Input
            value={keywordSearch}
            onChange={(e) => setKeywordSearch(e.target.value)}
            placeholder="Digite a palavra"
            className="h-8 text-xs w-[200px]"
          />
        </div>
        {(keyword !== "all" || keywordSearch) && (
          <Button size="sm" variant="ghost" onClick={() => { setKeyword("all"); setKeywordSearch(""); }}>
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Total de disparos" value={stats.total} />
        <Kpi label="Visualizados" value={stats.ack} accent="text-emerald-600" />
        <Kpi label="Pendentes" value={stats.pending} accent="text-amber-600" />
        <Kpi label="Regra mais acionada" value={stats.topRule} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Gatilhos disparados
            </CardTitle>
            <CardDescription>
              Histórico de regras de palavra-chave acionadas por mensagens recebidas no período.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum gatilho disparado no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Regra</TableHead>
                    <TableHead className="text-xs">Palavra</TableHead>
                    <TableHead className="text-xs">Contato</TableHead>
                    <TableHead className="text-xs">Trecho</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                    <TableHead className="text-xs">Destinatário</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l: any) => {
                    const a = l.action_taken || {};
                    const actionParts: string[] = [];
                    if (a.alert_recipients) actionParts.push(`alerta x${a.alert_recipients}`);
                    if (a.transferred_to) actionParts.push(`→ ${a.transferred_to}`);
                    if (a.ticket_attendance_id) actionParts.push(`chamado ${a.ticket_attendance_id}`);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{new Date(l.triggered_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs font-medium">{l.rule_name}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{l.matched_keyword}</Badge></TableCell>
                        <TableCell className="text-xs">{l.contact_name || l.phone || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate" title={l.message_excerpt}>
                          {l.message_excerpt || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{actionParts.join(" • ") || "Somente registro"}</TableCell>
                        <TableCell className="text-xs">{l.recipient_name || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {!l.recipient_user_id ? (
                            <Badge variant="outline">Registrado</Badge>
                          ) : l.acknowledged_at ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">Visto</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${accent || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
