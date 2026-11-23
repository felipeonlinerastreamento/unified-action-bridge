import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Cake, CalendarDays, ChevronLeft, ChevronRight, Loader2, Paperclip, Plus, Printer, Send, Trash2, UserMinus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CONFIG_RH_PADRAO, TIPOS_AUSENCIA, TIPOS_OCORRENCIA, absenteismo, avisosRh, calendarioMes, diasCorridos, formatarMinutos,
  periodosFerias, proximoAniversario, saldoBancoHoras, situacaoDocumento, somaDias, turnover, type TipoAusencia,
} from "@/lib/rh";
import { rhDesativarAcesso, rhEnviarResumo, rhImportarUsuarios } from "@/lib/rh.functions";
import {
  AusenciaDialog, ColaboradorDialog, DocumentoDialog, FeriasDialog, HorasDialog, OcorrenciaDialog, TIPOS_CONTRATO, imprimirOcorrencia,
} from "./rh-formularios";
import {
  brl, dataBR, hojeSP, rh, useAbrirArquivoRh, useRhDados, useRhRecarregar,
  type AusenciaRh, type ChecklistRh, type ColabRh, type DocumentoRh, type FeriasRh, type OcorrenciaRh,
} from "./use-rh";

type Dados = NonNullable<ReturnType<typeof useRhDados>["data"]>;
type Modal =
  | { t: "colab"; colab?: ColabRh | null } | { t: "ficha"; id: string }
  | { t: "ausencia"; reg?: AusenciaRh | null; colab?: string } | { t: "ferias"; reg?: FeriasRh | null; colab?: string }
  | { t: "horas"; colab?: string } | { t: "doc"; reg?: DocumentoRh | null; colab?: string } | { t: "oc"; reg?: OcorrenciaRh | null; colab?: string } | null;

const SIT_COLAB: Record<string, { texto: string; cls: string }> = {
  ativo: { texto: "Ativo", cls: "border-emerald-500 text-emerald-700" },
  afastado: { texto: "Afastado", cls: "border-amber-500 text-amber-700" },
  desligado: { texto: "Desligado", cls: "text-muted-foreground" },
};
const SIT_FERIAS: Record<string, { texto: string; cls: string }> = {
  em_aquisicao: { texto: "Em aquisição", cls: "text-muted-foreground" }, a_gozar: { texto: "A tirar", cls: "border-sky-500 text-sky-700" },
  vencendo: { texto: "Vencendo", cls: "border-amber-500 text-amber-700" }, vencida: { texto: "Vencida", cls: "bg-red-600 text-white border-transparent" },
  quitada: { texto: "Quitada", cls: "border-emerald-500 text-emerald-700" },
};
const SIT_DOC: Record<string, { texto: string; cls: string }> = {
  vencido: { texto: "Vencido", cls: "bg-red-600 text-white border-transparent" }, vencendo: { texto: "Vencendo", cls: "border-amber-500 text-amber-700" },
  ok: { texto: "Em dia", cls: "border-emerald-500 text-emerald-700" }, sem_validade: { texto: "Sem validade", cls: "text-muted-foreground" },
};
const COR_TIPO = (t: string) => t === "ferias" ? "bg-sky-500" : t === "atestado" ? "bg-violet-500" : t === "falta_injustificada" ? "bg-red-600" : t.startsWith("licenca") || t === "afastamento_inss" ? "bg-amber-500" : "bg-slate-500";
const nomeTipo = (t: string) => (t === "ferias" ? "Férias" : TIPOS_AUSENCIA[t as TipoAusencia]?.label ?? t);

export function RhTela() {
  const q = useRhDados();
  const [tab, setTab] = useState("painel");
  const [modal, setModal] = useState<Modal>(null);
  // Os colaboradores são os usuários do sistema: quem estiver ativo e ainda sem ficha ganha uma automaticamente.
  const sincronizar = useServerFn(rhImportarUsuarios);
  const recarregarRh = useRhRecarregar();
  const sincronizado = useRef(false);
  useEffect(() => {
    const d = q.data;
    if (!d || sincronizado.current) return;
    sincronizado.current = true;
    const comFicha = new Map(d.colabs.filter((c) => c.user_id).map((c) => [c.user_id, c]));
    const precisa = d.perfis.some((p) => (p.is_active && !comFicha.has(p.user_id)) || (comFicha.get(p.user_id) && comFicha.get(p.user_id)!.nome !== p.name));
    if (!precisa) return;
    sincronizar().then((r: any) => { if (r.criados || r.atualizados) recarregarRh(); }).catch(() => { /* segue sem sincronizar */ });
  }, [q.data, sincronizar, recarregarRh]);
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error || !q.data) return <Card className="border-amber-500"><CardContent className="pt-4 text-sm">Não foi possível carregar o RH: {(q.error as Error)?.message}. Confira se a migração 0072 foi aplicada no Lovable.</CardContent></Card>;
  const d = q.data;
  const nome = (id: string) => d.colabs.find((c) => c.id === id)?.nome ?? "—";
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="ausencias">Faltas e ausências{d.ausencias.some((a) => a.situacao === "pendente") && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{d.ausencias.filter((a) => a.situacao === "pendente").length}</Badge>}</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="horas">Banco de horas</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="ocorrencias">Advertências e ocorrências</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="painel" className="mt-4"><Painel d={d} onFicha={(id) => setModal({ t: "ficha", id })} /></TabsContent>
        <TabsContent value="colaboradores" className="mt-4"><Colaboradores d={d} setModal={setModal} /></TabsContent>
        <TabsContent value="ausencias" className="mt-4"><Ausencias d={d} nome={nome} setModal={setModal} /></TabsContent>
        <TabsContent value="calendario" className="mt-4"><Calendario d={d} nome={nome} /></TabsContent>
        <TabsContent value="ferias" className="mt-4"><FeriasAba d={d} nome={nome} setModal={setModal} /></TabsContent>
        <TabsContent value="horas" className="mt-4"><HorasAba d={d} nome={nome} setModal={setModal} /></TabsContent>
        <TabsContent value="documentos" className="mt-4"><DocumentosAba d={d} nome={nome} setModal={setModal} /></TabsContent>
        <TabsContent value="ocorrencias" className="mt-4"><OcorrenciasAba d={d} nome={nome} setModal={setModal} /></TabsContent>
        <TabsContent value="config" className="mt-4"><Configuracoes cfg={d.config} /></TabsContent>
      </Tabs>
      {modal?.t === "colab" && <ColaboradorDialog colab={modal.colab} setores={d.setores} perfis={d.perfis} onFechar={() => setModal(null)} />}
      {modal?.t === "ficha" && <Ficha d={d} id={modal.id} setModal={setModal} onFechar={() => setModal(null)} />}
      {modal?.t === "ausencia" && <AusenciaDialog colabs={d.colabs} ausencia={modal.reg} colaboradorId={modal.colab} onFechar={() => setModal(null)} />}
      {modal?.t === "ferias" && <FeriasDialog colabs={d.colabs} ausencias={d.ausencias} ferias={d.ferias} registro={modal.reg} colaboradorId={modal.colab} onFechar={() => setModal(null)} />}
      {modal?.t === "horas" && <HorasDialog colabs={d.colabs} colaboradorId={modal.colab} onFechar={() => setModal(null)} />}
      {modal?.t === "doc" && <DocumentoDialog colabs={d.colabs} documento={modal.reg} colaboradorId={modal.colab} onFechar={() => setModal(null)} />}
      {modal?.t === "oc" && <OcorrenciaDialog colabs={d.colabs} ocorrencia={modal.reg} colaboradorId={modal.colab} onFechar={() => setModal(null)} />}
    </div>
  );
}

