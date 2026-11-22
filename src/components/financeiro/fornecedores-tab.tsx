import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calculator, Loader2, History, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDataBR, hojeSP } from "@/lib/finance";
import { CANAL_LABEL, SERVICO_LABEL, TIPO_REGRA_LABEL, normalizarRegras, soDigitos, type Regra, type TipoServico } from "@/lib/finance-fornecedores";
import { simularCobrancaFn } from "@/lib/finance-fornecedores.functions";
import { fin, type Cat, type Emp, type Lanc } from "./use-fin";

export type Fornecedor = {
  id: string; nome: string; documento: string | null; emails: string[]; categoria_id: string | null; empresa_id: string | null;
  regras: Regra[]; competencia_ref: "anterior" | "atual"; tolerancia_pct: number; explicacao: string | null; dia_vencimento: number | null;
  exige_aprovacao: boolean; ativo: boolean; updated_at: string;
};

export function useFornecedores() {
  return useQuery({
    queryKey: ["fin-fornecedores"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await fin.from("fin_fornecedores").select("*").order("nome");
      if (error) throw error;
      return (data || []).map((f: any) => ({ ...f, regras: normalizarRegras(f.regras), tolerancia_pct: Number(f.tolerancia_pct) })) as Fornecedor[];
    },
  });
}

export const TIPO_EVIDENCIA: Record<string, string> = {
  regra_alterada: "Regra alterada", valor_divergente: "Valor diferente do esperado", aumento_valor: "Aumento de valor",
  boleto_fora_dda: "Boleto fora do DDA", dda_sem_cobranca: "DDA sem cobrança", aprovacao: "Aprovação", pagamento: "Pagamento",
};

const vazio = (): Omit<Fornecedor, "id" | "updated_at"> => ({
  nome: "", documento: "", emails: [], categoria_id: null, empresa_id: null, regras: [], competencia_ref: "anterior",
  tolerancia_pct: 2, explicacao: "", dia_vencimento: null, exige_aprovacao: true, ativo: true,
});
const mesAnterior = () => { const [y, m] = hojeSP().split("-").map(Number); const t = y * 12 + m - 2; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };

