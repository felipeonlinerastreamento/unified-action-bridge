import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import { NOTIFICACOES_CONTATO, type NotificacaoContato } from "@/lib/contato-notificacoes";
import type { TableColumn } from "@/lib/table-columns";

export type ContatoForm = {
  name: string; sector: string; phone: string; email: string;
  is_prime?: boolean; notificacoes?: NotificacaoContato[]; observacao?: string;
};
type Linha = ContatoForm & { idx: number };

const rotuloNotif = (k: string) => NOTIFICACOES_CONTATO.find((n) => n.key === k)?.label ?? k;

const COLUNAS: TableColumn<Linha>[] = [
  { id: "nome", label: "Nome", value: (r) => r.name },
  { id: "telefone", label: "Telefone", value: (r) => r.phone },
  { id: "setor", label: "Setor", value: (r) => r.sector },
  { id: "email", label: "E-mail", value: (r) => r.email },
  { id: "prime", label: "Prime", value: (r) => !!r.is_prime },
  ...NOTIFICACOES_CONTATO.map((n) => ({
    id: `notif_${n.key}`,
    label: n.label,
    value: (r: Linha) => (r.notificacoes || []).includes(n.key),
  })),
  { id: "recebe", label: "Recebe (todos)", value: (r) => (r.notificacoes || []).map(rotuloNotif).join(", "), defaultHidden: true },
  { id: "observacao", label: "Observação", value: (r) => r.observacao || "" },
  { id: "acoes", label: "", value: () => "", data: false },
];

/**
 * Contatos da empresa em tabela editável: colunas configuráveis e filtro por coluna (padrão
 * data-table). Cada linha guarda o índice original, então editar uma linha filtrada altera o contato certo.
 */
export function ContatosTabela({ contatos, onChange, salvarObservacao, contatoGravado, salvandoObs, empresaNome }: {
  contatos: ContatoForm[];
  onChange: (c: ContatoForm[]) => void;
  salvarObservacao: (idx: number) => void;
  contatoGravado: (idx: number) => unknown;
  salvandoObs: number | null;
  empresaNome?: string;
}) {
  const linhas = useMemo<Linha[]>(() => contatos.map((c, idx) => ({ ...c, idx })), [contatos]);
  const tabela = useTableColumns("empresas-contatos", COLUNAS, linhas);
  const set = (idx: number, patch: Partial<ContatoForm>) => {
    const c = [...contatos];
    c[idx] = { ...c[idx], ...patch };
    onChange(c);
  };

  const celula = (r: Linha, id: string) => {
    if (id.startsWith("notif_")) {
      const key = id.slice(6) as NotificacaoContato;
      const marcado = (r.notificacoes || []).includes(key);
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={marcado}
            onCheckedChange={(v) => {
              const atual = r.notificacoes || [];
              set(r.idx, { notificacoes: v === true ? [...new Set([...atual, key])] : atual.filter((k) => k !== key) });
            }}
          />
        </div>
      );
    }
    switch (id) {
      case "nome": return <Input className="h-8 min-w-[140px]" value={r.name} placeholder="Nome" onChange={(e) => set(r.idx, { name: e.target.value })} />;
      case "telefone": return <Input className="h-8 w-36" value={r.phone} placeholder="Telefone" onChange={(e) => set(r.idx, { phone: e.target.value })} />;
      case "setor": return <Input className="h-8 w-28" value={r.sector} placeholder="Setor" onChange={(e) => set(r.idx, { sector: e.target.value })} />;
      case "email": return <Input className="h-8 min-w-[170px]" value={r.email} placeholder="E-mail" onChange={(e) => set(r.idx, { email: e.target.value })} />;
      case "prime": return <div className="flex justify-center"><Checkbox checked={!!r.is_prime} onCheckedChange={(v) => set(r.idx, { is_prime: v === true })} /></div>;
      case "recebe": return <span className="text-xs">{(r.notificacoes || []).map(rotuloNotif).join(", ") || "—"}</span>;
      case "observacao":
        return (
          <div className="min-w-[200px]">
            <Textarea
              value={r.observacao || ""}
              onChange={(e) => set(r.idx, { observacao: e.target.value })}
              onBlur={() => salvarObservacao(r.idx)}
              maxLength={2000}
              rows={1}
              placeholder="Observação"
              className="text-xs min-h-[32px]"
              title={contatoGravado(r.idx) ? "Salva ao sair do campo" : "Contato novo ou alterado: gravada ao salvar a empresa"}
            />
            {salvandoObs === r.idx && <p className="text-[10px] text-muted-foreground">Salvando…</p>}
          </div>
        );
      case "acoes":
        return contatos.length > 1 ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Remover contato" onClick={() => onChange(contatos.filter((_, i) => i !== r.idx))}>
            <X className="h-4 w-4" />
          </Button>
        ) : null;
      default: return null;
    }
  };

  return (
    <div className="space-y-2">
      <TableToolbar state={tabela} fileName={`contatos-${(empresaNome || "empresa").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} count={tabela.filteredRows.length} />
      <div className="overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              {tabela.visibleColumns.map((c) => (
                <TableHead key={c.id} className={c.id.startsWith("notif_") || c.id === "prime" ? "text-center text-xs" : "text-xs"}>
                  {c.data === false ? null : <ColumnFilterHeader column={c} state={tabela} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tabela.filteredRows.map((r) => (
              <TableRow key={r.idx}>
                {tabela.visibleColumns.map((c) => <TableCell key={c.id} className="p-1.5 align-top">{celula(r, c.id)}</TableCell>)}
              </TableRow>
            ))}
            {tabela.filteredRows.length === 0 && (
              <TableRow><TableCell colSpan={tabela.visibleColumns.length} className="py-6 text-center text-xs text-muted-foreground">Nenhum contato com esses filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
