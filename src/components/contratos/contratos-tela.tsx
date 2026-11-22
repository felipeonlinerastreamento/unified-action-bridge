import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Search, Loader2, Send, Copy, PenLine, Ban, Printer, Eye, Download, Trash2, FileSignature, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDataBR, hojeSP } from "@/lib/finance";
import { formatCpf, isValidCpf } from "@/lib/crm-proposal";
import {
  PLANOS, STATUS_LABEL, EVENTO_LABEL, situacao, fimVigencia, formatarDoc, soDigitos, mascararCpf,
  type DadosContrato, type Veiculo, type SituacaoContrato,
} from "@/lib/contratos";
import { EQUIPAMENTOS_PADRAO } from "@/lib/contratos-modelos";
import { AcoesLote } from "./acoes-lote";
import { ajustarContratoImportado, assinarInterno, atualizarAutentique, buscarClienteGsystem, cancelarContrato, enviarAutentique, enviarContrato, prepararModelos, previaContrato, statusAutentique } from "@/lib/contratos.functions";
import { CONTRATO_CSS } from "./contrato-css";

const db = supabase as any; // tabelas novas ainda fora dos tipos gerados

type Contrato = {
  id: string; numero: number; status: "rascunho" | "enviado" | "assinado" | "cancelado"; cliente_nome: string; cliente_documento: string;
  dados: DadosContrato; vigencia_inicio: string | null; vigencia_meses: number; renovacao_automatica: boolean;
  valor_mensal: number | null; valor_implantacao: number | null; signatario_nome: string | null; signatario_cpf: string | null;
  signatario_email: string | null; signatario_telefone: string | null; conteudo_html: string | null; hash_sha256: string | null;
  token: string; enviado_em: string | null; visualizado_em: string | null; assinado_em: string | null; assinatura_nome: string | null;
  assinatura_ip: string | null; assinatura_user_agent: string | null; assinatura_canal: string | null;
  contratada_assinado_nome: string | null; contratada_assinado_em: string | null; contratada_ip: string | null;
  testemunhas: { nome: string; cpf: string; assinado_em: string; ip: string | null }[]; cancelado_motivo: string | null; created_at: string;
  provedor: "proprio" | "autentique"; provedor_documento_id: string | null; provedor_link: string | null; provedor_verificacao: string | null;
  provedor_sandbox: boolean; arquivo_assinado_url: string | null; assinatura_geo: string | null;
  pasta?: string | null;
  categoria?: "cliente" | "fornecedor" | null;
};
const COLS = "id, numero, status, cliente_nome, cliente_documento, dados, vigencia_inicio, vigencia_meses, renovacao_automatica, valor_mensal, valor_implantacao, signatario_nome, signatario_cpf, signatario_email, signatario_telefone, conteudo_html, hash_sha256, token, enviado_em, visualizado_em, assinado_em, assinatura_nome, assinatura_ip, assinatura_user_agent, assinatura_canal, contratada_assinado_nome, contratada_assinado_em, contratada_ip, testemunhas, cancelado_motivo, created_at, provedor, provedor_documento_id, provedor_link, provedor_verificacao, provedor_sandbox, arquivo_assinado_url, assinatura_geo";

