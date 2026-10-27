import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BellRing } from "lucide-react";

const db = supabase as any;
const LABEL: Record<string, string> = { created: "Novo Chamado Manual", reassigned: "Chamado Atribuído", email: "Entrada via E-mail" };

function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function TicketAssignmentAlertsReport({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [type, setType] = useState("all");
  const { data = [] } = useQuery({
    queryKey: ["ticket-assignment-alerts-report", dateFrom, dateTo],
    queryFn: async () => {
      const from = new Date(`${dateFrom}T00:00:00`).toISOString();
      const to = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data: rows } = await db.from("ticket_assignment_alerts").select("*")
        .gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(500);
      const ids = [...new Set((rows || []).map((r: any) => r.target_user_id))];
      const { data: profs } = ids.length
        ? await db.from("profiles").select("user_id,name").in("user_id", ids) : { data: [] };
      const names = new Map((profs || []).map((p: any) => [p.user_id, p.name]));
      return (rows || []).map((r: any) => ({ ...r, target_name: names.get(r.target_user_id) || "—" }));
    },
  });
  const rows = type === "all" ? data : data.filter((r: any) => r.event_type === type);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2"><BellRing className="h-4 w-4" /> Alertas de atribuição de chamados</CardTitle>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead><TableHead>Protocolo</TableHead><TableHead>Cliente</TableHead>
            <TableHead>Atendente</TableHead><TableHead>Gerado por</TableHead><TableHead>Disparo</TableHead>
            <TableHead>OK</TableHead><TableHead>Tempo de ciência</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum alerta no período</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell><Badge variant="secondary">{LABEL[r.event_type] || r.event_type}</Badge></TableCell>
                <TableCell>{r.protocol}</TableCell>
                <TableCell>{r.client_name || "—"}</TableCell>
                <TableCell>{r.target_name}</TableCell>
                <TableCell>{r.triggered_by_name || "—"}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleString("pt-BR") : <Badge variant="destructive">Pendente</Badge>}</TableCell>
                <TableCell>{r.acknowledged_at ? fmtDur(new Date(r.acknowledged_at).getTime() - new Date(r.created_at).getTime()) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
