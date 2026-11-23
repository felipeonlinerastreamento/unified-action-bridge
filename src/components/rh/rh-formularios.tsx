import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TIPOS_AUSENCIA, TIPOS_OCORRENCIA, periodosFerias, textoOcorrencia, diasCorridos, type TipoAusencia } from "@/lib/rh";
import { dataBR, hojeSP, rh, useEnviarArquivoRh, useRhRecarregar, type ColabRh, type AusenciaRh, type FeriasRh, type DocumentoRh, type OcorrenciaRh } from "./use-rh";

const NONE = "__none__";
export const TIPOS_CONTRATO: Record<string, string> = { clt: "CLT", pj: "PJ", estagio: "Estágio", temporario: "Temporário", aprendiz: "Aprendiz", outro: "Outro" };
export const TIPOS_DOCUMENTO_RH = ["CNH", "ASO", "NR-10", "NR-35", "Contrato de trabalho", "RG", "CPF", "CTPS", "Certificado de treinamento", "Outro"];

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs">{label}</Label>{children}</div>;
}

export function ColabSelect({ colabs, value, onChange, incluirDesligados = false }: { colabs: ColabRh[]; value: string; onChange: (v: string) => void; incluirDesligados?: boolean }) {
  // Mesmos usuários do sistema (cada usuário ativo tem a sua ficha), mais quem foi cadastrado só no RH.
  const lista = colabs.filter((c) => incluirDesligados || c.situacao !== "desligado").sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger>
      <SelectContent>{lista.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}{c.user_id ? "" : " (sem usuário)"}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Rodape({ busy, onSalvar, onFechar }: { busy: boolean; onSalvar: () => void; onFechar: () => void }) {
  return <DialogFooter><Button variant="outline" onClick={onFechar}>Cancelar</Button><Button onClick={onSalvar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button></DialogFooter>;
}

async function gravar(tabela: string, id: string | undefined, payload: any) {
  const r = id ? await rh.from(tabela).update(payload).eq("id", id) : await rh.from(tabela).insert(payload);
  if (r.error) throw r.error;
}

// ----- colaborador ------------------------------------------------------------------------

export function ColaboradorDialog({ colab, setores, perfis, onFechar }: { colab?: ColabRh | null; setores: { id: string; name: string }[]; perfis: { user_id: string; name: string }[]; onFechar: () => void }) {
  const recarregar = useRhRecarregar();
  const [f, setF] = useState<any>(() => colab ? { ...colab, salario: colab.salario != null ? String(colab.salario).replace(".", ",") : "" } : { situacao: "ativo", tipo_contrato: "clt", data_admissao: hojeSP() });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const salvar = async () => {
    if (!String(f.nome ?? "").trim()) { toast.error("Informe o nome."); return; }
    setBusy(true);
    try {
      const n = (v: any) => (v === "" || v === undefined ? null : v);
      await gravar("rh_colaboradores", colab?.id, {
        nome: f.nome.trim(), cpf: n(f.cpf), cargo: n(f.cargo), setor_id: n(f.setor_id), gestor_user_id: n(f.gestor_user_id), user_id: n(f.user_id),
        tipo_contrato: f.tipo_contrato, data_admissao: n(f.data_admissao), data_desligamento: n(f.data_desligamento), motivo_desligamento: n(f.motivo_desligamento),
        situacao: f.data_desligamento && f.situacao !== "desligado" ? "desligado" : f.situacao,
        salario: f.salario ? Number(String(f.salario).replace(/\./g, "").replace(",", ".")) : null, jornada: n(f.jornada), data_nascimento: n(f.data_nascimento),
        telefone: n(f.telefone), email: n(f.email), endereco: n(f.endereco), contato_emergencia: n(f.contato_emergencia), observacao: n(f.observacao), updated_at: new Date().toISOString(),
      });
      toast.success(colab ? "Ficha atualizada." : "Colaborador cadastrado.");
      recarregar(); onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{colab ? "Editar ficha" : "Novo colaborador"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <Campo label="Nome completo" className="sm:col-span-2"><Input value={f.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></Campo>
          <Campo label="CPF"><Input value={f.cpf ?? ""} onChange={(e) => set("cpf", e.target.value)} /></Campo>
          <Campo label="Cargo"><Input value={f.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} /></Campo>
          <Campo label="Setor"><Select value={f.setor_id || NONE} onValueChange={(v) => set("setor_id", v === NONE ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>—</SelectItem>{setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Campo>
          <Campo label="Gestor"><Select value={f.gestor_user_id || NONE} onValueChange={(v) => set("gestor_user_id", v === NONE ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>—</SelectItem>{perfis.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}</SelectContent></Select></Campo>
          <Campo label="Tipo de contrato"><Select value={f.tipo_contrato} onValueChange={(v) => set("tipo_contrato", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIPOS_CONTRATO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Campo>
          <Campo label="Admissão"><Input type="date" value={f.data_admissao ?? ""} onChange={(e) => set("data_admissao", e.target.value)} /></Campo>
          <Campo label="Situação"><Select value={f.situacao} onValueChange={(v) => set("situacao", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="afastado">Afastado</SelectItem><SelectItem value="desligado">Desligado</SelectItem></SelectContent></Select></Campo>
          <Campo label="Salário (R$)"><Input value={f.salario ?? ""} onChange={(e) => set("salario", e.target.value)} /></Campo>
          <Campo label="Jornada"><Input value={f.jornada ?? ""} onChange={(e) => set("jornada", e.target.value)} placeholder="44h semanais, seg–sex" /></Campo>
          <Campo label="Nascimento"><Input type="date" value={f.data_nascimento ?? ""} onChange={(e) => set("data_nascimento", e.target.value)} /></Campo>
          <Campo label="Telefone"><Input value={f.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></Campo>
          <Campo label="E-mail"><Input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Campo>
          <Campo label="Usuário do sistema"><Select value={f.user_id || NONE} onValueChange={(v) => set("user_id", v === NONE ? null : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NONE}>Sem acesso ao sistema</SelectItem>{perfis.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}</SelectContent></Select></Campo>
          <Campo label="Endereço" className="sm:col-span-2"><Input value={f.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></Campo>
          <Campo label="Contato de emergência"><Input value={f.contato_emergencia ?? ""} onChange={(e) => set("contato_emergencia", e.target.value)} /></Campo>
          {(f.situacao === "desligado" || f.data_desligamento) && <>
            <Campo label="Desligamento"><Input type="date" value={f.data_desligamento ?? ""} onChange={(e) => set("data_desligamento", e.target.value)} /></Campo>
            <Campo label="Motivo do desligamento" className="sm:col-span-2"><Input value={f.motivo_desligamento ?? ""} onChange={(e) => set("motivo_desligamento", e.target.value)} placeholder="Pedido de demissão, sem justa causa, fim de contrato..." /></Campo>
          </>}
          <Campo label="Observação" className="sm:col-span-3"><Textarea rows={2} value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></Campo>
        </div>
        <Rodape busy={busy} onSalvar={salvar} onFechar={onFechar} />
      </DialogContent>
    </Dialog>
  );
}

// ----- ausência ----------------------------------------------------------------------------

export function AusenciaDialog({ colabs, ausencia, colaboradorId, onFechar }: { colabs: ColabRh[]; ausencia?: AusenciaRh | null; colaboradorId?: string; onFechar: () => void }) {
  const recarregar = useRhRecarregar();
  const enviarArquivo = useEnviarArquivoRh();
  const [f, setF] = useState<any>(() => ausencia ? { ...ausencia } : { colaborador_id: colaboradorId ?? "", tipo: "falta_injustificada", data_inicio: hojeSP(), data_fim: hojeSP(), situacao: "aprovada", desconta: false });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const porMin = TIPOS_AUSENCIA[f.tipo as TipoAusencia]?.porMinutos;
  const salvar = async () => {
    if (!f.colaborador_id) { toast.error("Escolha o colaborador."); return; }
    if (f.data_fim < f.data_inicio) { toast.error("A data final é antes da inicial."); return; }
    setBusy(true);
    try {
      let arq: any = {};
      if (arquivo) { const r = await enviarArquivo("ausencias", f.colaborador_id, arquivo); arq = { arquivo_path: r.path, arquivo_nome: r.nome }; }
      await gravar("rh_ausencias", ausencia?.id, {
        colaborador_id: f.colaborador_id, tipo: f.tipo, data_inicio: f.data_inicio, data_fim: porMin ? f.data_inicio : f.data_fim,
        minutos: porMin ? Number(f.minutos) || 0 : null, situacao: f.situacao, desconta: !!f.desconta, observacao: f.observacao || null, ...arq,
      });
      toast.success("Ausência salva."); recarregar(); onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{ausencia ? "Editar ausência" : "Registrar falta / ausência"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Campo label="Colaborador" className="sm:col-span-2"><ColabSelect colabs={colabs} value={f.colaborador_id} onChange={(v) => set("colaborador_id", v)} /></Campo>
          <Campo label="Tipo"><Select value={f.tipo} onValueChange={(v) => set("tipo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIPOS_AUSENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></Campo>
          <Campo label="Situação"><Select value={f.situacao} onValueChange={(v) => set("situacao", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aprovada">Aprovada</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="recusada">Recusada</SelectItem></SelectContent></Select></Campo>
          <Campo label={porMin ? "Data" : "De"}><Input type="date" value={f.data_inicio} onChange={(e) => setF((p: any) => ({ ...p, data_inicio: e.target.value, data_fim: p.data_fim < e.target.value ? e.target.value : p.data_fim }))} /></Campo>
          {porMin ? <Campo label="Minutos"><Input type="number" value={f.minutos ?? ""} onChange={(e) => set("minutos", e.target.value)} /></Campo>
            : <Campo label="Até"><Input type="date" value={f.data_fim} onChange={(e) => set("data_fim", e.target.value)} /></Campo>}
          {!porMin && f.data_inicio && f.data_fim >= f.data_inicio && <p className="sm:col-span-2 text-xs text-muted-foreground">{diasCorridos(f.data_inicio, f.data_fim)} dia(s) corrido(s).</p>}
          <label className="flex items-center gap-2 sm:col-span-2"><Checkbox checked={!!f.desconta} onCheckedChange={(v) => set("desconta", !!v)} />Descontar do salário</label>
          <Campo label={f.tipo === "atestado" ? "Atestado (PDF ou foto)" : "Comprovante (opcional)"} className="sm:col-span-2">
            {ausencia?.arquivo_nome && !arquivo && <p className="text-xs text-muted-foreground">Atual: {ausencia.arquivo_nome}</p>}
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </Campo>
          <Campo label="Observação" className="sm:col-span-2"><Textarea rows={2} value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></Campo>
        </div>
        {f.tipo === "atestado" && <p className="text-xs text-muted-foreground">O atestado é dado de saúde: fica guardado com acesso só dos administradores. Não registre o CID na observação.</p>}
        <Rodape busy={busy} onSalvar={salvar} onFechar={onFechar} />
      </DialogContent>
    </Dialog>
  );
}

// ----- férias ---------------------------------------------------------------------------------

export function FeriasDialog({ colabs, ausencias, ferias, registro, colaboradorId, onFechar }: { colabs: ColabRh[]; ausencias: AusenciaRh[]; ferias: FeriasRh[]; registro?: FeriasRh | null; colaboradorId?: string; onFechar: () => void }) {
  const recarregar = useRhRecarregar();
  const [f, setF] = useState<any>(() => registro ? { ...registro } : { colaborador_id: colaboradorId ?? "", aquisitivo_inicio: "", data_inicio: "", data_fim: "", abono_dias: 0, situacao: "planejada" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const c = colabs.find((x) => x.id === f.colaborador_id);
  const periodos = c ? periodosFerias(c, ausencias, ferias.filter((x) => x.id !== registro?.id), hojeSP()) : [];
  const dias = f.data_inicio && f.data_fim >= f.data_inicio ? diasCorridos(f.data_inicio, f.data_fim) : 0;
  const per = periodos.find((p) => p.inicio === f.aquisitivo_inicio);
  const salvar = async () => {
    if (!f.colaborador_id || !f.aquisitivo_inicio || !f.data_inicio || !f.data_fim) { toast.error("Preencha colaborador, período aquisitivo e datas."); return; }
    if (f.data_fim < f.data_inicio) { toast.error("A data final é antes da inicial."); return; }
    setBusy(true);
    try {
      await gravar("rh_ferias", registro?.id, { colaborador_id: f.colaborador_id, aquisitivo_inicio: f.aquisitivo_inicio, data_inicio: f.data_inicio, data_fim: f.data_fim, abono_dias: Number(f.abono_dias) || 0, situacao: f.situacao, observacao: f.observacao || null });
      toast.success("Férias salvas."); recarregar(); onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{registro ? "Editar férias" : "Programar férias"}</DialogTitle>
          <DialogDescription>As férias podem ser divididas em até 3 períodos (um com pelo menos 14 dias e os outros com pelo menos 5) e até 10 dias podem ser vendidos (abono). Confira com a contabilidade.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Campo label="Colaborador" className="sm:col-span-2"><ColabSelect colabs={colabs} value={f.colaborador_id} onChange={(v) => setF((p: any) => ({ ...p, colaborador_id: v, aquisitivo_inicio: "" }))} /></Campo>
          <Campo label="Período aquisitivo" className="sm:col-span-2">
            <Select value={f.aquisitivo_inicio || NONE} onValueChange={(v) => set("aquisitivo_inicio", v === NONE ? "" : v)}><SelectTrigger><SelectValue placeholder={c?.data_admissao ? "Escolha" : "Informe a admissão na ficha"} /></SelectTrigger>
              <SelectContent>{periodos.map((p) => <SelectItem key={p.inicio} value={p.inicio}>{dataBR(p.inicio)} a {dataBR(p.fim)} · saldo {p.saldo} de {p.direito} dia(s){p.situacao === "vencida" ? " · VENCIDA" : ""}</SelectItem>)}</SelectContent></Select>
          </Campo>
          <Campo label="Início"><Input type="date" value={f.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} /></Campo>
          <Campo label="Fim"><Input type="date" value={f.data_fim} onChange={(e) => set("data_fim", e.target.value)} /></Campo>
          <Campo label="Dias vendidos (abono)"><Input type="number" min={0} max={10} value={f.abono_dias} onChange={(e) => set("abono_dias", e.target.value)} /></Campo>
          <Campo label="Situação"><Select value={f.situacao} onValueChange={(v) => set("situacao", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planejada">Planejada</SelectItem><SelectItem value="aprovada">Aprovada</SelectItem><SelectItem value="concluida">Concluída</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select></Campo>
          <p className="sm:col-span-2 text-xs text-muted-foreground">{dias} dia(s) de gozo{Number(f.abono_dias) ? ` + ${f.abono_dias} vendido(s)` : ""}{per ? ` · saldo do período antes desta programação: ${per.saldo} dia(s)` : ""}.{per && dias + Number(f.abono_dias || 0) > per.saldo ? " Atenção: passa do saldo." : ""}</p>
          <Campo label="Observação" className="sm:col-span-2"><Textarea rows={2} value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></Campo>
        </div>
        <Rodape busy={busy} onSalvar={salvar} onFechar={onFechar} />
      </DialogContent>
    </Dialog>
  );
}

// ----- banco de horas ---------------------------------------------------------------------------

export function HorasDialog({ colabs, colaboradorId, onFechar }: { colabs: ColabRh[]; colaboradorId?: string; onFechar: () => void }) {
  const recarregar = useRhRecarregar();
  const [f, setF] = useState<any>({ colaborador_id: colaboradorId ?? "", data: hojeSP(), tipo: "extra", horas: "", observacao: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const salvar = async () => {
    const m = String(f.horas).match(/^(\d+)(?:[:h,.](\d{1,2}))?$/);
    if (!f.colaborador_id || !m) { toast.error("Informe o colaborador e as horas (ex.: 2:30)."); return; }
    const min = Number(m[1]) * 60 + Number(m[2] ?? 0);
    const sinal = f.tipo === "extra" || (f.tipo === "ajuste" && !f.negativo) ? 1 : -1;
    setBusy(true);
    try {
      await gravar("rh_banco_horas", undefined, { colaborador_id: f.colaborador_id, data: f.data, minutos: sinal * min, tipo: f.tipo, observacao: f.observacao || null });
      toast.success("Lançado no banco de horas."); recarregar(); onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Lançar no banco de horas</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Campo label="Colaborador" className="sm:col-span-2"><ColabSelect colabs={colabs} value={f.colaborador_id} onChange={(v) => set("colaborador_id", v)} /></Campo>
          <Campo label="Tipo"><Select value={f.tipo} onValueChange={(v) => set("tipo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="extra">Hora extra (crédito)</SelectItem><SelectItem value="compensacao">Compensação (débito)</SelectItem><SelectItem value="pagamento">Pago na folha (débito)</SelectItem><SelectItem value="ajuste">Ajuste</SelectItem>
          </SelectContent></Select></Campo>
          <Campo label="Data"><Input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></Campo>
          <Campo label="Horas (ex.: 2:30)"><Input value={f.horas} onChange={(e) => set("horas", e.target.value)} /></Campo>
          {f.tipo === "ajuste" && <label className="flex items-center gap-2 pt-5"><Checkbox checked={!!f.negativo} onCheckedChange={(v) => set("negativo", !!v)} />Ajuste negativo</label>}
          <Campo label="Observação" className="sm:col-span-2"><Input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} /></Campo>
        </div>
        <Rodape busy={busy} onSalvar={salvar} onFechar={onFechar} />
      </DialogContent>
    </Dialog>
  );
}

// ----- documento -----------------------------------------------------------------------------------

export function DocumentoDialog({ colabs, documento, colaboradorId, onFechar }: { colabs: ColabRh[]; documento?: DocumentoRh | null; colaboradorId?: string; onFechar: () => void }) {
  const recarregar = useRhRecarregar();
  const enviarArquivo = useEnviarArquivoRh();
  const [f, setF] = useState<any>(() => documento ? { ...documento } : { colaborador_id: colaboradorId ?? "", tipo: "CNH" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const salvar = async () => {
    if (!f.colaborador_id || !f.tipo) { toast.error("Informe o colaborador e o tipo."); return; }
    setBusy(true);
    try {
      let arq: any = {};
      if (arquivo) { const r = await enviarArquivo("documentos", f.colaborador_id, arquivo); arq = { arquivo_path: r.path, arquivo_nome: r.nome }; }
      await gravar("rh_documentos", documento?.id, { colaborador_id: f.colaborador_id, tipo: f.tipo, numero: f.numero || null, emissao: f.emissao || null, validade: f.validade || null, observacao: f.observacao || null, ...arq });
      toast.success("Documento salvo."); recarregar(); onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{documento ? "Editar documento" : "Novo documento"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Campo label="Colaborador" className="sm:col-span-2"><ColabSelect colabs={colabs} value={f.colaborador_id} onChange={(v) => set("colaborador_id", v)} /></Campo>
          <Campo label="Tipo"><Input list="rh-tipos-doc" value={f.tipo} onChange={(e) => set("tipo", e.target.value)} /><datalist id="rh-tipos-doc">{TIPOS_DOCUMENTO_RH.map((t) => <option key={t} value={t} />)}</datalist></Campo>
          <Campo label="Número"><Input value={f.numero ?? ""} onChange={(e) => set("numero", e.target.value)} /></Campo>
          <Campo label="Emissão"><Input type="date" value={f.emissao ?? ""} onChange={(e) => set("emissao", e.target.value)} /></Campo>
          <Campo label="Validade"><Input type="date" value={f.validade ?? ""} onChange={(e) => set("validade", e.target.value)} /></Campo>
          <Campo label="Arquivo" className="sm:col-span-2">{documento?.arquivo_nome && !arquivo && <p className="text-xs text-muted-foreground">Atual: {documento.arquivo_nome}</p>}<Input type="file" accept=".pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
          <Campo label="Observação" className="sm:col-span-2"><Input value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></Campo>
        </div>
        <Rodape busy={busy} onSalvar={salvar} onFechar={onFechar} />
      </DialogContent>
    </Dialog>
  );
}

// ----- ocorrência / advertência ---------------------------------------------------------------------

export function imprimirOcorrencia(o: OcorrenciaRh, c: ColabRh | undefined, empresa = "Online Rastreamento Ltda") {
  const t = textoOcorrencia({ empresa, colaborador: c?.nome ?? "", cargo: c?.cargo, tipo: o.tipo, data: o.data, motivo: o.motivo, descricao: o.descricao, diasSuspensao: o.dias_suspensao });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank");
  if (!w) { toast.error("O navegador bloqueou a janela de impressão."); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(t.titulo)} — ${esc(c?.nome ?? "")}</title>
    <style>body{font-family:Georgia,serif;font-size:12pt;line-height:1.6;max-width:16cm;margin:2.5cm auto;color:#111}h1{text-align:center;font-size:14pt;margin-bottom:2em}p{text-align:justify;margin:0 0 1.2em}.ass{display:flex;justify-content:space-between;margin-top:5em;gap:2cm}.ass div{flex:1;text-align:center;border-top:1px solid #111;padding-top:.3em;font-size:11pt}</style></head><body>
    <h1>${esc(t.titulo)}</h1>${t.paragrafos.map((p) => `<p>${esc(p)}</p>`).join("")}<p>${esc(empresa)}, ${esc(dataBR(o.data))}.</p>
    <div class="ass"><div>${esc(empresa)}</div><div>Ciente: ${esc(c?.nome ?? "")}<br/>Data: ____/____/______</div></div>
    <div class="ass"><div>Testemunha 1</div><div>Testemunha 2</div></div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export function OcorrenciaDialog({ colabs, ocorrencia, colaboradorId, onFechar }: { colabs: ColabRh[]; ocorrencia?: OcorrenciaRh | null; colaboradorId?: string; onFechar: () => void }) {
  const recarregar = useRhRecarregar();
  const enviarArquivo = useEnviarArquivoRh();
  const [f, setF] = useState<any>(() => ocorrencia ? { ...ocorrencia } : { colaborador_id: colaboradorId ?? "", tipo: "advertencia_escrita", data: hojeSP(), motivo: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const salvar = async () => {
    if (!f.colaborador_id || !String(f.motivo).trim()) { toast.error("Informe o colaborador e o motivo."); return; }
    setBusy(true);
    try {
      let arq: any = {};
      if (arquivo) { const r = await enviarArquivo("ocorrencias", f.colaborador_id, arquivo); arq = { arquivo_path: r.path, arquivo_nome: r.nome }; }
      await gravar("rh_ocorrencias", ocorrencia?.id, { colaborador_id: f.colaborador_id, tipo: f.tipo, data: f.data, motivo: f.motivo.trim(), descricao: f.descricao || null, dias_suspensao: f.tipo === "suspensao" ? Number(f.dias_suspensao) || 1 : null, ciente_em: f.ciente_em || null, ...arq });
      if (!ocorrencia && f.tipo === "suspensao") {
        const fim = new Date(Date.parse(`${f.data}T00:00:00Z`) + ((Number(f.dias_suspensao) || 1) - 1) * 86_400_000).toISOString().slice(0, 10);
        await rh.from("rh_ausencias").insert({ colaborador_id: f.colaborador_id, tipo: "suspensao", data_inicio: f.data, data_fim: fim, situacao: "aprovada", desconta: true, observacao: `Suspensão: ${f.motivo}` });
      }
      toast.success("Registro salvo."); recarregar(); onFechar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setBusy(false); }
  };
  const disciplinar = ["advertencia_verbal", "advertencia_escrita", "suspensao"].includes(f.tipo);
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{ocorrencia ? "Editar ocorrência" : "Nova advertência / ocorrência"}</DialogTitle>
          {disciplinar && <DialogDescription>Confira com a contabilidade ou o jurídico antes de aplicar. A suspensão já entra como ausência (com desconto) no período.</DialogDescription>}</DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Campo label="Colaborador" className="sm:col-span-2"><ColabSelect colabs={colabs} value={f.colaborador_id} onChange={(v) => set("colaborador_id", v)} /></Campo>
          <Campo label="Tipo"><Select value={f.tipo} onValueChange={(v) => set("tipo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TIPOS_OCORRENCIA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Campo>
          <Campo label="Data"><Input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></Campo>
          {f.tipo === "suspensao" && <Campo label="Dias de suspensão"><Input type="number" min={1} max={30} value={f.dias_suspensao ?? 1} onChange={(e) => set("dias_suspensao", e.target.value)} /></Campo>}
          <Campo label="Ciente em"><Input type="date" value={f.ciente_em ?? ""} onChange={(e) => set("ciente_em", e.target.value)} /></Campo>
          <Campo label="Motivo" className="sm:col-span-2"><Input value={f.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="Ex.: atrasos repetidos sem justificativa" /></Campo>
          <Campo label="Descrição" className="sm:col-span-2"><Textarea rows={3} value={f.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} /></Campo>
          <Campo label="Documento assinado (opcional)" className="sm:col-span-2">{ocorrencia?.arquivo_nome && !arquivo && <p className="text-xs text-muted-foreground">Atual: {ocorrencia.arquivo_nome}</p>}<Input type="file" accept=".pdf,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
        </div>
        <DialogFooter className="gap-2">
          {disciplinar && <Button variant="outline" onClick={() => imprimirOcorrencia({ ...f, id: ocorrencia?.id ?? "" }, colabs.find((c) => c.id === f.colaborador_id))}><Printer className="h-4 w-4 mr-1" />Gerar documento</Button>}
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
