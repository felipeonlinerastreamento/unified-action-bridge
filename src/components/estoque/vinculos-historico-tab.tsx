import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LABEL: Record<string, string> = { vincular: "Vinculação", desvincular: "Desvinculação", kit_adicionar: "Kit: adicionado", kit_remover: "Kit: removido" };

export function VinculosHistoricoTab() {
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["estoque-historico"],
    queryFn: async () => (await supabase.from("gsystem_vinculos_historico").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const s = q.toLowerCase().trim();
  const rows = s ? data.filter((r) => [r.equipamento_codigo, r.equipamento_serie, r.placa, r.chip, r.user_name].some((v) => String(v ?? "").toLowerCase().includes(s))) : data;
  return (
    <div className="space-y-3">
      <Input className="max-w-sm" placeholder="Buscar por ID, série, placa, chip ou usuário" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data/hora</TableHead><TableHead>Operação</TableHead><TableHead>Equipamento</TableHead>
            <TableHead>Chip</TableHead><TableHead>Placa</TableHead><TableHead>Detalhe</TableHead><TableHead>Usuário</TableHead><TableHead>Resultado</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>
            ) : rows.map((r) => {
              const a = r.acessorios as any;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{LABEL[r.operacao] ?? r.operacao}</TableCell>
                  <TableCell className="text-xs">{r.equipamento_codigo} · {r.equipamento_serie} {r.equipamento_modelo ? `(${r.equipamento_modelo})` : ""}</TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">{r.chip ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{r.placa ?? "—"}</TableCell>
                  <TableCell className="text-xs">{a?.nome ? `${a.nome}: ${a.de} → ${a.para}` : "—"}</TableCell>
                  <TableCell className="text-xs">{r.user_name ?? "—"}</TableCell>
                  <TableCell>{r.sucesso ? <Badge variant="outline">OK</Badge> : <Badge variant="destructive" title={r.erro ?? ""}>Falhou</Badge>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
