import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { importTopGamific } from "@/lib/gamif-import.functions";
import type { ImportReport, UserMapping } from "@/lib/gamif-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

export function ImportacaoTop() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const runImport = useServerFn(importTopGamific);
  const [busy, setBusy] = useState(false);
  const { data: last } = useQuery({
    queryKey: ["gamif-import-last"],
    queryFn: async () => {
      const { data } = await supabase.from("gamif_import_runs").select("report, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return (data?.report ?? null) as ImportReport | null;
    },
  });
  const run = async () => {
    if (!confirm("Importar agora os dados do TOP Gamific? Pode repetir: o que já foi trazido é atualizado, sem duplicar.")) return;
    setBusy(true);
    try {
      await runImport();
      toast.success("Importação concluída");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setBusy(false);
    }
  };
  const isAdmin = hasRole("admin");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Importação do TOP Gamific</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">Traz pessoas, lançamentos, missões, loja, resgates, duelos, sugestões, avisos, processos e tarefas do TOP. Pode repetir sem duplicar; quem for ligado depois na aba "Usuários pendentes" recebe o resto ao repetir.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={busy || !isAdmin}>{busy ? "Importando…" : last ? "Importar de novo" : "Importar agora"}</Button>
            {!isAdmin && <span className="text-muted-foreground">Somente administradores importam.</span>}
            {last && <span className="text-muted-foreground">Última: {fmt(last.ran_at)} · dados do TOP de {fmt(last.exported_at)}</span>}
          </div>
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
        <p className="text-sm text-muted-foreground">Squads sem setor correspondente no GS Hub: {r.unmatchedSquads.join(", ")}.</p>
      )}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Contagem por tabela (TOP x GS Hub)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Tabela do TOP</TableHead><TableHead className="text-right">TOP</TableHead><TableHead className="text-right">GS Hub</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader>
            <TableBody>
              {r.tables.map((t) => (
                <TableRow key={t.table}>
                  <TableCell className="font-mono text-xs">{t.table}</TableCell>
                  <TableCell className="text-right">{t.top}</TableCell>
                  <TableCell className={`text-right ${t.gs !== null && t.gs < t.top && t.table !== "platform_settings" ? "text-destructive font-medium" : ""}`}>{t.gs ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Saldo por pessoa (TOP x GS Hub){diffs === 0 ? <Badge>todos iguais</Badge> : <Badge variant="destructive">{diffs} diferente(s)</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Pessoa</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Moedas TOP</TableHead><TableHead className="text-right">Moedas GS Hub</TableHead><TableHead className="text-right">XP TOP</TableHead><TableHead className="text-right">XP GS Hub</TableHead><TableHead className="text-right">Ajuste da migração</TableHead></TableRow></TableHeader>
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
