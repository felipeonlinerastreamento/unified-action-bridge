import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ImportReport, UserMapping } from "@/lib/gamif-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

/** Importação encerrada na virada: mostra só o relatório histórico e os excluídos. */
export function ImportacaoTop() {
  const { data: last } = useQuery({
    queryKey: ["gamif-import-last"],
    queryFn: async () => {
      const { data } = await supabase.from("gamif_import_runs").select("report, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data?.report ?? null) as ImportReport | null;
    },
  });
  const { data: excluded = [] } = useQuery({
    queryKey: ["gamif-import-exclusions"],
    queryFn: async () => {
      const { data } = await supabase.from("gamif_import_exclusions").select("legacy_id, name").order("name");
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Importação do TOP Gamific (encerrada)</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">A migração terminou e a importação foi desativada. O TOP Gamific ficou só para consulta; daqui em diante tudo é lançado aqui na Gamificação.</p>
          {last && <p className="text-muted-foreground">Última importação: {fmt(last.ran_at)} · dados do TOP de {fmt(last.exported_at)}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Excluídos da gamificação<Badge variant="outline">{excluded.length}</Badge></CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="text-xs text-muted-foreground">Pessoas vindas do TOP que ficaram fora da gamificação. As tarefas delas foram mantidas, sem vínculo com essas pessoas.</p>
          <p>{excluded.length ? excluded.map((x) => x.name ?? x.legacy_id).join(" · ") : "Nenhum."}</p>
        </CardContent>
      </Card>
      {last && <Relatorio r={last} />}
    </div>
  );
}

function Pessoas({ title, list, variant }: { title: string; list: UserMapping[]; variant: "default" | "secondary" | "destructive" }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{title}<Badge variant={variant}>{list.length}</Badge></CardTitle></CardHeader>
      <CardContent className="text-sm divide-y">
        {list.length === 0 && <p className="text-muted-foreground">Nenhum.</p>}
        {list.map((m) => (
          <div key={m.legacyId} className="py-1.5">
            <div>{m.name}</div>
            <div className="text-xs text-muted-foreground">{m.email ?? "sem e-mail"} · {m.reason}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Relatorio({ r }: { r: ImportReport }) {
  const diffs = r.balances.filter((b) => !b.ok).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Pessoas title="Ligados" list={r.users.linked} variant="default" />
        <Pessoas title="Pendentes" list={r.users.pending} variant="secondary" />
        <Pessoas title="Duplicados" list={r.users.duplicates} variant="destructive" />
      </div>
      {r.unmatchedSquads.length > 0 && (
        <p className="text-sm text-muted-foreground">Squads sem setor correspondente no Gestão Online: {r.unmatchedSquads.join(", ")}.</p>
      )}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Contagem por tabela (TOP x Gestão Online)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tabela do TOP</TableHead><TableHead className="text-right">TOP</TableHead><TableHead className="text-right">Gestão Online</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.tables.map((t) => (
                <TableRow key={t.table}>
                  <TableCell className="font-mono text-xs">{t.table}</TableCell>
                  <TableCell className="text-right">{t.top}</TableCell>
                  <TableCell className={`text-right ${t.gs !== null && t.gs < t.top - (t.excluded ?? 0) && t.table !== "platform_settings" ? "text-destructive font-medium" : ""}`}>{t.gs ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Saldo por pessoa (TOP x Gestão Online){diffs === 0 ? <Badge>todos iguais</Badge> : <Badge variant="destructive">{diffs} diferente(s)</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Moedas TOP</TableHead><TableHead className="text-right">Moedas Gestão Online</TableHead><TableHead className="text-right">XP TOP</TableHead><TableHead className="text-right">XP Gestão Online</TableHead><TableHead className="text-right">Ajuste da migração</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.balances.map((b) => (
                <TableRow key={`${b.name}-${b.email}`}>
                  <TableCell>{b.name}{b.gsName && b.gsName !== b.name ? <span className="text-xs text-muted-foreground"> ({b.gsName})</span> : null}</TableCell>
                  <TableCell><Badge variant={b.status === "ligado" ? "default" : "secondary"}>{b.status === "ligado" ? "ligado" : `${b.status} (guardado)`}</Badge></TableCell>
                  <TableCell className="text-right">{b.topCoins}</TableCell>
                  <TableCell className={`text-right ${b.topCoins !== b.gsCoins ? "text-destructive font-medium" : ""}`}>{b.gsCoins}</TableCell>
                  <TableCell className="text-right">{b.topXp}</TableCell>
                  <TableCell className={`text-right ${b.topXp !== b.gsXp ? "text-destructive font-medium" : ""}`}>{b.gsXp}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{b.adjustmentCoins > 0 ? `+${b.adjustmentCoins}` : b.adjustmentCoins}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
