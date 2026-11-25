import { Fragment, useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDataBR, hojeSP, statusVisivel } from "@/lib/finance";
import { linkComprovante } from "@/lib/finance.functions";
import { fin, useFinInvalidate, type Cat, type Emp, type Lanc } from "./use-fin";
import { LancamentoDialog } from "./lancamento-dialog";
import { GsystemSyncCard } from "./gsystem-sync-card";
import { useTableColumns } from "@/components/data-table/use-table-columns";
import { ColumnFilterHeader } from "@/components/data-table/column-filter-header";
import { TableToolbar } from "@/components/data-table/table-toolbar";
import type { TableColumn } from "@/lib/table-columns";

export const ORIGEM_LABEL: Record<string, string> = {
  drive: "Claude (Drive)", gsystem: "GSystem", email: "E-mail", dda: "DDA", bomcontrole: "Bom Controle", manual: "Manual",
};
export const origemLabel = (o?: string | null) => (o ? ORIGEM_LABEL[o] ?? o : "Manual");
const APROVACAO_LABEL: Record<string, string> = { pendente: "Aguardando", aprovado: "Aprovado", reprovado: "Reprovado" };

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
  const [fPor, setFPor] = useState("all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [edit, setEdit] = useState<Lanc | null>(null);
  const [novo, setNovo] = useState(false);
  const hoje = hojeSP();
  const catById = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  // Quem enviou: usuário que lançou (created_by) ou, nos automáticos, a origem (e-mail do remetente, GSystem...).
  const { data: perfis = [] } = useQuery({
    queryKey: ["fin-perfis-nomes"],
    queryFn: async () => ((await supabase.from("profiles").select("user_id, name")).data ?? []) as { user_id: string; name: string }[],
    staleTime: 5 * 60_000,
  });
  const nomePerfil = useMemo(() => new Map(perfis.map((p) => [p.user_id, p.name])), [perfis]);
  const enviadoPor = (l: Lanc) => {
    const id = (l as any).created_by as string | null;
    if (id) { const n = nomePerfil.get(id) ?? "Usuário removido"; return l.origem === "drive" ? `${n} (pelo Claude)` : n; }
    if (l.origem === "email") { const m = /E-mail de ([^\s]+)/.exec(l.observacao ?? ""); return m ? `E-mail ${m[1]}` : "E-mail financeiro"; }
    return `${origemLabel(l.origem)} (automático)`;
  };
  const empById = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtradas = lancamentos.filter((l) => {
      if (l.tipo !== tipo) return false;
      const s = statusVisivel(l, hoje);
      if (fStatus === "pendentes" && !(s === "aberto" || s === "vencido")) return false;
      if (fStatus !== "pendentes" && fStatus !== "all" && s !== fStatus) return false;
      if (fCat !== "all" && (fCat === "none" ? l.categoria_id : l.categoria_id !== fCat)) return false;
      if (fEmp !== "all" && l.empresa_id !== fEmp) return false;
      if (fPor !== "all" && enviadoPor(l) !== fPor) return false;
      const ref = l.vencimento || l.data_pagamento || "";
      if (de && ref < de) return false;
      if (ate && ref > ate) return false;
      if (t) {
        const hay = `${l.contraparte ?? ""} ${l.descricao ?? ""} ${l.documento_contraparte ?? ""} ${l.numero_documento ?? ""} ${l.arquivo_nome ?? ""} ${catById.get(l.categoria_id ?? "")?.nome ?? ""} ${String(l.valor).replace(".", ",")}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
    // Contas a pagar: lançados mais recentemente primeiro.
    if (tipo === "pagar") {
      const ref = (l: Lanc) => String((l as any).created_at || l.vencimento || "");
      filtradas.sort((a, b) => ref(b).localeCompare(ref(a)));
    }
    // Contas a receber: mais recentes primeiro (vencimento, senão emissão, senão data do lançamento).
    if (tipo === "receber") {
      const ref = (l: Lanc) => String(l.vencimento || l.data_emissao || (l as any).created_at || "");
      filtradas.sort((a, b) => ref(b).localeCompare(ref(a)));
    }
    return filtradas;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancamentos, tipo, q, fStatus, fCat, fEmp, fPor, de, ate, hoje, catById, nomePerfil]);
  const opcoesPor = useMemo(() => [...new Set(lancamentos.filter((l) => l.tipo === tipo).map(enviadoPor))].sort((a, b) => a.localeCompare(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lancamentos, tipo, nomePerfil]);

  const colunas = useMemo<TableColumn<Lanc>[]>(() => [
    { id: "vencimento", label: "Vencimento", value: (l) => formatDataBR(l.vencimento) },
    { id: "pagamento", label: tipo === "receber" ? "Recebimento" : "Pagamento", value: (l) => (l.data_pagamento ? formatDataBR(l.data_pagamento) : ""), defaultHidden: true },
    { id: "contraparte", label: tipo === "pagar" ? "Fornecedor" : "Cliente", value: (l) => l.contraparte ?? "" },
    { id: "documento", label: "CPF/CNPJ", value: (l) => l.documento_contraparte ?? "", defaultHidden: true },
    { id: "descricao", label: "Descrição", value: (l) => l.descricao ?? "" },
    { id: "categoria", label: "Categoria", value: (l) => catById.get(l.categoria_id ?? "")?.nome ?? "Sem categoria" },
    { id: "empresa", label: "Empresa", value: (l) => empById.get(l.empresa_id ?? "")?.codigo ?? "" },
    { id: "valor", label: "Valor", value: (l) => Number(l.valor || 0) },
    { id: "status", label: "Status", value: (l) => { const st = statusVisivel(l, hoje); return st === "pago" && tipo === "receber" ? "Recebido" : STATUS_LABEL[st] ?? st; } },
    { id: "origem", label: "Origem", value: (l) => origemLabel(l.origem) },
    ...(tipo === "pagar" ? [{ id: "aprovacao", label: "Aprovação", value: (l: Lanc) => (l.aprovacao ? APROVACAO_LABEL[l.aprovacao] ?? l.aprovacao : "Não exige") }] : []),
    { id: "revisado", label: "Revisado", value: (l) => (l.revisado ? "Sim" : "A revisar"), defaultHidden: true },
    { id: "enviado", label: "Enviado por", value: enviadoPor },
    { id: "lancado", label: "Lançado em", value: (l) => ((l as any).created_at ? formatDataBR(String((l as any).created_at).slice(0, 10)) : ""), defaultHidden: tipo === "receber" },
    { id: "acoes", label: "", value: () => "", data: false },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [tipo, catById, empById, hoje, nomePerfil]);
  const tabela = useTableColumns(`fin-lancamentos-${tipo}`, colunas, rows);
  const visiveis = tabela.filteredRows;
  const total = visiveis.reduce((s, l) => s + Number(l.valor || 0), 0);
  const ocultosPorStatus = fStatus === "all" ? 0 : lancamentos.filter((l) => l.tipo === tipo).length - lancamentos.filter((l) => {
    if (l.tipo !== tipo) return false;
    const st = statusVisivel(l, hoje);
    return fStatus === "pendentes" ? st === "aberto" || st === "vencido" : st === fStatus;
  }).length;

  const marcarPago = async (l: Lanc) => {
    if (l.tipo === "pagar" && (l.aprovacao === "pendente" || l.aprovacao === "reprovado")
      && !confirm(l.aprovacao === "pendente" ? "Esta conta ainda não foi aprovada para pagamento. Marcar como paga mesmo assim?" : "Esta conta foi REPROVADA para pagamento. Marcar como paga mesmo assim?")) return;
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
          <Select value={fPor} onValueChange={setFPor}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Enviado por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Enviado por: todos</SelectItem>
              {opcoesPor.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-[150px]" value={de} onChange={(e) => setDe(e.target.value)} title="De" />
          <Input type="date" className="w-[150px]" value={ate} onChange={(e) => setAte(e.target.value)} title="Até" />
          <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground flex flex-wrap justify-between gap-2">
        <span>
          {visiveis.length} lançamento(s)
          {ocultosPorStatus > 0 && (
            <> · <button type="button" className="underline" onClick={() => setFStatus("all")}>{ocultosPorStatus} com outro status ocultos (ver todos)</button></>
          )}
        </span>
        <span>Total: <b className="text-foreground">{formatBRL(total)}</b></span>
      </div>

      <TableToolbar state={tabela} fileName={tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"} />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {tabela.visibleColumns.map((c) => (
                <TableHead key={c.id} className={c.id === "valor" ? "text-right" : c.id === "acoes" ? "w-10" : ""}>
                  {c.data === false ? null : <ColumnFilterHeader column={c} state={tabela} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow><TableCell colSpan={tabela.visibleColumns.length} className="text-center text-sm text-muted-foreground py-8">Nenhum lançamento.</TableCell></TableRow>
            )}
            {visiveis.map((l) => {
              const s = statusVisivel(l, hoje);
              const celulas: Record<string, React.ReactNode> = {
                vencimento: <TableCell key="vencimento" className="whitespace-nowrap">{formatDataBR(l.vencimento)}</TableCell>,
                pagamento: <TableCell key="pagamento" className="whitespace-nowrap">{l.data_pagamento ? formatDataBR(l.data_pagamento) : "—"}</TableCell>,
                documento: <TableCell key="documento" className="whitespace-nowrap text-xs">{l.documento_contraparte ?? "—"}</TableCell>,
                origem: <TableCell key="origem"><Badge variant="outline" className="text-[10px]">{origemLabel(l.origem)}</Badge></TableCell>,
                aprovacao: <TableCell key="aprovacao" className="text-xs">{l.aprovacao ? APROVACAO_LABEL[l.aprovacao] ?? l.aprovacao : "—"}</TableCell>,
                revisado: <TableCell key="revisado" className="text-xs">{l.revisado ? "Sim" : "A revisar"}</TableCell>,
                enviado: <TableCell key="enviado" className="text-xs">{enviadoPor(l)}</TableCell>,
                lancado: <TableCell key="lancado" className="text-xs whitespace-nowrap">{(l as any).created_at ? formatDataBR(String((l as any).created_at).slice(0, 10)) : "—"}</TableCell>,
              };
              return (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setEdit(l)}>
                  {tabela.visibleColumns.map((c) => celulas[c.id] ?? <Fragment key={c.id}>{CelulaFixa(c.id)}</Fragment>)}
                </TableRow>
              );
              function CelulaFixa(id: string) {
                switch (id) {
                  case "contraparte": return <TableCell className="font-medium">{l.contraparte ?? "—"}{!l.revisado && <Badge variant="outline" className="ml-2 text-[10px]">A revisar</Badge>}{l.origem === "gsystem" && <Badge variant="outline" className="ml-2 text-[10px]">GSystem</Badge>}{l.origem === "email" && <Badge variant="outline" className="ml-2 text-[10px]">E-mail</Badge>}{l.origem === "dda" && <Badge variant="outline" className="ml-2 text-[10px]">DDA</Badge>}{l.origem === "bomcontrole" && <Badge variant="outline" className="ml-2 text-[10px]">Bom Controle</Badge>}{l.aprovacao === "pendente" && <Badge variant="outline" className="ml-2 text-[10px] border-amber-500 text-amber-700">Aguardando aprovação</Badge>}{l.aprovacao === "aprovado" && <Badge variant="outline" className="ml-2 text-[10px] border-emerald-500 text-emerald-700">Aprovado</Badge>}{l.aprovacao === "reprovado" && <Badge variant="destructive" className="ml-2 text-[10px]">Reprovado</Badge>}{(l.conferencia?.status === "acima" || l.conferencia?.status === "abaixo") && <Badge variant="outline" className="ml-2 text-[10px] border-red-500 text-red-700" title={`Esperado ${formatBRL(l.valor_esperado ?? 0)}`}>{l.conferencia.status === "acima" ? "↑" : "↓"} esperado</Badge>}</TableCell>;
                  case "descricao": return <TableCell className="max-w-[260px] truncate" title={l.descricao ?? ""}>{l.descricao ?? "—"}</TableCell>;
                  case "categoria": return <TableCell>{catById.get(l.categoria_id ?? "")?.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>;
                  case "empresa": return <TableCell>{empById.get(l.empresa_id ?? "")?.codigo ?? "—"}</TableCell>;
                  case "valor": return <TableCell className="text-right font-semibold whitespace-nowrap">{formatBRL(l.valor)}</TableCell>;
                  case "status": return <TableCell><StatusBadge s={s} tipo={tipo} /></TableCell>;
                  case "acoes": return (
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
                  );
                  default: return null;
                }
              }
            })}
          </TableBody>
        </Table>
      </Card>

      <LancamentoDialog open={novo || !!edit} onClose={() => { setNovo(false); setEdit(null); }} tipo={tipo} lanc={edit} categorias={categorias} empresas={empresas} />
    </div>
  );
}
