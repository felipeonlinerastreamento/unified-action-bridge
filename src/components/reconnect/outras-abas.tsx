import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Search, Send, Trash2, Upload, Link2, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { canaisReconnect, enviarNotificacaoReconnect } from "@/lib/reconnect.functions";
import { buildNotificationMessage, extrairPlaca, getCriticality, normalizeClientKey, sessaoAtual, todaySP, type Criticidade, type VehicleRow } from "@/lib/reconnect";
import { destinosCliente, motivoSemEnvioCliente, logRc, rc, upsertEmBlocos, useRcInvalidate, type RcClient, type RcImportTemplate, type RcRecovered, type RcTemplate } from "./use-rc";
import { Crit } from "./painel-tab";
import { UnificacaoEmpresas } from "./unificacao-empresas";
import { HistoricoNotificacoes } from "./historico-notificacoes";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const lista = (s: string) => s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
type AlvoPlaca = { plate: string; dias: number; anotacao: string };
type Alvo = { c: RcClient; placas: AlvoPlaca[] };
const chaveP = (clientId: string, plate: string) => `${clientId}|${plate}`;

export function NotificacoesTab({ clients, vehicles, templates }: { clients: RcClient[]; vehicles: VehicleRow[]; templates: RcTemplate[] }) {
  const enviar = useServerFn(enviarNotificacaoReconnect);
  const invalidate = useRcInvalidate();
  const hoje = todaySP();
  const sessao = useMemo(() => sessaoAtual(vehicles), [vehicles]);
  const dataSessao = sessao[0]?.import_date ?? "";
  const [crits, setCrits] = useState<Criticidade[]>(["red", "orange"]);
  const [tplId, setTplId] = useState("");
  const [canais, setCanais] = useState<("whatsapp" | "email")[]>(["whatsapp", "email"]);
  const [pularAnotacao, setPularAnotacao] = useState(true);
  const [sel, setSel] = useState<string[]>([]);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  // Na confirmação: clientes e placas tirados do envio.
  const [foraClientes, setForaClientes] = useState<Set<string>>(new Set());
  const [foraPlacas, setForaPlacas] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<{ nome: string; ok: boolean; detalhe: string }[] | null>(null);
  const { data: historico = [] } = useQuery({
    queryKey: ["rc-notifications"],
    queryFn: async () => ((await rc.from("rc_notification_logs").select("*").order("sent_at", { ascending: false }).limit(5000)).data || []) as any[],
  });
  // Placas da última importação nas faixas escolhidas, sem repetir a mesma placa no cliente.
  const todos = useMemo<Alvo[]>(() => {
    const m = new Map<string, Map<string, AlvoPlaca>>();
    for (const v of sessao) {
      if (!crits.includes(getCriticality(v.days_offline))) continue;
      const pl = extrairPlaca(v.plate) || v.plate;
      const mm = m.get(v.client_id) ?? new Map<string, AlvoPlaca>();
      const ant = mm.get(pl);
      const anot = String(v.observation ?? "").trim();
      mm.set(pl, { plate: pl, dias: Math.max(ant?.dias ?? 0, Number(v.days_offline) || 0), anotacao: ant?.anotacao || anot });
      m.set(v.client_id, mm);
    }
    return clients.filter((c) => m.has(c.id)).map((c) => ({ c, placas: [...m.get(c.id)!.values()].sort((x, y) => y.dias - x.dias) }));
  }, [sessao, clients, crits]);
  const placasComAnotacao = todos.reduce((s, a) => s + a.placas.filter((p) => p.anotacao).length, 0);
  const alvo = useMemo<Alvo[]>(
    () => (pularAnotacao ? todos.map((a) => ({ ...a, placas: a.placas.filter((p) => !p.anotacao) })).filter((a) => a.placas.length) : todos),
    [todos, pularAnotacao],
  );
  const usaveis = templates.filter((t) => !t.is_closing_template);
  const selecionados = alvo.filter((a) => sel.includes(a.c.id));
  const podeReceber = (c: RcClient) => !motivoSemEnvioCliente(c, canais);
  const motivo = !alvo.length ? null
    : !sel.length ? "Marque ao menos um cliente."
    : !tplId ? (usaveis.length ? "Escolha o modelo de mensagem." : "Cadastre um modelo de mensagem na aba Mensagens.")
    : !canais.length ? "Marque WhatsApp e/ou E-mail."
    : null;
  const tplSel = usaveis.find((t) => t.id === tplId);

  // O que realmente vai sair depois das escolhas na confirmação.
  const finais = selecionados
    .filter((a) => !foraClientes.has(a.c.id) && podeReceber(a.c))
    .map((a) => ({ ...a, placas: a.placas.filter((p) => !foraPlacas.has(chaveP(a.c.id, p.plate))) }))
    .filter((a) => a.placas.length);
  const semDestino = selecionados.filter((a) => !podeReceber(a.c));

  const abrirConfirmacao = () => { setResultados(null); setForaClientes(new Set()); setForaPlacas(new Set()); setConfirmar(true); };
  const alternar = (set: Set<string>, k: string, setter: (s: Set<string>) => void) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); setter(n); };

  // Só envia depois da confirmação no diálogo; o resultado de cada cliente (inclusive o erro) fica na tela.
  const enviarLote = async () => {
    const batchId = crypto.randomUUID();
    const itens = finais;
    const res: { nome: string; ok: boolean; detalhe: string }[] = [];
    setResultados([]);
    if (semDestino.length) {
      await rc.from("rc_notification_logs").insert(semDestino.map(({ c, placas }) => ({
        client_id: c.id, client_name: c.name, sent_by: "Envio em massa", plates: placas.map((p) => p.plate), channels: [],
        template_name: tplSel?.name ?? "", status: "error", error_message: motivoSemEnvioCliente(c, canais), batch_id: batchId,
      })));
      for (const { c } of semDestino) res.push({ nome: c.name, ok: false, detalhe: `${motivoSemEnvioCliente(c, canais)} — registrado no histórico.` });
    }
    for (let i = 0; i < itens.length; i++) {
      setProgresso(`Enviando ${i + 1}/${itens.length}: ${itens[i].c.name}`);
      const dest = destinosCliente(itens[i].c);
      const ch = canais.filter((x) => (x === "whatsapp" ? dest.phones.length : dest.emails.length));
      try {
        const r: any = await enviar({ data: { clientId: itens[i].c.id, plates: itens[i].placas.map((p) => p.plate), templateId: tplId, channels: ch, batchId } });
        const partes = [
          r.whatsapp && (r.whatsapp.ok ? `WhatsApp: ${r.whatsapp.enviados} enviado(s)${r.whatsapp.erro ? ` (falhas: ${r.whatsapp.erro})` : ""}` : `WhatsApp falhou: ${r.whatsapp.erro}`),
          r.email && (r.email.ok ? `E-mail: ${r.email.enviados} destinatário(s)` : `E-mail falhou: ${r.email.erro}`),
        ].filter(Boolean);
        res.push({ nome: itens[i].c.name, ok: !!r.channels?.length, detalhe: partes.join(" · ") || "Nada enviado." });
      } catch (e: any) {
        res.push({ nome: itens[i].c.name, ok: false, detalhe: e?.message ?? "Falha ao enviar." });
      }
      setResultados([...res]);
    }
    setProgresso(null);
    const ok = res.filter((x) => x.ok).length;
    (ok === res.length ? toast.success : toast.error)(`Envio concluído: ${ok} de ${res.length} cliente(s) notificado(s).`);
    const enviados = new Set(itens.filter((it) => res.some((r) => r.ok && r.nome === it.c.name)).map((it) => it.c.id));
    if (enviados.size) setSel((x) => x.filter((id) => !enviados.has(id)));
    invalidate();
  };

  const totalPlacasFinais = finais.reduce((s, a) => s + a.placas.length, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Envio em massa</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            {(["green", "yellow", "orange", "red"] as Criticidade[]).map((c) => (
              <label key={c} className="flex items-center gap-1"><Checkbox checked={crits.includes(c)} onCheckedChange={(v) => setCrits((x) => (v ? [...x, c] : x.filter((y) => y !== c)))} />{({ green: "1-10", yellow: "11-20", orange: "21-30", red: "31+" } as any)[c]} dias</label>
            ))}
            <Select value={tplId} onValueChange={setTplId}>
              <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Modelo de mensagem" /></SelectTrigger>
              <SelectContent>{usaveis.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-1"><Checkbox checked={canais.includes("whatsapp")} onCheckedChange={(v) => setCanais((x) => (v ? [...x, "whatsapp"] : x.filter((y) => y !== "whatsapp")))} />WhatsApp</label>
            <label className="flex items-center gap-1"><Checkbox checked={canais.includes("email")} onCheckedChange={(v) => setCanais((x) => (v ? [...x, "email"] : x.filter((y) => y !== "email")))} />E-mail</label>
            <label className="flex items-center gap-1" title="Placas com texto na coluna Anotação do Painel"><Checkbox checked={pularAnotacao} onCheckedChange={(v) => setPularAnotacao(v === true)} />Não enviar placas com anotação{placasComAnotacao ? ` (${placasComAnotacao})` : ""}</label>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!alvo.length} onClick={() => setSel(selecionados.length === alvo.length ? [] : alvo.map((a) => a.c.id))}>{selecionados.length === alvo.length && alvo.length ? "Desmarcar todos" : "Marcar todos"}</Button>
            <span className="text-xs text-muted-foreground">{selecionados.length} de {alvo.length} cliente(s){dataSessao && ` · importação de ${dataSessao === hoje ? "hoje" : dataSessao.split("-").reverse().join("/")}`}</span>
            {motivo && !progresso && <span className="text-xs text-amber-600">{motivo}</span>}
            <Button size="sm" className="ml-auto" disabled={!!motivo || !selecionados.length || !!progresso} onClick={abrirConfirmacao}>
              {progresso ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}{progresso ?? "Enviar"}
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded border divide-y">
            {alvo.map(({ c, placas }) => {
              const d = destinosCliente(c);
              const m = motivoSemEnvioCliente(c, canais);
              return (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <Checkbox checked={sel.includes(c.id)} onCheckedChange={(v) => setSel((x) => (v ? [...x, c.id] : x.filter((y) => y !== c.id)))} />
                  <span className="font-medium flex-1">{c.empresa_nome || c.name}{c.empresa_nome && c.empresa_nome !== c.name && <span className="font-normal text-muted-foreground"> (planilha: {c.name})</span>}</span>
                  {m ? <span className="text-amber-600">{m}</span> : <span className="text-muted-foreground">{placas.length} placa(s) · {d.phones.length} tel · {d.emails.length} e-mail</span>}
                </label>
              );
            })}
            {alvo.length === 0 && <p className="p-3 text-xs text-muted-foreground">{sessao.length ? "Nenhum cliente com placas nessas faixas na última importação." : "Nenhuma planilha importada ainda — importe no Painel."}</p>}
          </div>
        </CardContent>
      </Card>
      <Dialog open={confirmar} onOpenChange={(o) => { if (!progresso) setConfirmar(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{resultados ? "Resultado do envio" : `Confirmar envio: ${finais.length} cliente(s), ${totalPlacasFinais} placa(s)`}</DialogTitle></DialogHeader>
          {!resultados ? (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Modelo <b>{tplSel?.name}</b> · canais: {canais.map((c) => (c === "whatsapp" ? "WhatsApp" : "E-mail")).join(" e ")}.
                Desmarque o cliente ou a placa que não deve receber.
                {semDestino.length > 0 && ` ${semDestino.length} cliente(s) sem contato marcado "Veículo sem comunicação" (ou sem empresa ligada) não recebem e ficam registrados no histórico como não enviados.`}
              </p>
              <div className="max-h-80 overflow-y-auto rounded border divide-y">
                {selecionados.filter((a) => podeReceber(a.c)).map(({ c, placas }) => {
                  const d = destinosCliente(c);
                  const para = [...(canais.includes("whatsapp") ? d.phones : []), ...(canais.includes("email") ? d.emails : [])];
                  const fora = foraClientes.has(c.id);
                  return (
                    <div key={c.id} className={`px-2 py-1.5 text-xs ${fora ? "opacity-50" : ""}`}>
                      <label className="flex items-center gap-2 font-medium">
                        <Checkbox checked={!fora} onCheckedChange={() => alternar(foraClientes, c.id, setForaClientes)} />
                        {c.empresa_nome || c.name}
                      </label>
                      <div className="text-muted-foreground break-all pl-6">Para: {para.join(", ")}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-6 pt-1">
                        {placas.map((p) => (
                          <label key={p.plate} className="flex items-center gap-1" title={p.anotacao || undefined}>
                            <Checkbox disabled={fora} checked={!foraPlacas.has(chaveP(c.id, p.plate))} onCheckedChange={() => alternar(foraPlacas, chaveP(c.id, p.plate), setForaPlacas)} />
                            <span className="font-mono">{p.plate}</span><span className="text-muted-foreground">{p.dias}d{p.anotacao ? " · anotação" : ""}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {tplSel && finais[0] && (
                <div>
                  <Label className="text-xs">Prévia ({finais[0].c.empresa_nome || finais[0].c.name})</Label>
                  <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs max-h-40 overflow-y-auto">{buildNotificationMessage(tplSel.body, finais[0].c.name, finais[0].placas.map((p) => p.plate))}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border divide-y text-xs">
              {resultados.map((r, i) => (
                <div key={i} className="flex gap-2 px-2 py-1.5">
                  {r.ok ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <div><div className="font-medium">{r.nome}</div><div className="text-muted-foreground break-all">{r.detalhe}</div></div>
                </div>
              ))}
              {progresso && <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{progresso}</div>}
            </div>
          )}
          <DialogFooter>
            {!resultados ? (
              <>
                <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
                <Button onClick={enviarLote} disabled={!finais.length && !semDestino.length}><Send className="h-4 w-4 mr-1" />Confirmar envio</Button>
              </>
            ) : (
              <Button onClick={() => setConfirmar(false)} disabled={!!progresso}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <HistoricoNotificacoes historico={historico} />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function RecuperadosTab({ recovered }: { recovered: RcRecovered[] }) {
  const porSemana = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recovered) {
      const d = new Date(r.recovered_at);
      const seg = new Date(d); seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = seg.toISOString().slice(0, 10);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [recovered]);
  const max = Math.max(1, ...porSemana.map(([, n]) => n));
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recuperados por semana</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {porSemana.map(([k, n]) => (
            <div key={k}><div className="flex justify-between"><span>Semana de {k.split("-").reverse().join("/")}</span><b>{n}</b></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-emerald-500" style={{ width: `${(n / max) * 100}%` }} /></div></div>
          ))}
          {!porSemana.length && <p className="text-muted-foreground">Nenhum veículo recuperado ainda.</p>}
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Recuperado em</TableHead><TableHead>Placa</TableHead><TableHead>Cliente</TableHead><TableHead>Estava sem comunicação</TableHead></TableRow></TableHeader>
          <TableBody>
            {recovered.slice(0, 500).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{fmt(r.recovered_at)}</TableCell>
                <TableCell className="font-mono">{r.plate}</TableCell>
                <TableCell className="text-xs">{r.client_name}</TableCell>
                <TableCell><Crit dias={r.last_days_offline} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function MensagensTab({ templates }: { templates: RcTemplate[] }) {
  const { user } = useAuth();
  const invalidate = useRcInvalidate();
  const [edit, setEdit] = useState<Partial<RcTemplate> | null>(null);
  const salvar = async () => {
    if (!edit?.name?.trim() || !edit.body?.trim()) { toast.error("Preencha nome e texto."); return; }
    if (edit.is_closing_template) await rc.from("rc_message_templates").update({ is_closing_template: false }).eq("is_closing_template", true);
    const payload = { name: edit.name.trim(), subject: edit.subject ?? "", body: edit.body, is_closing_template: !!edit.is_closing_template, updated_at: new Date().toISOString() };
    const res = edit.id ? await rc.from("rc_message_templates").update(payload).eq("id", edit.id) : await rc.from("rc_message_templates").insert({ ...payload, created_by: user?.id ?? null });
    if (res.error) toast.error(res.error.message); else { setEdit(null); invalidate(); }
  };
  const excluir = async (t: RcTemplate) => {
    if (!confirm(`Excluir o modelo "${t.name}"?`)) return;
    const { error } = await rc.from("rc_message_templates").delete().eq("id", t.id);
    if (error) toast.error(error.message); else invalidate();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0"><CardTitle className="text-sm">Modelos de mensagem</CardTitle>
          <Button size="sm" onClick={() => setEdit({ name: "", subject: "", body: "Olá {cliente}, identificamos veículos sem comunicação com a central." })}><Plus className="h-4 w-4 mr-1" />Novo</Button></CardHeader>
        <CardContent className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border p-2 text-sm cursor-pointer hover:bg-muted/50" onClick={() => setEdit(t)}>
              <span>{t.name}{t.is_closing_template && <Badge variant="secondary" className="ml-2 text-[10px]">Encerramento</Badge>}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); excluir(t); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {!templates.length && <p className="text-sm text-muted-foreground">Nenhum modelo. Eles também chegam ao importar o histórico do sistema antigo.</p>}
        </CardContent>
      </Card>
      {edit && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{edit.id ? "Editar modelo" : "Novo modelo"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><Label>Nome</Label><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><Label>Assunto do e-mail</Label><Input value={edit.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>
            <div><Label>Texto</Label><Textarea rows={8} value={edit.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
              <p className="text-[11px] text-muted-foreground mt-1">Use {"{cliente}"} para o nome. A lista de placas entra sozinha no fim.</p></div>
            <label className="flex items-center gap-2"><Switch checked={!!edit.is_closing_template} onCheckedChange={(v) => setEdit({ ...edit, is_closing_template: v })} />Mensagem de encerramento (enviada no WhatsApp depois da notificação)</label>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const TABELAS_BACKUP: Record<string, string> = {
  clients: "rc_clients", vehicles: "rc_vehicles", recovered_vehicles: "rc_recovered_vehicles", vehicle_annotations: "rc_vehicle_annotations",
  notification_logs: "rc_notification_logs", bulk_send_logs: "rc_bulk_send_logs", import_history: "rc_import_history", skipped_rows: "rc_skipped_rows",
  import_templates: "rc_import_templates", message_templates: "rc_message_templates", activity_logs: "rc_activity_logs",
};
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const COLS: Record<string, string[]> = {
  rc_vehicles: ["id", "plate", "last_communication", "days_offline", "client_name", "client_id", "observation", "incidences", "notifications", "battery_voltage", "imported_at", "was_recovered", "recovery_count", "status", "import_date", "created_at"],
  rc_recovered_vehicles: ["id", "plate", "client_name", "client_id", "last_days_offline", "recovered_at", "created_at"],
  rc_vehicle_annotations: ["id", "plate", "client_id", "client_name", "observation", "created_by_email", "created_at"],
  rc_notification_logs: ["id", "client_id", "client_name", "sent_by", "sent_at", "plates", "channels", "template_name", "created_at"],
  rc_bulk_send_logs: ["id", "client_name", "client_id", "plates", "channels", "template_name", "status", "error_message", "sent_by", "batch_id", "created_at"],
  rc_import_history: ["id", "imported_at", "imported_by", "total_rows", "new_vehicles", "updated_vehicles", "skipped_count", "recovered_count", "warning_count", "skipped_details", "warning_details"],
  rc_skipped_rows: ["id", "row_number", "raw_plate", "raw_client", "reason", "imported_at", "created_at"],
  rc_import_templates: ["id", "name", "mapping", "created_at", "updated_at"],
  rc_message_templates: ["id", "name", "subject", "body", "is_closing_template", "created_at", "updated_at"],
};

export function ConfigTab({ importTemplates }: { importTemplates: RcImportTemplate[] }) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const invalidate = useRcInvalidate();
  const canaisFn = useServerFn(canaisReconnect);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState<string | null>(null);
  const [novoModelo, setNovoModelo] = useState({ name: "", plate: "Placa", client: "Cliente", lastCommunication: "Tempo desatualizado", batteryVoltage: "" });
  const { data: settings } = useQuery({ queryKey: ["rc-settings"], queryFn: async () => (await rc.from("rc_settings").select("*").eq("id", 1).maybeSingle()).data });
  const { data: canais } = useQuery({ queryKey: ["rc-canais"], queryFn: () => canaisFn() });
  const { data: historico = [] } = useQuery({
    queryKey: ["rc-history"],
    queryFn: async () => ((await rc.from("rc_import_history").select("*").order("imported_at", { ascending: false }).limit(200)).data || []) as any[],
  });

  const salvarCanal = async (campo: "whatsapp_channel_id" | "email_channel_id", v: string) => {
    const { error } = await rc.from("rc_settings").update({ [campo]: v === "auto" ? null : v, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Canal salvo."); invalidate(); }
  };
  const criarModelo = async () => {
    if (!novoModelo.name.trim()) return;
    const { name, ...mapping } = novoModelo;
    const { error } = await rc.from("rc_import_templates").insert({ name: name.trim(), mapping });
    if (error) toast.error(error.message); else { setNovoModelo({ ...novoModelo, name: "" }); invalidate(); }
  };
  const excluirModelo = async (id: string) => { await rc.from("rc_import_templates").delete().eq("id", id); invalidate(); };

  /** Importa o arquivo "Exportar backup completo" do sistema antigo. Mantém os ids: pode rodar de novo sem duplicar. */
  const importarBackup = async (file?: File) => {
    if (!file) return;
    try {
      setImportando("Lendo arquivo...");
      const json = JSON.parse(await file.text());
      if (json?.source !== "reconnect-hub" || !json?.data) throw new Error("Este não é o arquivo de backup do Reconnect Hub.");
      const d = json.data as Record<string, any[]>;
      const counts: Record<string, number> = {};
      // Clientes: ligados ao cliente do Gestão Online pelo nome.
      const { data: comps } = await rc.from("companies").select("id, name").limit(5000);
      const compByKey = new Map((comps || []).map((c: any) => [normalizeClientKey(c.name), c.id]));
      const vistos = new Set<string>();
      const clientes = (d.clients || []).filter((c) => { const k = normalizeClientKey(c.name); if (vistos.has(k)) return false; vistos.add(k); return true; }).map((c) => ({
        id: c.id, name: c.name, name_key: normalizeClientKey(c.name), emails: c.emails ?? [], phones: c.phones ?? [], vehicle_count: c.vehicle_count ?? 0,
        company_id: compByKey.get(normalizeClientKey(c.name)) ?? null, created_at: c.created_at,
      }));
      setImportando(`Clientes (${clientes.length})...`);
      await upsertEmBlocos("rc_clients", clientes);
      counts.clients = clientes.length;
      for (const [orig, dest] of Object.entries(TABELAS_BACKUP)) {
        if (orig === "clients") continue;
        let rows = d[orig] || [];
        if (dest === "rc_activity_logs") rows = rows.map((r) => ({ id: r.id, legacy_user_id: r.user_id ?? null, action: r.action, details: r.details ?? {}, created_at: r.created_at }));
        else rows = rows.map((r) => pick(r, COLS[dest] ?? Object.keys(r)));
        if (dest === "rc_message_templates") {
          let closing = false; // só um modelo de encerramento
          rows = rows.map((r) => { const c = r.is_closing_template && !closing; if (c) closing = true; return { ...r, is_closing_template: c }; });
        }
        setImportando(`${orig} (${rows.length})...`);
        await upsertEmBlocos(dest, rows);
        counts[orig] = rows.length;
      }
      // Conversas antigas: guardadas só como histórico.
      const msgsPorSessao = new Map<string, any[]>();
      for (const m of d.chat_messages || []) msgsPorSessao.set(m.session_id, [...(msgsPorSessao.get(m.session_id) ?? []), m]);
      const conversas = (d.chat_sessions || []).map((s) => ({
        id: s.id, phone: s.phone, contact_name: s.contact_name ?? "", status: s.status ?? "", assigned_to: s.assigned_to ?? null, last_message_at: s.last_message_at ?? null,
        messages: (msgsPorSessao.get(s.id) ?? []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))), created_at: s.created_at,
      }));
      setImportando(`Conversas (${conversas.length})...`);
      await upsertEmBlocos("rc_legacy_chats", conversas, "id", 100);
      counts.chat_sessions = conversas.length;
      await rc.from("rc_settings").update({ legacy_imported_at: new Date().toISOString(), legacy_import_counts: counts }).eq("id", 1);
      await logRc(user?.id, "legacy_import", counts);
      toast.success("Histórico importado: " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar o backup.");
    } finally {
      setImportando(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {(isAdmin || hasRole("gestor")) && <div className="xl:col-span-2"><UnificacaoEmpresas /></div>}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Canais das notificações</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1"><Label className="text-xs">WhatsApp (canal da Central)</Label>
            <Select value={settings?.whatsapp_channel_id ?? "auto"} onValueChange={(v) => salvarCanal("whatsapp_channel_id", v)} disabled={!isAdmin && !hasRole("gestor")}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="auto">Primeiro canal ativo</SelectItem>{(canais?.whatsapp ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label className="text-xs">E-mail (caixa do Gestão Online)</Label>
            <Select value={settings?.email_channel_id ?? "auto"} onValueChange={(v) => salvarCanal("email_channel_id", v)} disabled={!isAdmin && !hasRole("gestor")}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="auto">Primeira caixa ativa</SelectItem>{(canais?.email ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Importar histórico do Reconnect Hub</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">No sistema antigo, em Configurações › <b>Exportar backup completo</b>, baixe o arquivo e envie aqui. Os registros mantêm os mesmos ids, então importar de novo não duplica.</p>
            {settings?.legacy_imported_at && <p className="text-xs">Última importação: {fmt(settings.legacy_imported_at)} · {Object.entries(settings.legacy_import_counts || {}).map(([k, v]) => `${k} ${v}`).join(", ")}</p>}
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importarBackup(e.target.files?.[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={!!importando}>{importando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}{importando ?? "Enviar arquivo de backup"}</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Modelos de importação</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nome (ex.: Padrão plataforma)" value={novoModelo.name} onChange={(e) => setNovoModelo({ ...novoModelo, name: e.target.value })} className="col-span-2" />
            {(["plate", "client", "lastCommunication", "batteryVoltage"] as const).map((k) => (
              <Input key={k} placeholder={({ plate: "Coluna da placa", client: "Coluna do cliente", lastCommunication: "Coluna da comunicação", batteryVoltage: "Coluna da bateria" } as any)[k]} value={novoModelo[k]} onChange={(e) => setNovoModelo({ ...novoModelo, [k]: e.target.value })} />
            ))}
          </div>
          <Button size="sm" onClick={criarModelo}><Plus className="h-4 w-4 mr-1" />Salvar modelo</Button>
          {importTemplates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border p-2 text-xs">
              <span><b>{t.name}</b> · placa "{t.mapping.plate}" · cliente "{t.mapping.client}" · comunicação "{t.mapping.lastCommunication}"{t.mapping.batteryVoltage ? ` · bateria "${t.mapping.batteryVoltage}"` : ""}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => excluirModelo(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de importações</CardTitle></CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Por</TableHead><TableHead>Linhas</TableHead><TableHead>Novas</TableHead><TableHead>Atualiz.</TableHead><TableHead>Recup.</TableHead><TableHead>Puladas</TableHead></TableRow></TableHeader>
          <TableBody>
            {historico.map((h) => (
              <Fragment key={h.id}>
                <TableRow>
                  <TableCell className="text-xs whitespace-nowrap">{fmt(h.imported_at)}</TableCell>
                  <TableCell className="text-xs">{h.imported_by}</TableCell>
                  <TableCell className="text-xs">{h.total_rows}</TableCell>
                  <TableCell className="text-xs">{h.new_vehicles}</TableCell>
                  <TableCell className="text-xs">{h.updated_vehicles}</TableCell>
                  <TableCell className="text-xs">{h.recovered_count}</TableCell>
                  <TableCell className="text-xs">{h.skipped_count}</TableCell>
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