export function FornecedoresTab({ lancamentos, categorias, empresas }: { lancamentos: Lanc[]; categorias: Cat[]; empresas: Emp[] }) {
  const qc = useQueryClient();
  const q = useFornecedores();
  const [edit, setEdit] = useState<(Partial<Fornecedor> & { emailsTxt?: string }) | null>(null);
  const [historico, setHistorico] = useState<Fornecedor | null>(null);
  const [sugerir, setSugerir] = useState(false);
  const fornecedores = q.data ?? [];
  const catNome = (id: string | null) => categorias.find((c) => c.id === id)?.nome ?? "—";

  const sugestoes = useMemo(() => {
    const docs = new Set(fornecedores.map((f) => soDigitos(f.documento)).filter(Boolean));
    const m = new Map<string, { nome: string; documento: string; qtd: number; total: number; categoria_id: string | null; empresa_id: string | null }>();
    for (const l of lancamentos) {
      if (l.tipo !== "pagar" || l.status === "cancelado") continue;
      const d = soDigitos(l.documento_contraparte);
      if (d.length < 11 || docs.has(d)) continue;
      const x = m.get(d) ?? { nome: l.contraparte || d, documento: d, qtd: 0, total: 0, categoria_id: l.categoria_id, empresa_id: l.empresa_id };
      x.qtd++; x.total += Number(l.valor) || 0;
      m.set(d, x);
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 50);
  }, [lancamentos, fornecedores]);

  const excluir = async (f: Fornecedor) => {
    if (!confirm(`Excluir o fornecedor ${f.nome}? As contas e evidências dele continuam guardadas.`)) return;
    const { error } = await fin.from("fin_fornecedores").delete().eq("id", f.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["fin-fornecedores"] });
  };

  if (q.error) return <p className="text-sm text-destructive">Não foi possível carregar os fornecedores: {(q.error as Error).message}. Confira se a migração 0065 foi aplicada.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <p className="text-sm text-muted-foreground flex-1 min-w-[260px]">Cadastre como cada fornecedor cobra. As cobranças que chegam pelo e-mail ou pelo DDA são conferidas contra essa regra e as diferenças viram evidência.</p>
        {sugestoes.length > 0 && <Button variant="outline" onClick={() => setSugerir(true)}><UserPlus className="h-4 w-4 mr-1" />Das contas a pagar ({sugestoes.length})</Button>}
        <Button onClick={() => setEdit({ ...vazio(), emailsTxt: "" })}><Plus className="h-4 w-4 mr-1" />Novo fornecedor</Button>
      </div>
      <Card>
        {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin m-4" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Como cobra</TableHead><TableHead>Categoria</TableHead><TableHead>Tolerância</TableHead><TableHead>Última cobrança</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {fornecedores.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Nenhum fornecedor cadastrado.</TableCell></TableRow>}
              {fornecedores.map((f) => {
                const ult = lancamentos.filter((l) => l.fornecedor_id === f.id).sort((a, b) => String(b.vencimento).localeCompare(String(a.vencimento)))[0];
                return (
                  <TableRow key={f.id} className={f.ativo ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{f.nome}<div className="text-xs text-muted-foreground">{f.documento || "sem CNPJ"}{f.emails.length ? ` · ${f.emails.join(", ")}` : ""}</div></TableCell>
                    <TableCell className="text-xs">{f.regras.length ? f.regras.map((r) => TIPO_REGRA_LABEL[r.tipo]).join(" + ") : <span className="text-amber-700">sem regra</span>}</TableCell>
                    <TableCell className="text-xs">{catNome(f.categoria_id)}</TableCell>
                    <TableCell className="text-xs">{f.tolerancia_pct}%</TableCell>
                    <TableCell className="text-xs">{ult ? `${formatDataBR(ult.vencimento)} · ${formatBRL(ult.valor)}${ult.valor_esperado != null ? ` (esperado ${formatBRL(ult.valor_esperado)})` : ""}` : "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Histórico e evidências" onClick={() => setHistorico(f)}><History className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit({ ...f, emailsTxt: f.emails.join(", ") })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluir(f)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      {edit && <EditorFornecedor f={edit} categorias={categorias} empresas={empresas} onClose={() => setEdit(null)} />}
      {historico && <HistoricoFornecedor f={historico} lancamentos={lancamentos} onClose={() => setHistorico(null)} />}
      <Dialog open={sugerir} onOpenChange={setSugerir}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Fornecedores encontrados nas contas a pagar</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto divide-y rounded border text-sm">
            {sugestoes.map((s) => (
              <div key={s.documento} className="flex items-center gap-2 px-2 py-1.5">
                <div className="flex-1"><b>{s.nome}</b> <span className="text-xs text-muted-foreground">{s.documento} · {s.qtd} conta(s) · {formatBRL(s.total)}</span></div>
                <Button size="sm" variant="outline" onClick={() => { setSugerir(false); setEdit({ ...vazio(), nome: s.nome, documento: s.documento, categoria_id: s.categoria_id, empresa_id: s.empresa_id, emailsTxt: "" }); }}>Cadastrar</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditorRegra({ r, onChange, onRemove }: { r: Regra; onChange: (r: Regra) => void; onRemove: () => void }) {
  const n = (v: string) => Number(String(v).replace(",", ".")) || 0;
  return (
    <div className="rounded border p-2 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{TIPO_REGRA_LABEL[r.tipo]}</Badge>
        <Input className="h-7 text-xs flex-1" placeholder="Descrição (opcional)" value={r.descricao ?? ""} onChange={(e) => onChange({ ...r, descricao: e.target.value })} />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {r.tipo === "fixo" && <div className="w-48"><Label className="text-xs">Valor mensal (R$)</Label><Input className="h-8" defaultValue={r.valor || ""} onBlur={(e) => onChange({ ...r, valor: n(e.target.value) })} /></div>}
      {(r.tipo === "por_veiculo" || r.tipo === "por_chip") && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Valor por {r.tipo === "por_veiculo" ? "veículo" : "linha"} (R$)</Label><Input className="h-8" defaultValue={r.valor_unit || ""} onBlur={(e) => onChange({ ...r, valor_unit: n(e.target.value) })} /></div>
          <div><Label className="text-xs">Mínimo cobrado (qtd.)</Label><Input className="h-8" defaultValue={r.minimo || ""} onBlur={(e) => onChange({ ...r, minimo: n(e.target.value) || undefined })} /></div>
          <div><Label className="text-xs">Filtro (opcional)</Label><Input className="h-8" placeholder={r.tipo === "por_chip" ? "ex.: Vivo" : "ex.: modelo J16"} defaultValue={r.filtro ?? ""} onBlur={(e) => onChange({ ...r, filtro: e.target.value.trim() || undefined })} /></div>
          <p className="text-[11px] text-muted-foreground sm:col-span-3">Conta os {r.tipo === "por_veiculo" ? "equipamentos vinculados a placas" : "chips de equipamentos vinculados"} no espelho do GSystem (Estoque). O filtro procura o texto nos dados do {r.tipo === "por_chip" ? "chip (operadora, número)" : "equipamento (modelo, cliente)"}.</p>
        </div>
      )}
      {r.tipo === "por_servico" && (
        <div className="grid gap-2 sm:grid-cols-4">
          {(["instalacao", "retirada", "manutencao"] as TipoServico[]).map((t) => (
            <div key={t}><Label className="text-xs">{SERVICO_LABEL[t]} (R$)</Label><Input className="h-8" defaultValue={r.precos[t] || ""} onBlur={(e) => onChange({ ...r, precos: { ...r.precos, [t]: n(e.target.value) || undefined } })} /></div>
          ))}
          <div><Label className="text-xs">Quais serviços</Label>
            <Select value={r.canal ?? "todos"} onValueChange={(v) => onChange({ ...r, canal: v as any })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CANAL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select></div>
          <p className="text-[11px] text-muted-foreground sm:col-span-4">Conta os serviços técnicos (chamados com termo de instalação, retirada ou manutenção) concluídos no mês de competência.</p>
        </div>
      )}
    </div>
  );
}

function EditorFornecedor({ f, categorias, empresas, onClose }: { f: Partial<Fornecedor> & { emailsTxt?: string }; categorias: Cat[]; empresas: Emp[]; onClose: () => void }) {
  const qc = useQueryClient();
  const simular = useServerFn(simularCobrancaFn);
  const [x, setX] = useState(f);
  const [busy, setBusy] = useState(false);
  const [mes, setMes] = useState(mesAnterior());
  const [sim, setSim] = useState<any>(null);
  const set = (k: keyof Fornecedor | "emailsTxt", v: any) => setX((o) => ({ ...o, [k]: v }));
  const regras = x.regras ?? [];
  const novaRegra = (tipo: Regra["tipo"]) => set("regras", [...regras, tipo === "fixo" ? { tipo, valor: 0 } : tipo === "por_servico" ? { tipo, precos: {}, canal: "todos" } : { tipo, valor_unit: 0 }]);

  const salvar = async () => {
    if (!x.nome?.trim()) { toast.error("Informe o nome."); return; }
    setBusy(true);
    const payload = {
      nome: x.nome.trim(), documento: soDigitos(x.documento) || null,
      emails: String(x.emailsTxt ?? "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean),
      categoria_id: x.categoria_id || null, empresa_id: x.empresa_id || null, regras, competencia_ref: x.competencia_ref ?? "anterior",
      tolerancia_pct: Number(x.tolerancia_pct) || 0, explicacao: x.explicacao || null, dia_vencimento: x.dia_vencimento || null,
      exige_aprovacao: x.exige_aprovacao !== false, ativo: x.ativo !== false,
    };
    const res = x.id ? await fin.from("fin_fornecedores").update(payload).eq("id", x.id).select("id").single() : await fin.from("fin_fornecedores").insert(payload).select("id").single();
    setBusy(false);
    if (res.error) { toast.error(/duplicate|unique/i.test(res.error.message) ? "Já existe fornecedor com este CNPJ." : res.error.message); return; }
    toast.success("Fornecedor salvo.");
    qc.invalidateQueries({ queryKey: ["fin-fornecedores"] });
    if (!x.id) setX((o) => ({ ...o, id: res.data.id }));
    else onClose();
  };
  const doSimular = async () => {
    if (!x.id) { toast.error("Salve o fornecedor antes de simular."); return; }
    try { setSim(await simular({ data: { fornecedorId: x.id, mes } })); } catch (e: any) { toast.error(e?.message ?? "Falha ao simular."); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{x.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2"><Label>Nome</Label><Input value={x.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></div>
            <div><Label>CNPJ/CPF</Label><Input value={x.documento ?? ""} onChange={(e) => set("documento", e.target.value)} /></div>
            <div className="sm:col-span-3"><Label>E-mails ou domínios das cobranças</Label><Input value={x.emailsTxt ?? ""} onChange={(e) => set("emailsTxt", e.target.value)} placeholder="cobranca@fornecedor.com.br, @fornecedor.com.br" />
              <p className="text-[11px] text-muted-foreground mt-1">Usado para reconhecer o fornecedor quando o e-mail chega sem nota fiscal.</p></div>
            <div><Label>Categoria</Label>
              <Select value={x.categoria_id ?? "none"} onValueChange={(v) => set("categoria_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{categorias.filter((c) => c.tipo === "despesa" && c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Empresa pagadora</Label>
              <Select value={x.empresa_id ?? "none"} onValueChange={(v) => set("empresa_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">—</SelectItem>{empresas.filter((e) => e.ativo).map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo} — {e.nome}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Dia do vencimento</Label><Input type="number" min={1} max={31} value={x.dia_vencimento ?? ""} onChange={(e) => set("dia_vencimento", Number(e.target.value) || null)} /></div>
          </div>
          <div><Label>Como o fornecedor cobra (explicação)</Label>
            <Textarea rows={3} value={x.explicacao ?? ""} onChange={(e) => set("explicacao", e.target.value)} placeholder="Ex.: cobra R$ 2,50 por veículo ativo no mês anterior, mínimo de 150 veículos; a nota chega até o dia 5 e o boleto vence dia 15." /></div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Regra de cobrança (os componentes são somados)</Label>
              {(Object.keys(TIPO_REGRA_LABEL) as Regra["tipo"][]).map((t) => <Button key={t} size="sm" variant="outline" className="h-7 text-xs" onClick={() => novaRegra(t)}><Plus className="h-3 w-3 mr-1" />{TIPO_REGRA_LABEL[t]}</Button>)}
            </div>
            {regras.map((r, i) => <EditorRegra key={i} r={r} onChange={(nr) => set("regras", regras.map((o, j) => (j === i ? nr : o)))} onRemove={() => set("regras", regras.filter((_, j) => j !== i))} />)}
            {!regras.length && <p className="text-xs text-muted-foreground">Sem regra, a cobrança é lançada e comparada só com as anteriores (aumento de valor).</p>}
          </div>

          <div className="grid gap-2 sm:grid-cols-3 items-end">
            <div><Label>A cobrança se refere a</Label>
              <Select value={x.competencia_ref ?? "anterior"} onValueChange={(v) => set("competencia_ref", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="anterior">Mês anterior à emissão</SelectItem><SelectItem value="atual">Mesmo mês da emissão</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Tolerância (%)</Label><Input type="number" step="0.5" min={0} value={x.tolerancia_pct ?? 2} onChange={(e) => set("tolerancia_pct", Number(e.target.value))} /></div>
            <div className="space-y-1">
              <label className="flex items-center gap-2"><Switch checked={x.exige_aprovacao !== false} onCheckedChange={(v) => set("exige_aprovacao", v)} />Exige aprovação</label>
              <label className="flex items-center gap-2"><Switch checked={x.ativo !== false} onCheckedChange={(v) => set("ativo", v)} />Ativo</label>
            </div>
          </div>

          {x.id && (
            <Card><CardContent className="p-3 space-y-2">
              <div className="flex items-end gap-2">
                <div><Label className="text-xs">Simular o mês</Label><Input type="month" className="h-8 w-40" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
                <Button size="sm" variant="outline" onClick={doSimular}><Calculator className="h-4 w-4 mr-1" />Calcular cobrança esperada</Button>
                <span className="text-[11px] text-muted-foreground">Salve antes de simular as mudanças.</span>
              </div>
              {sim && (
                <div className="text-xs">
                  <Table>
                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Unitário</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead>Fonte</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sim.itens.map((i: any, k: number) => <TableRow key={k}><TableCell>{i.descricao}</TableCell><TableCell className="text-right">{i.quantidade}</TableCell><TableCell className="text-right">{formatBRL(i.unitario)}</TableCell><TableCell className="text-right">{formatBRL(i.subtotal)}</TableCell><TableCell className="text-muted-foreground">{i.fonte}</TableCell></TableRow>)}
                      <TableRow><TableCell colSpan={3} className="font-semibold">Total esperado</TableCell><TableCell className="text-right font-semibold">{formatBRL(sim.total)}</TableCell><TableCell /></TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent></Card>
          )}
          <p className="text-[11px] text-muted-foreground">Toda mudança na regra, na tolerância ou na competência fica registrada como evidência (antes e depois, quem e quando).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={salvar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoFornecedor({ f, lancamentos, onClose }: { f: Fornecedor; lancamentos: Lanc[]; onClose: () => void }) {
  const { data: evid = [] } = useQuery({
    queryKey: ["fin-evidencias", f.id],
    queryFn: async () => ((await fin.from("fin_evidencias").select("*").eq("fornecedor_id", f.id).order("created_at", { ascending: false }).limit(200)).data || []) as any[],
  });
  const cobrancas = lancamentos.filter((l) => l.fornecedor_id === f.id).sort((a, b) => String(b.vencimento).localeCompare(String(a.vencimento))).slice(0, 24);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.nome} — histórico</DialogTitle></DialogHeader>
        {f.explicacao && <p className="text-sm rounded bg-muted p-2 whitespace-pre-wrap">{f.explicacao}</p>}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cobranças</CardTitle></CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Competência</TableHead><TableHead className="text-right">Cobrado</TableHead><TableHead className="text-right">Esperado</TableHead><TableHead>Aprovação</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {cobrancas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{formatDataBR(l.vencimento)}</TableCell>
                  <TableCell className="text-xs">{l.competencia ? l.competencia.slice(0, 7).split("-").reverse().join("/") : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{formatBRL(l.valor)}</TableCell>
                  <TableCell className={`text-right text-xs ${l.conferencia?.status === "acima" ? "text-red-700" : l.conferencia?.status === "abaixo" ? "text-amber-700" : ""}`}>{l.valor_esperado != null ? formatBRL(l.valor_esperado) : "—"}</TableCell>
                  <TableCell className="text-xs">{l.aprovacao ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.status}</TableCell>
                </TableRow>
              ))}
              {!cobrancas.length && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">Nenhuma cobrança ligada a este fornecedor.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evidências</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {evid.map((e) => (
              <div key={e.id} className="rounded border p-2">
                <div className="flex justify-between"><b>{e.titulo}</b><span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></div>
                <Badge variant="outline" className="text-[10px]">{TIPO_EVIDENCIA[e.tipo] ?? e.tipo}</Badge>
                {e.descricao && <p className="mt-1">{e.descricao}</p>}
                {e.tipo === "regra_alterada" && <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-1 text-[10px]">{JSON.stringify(e.dados, null, 1)}</pre>}
              </div>
            ))}
            {!evid.length && <p className="text-muted-foreground">Nenhuma evidência ainda.</p>}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