const dh = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const num = (s?: string) => { const n = Number(String(s ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

function SituacaoBadge({ s }: { s: SituacaoContrato }) {
  const cls: Record<string, string> = {
    rascunho: "", enviado: "border-amber-500 text-amber-600", assinado: "bg-emerald-600 text-white hover:bg-emerald-600",
    vigente: "bg-emerald-600 text-white hover:bg-emerald-600", vencendo: "bg-amber-500 text-white hover:bg-amber-500", encerrado: "", cancelado: "",
  };
  return <Badge variant={s === "rascunho" || s === "encerrado" ? "secondary" : s === "cancelado" ? "outline" : s === "enviado" ? "outline" : "default"} className={cls[s]}>{STATUS_LABEL[s]}</Badge>;
}

export function ContratosTela() {
  const { hasRole } = useAuth();
  const gestor = hasRole("admin") || hasRole("gestor");
  const preparar = useServerFn(prepararModelos);
  useQuery({ queryKey: ["contratos-modelos-preparados"], queryFn: () => preparar(), staleTime: Infinity });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileSignature className="h-6 w-6" /> Contratos</h1>
        <p className="text-sm text-muted-foreground">Contratos com assinatura eletrônica própria (CPF + código por WhatsApp/e-mail + registro de IP e hash do documento).</p>
      </div>
      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Contratos</TabsTrigger>
          {gestor && <TabsTrigger value="modelos">Modelos</TabsTrigger>}
        </TabsList>
        <TabsContent value="lista" className="mt-4"><Lista /></TabsContent>
        {gestor && <TabsContent value="modelos" className="mt-4"><Modelos /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ lista
function Lista() {
  const hoje = hojeSP();
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const [editar, setEditar] = useState<Contrato | "novo" | null>(null);
  const [abrir, setAbrir] = useState<Contrato | null>(null);
  const [pasta, setPasta] = useState("all");
  const [cat, setCat] = useState<"all" | "cliente" | "fornecedor">("all");
  const [sel, setSel] = useState<string[]>([]);
  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      // A coluna "pasta" vem da migração 0061; sem ela a lista continua funcionando.
      let r = await db.from("contratos").select(`${COLS}, pasta, categoria`).order("numero", { ascending: false }).limit(2000);
      if (r.error) r = await db.from("contratos").select(COLS).order("numero", { ascending: false }).limit(2000);
      return (r.data || []) as Contrato[];
    },
  });
  const linhas = useMemo(() => contratos.filter((c) => {
    const s = situacao(c, hoje);
    if (f !== "all" && s !== f) return false;
    if (cat !== "all" && (c.categoria ?? "cliente") !== cat) return false;
    if (pasta === "sem" ? !!c.pasta : pasta !== "all" && c.pasta !== pasta) return false;
    const t = q.trim().toLowerCase();
    return !t || `${c.numero} ${c.cliente_nome} ${c.cliente_documento}`.toLowerCase().includes(t);
  }), [contratos, q, f, hoje, pasta, cat]);
  const pastas = useMemo(() => [...new Set(contratos.map((c) => c.pasta).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")), [contratos]);
  const todosMarcados = linhas.length > 0 && linhas.every((c) => sel.includes(c.id));
  const contar = (s: SituacaoContrato) => contratos.filter((c) => situacao(c, hoje) === s).length;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        {(["enviado", "vigente", "vencendo", "rascunho"] as SituacaoContrato[]).map((s) => (
          <Card key={s} className="cursor-pointer" onClick={() => setF(f === s ? "all" : s)}>
            <CardContent className="p-3"><div className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</div><div className={`text-2xl font-semibold ${s === "vencendo" && contar(s) ? "text-amber-600" : ""}`}>{contar(s)}</div></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar nº, cliente ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={f} onValueChange={setF}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {(Object.keys(STATUS_LABEL) as SituacaoContrato[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={(v) => setCat(v as any)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Clientes e fornecedores</SelectItem>
            <SelectItem value="cliente">Contratos com clientes ({contratos.filter((c) => (c.categoria ?? "cliente") === "cliente").length})</SelectItem>
            <SelectItem value="fornecedor">Contratos com fornecedores ({contratos.filter((c) => c.categoria === "fornecedor").length})</SelectItem>
          </SelectContent>
        </Select>
        {pastas.length > 0 && (
          <Select value={pasta} onValueChange={setPasta}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pastas</SelectItem>
              <SelectItem value="sem">Sem pasta</SelectItem>
              {pastas.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => setEditar("novo")}><Plus className="h-4 w-4 mr-1" />Novo contrato</Button>
      </div>
      <AcoesLote selecionados={contratos.filter((c) => sel.includes(c.id))} pastasLocais={pastas} onLimpar={() => setSel([])} />
      <Card>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin m-4" /> : (
          <Table>
            <TableHeader><TableRow><TableHead className="w-8"><Checkbox checked={todosMarcados} onCheckedChange={(v) => setSel(v ? [...new Set([...sel, ...linhas.map((c) => c.id)])] : sel.filter((id) => !linhas.some((c) => c.id === id)))} aria-label="Marcar todos" /></TableHead><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Situação</TableHead><TableHead>Vigência</TableHead><TableHead>Enviado</TableHead><TableHead>Assinado</TableHead></TableRow></TableHeader>
            <TableBody>
              {linhas.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum contrato.</TableCell></TableRow>}
              {linhas.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => (c.status === "rascunho" ? setEditar(c) : setAbrir(c))}>
                  <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.includes(c.id)} onCheckedChange={(v) => setSel((x) => (v ? [...x, c.id] : x.filter((id) => id !== c.id)))} aria-label={`Marcar contrato ${c.numero}`} /></TableCell>
                  <TableCell>{c.numero}</TableCell>
                  <TableCell className="font-medium">{c.cliente_nome}<div className="text-xs text-muted-foreground">{formatarDoc(c.cliente_documento)}{c.provedor === "autentique" && <Badge variant="outline" className="ml-2 text-[10px]">Autentique</Badge>}{c.categoria === "fornecedor" && <Badge variant="outline" className="ml-1 text-[10px] border-violet-500/50 text-violet-700">Fornecedor</Badge>}{c.pasta && <Badge variant="secondary" className="ml-1 text-[10px]">{c.pasta}</Badge>}</div></TableCell>
                  <TableCell><SituacaoBadge s={situacao(c, hoje)} /></TableCell>
                  <TableCell className="whitespace-nowrap">{c.vigencia_inicio ? `${formatDataBR(c.vigencia_inicio)} → ${formatDataBR(fimVigencia(c.vigencia_inicio, c.vigencia_meses, c.renovacao_automatica, hoje))}` : "—"}</TableCell>
                  <TableCell>{dh(c.enviado_em)}</TableCell>
                  <TableCell>{dh(c.assinado_em)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {editar && <Editor contrato={editar === "novo" ? null : editar} onClose={() => setEditar(null)} onAbrir={(c) => { setEditar(null); setAbrir(c); }} />}
      {abrir && <Detalhe contrato={abrir} onClose={() => setAbrir(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ editor (rascunho)
const vazio = (): DadosContrato => ({
  tipo_pessoa: "PJ", cliente_nome: "", cliente_documento: "", endereco: "", planos: ["frotas"], instalacao: "credenciado",
  vigencia_meses: 12, vigencia_inicio: hojeSP(), veiculos: [], equipamentos: EQUIPAMENTOS_PADRAO, local: "São José da Lapa, MG",
});

function Editor({ contrato, onClose, onAbrir }: { contrato: Contrato | null; onClose: () => void; onAbrir: (c: Contrato) => void }) {
  const qc = useQueryClient();
  const buscar = useServerFn(buscarClienteGsystem);
  const previa = useServerFn(previaContrato);
  const [d, setD] = useState<DadosContrato>(() => ({ ...vazio(), ...(contrato?.dados ?? {}) }));
  const [sig, setSig] = useState({
    nome: contrato?.signatario_nome ?? "", cpf: contrato?.signatario_cpf ? formatCpf(contrato.signatario_cpf) : "",
    email: contrato?.signatario_email ?? "", telefone: contrato?.signatario_telefone ?? "",
  });
  const [renova, setRenova] = useState(contrato?.renovacao_automatica ?? true);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [preview, setPreview] = useState<{ html: string; faltando: string[] } | null>(null);
  const set = <K extends keyof DadosContrato>(k: K, v: DadosContrato[K]) => setD((p) => ({ ...p, [k]: v }));

  const doBuscar = async () => {
    if (soDigitos(d.cliente_documento).length < 11) { toast.error("Informe o CPF/CNPJ do cliente."); return; }
    setBuscando(true);
    try {
      const r = await buscar({ data: { documento: d.cliente_documento } });
      if (!r.encontrado) { toast.error("Cliente não encontrado no GSystem."); return; }
      setD((p) => ({
        ...p, cliente_nome: r.nome || p.cliente_nome, endereco: r.endereco || p.endereco, email_cobranca: p.email_cobranca || r.email,
        tipo_pessoa: soDigitos(p.cliente_documento).length === 11 ? "PF" : "PJ", veiculos: r.veiculos.length ? r.veiculos : p.veiculos,
      }));
      if (r.telefone && !sig.telefone) setSig((s) => ({ ...s, telefone: r.telefone }));
      toast.success(`Dados do GSystem carregados (${r.veiculos.length} veículo(s)).`);
    } catch (e: any) { toast.error(e?.message ?? "Falha na busca."); } finally { setBuscando(false); }
  };

  const salvar = async (fechar = true): Promise<Contrato | null> => {
    if (!d.cliente_nome.trim() || soDigitos(d.cliente_documento).length < 11) { toast.error("Informe nome e CPF/CNPJ do cliente."); return null; }
    if (sig.cpf && !isValidCpf(sig.cpf)) { toast.error("CPF do signatário inválido."); return null; }
    setSalvando(true);
    const row = {
      cliente_nome: d.cliente_nome.trim(), cliente_documento: soDigitos(d.cliente_documento), dados: { ...d, cliente_documento: soDigitos(d.cliente_documento) },
      vigencia_inicio: d.vigencia_inicio || null, vigencia_meses: d.vigencia_meses || 12, renovacao_automatica: renova,
      valor_mensal: num(d.valor_mensalidade), valor_implantacao: num(d.valor_implantacao),
      signatario_nome: sig.nome.trim() || null, signatario_cpf: soDigitos(sig.cpf) || null, signatario_email: sig.email.trim() || null, signatario_telefone: soDigitos(sig.telefone) || null,
    };
    const q = contrato ? db.from("contratos").update(row).eq("id", contrato.id) : db.from("contratos").insert(row);
    const { data, error } = await q.select(COLS).single();
    setSalvando(false);
    if (error) { toast.error(error.message); return null; }
    qc.invalidateQueries({ queryKey: ["contratos"] });
    if (fechar) { toast.success("Rascunho salvo."); onClose(); }
    return data as Contrato;
  };

  const verPrevia = async () => {
    try { setPreview(await previa({ data: { dados: d } })); } catch (e: any) { toast.error(e?.message ?? "Falha na prévia."); }
  };
  const excluir = async () => {
    if (!contrato || !confirm("Excluir este rascunho?")) return;
    const { error } = await db.from("contratos").delete().eq("id", contrato.id);
    if (error) toast.error(error.message); else { qc.invalidateQueries({ queryKey: ["contratos"] }); onClose(); }
  };
  const setVeic = (i: number, k: keyof Veiculo, v: string) => set("veiculos", d.veiculos.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const campo = (label: string, k: keyof DadosContrato, props: any = {}) => (
    <div><Label>{label}</Label><Input value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as any)} {...props} /></div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{contrato ? `Contrato nº ${contrato.numero} (rascunho)` : "Novo contrato"}</DialogTitle></DialogHeader>

        <section className="space-y-3">
          <h3 className="font-semibold text-sm">Contratante</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><Label>CPF/CNPJ</Label>
              <div className="flex gap-2"><Input value={d.cliente_documento} onChange={(e) => set("cliente_documento", e.target.value)} />
                <Button type="button" variant="outline" onClick={doBuscar} disabled={buscando}>{buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="ml-1 hidden sm:inline">GSystem</span></Button></div>
            </div>
            <div><Label>Tipo</Label>
              <Select value={d.tipo_pessoa} onValueChange={(v) => set("tipo_pessoa", v as "PJ" | "PF")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PJ">Pessoa jurídica</SelectItem><SelectItem value="PF">Pessoa física</SelectItem></SelectContent></Select>
            </div>
            {campo("Nome / Razão social", "cliente_nome")}
          </div>
          {campo("Endereço completo (rua, nº, bairro, cidade/UF, CEP)", "endereco")}
          {d.tipo_pessoa === "PJ" ? (
            <div className="grid gap-3 sm:grid-cols-3">{campo("Representante legal", "representante_nome")}{campo("RG do representante", "representante_rg")}{campo("CPF do representante", "representante_cpf")}</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">{campo("Estado civil", "estado_civil")}{campo("Profissão", "profissao")}{campo("RG", "rg")}</div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-sm">Plano, instalação e vigência</h3>
          <div className="flex flex-wrap gap-4">
            {PLANOS.map((p) => (
              <label key={p.key} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={d.planos.includes(p.key)} onCheckedChange={(v) => set("planos", v ? [...d.planos, p.key] : d.planos.filter((x) => x !== p.key))} />{p.label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><Label>Instalação</Label>
              <Select value={d.instalacao} onValueChange={(v) => set("instalacao", v as any)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="credenciado">Técnico credenciado</SelectItem><SelectItem value="cliente">Técnico do cliente</SelectItem></SelectContent></Select>
            </div>
            <div><Label>Início da vigência</Label><Input type="date" value={d.vigencia_inicio} onChange={(e) => set("vigencia_inicio", e.target.value)} /></div>
            <div><Label>Meses</Label><Input inputMode="numeric" value={String(d.vigencia_meses)} onChange={(e) => set("vigencia_meses", Number(e.target.value.replace(/\D/g, "")) || 12)} /></div>
            <label className="flex items-center gap-2 text-sm mt-6"><Switch checked={renova} onCheckedChange={setRenova} />Renovação automática</label>
          </div>
          <div><Label>Remuneração (opcional — em branco usa implantação + mensalidade)</Label><Input value={d.remuneracao ?? ""} onChange={(e) => set("remuneracao", e.target.value)} /></div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="font-semibold text-sm">Veículos ({d.veiculos.length})</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => set("veiculos", [...d.veiculos, { placa: "" }])}><Plus className="h-4 w-4 mr-1" />Veículo</Button></div>
          {d.veiculos.map((v, i) => (
            <div key={i} className="grid gap-2 grid-cols-2 sm:grid-cols-7 items-end">
              {(["placa", "chassi", "renavam", "marca", "modelo", "ano"] as (keyof Veiculo)[]).map((k) => (
                <div key={k}><Label className="text-xs capitalize">{k}</Label><Input value={v[k] ?? ""} onChange={(e) => setVeic(i, k, e.target.value)} /></div>
              ))}
              <Button type="button" size="icon" variant="ghost" onClick={() => set("veiculos", d.veiculos.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-sm">Termo de Adesão (Anexo I)</h3>
          <div><Label>Equipamentos e especificações</Label><Textarea rows={3} value={d.equipamentos ?? ""} onChange={(e) => set("equipamentos", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {campo("Kit instalação", "kit_instalacao")}{campo("Implantação (R$)", "valor_implantacao")}{campo("Mensalidade (R$)", "valor_mensalidade")}
            {campo("Visita frustrada (R$)", "valor_visita_frustrada")}{campo("Extravio telemetria (R$)", "valor_telemetria")}{campo("Extravio identificador (R$)", "valor_identificador")}
            {campo("Extravio módulo câmera (R$)", "valor_modulo_camera")}{campo("Extravio câmera motorista (R$)", "valor_camera_motorista")}{campo("Crachá extra (R$)", "valor_cracha")}
            {campo("E-mail de cobrança", "email_cobranca")}{campo("Local", "local")}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold text-sm">Quem assina pelo contratante</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div><Label>Nome</Label><Input value={sig.nome} onChange={(e) => setSig({ ...sig, nome: e.target.value })} /></div>
            <div><Label>CPF</Label><Input value={sig.cpf} onChange={(e) => setSig({ ...sig, cpf: formatCpf(e.target.value) })} /></div>
            <div><Label>WhatsApp</Label><Input value={sig.telefone} onChange={(e) => setSig({ ...sig, telefone: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input value={sig.email} onChange={(e) => setSig({ ...sig, email: e.target.value })} /></div>
          </div>
        </section>

        <DialogFooter className="gap-2 flex-wrap">
          {contrato && <Button variant="ghost" className="text-destructive mr-auto" onClick={excluir}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>}
          <Button variant="outline" onClick={verPrevia}><Eye className="h-4 w-4 mr-1" />Prévia</Button>
          <Button variant="outline" onClick={() => salvar(true)} disabled={salvando}>Salvar rascunho</Button>
          <Button onClick={async () => { const c = await salvar(false); if (c) onAbrir(c); }} disabled={salvando}><Send className="h-4 w-4 mr-1" />Salvar e enviar</Button>
        </DialogFooter>
        {preview && (
          <Dialog open onOpenChange={(o) => !o && setPreview(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Prévia</DialogTitle></DialogHeader>
              {preview.faltando.length > 0 && <p className="text-sm text-amber-600">Campos em branco: {preview.faltando.join(", ")}</p>}
              <style>{CONTRATO_CSS}</style>
              <article className="contrato-doc" dangerouslySetInnerHTML={{ __html: preview.html }} />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ detalhe (enviado / assinado)
function registroHtml(c: Contrato, eventos: any[]) {
  const e = (s: any) => String(s ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const linhas = [
    ["CONTRATANTE", c.assinatura_nome ? `${e(c.assinatura_nome)} — CPF ${e(mascararCpf(c.signatario_cpf || ""))}` : "Pendente", dh(c.assinado_em), c.assinado_em ? `IP ${e(c.assinatura_ip)} · código por ${e(c.assinatura_canal)}<br/>${e(c.assinatura_user_agent)}` : ""],
    ["CONTRATADA", c.contratada_assinado_nome ? e(c.contratada_assinado_nome) : "Pendente", dh(c.contratada_assinado_em), c.contratada_ip ? `IP ${e(c.contratada_ip)}` : ""],
    ...(c.testemunhas || []).map((t, i) => [`TESTEMUNHA ${i + 1}`, `${e(t.nome)} — CPF ${e(mascararCpf(t.cpf))}`, dh(t.assinado_em), t.ip ? `IP ${e(t.ip)}` : ""]),
  ];
  return `<div class="registro"><h3>Registro de assinaturas eletrônicas — Contrato nº ${c.numero}</h3>
<p>Documento: SHA-256 <b>${e(c.hash_sha256)}</b><br/>Assinatura eletrônica nos termos do art. 10, §2º, da MP 2.200-2/2001 e da Lei 14.063/2020 (cláusula 8.5).</p>
<table><tr><th>Parte</th><th>Assinante</th><th>Data/hora</th><th>Evidências</th></tr>${linhas.map((l) => `<tr>${l.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</table>
<h3>Trilha de auditoria</h3><table><tr><th>Data/hora</th><th>Evento</th><th>Detalhe</th><th>IP</th></tr>
${eventos.map((ev) => `<tr><td>${dh(ev.created_at)}</td><td>${e(EVENTO_LABEL[ev.tipo] ?? ev.tipo)}</td><td>${e(ev.descricao)}</td><td>${e(ev.ip)}</td></tr>`).join("")}</table></div>`;
}

function Detalhe({ contrato, onClose }: { contrato: Contrato; onClose: () => void }) {
  const qc = useQueryClient();
  const enviar = useServerFn(enviarContrato);
  const cancelar = useServerFn(cancelarContrato);
  const assinar = useServerFn(assinarInterno);
  const enviarAut = useServerFn(enviarAutentique);
  const atualizarAut = useServerFn(atualizarAutentique);
  const statusAut = useServerFn(statusAutentique);
  const { data: aut } = useQuery({ queryKey: ["autentique-status"], queryFn: () => statusAut(), staleTime: 10 * 60_000 });
  const [autCanal, setAutCanal] = useState<"email" | "whatsapp">(contrato.signatario_email ? "email" : "whatsapp");
  const [autVerif, setAutVerif] = useState<"nenhuma" | "LIVE" | "PF_FACIAL" | "UPLOAD">("nenhuma");
  const hoje = hojeSP();
  const { data: c = contrato, refetch } = useQuery({
    queryKey: ["contrato", contrato.id],
    queryFn: async () => (await db.from("contratos").select(COLS).eq("id", contrato.id).single()).data as Contrato,
    initialData: contrato,
  });
  const { data: eventos = [], refetch: refEv } = useQuery({
    queryKey: ["contrato-eventos", contrato.id],
    queryFn: async () => (await db.from("contratos_eventos").select("*").eq("contrato_id", contrato.id).order("created_at")).data || [],
  });
  const [canais, setCanais] = useState({ whatsapp: !!c.signatario_telefone, email: !!c.signatario_email });
  const [ocupado, setOcupado] = useState(false);
  const [cpfTest, setCpfTest] = useState("");
  const atualizar = () => { refetch(); refEv(); qc.invalidateQueries({ queryKey: ["contratos"] }); };
  const url = typeof window !== "undefined" ? `${window.location.origin}/contrato/${c.token}` : "";

  const doEnviar = async () => {
    if (!canais.whatsapp && !canais.email) { toast.error("Escolha WhatsApp e/ou e-mail."); return; }
    setOcupado(true);
    try {
      const r = await enviar({ data: { id: c.id, ...canais } });
      if (r.enviados.length) toast.success(`Enviado por ${r.enviados.join(" e ")}.`);
      Object.entries(r.erros).forEach(([k, v]) => toast.error(`${k}: ${v}`));
      atualizar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao enviar."); } finally { setOcupado(false); }
  };
  const doEnviarAut = async () => {
    setOcupado(true);
    try { await enviarAut({ data: { id: c.id, canal: autCanal, verificacao: autVerif } }); toast.success("Enviado pelo Autentique."); atualizar(); }
    catch (e: any) { toast.error(e?.message ?? "Falha no Autentique."); } finally { setOcupado(false); }
  };
  const doAtualizarAut = async () => {
    setOcupado(true);
    try { const r = await atualizarAut({ data: { id: c.id } }); toast.success(r.mudou ? "Atualizado do Autentique." : "Sem novidades no Autentique."); atualizar(); }
    catch (e: any) { toast.error(e?.message ?? "Falha ao consultar o Autentique."); } finally { setOcupado(false); }
  };
  const doAssinar = async (papel: "contratada" | "testemunha") => {
    if (papel === "testemunha" && !isValidCpf(cpfTest)) { toast.error("Informe seu CPF para assinar como testemunha."); return; }
    setOcupado(true);
    try { await assinar({ data: { id: c.id, papel, cpf: cpfTest } }); toast.success("Assinatura registrada."); atualizar(); }
    catch (e: any) { toast.error(e?.message ?? "Falha."); } finally { setOcupado(false); }
  };
  const doCancelar = async () => {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    try { await cancelar({ data: { id: c.id, motivo } }); toast.success("Contrato cancelado."); atualizar(); } catch (e: any) { toast.error(e?.message ?? "Falha."); }
  };
  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Contrato nº ${c.numero}</title><style>body{max-width:800px;margin:24px auto;padding:0 16px}${CONTRATO_CSS}</style></head><body><article class="contrato-doc">${c.conteudo_html ?? ""}</article>${registroHtml(c, eventos)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  const s = situacao(c, hoje);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2">Contrato nº {c.numero} · {c.cliente_nome} <SituacaoBadge s={s} /></DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Signatário</div>{c.signatario_nome} · CPF {mascararCpf(c.signatario_cpf || "")}</div>
          <div><div className="text-xs text-muted-foreground">Vigência</div>{c.vigencia_inicio ? `${formatDataBR(c.vigencia_inicio)} → ${formatDataBR(fimVigencia(c.vigencia_inicio, c.vigencia_meses, c.renovacao_automatica, hoje))}${c.renovacao_automatica ? " (renova)" : ""}` : "—"}</div>
          <div><div className="text-xs text-muted-foreground">Aberto pelo cliente</div>{dh(c.visualizado_em)}</div>
        </div>
        {c.status === "cancelado" && <p className="text-sm text-destructive">Cancelado: {c.cancelado_motivo}</p>}
        {(c.dados as any)?.importado && <AjusteImportado c={c} onSalvo={atualizar} />}

        {c.status === "enviado" && c.provedor !== "autentique" && (
          <Card><CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5"><Checkbox checked={canais.whatsapp} onCheckedChange={(v) => setCanais({ ...canais, whatsapp: v === true })} />WhatsApp</label>
            <label className="flex items-center gap-1.5"><Checkbox checked={canais.email} onCheckedChange={(v) => setCanais({ ...canais, email: v === true })} />E-mail</label>
            <Button size="sm" onClick={doEnviar} disabled={ocupado}><Send className="h-4 w-4 mr-1" />{c.enviado_em ? "Reenviar link" : "Enviar"}</Button>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado."); }}><Copy className="h-4 w-4 mr-1" />Copiar link</Button>
          </CardContent></Card>
        )}
        {c.status === "rascunho" && aut?.configurado && (
          <Card><CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1 font-medium"><ShieldCheck className="h-4 w-4" />Autentique{aut.sandbox ? " (modo teste)" : ""}</span>
            <Select value={autCanal} onValueChange={(v) => setAutCanal(v as any)}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="email">E-mail</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent></Select>
            <Select value={autVerif} onValueChange={(v) => setAutVerif(v as any)}><SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem verificação extra</SelectItem>
                <SelectItem value="LIVE">Documento + selfie + prova de vida</SelectItem>
                <SelectItem value="PF_FACIAL">Selfie validada no governo (SERPRO)</SelectItem>
                <SelectItem value="UPLOAD">Foto do documento (frente e verso)</SelectItem>
              </SelectContent></Select>
            <Button size="sm" variant="outline" onClick={doEnviarAut} disabled={ocupado}>{ocupado ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Enviar pelo Autentique</Button>
            <span className="text-xs text-muted-foreground w-full">Você assina como CONTRATADA pelo e-mail da sua conta. Verificações extras consomem créditos do Autentique.</span>
          </CardContent></Card>
        )}
        {c.provedor === "autentique" && c.status !== "rascunho" && (
          <Card><CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1 font-medium"><ShieldCheck className="h-4 w-4" />Assinatura pelo Autentique{c.provedor_sandbox ? " (teste)" : ""}</span>
            {c.provedor_link && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.provedor_link!); toast.success("Link copiado."); }}><Copy className="h-4 w-4 mr-1" />Link do cliente</Button>}
            <Button size="sm" variant="outline" onClick={doAtualizarAut} disabled={ocupado}><RefreshCw className="h-4 w-4 mr-1" />Atualizar do Autentique</Button>
            {c.arquivo_assinado_url && <a href={c.arquivo_assinado_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><ExternalLink className="h-4 w-4" />PDF assinado</a>}
          </CardContent></Card>
        )}
        {c.status === "rascunho" && (
          <Card><CardContent className="p-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">Assinatura própria:</span><span>ao enviar, o texto é congelado e recebe o código de integridade (SHA-256).</span>
            <label className="flex items-center gap-1.5"><Checkbox checked={canais.whatsapp} onCheckedChange={(v) => setCanais({ ...canais, whatsapp: v === true })} />WhatsApp</label>
            <label className="flex items-center gap-1.5"><Checkbox checked={canais.email} onCheckedChange={(v) => setCanais({ ...canais, email: v === true })} />E-mail</label>
            <Button size="sm" onClick={doEnviar} disabled={ocupado}>{ocupado ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Enviar para assinatura</Button>
          </CardContent></Card>
        )}

        {(c.status === "enviado" || c.status === "assinado") && c.provedor === "autentique" && (
          <Card><CardContent className="p-3 text-sm space-y-1">
            <div>CONTRATANTE: {c.assinado_em ? `${c.assinatura_nome} em ${dh(c.assinado_em)} (IP ${c.assinatura_ip ?? "—"}${c.assinatura_geo ? `, ${c.assinatura_geo}` : ""})` : "aguardando"}</div>
            <div>CONTRATADA: {c.contratada_assinado_em ? `${c.contratada_assinado_nome} em ${dh(c.contratada_assinado_em)}` : "aguardando (assine pelo e-mail do Autentique)"}</div>
          </CardContent></Card>
        )}
        {(c.status === "enviado" || c.status === "assinado") && c.provedor !== "autentique" && (
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Assinaturas</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>CONTRATANTE: {c.assinado_em ? `${c.assinatura_nome} em ${dh(c.assinado_em)} (IP ${c.assinatura_ip ?? "—"})` : "aguardando"}</div>
              <div className="flex flex-wrap items-center gap-2">CONTRATADA: {c.contratada_assinado_em ? `${c.contratada_assinado_nome} em ${dh(c.contratada_assinado_em)}` :
                <Button size="sm" variant="outline" onClick={() => doAssinar("contratada")} disabled={ocupado}><PenLine className="h-4 w-4 mr-1" />Assinar como CONTRATADA</Button>}</div>
              {(c.testemunhas || []).map((t, i) => <div key={i}>Testemunha {i + 1}: {t.nome} em {dh(t.assinado_em)}</div>)}
              {(c.testemunhas || []).length < 2 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="w-[170px]" placeholder="Seu CPF" value={cpfTest} onChange={(e) => setCpfTest(formatCpf(e.target.value))} />
                  <Button size="sm" variant="outline" onClick={() => doAssinar("testemunha")} disabled={ocupado}><PenLine className="h-4 w-4 mr-1" />Assinar como testemunha</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {c.conteudo_html && (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Ver texto do contrato</summary>
            <style>{CONTRATO_CSS}</style>
            <article className="contrato-doc mt-3" dangerouslySetInnerHTML={{ __html: c.conteudo_html }} />
            <p className="text-[11px] text-muted-foreground break-all mt-2">SHA-256: {c.hash_sha256}</p>
          </details>
        )}

        <div className="space-y-1">
          <div className="text-sm font-medium">Trilha de auditoria</div>
          {eventos.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
          {eventos.map((ev: any) => (
            <div key={ev.id} className="text-xs border-l-2 pl-2"><b>{dh(ev.created_at)}</b> · {EVENTO_LABEL[ev.tipo] ?? ev.tipo}{ev.descricao ? ` — ${ev.descricao}` : ""}{ev.ip ? ` · IP ${ev.ip}` : ""}</div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          {c.status !== "cancelado" && c.status !== "rascunho" && <Button variant="ghost" className="text-destructive mr-auto" onClick={doCancelar}><Ban className="h-4 w-4 mr-1" />Cancelar contrato</Button>}
          {c.conteudo_html && <Button variant="outline" onClick={imprimir}><Printer className="h-4 w-4 mr-1" />Imprimir / PDF</Button>}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ modelos
function Modelos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["contratos-modelos"],
    queryFn: async () => (await db.from("contratos_modelos").select("*").order("chave")).data || [],
  });
  const [texto, setTexto] = useState<Record<string, string>>({});
  const salvar = async (m: any) => {
    const conteudo = texto[m.id] ?? m.conteudo;
    const { error } = await db.from("contratos_modelos").update({ conteudo, versao: m.versao + 1, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) toast.error(error.message); else { toast.success("Modelo salvo. Vale para os próximos envios; contratos já enviados não mudam."); qc.invalidateQueries({ queryKey: ["contratos-modelos"] }); }
  };
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Campos disponíveis: {"{{cliente_qualificacao}} {{x:plano_frotas}} {{vigencia_texto}} {{vigencia_inicio_extenso}} {{remuneracao}} {{veiculos}} {{equipamentos}} {{valor_implantacao}} {{valor_mensalidade}} {{email_cobranca}} {{local}} {{data_extenso}} {{assinaturas}}"} e os demais valores do Termo. Linha curta em maiúsculas vira título.
      </p>
      {modelos.map((m: any) => (
        <Card key={m.id}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{m.nome} · versão {m.versao}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea rows={18} className="font-mono text-xs" value={texto[m.id] ?? m.conteudo} onChange={(e) => setTexto({ ...texto, [m.id]: e.target.value })} />
            <Button size="sm" onClick={() => salvar(m)}>Salvar modelo</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ contratos importados do Autentique
function AjusteImportado({ c, onSalvo }: { c: Contrato; onSalvo: () => void }) {
  const ajustar = useServerFn(ajustarContratoImportado);
  const [f, setF] = useState({
    cliente_nome: c.cliente_nome, cliente_documento: c.cliente_documento ? formatarDoc(c.cliente_documento) : "",
    vigencia_inicio: c.vigencia_inicio ?? (c.assinado_em ? c.assinado_em.slice(0, 10) : ""), vigencia_meses: String(c.vigencia_meses || 12), renovacao: c.renovacao_automatica,
  });
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    try {
      await ajustar({ data: { id: c.id, cliente_nome: f.cliente_nome, cliente_documento: f.cliente_documento, vigencia_inicio: f.vigencia_inicio || null, vigencia_meses: Number(f.vigencia_meses) || 12, renovacao_automatica: f.renovacao } });
      toast.success("Dados do contrato importado salvos."); onSalvo();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); } finally { setSalvando(false); }
  };
  return (
    <Card><CardContent className="p-3 space-y-2 text-sm">
      <div className="font-medium">Importado do Autentique — complete cliente e vigência para os alertas de renovação</div>
      <div className="grid gap-2 sm:grid-cols-5 items-end">
        <div className="sm:col-span-2"><Label>Cliente</Label><Input value={f.cliente_nome} onChange={(e) => setF({ ...f, cliente_nome: e.target.value })} /></div>
        <div><Label>CPF/CNPJ</Label><Input value={f.cliente_documento} onChange={(e) => setF({ ...f, cliente_documento: e.target.value })} /></div>
        <div><Label>Início vigência</Label><Input type="date" value={f.vigencia_inicio} onChange={(e) => setF({ ...f, vigencia_inicio: e.target.value })} /></div>
        <div><Label>Meses</Label><Input inputMode="numeric" value={f.vigencia_meses} onChange={(e) => setF({ ...f, vigencia_meses: e.target.value.replace(/\D/g, "") })} /></div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2"><Switch checked={f.renovacao} onCheckedChange={(v) => setF({ ...f, renovacao: v })} />Renovação automática</label>
        <Button size="sm" onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
      </div>
    </CardContent></Card>
  );
}
