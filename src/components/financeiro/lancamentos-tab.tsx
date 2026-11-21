import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Check, Pencil, Trash2, Paperclip, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { formatBRL, formatDataBR, hojeSP, statusVisivel } from "@/lib/finance";
import { linkComprovante } from "@/lib/finance.functions";
import { fin, useFinInvalidate, type Cat, type Emp, type Lanc } from "./use-fin";
import { LancamentoDialog } from "./lancamento-dialog";
import { GsystemSyncCard } from "./gsystem-sync-card";

export const STATUS_LABEL: Record<string, string> = { aberto: "Aberto", vencido: "Vencido", pago: "Pago", cancelado: "Cancelado" };
export function StatusBadge({ s, tipo }: { s: string; tipo?: string }) {
  const label = s === "pago" && tipo === "receber" ? "Recebido" : STATUS_LABEL[s] ?? s;
  if (s === "vencido") return <Badge variant="destructive">{label}</Badge>;
  if (s === "pago") return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{label}</Badge>;
  if (s === "cancelado") return <Badge variant="outline">{label}</Badge>;
  return <Badge variant="secondary">{label}</Badge>;
}

export function useAbrirAnexo() {
  const getLink = useServerFn(linkComprovante);
  return async (l: Pick<Lanc, "arquivo_url" | "arquivo_path">) => {
    if (l.arquivo_url) { window.open(l.arquivo_url, "_blank", "noopener"); return; }
    if (!l.arquivo_path) return;
    try {
      const { url } = await getLink({ data: { path: l.arquivo_path } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) { toast.error(e?.message ?? "Não foi possível abrir o anexo."); }
  };
}

export function LancamentosTab({ tipo, lancamentos, categorias, empresas }: { tipo: "pagar" | "receber"; lancamentos: Lanc[]; categorias: Cat[]; empresas: Emp[] }) {
  const invalidate = useFinInvalidate();
  const abrirAnexo = useAbrirAnexo();
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("pendentes");
  const [fCat, setFCat] = useState("all");
  const [fEmp, setFEmp] = useState("all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [edit, setEdit] = useState<Lanc | null>(null);
  const [novo, setNovo] = useState(false);
  const hoje = hojeSP();
  const catById = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const empById = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (l.tipo !== tipo) return false;
      const s = statusVisivel(l, hoje);
      if (fStatus === "pendentes" && !(s === "aberto" || s === "vencido")) return false;
      if (fStatus !== "pendentes" && fStatus !== "all" && s !== fStatus) return false;
      if (fCat !== "all" && (fCat === "none" ? l.categoria_id : l.categoria_id !== fCat)) return false;
      if (fEmp !== "all" && l.empresa_id !== fEmp) return false;
      const ref = l.vencimento || l.data_pagamento || "";
      if (de && ref < de) return false;
      if (ate && ref > ate) return false;
      if (t) {
        const hay = `${l.contraparte ?? ""} ${l.descricao ?? ""} ${l.documento_contraparte ?? ""} ${l.numero_documento ?? ""} ${l.arquivo_nome ?? ""} ${catById.get(l.categoria_id ?? "")?.nome ?? ""} ${String(l.valor).replace(".", ",")}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [lancamentos, tipo, q, fStatus, fCat, fEmp, de, ate, hoje, catById]);

  const total = rows.reduce((s, l) => s + Number(l.valor || 0), 0);

  const marcarPago = async (l: Lanc) => {
    const { error } = await fin.from("fin_lancamentos").update({ status: "pago", data_pagamento: hoje, valor_pago: l.valor }).eq("id", l.id);
    if (error) toast.error(error.message); else { toast.success(tipo === "receber" ? "Marcado como recebido." : "Marcado como pago."); invalidate(); }
  };
  const reabrir = async (l: Lanc) => {
    const { error } = await fin.from("fin_lancamentos").update({ status: "aberto", data_pagamento: null, valor_pago: null }).eq("id", l.id);
    if (error) toast.error(error.message); else invalidate();
  };
  const excluir = async (l: Lanc) => {
    if (!confirm(`Excluir o lançamento de ${formatBRL(l.valor)}${l.contraparte ? ` (${l.contraparte})` : ""}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await fin.from("fin_lancamentos").delete().eq("id", l.id);
    if (error) toast.error(error.message); else { toast.success("Lançamento excluído."); invalidate(); }
  };

  return (
    <div className="space-y-3">
      {tipo === "receber" && <GsystemSyncCard />}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder={`Buscar ${tipo === "pagar" ? "fornecedor" : "cliente"}, descrição, CNPJ, valor...`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Em aberto + vencidos</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="aberto">A vencer</SelectItem>
              <SelectItem value="pago">{tipo === "receber" ? "Recebidos" : "Pagos"}</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fCat} onValueChange={setFCat}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categorias.filter((c) => c.tipo === (tipo === "receber" ? "receita" : "despesa")).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fEmp} onValueChange={setFEmp}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Empresas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-[150px]" value={de} onChange={(e) => setDe(e.target.value)} title="De" />
          <Input type="date" className="w-[150px]" value={ate} onChange={(e) => setAte(e.target.value)} title="Até" />
          <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground flex justify-between">
        <span>{rows.length} lançamento(s)</span>
        <span>Total: <b className="text-foreground">{formatBRL(total)}</b></span>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>{tipo === "pagar" ? "Fornecedor" : "Cliente"}</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento.</TableCell></TableRow>
            )}
            {rows.map((l) => {
              const s = statusVisivel(l, hoje);
              return (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setEdit(l)}>
                  <TableCell className="whitespace-nowrap">{formatDataBR(l.vencimento)}</TableCell>
                  <TableCell className="font-medium">{l.contraparte ?? "—"}{!l.revisado && <Badge variant="outline" className="ml-2 text-[10px]">A revisar</Badge>}{l.origem === "gsystem" && <Badge variant="outline" className="ml-2 text-[10px]">GSystem</Badge>}</TableCell>
                  <TableCell className="max-w-[260px] truncate" title={l.descricao ?? ""}>{l.descricao ?? "—"}</TableCell>
                  <TableCell>{catById.get(l.categoria_id ?? "")?.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{empById.get(l.empresa_id ?? "")?.codigo ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">{formatBRL(l.valor)}</TableCell>
                  <TableCell><StatusBadge s={s} tipo={tipo} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(s === "aberto" || s === "vencido") && (
                          <DropdownMenuItem onSelect={() => marcarPago(l)}><Check className="h-4 w-4 mr-2" />{tipo === "receber" ? "Marcar recebido hoje" : "Marcar pago hoje"}</DropdownMenuItem>
                        )}
                        {s === "pago" && <DropdownMenuItem onSelect={() => reabrir(l)}><Undo2 className="h-4 w-4 mr-2" />Reabrir</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => setEdit(l)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        {(l.arquivo_url || l.arquivo_path) && <DropdownMenuItem onSelect={() => abrirAnexo(l)}><Paperclip className="h-4 w-4 mr-2" />{l.origem === "gsystem" ? "Abrir boleto" : "Abrir anexo"}</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={() => excluir(l)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <LancamentoDialog open={novo || !!edit} onClose={() => { setNovo(false); setEdit(null); }} tipo={tipo} lanc={edit} categorias={categorias} empresas={empresas} />
    </div>
  );
}
