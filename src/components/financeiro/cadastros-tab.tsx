import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fin, useFinInvalidate, type Cat, type Emp } from "./use-fin";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

const COLUNAS_CAT: TableColumn<Cat>[] = [
  { id: "nome", label: "Nome", value: (c) => c.nome },
  { id: "tipo", label: "Tipo", value: (c) => (c.tipo === "receita" ? "Receita" : "Despesa") },
  { id: "grupo", label: "Grupo do DRE", value: (c) => c.grupo_dre },
  { id: "ativa", label: "Ativa", value: (c) => (c.ativo ? "Sim" : "Não") },
];

const GRUPOS = ["Receita bruta", "Outras receitas", "Custo dos serviços", "Impostos", "Pessoal", "Despesas comerciais", "Despesas administrativas", "Despesas operacionais", "Despesas financeiras", "Outras despesas"];

export function CadastrosTab({ categorias, empresas }: { categorias: Cat[]; empresas: Emp[] }) {
  const invalidate = useFinInvalidate();
  const [nova, setNova] = useState({ nome: "", tipo: "despesa", grupo_dre: "Despesas operacionais" });
  const [emp, setEmp] = useState({ codigo: "", nome: "" });

  const tabela = useTableColumns("fin-categorias", COLUNAS_CAT, categorias);
  const th = (id: string) => <ColumnFilterHeader column={COLUNAS_CAT.find((c) => c.id === id)!} state={tabela} />;

  const upd = async (tabela: string, id: string, patch: any) => {
    const { error } = await fin.from(tabela).update(patch).eq("id", id);
    if (error) toast.error(error.message); else invalidate();
  };
  const criarCat = async () => {
    if (!nova.nome.trim()) return;
    const { error } = await fin.from("fin_categorias").insert({ ...nova, nome: nova.nome.trim() });
    if (error) toast.error(error.message); else { setNova({ ...nova, nome: "" }); invalidate(); }
  };
  const criarEmp = async () => {
    if (!emp.codigo.trim() || !emp.nome.trim()) return;
    const { error } = await fin.from("fin_empresas").insert({ codigo: emp.codigo.trim().toUpperCase(), nome: emp.nome.trim() });
    if (error) toast.error(error.message); else { setEmp({ codigo: "", nome: "" }); invalidate(); }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Categorias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="flex-1 min-w-[180px]" placeholder="Nova categoria" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
            <Select value={nova.tipo} onValueChange={(v) => setNova({ ...nova, tipo: v })}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="despesa">Despesa</SelectItem><SelectItem value="receita">Receita</SelectItem></SelectContent>
            </Select>
            <Select value={nova.grupo_dre} onValueChange={(v) => setNova({ ...nova, grupo_dre: v })}>
              <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
              <SelectContent>{GRUPOS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={criarCat}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
          <TableToolbar state={tabela} fileName="categorias" semColunas count={tabela.filteredRows.length} />
          <Table>
            <TableHeader><TableRow><TableHead>{th("nome")}</TableHead><TableHead>{th("tipo")}</TableHead><TableHead>{th("grupo")}</TableHead><TableHead>{th("ativa")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {tabela.filteredRows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Input className="h-8" defaultValue={c.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== c.nome && upd("fin_categorias", c.id, { nome: e.target.value.trim() })} /></TableCell>
                  <TableCell className="text-sm">{c.tipo === "receita" ? "Receita" : "Despesa"}</TableCell>
                  <TableCell>
                    <Select value={c.grupo_dre} onValueChange={(v) => upd("fin_categorias", c.id, { grupo_dre: v })}>
                      <SelectTrigger className="h-8 w-[210px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{[...new Set([c.grupo_dre, ...GRUPOS])].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Switch checked={c.ativo} onCheckedChange={(v) => upd("fin_categorias", c.id, { ativo: v })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Empresas do grupo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input className="w-[80px]" placeholder="Código" value={emp.codigo} onChange={(e) => setEmp({ ...emp, codigo: e.target.value })} />
            <Input placeholder="Nome" value={emp.nome} onChange={(e) => setEmp({ ...emp, nome: e.target.value })} />
            <Button size="icon" onClick={criarEmp}><Plus className="h-4 w-4" /></Button>
          </div>
          {empresas.map((e) => (
            <div key={e.id} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
              <span className="font-mono text-sm">{e.codigo}</span>
              <Input className="h-8" defaultValue={e.nome} onBlur={(ev) => ev.target.value.trim() && ev.target.value !== e.nome && upd("fin_empresas", e.id, { nome: ev.target.value.trim() })} />
              <Input className="h-8" placeholder="CNPJ" defaultValue={e.cnpj ?? ""} onBlur={(ev) => ev.target.value !== (e.cnpj ?? "") && upd("fin_empresas", e.id, { cnpj: ev.target.value || null })} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">O código (ex.: OR, OT) é o que aparece no nome dos arquivos do Drive e liga o comprovante à empresa.</p>
        </CardContent>
      </Card>
    </div>
  );
}