async function excluir(tabela: string, id: string, recarregar: () => void) {
  if (!window.confirm("Excluir este registro?")) return;
  const { error } = await rh.from(tabela).delete().eq("id", id);
  if (error) toast.error(error.message); else { toast.success("Excluído."); recarregar(); }
}

// ----- painel -------------------------------------------------------------------------------

function Painel({ d, onFicha }: { d: Dados; onFicha: (id: string) => void }) {
  const hoje = hojeSP();
  const enviarResumo = useServerFn(rhEnviarResumo);
  const [enviando, setEnviando] = useState(false);
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const de = `${mes}-01`, ate = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const cfg = { ...CONFIG_RH_PADRAO, ...(d.config ?? {}) };
  const abs = useMemo(() => absenteismo(d.colabs, d.ausencias, de, ate), [d, de, ate]);
  const turn = useMemo(() => turnover(d.colabs, somaDias(hoje, -365), hoje), [d, hoje]);
  const avisos = useMemo(() => avisosRh({ colabs: d.colabs, ausencias: d.ausencias, ferias: d.ferias, horas: d.horas, documentos: d.documentos, hoje, config: cfg }), [d, hoje]);
  const ativos = d.colabs.filter((c) => c.situacao !== "desligado");
  const foraHoje = calendarioMes(hoje.slice(0, 7), d.ausencias, d.ferias).get(hoje) ?? [];
  const setorNome = (id?: string | null) => d.setores.find((s) => s.id === id)?.name ?? "Sem setor";
  const porSetor = new Map<string, number>();
  for (const [id, h] of abs.porColaborador) { const s = setorNome(d.colabs.find((c) => c.id === id)?.setor_id); porSetor.set(s, (porSetor.get(s) ?? 0) + h); }
  const top = [...abs.porColaborador.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  const aniversarios = ativos.flatMap((c) => [
    ...(c.data_nascimento ? [{ c, tipo: "Aniversário", ...proximoAniversario(c.data_nascimento, hoje) }] : []),
    ...(c.data_admissao ? [{ c, tipo: "Tempo de casa", ...proximoAniversario(c.data_admissao, hoje) }] : []),
  ]).filter((x) => x.dias <= 30 && (x.tipo === "Aniversário" || x.anos >= 1)).sort((x, y) => x.dias - y.dias);
  const folha = ativos.reduce((s, c) => s + Number(c.salario || 0), 0);
  const horasTot = [...saldoBancoHoras(d.horas).values()].reduce((s, v) => s + v, 0);
  const feriasVencidas = avisos.filter((x) => x.tipo === "ferias_vencida").length;
  const mesesNav = (n: number) => { const x = new Date(Date.UTC(a, m - 1 + n, 1)); setMes(x.toISOString().slice(0, 7)); };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        {[
          { t: "Colaboradores ativos", v: String(ativos.filter((c) => c.situacao === "ativo").length), x: `${ativos.filter((c) => c.situacao === "afastado").length} afastado(s)` },
          { t: "Fora hoje", v: String(foraHoje.length), x: "férias e ausências" },
          { t: `Absenteísmo ${String(m).padStart(2, "0")}/${a}`, v: `${abs.taxa.toLocaleString("pt-BR")}%`, x: `${abs.horasPerdidas.toLocaleString("pt-BR")} h perdidas` },
          { t: "Turnover 12 meses", v: `${turn.taxa.toLocaleString("pt-BR")}%`, x: `${turn.admissoes} admissões · ${turn.desligamentos} desligamentos` },
          { t: "Banco de horas (total)", v: formatarMinutos(horasTot), x: feriasVencidas ? `${feriasVencidas} férias vencida(s)` : "nenhuma férias vencida" },
          { t: "Folha (salários)", v: brl(folha), x: "soma dos ativos" },
        ].map((c) => <Card key={c.t}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{c.t}</div><div className="text-lg font-semibold">{c.v}</div><div className="text-[11px] text-muted-foreground">{c.x}</div></CardContent></Card>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Avisos ({avisos.filter((x) => x.gravidade < 3).length})
            <Button size="sm" variant="outline" className="ml-auto" disabled={enviando} onClick={async () => {
              setEnviando(true);
              try { const r: any = await enviarResumo(); if (!r.avisos) toast.info("Nenhum aviso hoje."); else if (r.enviados.length) toast.success(`Resumo enviado por ${r.enviados.join(" e ")}.`); else toast.error(r.erros?.join(" · ") || "Configure o e-mail ou WhatsApp em Configurações."); }
              catch (e: any) { toast.error(e?.message ?? "Falha ao enviar."); } finally { setEnviando(false); }
            }}>{enviando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Enviar resumo agora</Button></CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-80 overflow-y-auto">
            {avisos.filter((x) => x.gravidade < 3).map((x, i) => (
              <button key={i} className="w-full text-left text-sm flex gap-2 py-1 border-b last:border-0 hover:bg-muted/50 rounded px-1" onClick={() => onFicha(x.colaborador_id)}>
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${x.gravidade === 1 ? "bg-red-600" : "bg-amber-500"}`} />{x.texto}
              </button>
            ))}
            {!avisos.some((x) => x.gravidade < 3) && <p className="text-sm text-muted-foreground">Nenhum aviso.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4" />Fora hoje</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {foraHoje.map((x, i) => <div key={i} className="text-sm flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${COR_TIPO(x.tipo)}`} />{d.colabs.find((c) => c.id === x.colaborador_id)?.nome}<span className="text-muted-foreground">{nomeTipo(x.tipo)}{x.pendente ? " (pendente)" : ""}</span></div>)}
            {!foraHoje.length && <p className="text-sm text-muted-foreground">Equipe completa hoje.</p>}
            <div className="pt-3 text-sm font-medium flex items-center gap-1"><Cake className="h-4 w-4" />Próximos 30 dias</div>
            {aniversarios.map((x, i) => <div key={i} className="text-sm">{dataBR(x.data)} · {x.c.nome} · {x.tipo === "Aniversário" ? "aniversário" : `${x.anos} ano(s) de casa`}</div>)}
            {!aniversarios.length && <p className="text-sm text-muted-foreground">Nenhum.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">Absenteísmo por setor e por colaborador
          <span className="ml-auto flex items-center gap-1 font-normal"><Button size="icon" variant="ghost" onClick={() => mesesNav(-1)}><ChevronLeft className="h-4 w-4" /></Button>{String(m).padStart(2, "0")}/{a}<Button size="icon" variant="ghost" onClick={() => mesesNav(1)}><ChevronRight className="h-4 w-4" /></Button></span></CardTitle>
          <CardDescription>Conta faltas, atestados, atrasos e saídas antecipadas. Férias, folgas, licenças legais e INSS não entram. Dias úteis = segunda a sexta, 8 h por dia.</CardDescription></CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-1">{[...porSetor.entries()].sort((x, y) => y[1] - x[1]).map(([s, h]) => <Barra key={s} rotulo={s} valor={h} max={Math.max(...porSetor.values())} texto={`${h.toLocaleString("pt-BR")} h`} />)}{!porSetor.size && <p className="text-sm text-muted-foreground">Nenhuma ausência no mês.</p>}</div>
          <div className="space-y-1">{top.map(([id, h]) => <Barra key={id} rotulo={d.colabs.find((c) => c.id === id)?.nome ?? "—"} valor={h} max={top[0]?.[1] ?? 1} texto={`${h.toLocaleString("pt-BR")} h`} onClick={() => onFicha(id)} />)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function Barra({ rotulo, valor, max, texto, onClick }: { rotulo: string; valor: number; max: number; texto: string; onClick?: () => void }) {
  return (
    <button className="w-full flex items-center gap-2 text-sm text-left" onClick={onClick} disabled={!onClick}>
      <span className="w-40 truncate">{rotulo}</span>
      <span className="flex-1 h-3 rounded bg-muted overflow-hidden"><span className="block h-full bg-red-500" style={{ width: `${max ? (valor / max) * 100 : 0}%` }} /></span>
      <span className="w-16 text-right tabular-nums">{texto}</span>
    </button>
  );
}

// ----- colaboradores e ficha -----------------------------------------------------------------------

function Colaboradores({ d, setModal }: { d: Dados; setModal: (m: Modal) => void }) {
  const importar = useServerFn(rhImportarUsuarios);
  const recarregar = useRhRecarregar();
  const [busca, setBusca] = useState("");
  const [sit, setSit] = useState("ativos");
  const [importando, setImportando] = useState(false);
  const saldo = saldoBancoHoras(d.horas);
  const setorNome = (id?: string | null) => d.setores.find((s) => s.id === id)?.name ?? "—";
  const q = busca.toLowerCase();
  const lista = d.colabs.filter((c) => (sit === "todos" || (sit === "ativos" ? c.situacao !== "desligado" : c.situacao === sit)) && (!q || c.nome.toLowerCase().includes(q) || (c.cargo ?? "").toLowerCase().includes(q)))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex flex-wrap items-end gap-2">
        <div className="w-60"><Label className="text-xs">Buscar</Label><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou cargo" /></div>
        <div className="w-40"><Label className="text-xs">Situação</Label><Select value={sit} onValueChange={setSit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="ativos">Ativos e afastados</SelectItem><SelectItem value="ativo">Ativos</SelectItem><SelectItem value="afastado">Afastados</SelectItem><SelectItem value="desligado">Desligados</SelectItem><SelectItem value="todos">Todos</SelectItem>
        </SelectContent></Select></div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={importando} onClick={async () => {
            setImportando(true);
            try { const r: any = await importar(); toast.success(r.criados ? `${r.criados} colaborador(es) trazido(s) dos usuários do sistema. Complete as fichas (admissão, cargo, contrato).` : "Todos os usuários ativos já estão no RH."); recarregar(); }
            catch (e: any) { toast.error(e?.message ?? "Falha."); } finally { setImportando(false); }
          }}>{importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}Sincronizar com os usuários</Button>
          <Button size="sm" onClick={() => setModal({ t: "colab" })}><Plus className="h-4 w-4 mr-1" />Novo colaborador</Button>
        </div>
      </div></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Setor</TableHead><TableHead>Contrato</TableHead><TableHead>Admissão</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Banco de horas</TableHead></TableRow></TableHeader>
          <TableBody>
            {lista.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => setModal({ t: "ficha", id: c.id })}>
                <TableCell className="font-medium">{c.nome}
                  {!c.user_id && <Badge variant="outline" className="ml-2 text-[10px]">Sem usuário no sistema</Badge>}
                  {c.user_id && d.perfis.find((p) => p.user_id === c.user_id)?.is_active === false && c.situacao !== "desligado" && <Badge variant="outline" className="ml-2 text-[10px] border-amber-500 text-amber-700">Acesso desativado</Badge>}
                  {!c.data_admissao && <Badge variant="outline" className="ml-2 text-[10px]">Completar ficha</Badge>}</TableCell>
                <TableCell>{c.cargo ?? "—"}</TableCell><TableCell>{setorNome(c.setor_id)}</TableCell><TableCell>{TIPOS_CONTRATO[c.tipo_contrato ?? "clt"]}</TableCell>
                <TableCell>{dataBR(c.data_admissao)}</TableCell>
                <TableCell><Badge variant="outline" className={SIT_COLAB[c.situacao].cls}>{SIT_COLAB[c.situacao].texto}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{formatarMinutos(saldo.get(c.id) ?? 0)}</TableCell>
              </TableRow>
            ))}
            {!lista.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum colaborador. Os usuários ativos do sistema entram aqui sozinhos; quem não usa o sistema entra por "Novo colaborador".</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Ficha({ d, id, setModal, onFechar }: { d: Dados; id: string; setModal: (m: Modal) => void; onFechar: () => void }) {
  const c = d.colabs.find((x) => x.id === id);
  const hoje = hojeSP();
  const abrir = useAbrirArquivoRh();
  const desativar = useServerFn(rhDesativarAcesso);
  const recarregar = useRhRecarregar();
  if (!c) return null;
  const aus = d.ausencias.filter((a) => a.colaborador_id === id).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  const per = periodosFerias(c, d.ausencias, d.ferias, hoje, d.config?.dias_aviso_ferias ?? 60);
  const fer = d.ferias.filter((f) => f.colaborador_id === id);
  const horas = d.horas.filter((h) => h.colaborador_id === id).sort((a, b) => b.data.localeCompare(a.data));
  const docs = d.documentos.filter((x) => x.colaborador_id === id);
  const ocs = d.ocorrencias.filter((x) => x.colaborador_id === id).sort((a, b) => b.data.localeCompare(a.data));
  const abs12 = absenteismo([c], d.ausencias, somaDias(hoje, -365), hoje);
  const perfil = d.perfis.find((p) => p.user_id === c.user_id);
  const abrirNovo = (m: Modal) => { onFechar(); setTimeout(() => setModal(m), 0); };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{c.nome}<Badge variant="outline" className={SIT_COLAB[c.situacao].cls}>{SIT_COLAB[c.situacao].texto}</Badge>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => abrirNovo({ t: "colab", colab: c })}>Editar ficha</Button></DialogTitle>
          <DialogDescription>{c.cargo ?? "Sem cargo"} · {d.setores.find((s) => s.id === c.setor_id)?.name ?? "sem setor"} · {TIPOS_CONTRATO[c.tipo_contrato ?? "clt"]} · admissão {dataBR(c.data_admissao)}{c.data_desligamento ? ` · desligamento ${dataBR(c.data_desligamento)}` : ""} · salário {brl(c.salario)} · absenteísmo 12 meses {abs12.taxa.toLocaleString("pt-BR")}%</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="ausencias">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="ausencias">Ausências ({aus.length})</TabsTrigger><TabsTrigger value="ferias">Férias</TabsTrigger><TabsTrigger value="horas">Banco de horas</TabsTrigger>
            <TabsTrigger value="docs">Documentos ({docs.length})</TabsTrigger><TabsTrigger value="ocs">Ocorrências ({ocs.length})</TabsTrigger><TabsTrigger value="check">Admissão e desligamento</TabsTrigger><TabsTrigger value="dados">Dados</TabsTrigger>
          </TabsList>
          <TabsContent value="ausencias" className="space-y-2">
            <Button size="sm" onClick={() => abrirNovo({ t: "ausencia", colab: id })}><Plus className="h-4 w-4 mr-1" />Registrar</Button>
            <TabelaAusencias lista={aus} nome={() => c.nome} setModal={(m) => abrirNovo(m)} semNome />
          </TabsContent>
          <TabsContent value="ferias" className="space-y-2">
            <Button size="sm" onClick={() => abrirNovo({ t: "ferias", colab: id })}><Plus className="h-4 w-4 mr-1" />Programar férias</Button>
            <Table><TableHeader><TableRow><TableHead>Período aquisitivo</TableHead><TableHead>Tirar até</TableHead><TableHead className="text-right">Faltas</TableHead><TableHead className="text-right">Direito</TableHead><TableHead className="text-right">Usados</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
              <TableBody>{per.map((p) => <TableRow key={p.inicio}><TableCell>{dataBR(p.inicio)} a {dataBR(p.fim)}</TableCell><TableCell>{dataBR(p.concessivoFim)}</TableCell><TableCell className="text-right">{p.faltas}</TableCell><TableCell className="text-right">{p.direito}</TableCell><TableCell className="text-right">{p.usados}</TableCell><TableCell className="text-right font-medium">{p.saldo}</TableCell><TableCell><Badge variant="outline" className={SIT_FERIAS[p.situacao].cls}>{SIT_FERIAS[p.situacao].texto}</Badge></TableCell></TableRow>)}
                {!per.length && <TableRow><TableCell colSpan={7} className="text-muted-foreground">Informe a data de admissão (férias valem para CLT, aprendiz e temporário).</TableCell></TableRow>}</TableBody></Table>
            {fer.map((f) => <div key={f.id} className="text-sm flex items-center gap-2 border-b py-1">{dataBR(f.data_inicio)} a {dataBR(f.data_fim)} ({diasCorridos(f.data_inicio, f.data_fim)} dias{f.abono_dias ? ` + ${f.abono_dias} vendidos` : ""}) · {f.situacao}<Button size="sm" variant="ghost" className="ml-auto" onClick={() => abrirNovo({ t: "ferias", reg: f })}>Editar</Button></div>)}
          </TabsContent>
          <TabsContent value="horas" className="space-y-2">
            <div className="flex items-center gap-2"><Button size="sm" onClick={() => abrirNovo({ t: "horas", colab: id })}><Plus className="h-4 w-4 mr-1" />Lançar</Button><span className="text-sm">Saldo: <b>{formatarMinutos(horas.reduce((s, h) => s + h.minutos, 0))}</b></span></div>
            {horas.map((h) => <div key={h.id} className="text-sm flex gap-2 border-b py-1"><span className="w-24">{dataBR(h.data)}</span><span className={`w-20 tabular-nums ${h.minutos < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatarMinutos(h.minutos)}</span><span className="text-muted-foreground">{h.observacao}</span><Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => excluir("rh_banco_horas", h.id, recarregar)}><Trash2 className="h-3 w-3" /></Button></div>)}
          </TabsContent>
          <TabsContent value="docs" className="space-y-2">
            <Button size="sm" onClick={() => abrirNovo({ t: "doc", colab: id })}><Plus className="h-4 w-4 mr-1" />Novo documento</Button>
            {docs.map((x) => { const s = situacaoDocumento(x, hoje, d.config?.dias_aviso_documento ?? 30); return <div key={x.id} className="text-sm flex flex-wrap items-center gap-2 border-b py-1"><b>{x.tipo}</b>{x.numero && <span>{x.numero}</span>}<span className="text-muted-foreground">validade {dataBR(x.validade)}</span><Badge variant="outline" className={SIT_DOC[s].cls}>{SIT_DOC[s].texto}</Badge>
              <span className="ml-auto flex gap-1">{x.arquivo_path && <Button size="sm" variant="ghost" onClick={() => abrir(x.arquivo_path)}><Paperclip className="h-4 w-4 mr-1" />Abrir</Button>}<Button size="sm" variant="ghost" onClick={() => abrirNovo({ t: "doc", reg: x })}>Editar</Button></span></div>; })}
          </TabsContent>
          <TabsContent value="ocs" className="space-y-2">
            <Button size="sm" onClick={() => abrirNovo({ t: "oc", colab: id })}><Plus className="h-4 w-4 mr-1" />Nova ocorrência</Button>
            {ocs.map((o) => <div key={o.id} className="text-sm border-b py-1"><div className="flex flex-wrap items-center gap-2"><b>{TIPOS_OCORRENCIA[o.tipo]}</b><span>{dataBR(o.data)}</span>{o.ciente_em ? <Badge variant="outline" className="border-emerald-500 text-emerald-700">Ciente em {dataBR(o.ciente_em)}</Badge> : ["advertencia_escrita", "suspensao"].includes(o.tipo) && <Badge variant="outline" className="border-amber-500 text-amber-700">Sem ciência</Badge>}
              <span className="ml-auto flex gap-1">{o.arquivo_path && <Button size="sm" variant="ghost" onClick={() => abrir(o.arquivo_path)}><Paperclip className="h-4 w-4" /></Button>}<Button size="sm" variant="ghost" onClick={() => imprimirOcorrencia(o, c)}><Printer className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => abrirNovo({ t: "oc", reg: o })}>Editar</Button></span></div><div className="text-muted-foreground">{o.motivo}</div></div>)}
          </TabsContent>
          <TabsContent value="check" className="space-y-3">
            <Checklist colab={c} tipo="admissao" registro={d.checklists.find((x) => x.colaborador_id === id && x.tipo === "admissao")} padrao={d.config?.itens_admissao ?? []} />
            <Checklist colab={c} tipo="desligamento" registro={d.checklists.find((x) => x.colaborador_id === id && x.tipo === "desligamento")} padrao={d.config?.itens_desligamento ?? []} />
            {c.user_id && (
              <div className="rounded-md border p-3 text-sm flex flex-wrap items-center gap-2"><UserMinus className="h-4 w-4" />Acesso ao sistema: <b>{perfil ? (perfil.is_active ? "ativo" : "desativado") : "—"}</b>
                {perfil?.is_active && <Button size="sm" variant="destructive" className="ml-auto" onClick={async () => {
                  if (!window.confirm(`Desativar o acesso de ${c.nome} ao sistema? Ele(a) não consegue mais entrar.`)) return;
                  try { await desativar({ data: { colaboradorId: id } }); toast.success("Acesso desativado."); recarregar(); } catch (e: any) { toast.error(e?.message ?? "Falha."); }
                }}>Desativar acesso</Button>}</div>
            )}
          </TabsContent>
          <TabsContent value="dados" className="text-sm grid gap-1 sm:grid-cols-2">
            {[["CPF", c.cpf], ["Nascimento", dataBR(c.data_nascimento)], ["Telefone", c.telefone], ["E-mail", c.email], ["Endereço", c.endereco], ["Contato de emergência", c.contato_emergencia], ["Jornada", c.jornada], ["Gestor", d.perfis.find((p) => p.user_id === c.gestor_user_id)?.name], ["Usuário do sistema", perfil?.name], ["Motivo do desligamento", c.motivo_desligamento], ["Observação", c.observacao]]
              .map(([k, v]) => <div key={k as string}><span className="text-muted-foreground">{k}:</span> {v || "—"}</div>)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Checklist({ colab, tipo, registro, padrao }: { colab: ColabRh; tipo: "admissao" | "desligamento"; registro?: ChecklistRh; padrao: string[] }) {
  const recarregar = useRhRecarregar();
  const titulo = tipo === "admissao" ? "Checklist de admissão" : "Checklist de desligamento";
  const iniciar = async () => {
    const { error } = await rh.from("rh_checklists").insert({ colaborador_id: colab.id, tipo, itens: padrao.map((t) => ({ texto: t, feito: false })) });
    if (error) toast.error(error.message); else recarregar();
  };
  const marcar = async (i: number, v: boolean) => {
    if (!registro) return;
    const itens = registro.itens.map((x, j) => j === i ? { ...x, feito: v, feito_em: v ? new Date().toISOString() : null } : x);
    const concluido = itens.every((x) => x.feito);
    const { error } = await rh.from("rh_checklists").update({ itens, concluido_em: concluido ? new Date().toISOString() : null }).eq("id", registro.id);
    if (error) toast.error(error.message); else recarregar();
  };
  if (!registro) return <div className="rounded-md border p-3 text-sm flex items-center gap-2">{titulo}<Button size="sm" variant="outline" className="ml-auto" onClick={iniciar}>Iniciar</Button></div>;
  const feitos = registro.itens.filter((x) => x.feito).length;
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="text-sm font-medium flex items-center gap-2">{titulo}<Badge variant="outline" className={registro.concluido_em ? "border-emerald-500 text-emerald-700" : ""}>{feitos}/{registro.itens.length}</Badge></div>
      {registro.itens.map((x, i) => <label key={i} className="flex items-center gap-2 text-sm"><Checkbox checked={x.feito} onCheckedChange={(v) => marcar(i, !!v)} /><span className={x.feito ? "line-through text-muted-foreground" : ""}>{x.texto}</span></label>)}
    </div>
  );
}

// ----- ausências ---------------------------------------------------------------------------------

function TabelaAusencias({ lista, nome, setModal, semNome }: { lista: AusenciaRh[]; nome: (id: string) => string; setModal: (m: Modal) => void; semNome?: boolean }) {
  const recarregar = useRhRecarregar();
  const abrir = useAbrirArquivoRh();
  const decidir = async (a: AusenciaRh, situacao: string) => {
    const { error } = await rh.from("rh_ausencias").update({ situacao }).eq("id", a.id);
    if (error) toast.error(error.message); else recarregar();
  };
  return (
    <Table>
      <TableHeader><TableRow>{!semNome && <TableHead>Colaborador</TableHead>}<TableHead>Tipo</TableHead><TableHead>Período</TableHead><TableHead>Situação</TableHead><TableHead>Obs.</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {lista.map((a) => {
          const porMin = TIPOS_AUSENCIA[a.tipo]?.porMinutos;
          return (
            <TableRow key={a.id}>
              {!semNome && <TableCell className="font-medium">{nome(a.colaborador_id)}</TableCell>}
              <TableCell><span className={`inline-block h-2 w-2 rounded-full mr-1 ${COR_TIPO(a.tipo)}`} />{TIPOS_AUSENCIA[a.tipo]?.label}{a.desconta && <Badge variant="outline" className="ml-1 text-[10px]">desconta</Badge>}</TableCell>
              <TableCell>{porMin ? `${dataBR(a.data_inicio)} · ${a.minutos ?? 0} min` : a.data_inicio === a.data_fim ? dataBR(a.data_inicio) : `${dataBR(a.data_inicio)} a ${dataBR(a.data_fim)} (${diasCorridos(a.data_inicio, a.data_fim)} d)`}</TableCell>
              <TableCell>{a.situacao === "pendente" ? <span className="flex gap-1"><Button size="sm" variant="outline" onClick={() => decidir(a, "aprovada")}>Aprovar</Button><Button size="sm" variant="ghost" onClick={() => decidir(a, "recusada")}>Recusar</Button></span>
                : <Badge variant="outline" className={a.situacao === "recusada" ? "text-muted-foreground line-through" : ""}>{a.situacao === "aprovada" ? "Aprovada" : "Recusada"}</Badge>}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-56 truncate">{a.observacao}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {a.arquivo_path && <Button size="sm" variant="ghost" onClick={() => abrir(a.arquivo_path)}><Paperclip className="h-4 w-4" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => setModal({ t: "ausencia", reg: a })}>Editar</Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluir("rh_ausencias", a.id, recarregar)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </TableCell>
            </TableRow>
          );
        })}
        {!lista.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nenhuma ausência.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function Ausencias({ d, nome, setModal }: { d: Dados; nome: (id: string) => string; setModal: (m: Modal) => void }) {
  const hoje = hojeSP();
  const [de, setDe] = useState(somaDias(hoje, -90));
  const [ate, setAte] = useState(somaDias(hoje, 30));
  const [tipo, setTipo] = useState("todos");
  const [sit, setSit] = useState("todas");
  const lista = d.ausencias.filter((a) => a.data_fim >= de && a.data_inicio <= ate && (tipo === "todos" || a.tipo === tipo) && (sit === "todas" || a.situacao === sit))
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <div className="w-48"><Label className="text-xs">Tipo</Label><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{Object.entries(TIPOS_AUSENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-36"><Label className="text-xs">Situação</Label><Select value={sit} onValueChange={setSit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="aprovada">Aprovadas</SelectItem><SelectItem value="recusada">Recusadas</SelectItem></SelectContent></Select></div>
        <Button size="sm" className="ml-auto" onClick={() => setModal({ t: "ausencia" })}><Plus className="h-4 w-4 mr-1" />Registrar falta / ausência</Button>
      </div></CardHeader>
      <CardContent className="overflow-x-auto"><TabelaAusencias lista={lista} nome={nome} setModal={setModal} /></CardContent>
    </Card>
  );
}

// ----- calendário -----------------------------------------------------------------------------------

function Calendario({ d, nome }: { d: Dados; nome: (id: string) => string }) {
  const hoje = hojeSP();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [setor, setSetor] = useState("todos");
  const [a, m] = mes.split("-").map(Number);
  const cal = calendarioMes(mes, d.ausencias, d.ferias);
  const ids = new Set(d.colabs.filter((c) => setor === "todos" || c.setor_id === setor).map((c) => c.id));
  const primeiroDia = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celulas: (string | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: nDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const ir = (n: number) => setMes(new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7));
  const ativosSetor = d.colabs.filter((c) => c.situacao !== "desligado" && ids.has(c.id)).length;
  return (
    <Card>
      <CardHeader className="pb-2"><div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => ir(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <CardTitle className="text-base">{new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}</CardTitle>
        <Button size="icon" variant="ghost" onClick={() => ir(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="w-48 ml-auto"><Select value={setor} onValueChange={setSetor}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os setores</SelectItem>{d.setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
        <CardDescription className="flex flex-wrap gap-3">{[["ferias", "Férias"], ["atestado", "Atestado"], ["falta_injustificada", "Falta"], ["licenca_maternidade", "Licenças/INSS"], ["folga", "Outros"]].map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className={`h-2 w-3 rounded-sm ${COR_TIPO(k)}`} />{v}</span>)}<span>Tracejado = pendente/planejado</span></CardDescription></CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((x) => <div key={x} className="text-center font-medium text-muted-foreground">{x}</div>)}
          {celulas.map((dia, i) => {
            if (!dia) return <div key={i} />;
            const itens = (cal.get(dia) ?? []).filter((x) => ids.has(x.colaborador_id));
            const cobertura = ativosSetor ? itens.length / ativosSetor : 0;
            return (
              <div key={dia} className={`min-h-24 rounded border p-1 ${dia === hoje ? "border-primary" : ""} ${cobertura >= 0.3 ? "bg-red-50" : ""}`}>
                <div className="font-medium">{Number(dia.slice(8))}</div>
                {itens.slice(0, 5).map((x, j) => <div key={j} className={`truncate rounded px-1 mb-0.5 text-white ${COR_TIPO(x.tipo)} ${x.pendente ? "opacity-60 border border-dashed border-white" : ""}`} title={`${nome(x.colaborador_id)} — ${nomeTipo(x.tipo)}`}>{nome(x.colaborador_id).split(" ")[0]}</div>)}
                {itens.length > 5 && <div className="text-muted-foreground">+{itens.length - 5}</div>}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Dias em vermelho claro: 30% ou mais da equipe (do filtro) fora.</p>
      </CardContent>
    </Card>
  );
}

// ----- férias, banco de horas, documentos, ocorrências -------------------------------------------------

function FeriasAba({ d, nome, setModal }: { d: Dados; nome: (id: string) => string; setModal: (m: Modal) => void }) {
  const hoje = hojeSP();
  const linhas = d.colabs.filter((c) => c.situacao !== "desligado").flatMap((c) => periodosFerias(c, d.ausencias, d.ferias, hoje, d.config?.dias_aviso_ferias ?? 60)
    .filter((p) => p.situacao !== "quitada" && p.situacao !== "em_aquisicao").map((p) => ({ c, p })))
    .sort((a, b) => a.p.concessivoFim.localeCompare(b.p.concessivoFim));
  const prox = d.ferias.filter((f) => f.situacao !== "cancelada" && f.data_fim >= hoje).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Saldos a tirar</CardTitle><CardDescription>Períodos aquisitivos completos com saldo, pela ordem do prazo. Faltas injustificadas reduzem o direito (CLT, art. 130).</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Período</TableHead><TableHead>Tirar até</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
          <TableBody>{linhas.map(({ c, p }) => <TableRow key={c.id + p.inicio} className="cursor-pointer" onClick={() => setModal({ t: "ferias", colab: c.id })}><TableCell className="font-medium">{c.nome}</TableCell><TableCell className="text-xs">{dataBR(p.inicio)} a {dataBR(p.fim)}</TableCell><TableCell>{dataBR(p.concessivoFim)}</TableCell><TableCell className="text-right">{p.saldo} d</TableCell><TableCell><Badge variant="outline" className={SIT_FERIAS[p.situacao].cls}>{SIT_FERIAS[p.situacao].texto}</Badge></TableCell></TableRow>)}
            {!linhas.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nenhum saldo pendente (ou faltam datas de admissão nas fichas).</TableCell></TableRow>}</TableBody></Table></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center">Escala de férias<Button size="sm" className="ml-auto" onClick={() => setModal({ t: "ferias" })}><Plus className="h-4 w-4 mr-1" />Programar</Button></CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {prox.map((f) => <div key={f.id} className="text-sm flex flex-wrap items-center gap-2 border-b py-1"><b>{nome(f.colaborador_id)}</b>{dataBR(f.data_inicio)} a {dataBR(f.data_fim)}<span className="text-muted-foreground">({diasCorridos(f.data_inicio, f.data_fim)} dias{f.abono_dias ? ` + ${f.abono_dias} vendidos` : ""})</span><Badge variant="outline">{f.situacao}</Badge><Button size="sm" variant="ghost" className="ml-auto" onClick={() => setModal({ t: "ferias", reg: f })}>Editar</Button></div>)}
          {!prox.length && <p className="text-sm text-muted-foreground">Nenhuma férias programada.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function HorasAba({ d, nome, setModal }: { d: Dados; nome: (id: string) => string; setModal: (m: Modal) => void }) {
  const saldo = saldoBancoHoras(d.horas);
  const lim = d.config?.banco_horas_alerta_min ?? 2400;
  const linhas = [...saldo.entries()].filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const recentes = [...d.horas].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 50);
  const recarregar = useRhRecarregar();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center">Saldos<Button size="sm" className="ml-auto" onClick={() => setModal({ t: "horas" })}><Plus className="h-4 w-4 mr-1" />Lançar</Button></CardTitle>
        <CardDescription>Controle interno. O ponto oficial continua no sistema de ponto da empresa.</CardDescription></CardHeader>
        <CardContent className="space-y-1">{linhas.map(([id, v]) => <div key={id} className="text-sm flex gap-2 border-b py-1"><span className="flex-1">{nome(id)}</span><span className={`tabular-nums ${v < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatarMinutos(v)}</span>{Math.abs(v) >= lim && <Badge variant="outline" className="border-amber-500 text-amber-700">acima do limite</Badge>}</div>)}
          {!linhas.length && <p className="text-sm text-muted-foreground">Nenhum saldo.</p>}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Últimos lançamentos</CardTitle></CardHeader>
        <CardContent className="space-y-1">{recentes.map((h) => <div key={h.id} className="text-sm flex gap-2 border-b py-1"><span className="w-20">{dataBR(h.data)}</span><span className="flex-1 truncate">{nome(h.colaborador_id)}</span><span className={`tabular-nums ${h.minutos < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatarMinutos(h.minutos)}</span><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => excluir("rh_banco_horas", h.id, recarregar)}><Trash2 className="h-3 w-3" /></Button></div>)}</CardContent></Card>
    </div>
  );
}

function DocumentosAba({ d, nome, setModal }: { d: Dados; nome: (id: string) => string; setModal: (m: Modal) => void }) {
  const hoje = hojeSP();
  const abrir = useAbrirArquivoRh();
  const [sit, setSit] = useState("atencao");
  const ativos = new Set(d.colabs.filter((c) => c.situacao !== "desligado").map((c) => c.id));
  const lista = d.documentos.map((x) => ({ x, s: situacaoDocumento(x, hoje, d.config?.dias_aviso_documento ?? 30) }))
    .filter(({ x, s }) => ativos.has(x.colaborador_id) && (sit === "todos" || (sit === "atencao" ? s === "vencido" || s === "vencendo" : s === sit)))
    .sort((a, b) => (a.x.validade ?? "9999").localeCompare(b.x.validade ?? "9999"));
  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex flex-wrap items-end gap-2">
        <div className="w-48"><Label className="text-xs">Mostrar</Label><Select value={sit} onValueChange={setSit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="atencao">Vencidos e vencendo</SelectItem><SelectItem value="todos">Todos</SelectItem><SelectItem value="ok">Em dia</SelectItem><SelectItem value="sem_validade">Sem validade</SelectItem></SelectContent></Select></div>
        <Button size="sm" className="ml-auto" onClick={() => setModal({ t: "doc" })}><Plus className="h-4 w-4 mr-1" />Novo documento</Button>
      </div></CardHeader>
      <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Documento</TableHead><TableHead>Número</TableHead><TableHead>Validade</TableHead><TableHead>Situação</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{lista.map(({ x, s }) => <TableRow key={x.id}><TableCell className="font-medium">{nome(x.colaborador_id)}</TableCell><TableCell>{x.tipo}</TableCell><TableCell>{x.numero ?? "—"}</TableCell><TableCell>{dataBR(x.validade)}</TableCell><TableCell><Badge variant="outline" className={SIT_DOC[s].cls}>{SIT_DOC[s].texto}</Badge></TableCell>
          <TableCell className="text-right whitespace-nowrap">{x.arquivo_path && <Button size="sm" variant="ghost" onClick={() => abrir(x.arquivo_path)}><Paperclip className="h-4 w-4" /></Button>}<Button size="sm" variant="ghost" onClick={() => setModal({ t: "doc", reg: x })}>Editar</Button></TableCell></TableRow>)}
          {!lista.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nenhum documento.</TableCell></TableRow>}</TableBody></Table></CardContent>
    </Card>
  );
}

function OcorrenciasAba({ d, nome, setModal }: { d: Dados; nome: (id: string) => string; setModal: (m: Modal) => void }) {
  const abrir = useAbrirArquivoRh();
  const lista = [...d.ocorrencias].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <Card>
      <CardHeader className="pb-3"><div className="flex items-center"><CardTitle className="text-base">Advertências, suspensões e ocorrências</CardTitle><Button size="sm" className="ml-auto" onClick={() => setModal({ t: "oc" })}><Plus className="h-4 w-4 mr-1" />Nova</Button></div>
        <CardDescription>Gere o documento, colha a assinatura do colaborador e de testemunhas e anexe o arquivo assinado.</CardDescription></CardHeader>
      <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Colaborador</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead><TableHead>Ciência</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{lista.map((o) => <TableRow key={o.id}><TableCell>{dataBR(o.data)}</TableCell><TableCell className="font-medium">{nome(o.colaborador_id)}</TableCell><TableCell>{TIPOS_OCORRENCIA[o.tipo]}{o.tipo === "suspensao" ? ` (${o.dias_suspensao} d)` : ""}</TableCell><TableCell className="max-w-72 truncate">{o.motivo}</TableCell><TableCell>{o.ciente_em ? dataBR(o.ciente_em) : "—"}</TableCell>
          <TableCell className="text-right whitespace-nowrap">{o.arquivo_path && <Button size="sm" variant="ghost" onClick={() => abrir(o.arquivo_path)}><Paperclip className="h-4 w-4" /></Button>}<Button size="sm" variant="ghost" onClick={() => imprimirOcorrencia(o, d.colabs.find((c) => c.id === o.colaborador_id))}><Printer className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => setModal({ t: "oc", reg: o })}>Editar</Button></TableCell></TableRow>)}
          {!lista.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nenhum registro.</TableCell></TableRow>}</TableBody></Table></CardContent>
    </Card>
  );
}

// ----- configurações -------------------------------------------------------------------------------------

function Configuracoes({ cfg }: { cfg: any }) {
  const recarregar = useRhRecarregar();
  const [f, setF] = useState<any>(() => ({
    avisos_ativos: !!cfg?.avisos_ativos, aviso_email: cfg?.aviso_email ?? "", aviso_whatsapp: cfg?.aviso_whatsapp ?? "",
    dias_aviso_documento: cfg?.dias_aviso_documento ?? 30, dias_aviso_ferias: cfg?.dias_aviso_ferias ?? 60,
    faltas_alerta_qtd: cfg?.faltas_alerta_qtd ?? 3, faltas_alerta_dias: cfg?.faltas_alerta_dias ?? 90, banco_horas_alerta_h: Math.round((cfg?.banco_horas_alerta_min ?? 2400) / 60),
    itens_admissao: (cfg?.itens_admissao ?? []).join("\n"), itens_desligamento: (cfg?.itens_desligamento ?? []).join("\n"),
  }));
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const salvar = async () => {
    setBusy(true);
    const linhas = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    const { error } = await rh.from("rh_config").upsert({
      id: 1, avisos_ativos: f.avisos_ativos, aviso_email: f.aviso_email.trim() || null, aviso_whatsapp: f.aviso_whatsapp.trim() || null,
      dias_aviso_documento: Number(f.dias_aviso_documento) || 30, dias_aviso_ferias: Number(f.dias_aviso_ferias) || 60,
      faltas_alerta_qtd: Number(f.faltas_alerta_qtd) || 3, faltas_alerta_dias: Number(f.faltas_alerta_dias) || 90, banco_horas_alerta_min: (Number(f.banco_horas_alerta_h) || 40) * 60,
      itens_admissao: linhas(f.itens_admissao), itens_desligamento: linhas(f.itens_desligamento), updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Configurações salvas."); recarregar(); }
  };
  const num = (k: string, label: string) => <div><Label className="text-xs">{label}</Label><Input type="number" value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>;
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Avisos e checklists</CardTitle>
        <CardDescription>O resumo diário sai às 08:40 com férias vencendo/vencidas, documentos, excesso de faltas, banco de horas e ausências pendentes. Envia pelo WhatsApp e pela caixa de e-mail da Central (Configurações › CRM).</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.avisos_ativos} onCheckedChange={(v) => set("avisos_ativos", v)} />Enviar o resumo diário automaticamente</label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label className="text-xs">E-mail que recebe</Label><Input value={f.aviso_email} onChange={(e) => set("aviso_email", e.target.value)} /></div>
          <div><Label className="text-xs">WhatsApp que recebe (com DDD)</Label><Input value={f.aviso_whatsapp} onChange={(e) => set("aviso_whatsapp", e.target.value)} /></div>
          {num("dias_aviso_documento", "Avisar documento (dias antes)")}
          {num("dias_aviso_ferias", "Avisar férias (dias antes do prazo)")}
          {num("faltas_alerta_qtd", "Alerta: faltas injustificadas a partir de")}
          {num("faltas_alerta_dias", "… nos últimos (dias)")}
          {num("banco_horas_alerta_h", "Alerta de banco de horas acima de (h)")}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div><Label className="text-xs">Itens do checklist de admissão (um por linha)</Label><Textarea rows={9} value={f.itens_admissao} onChange={(e) => set("itens_admissao", e.target.value)} /></div>
          <div><Label className="text-xs">Itens do checklist de desligamento (um por linha)</Label><Textarea rows={9} value={f.itens_desligamento} onChange={(e) => set("itens_desligamento", e.target.value)} /></div>
        </div>
        <Button onClick={salvar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
      </CardContent>
    </Card>
  );
}
