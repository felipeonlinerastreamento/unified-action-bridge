import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Mail, MessageCircle, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TERM_TYPES_QUERY_KEY, useTechnicalTermTypes } from "@/hooks/use-technical-term-types";
import {
  TERM_MESSAGE_VARS,
  parseChecklistText,
  renderTermTemplate,
  sampleTermVars,
  slugifyTermKey,
  termDeletionAction,
  validateTermType,
  type TermType,
} from "@/lib/technical-terms";

const DEFAULT_MESSAGES = {
  whatsapp_template: "Olá {responsavel}! A {empresa} precisa do seu aceite para o serviço de {servico} no veículo {placa}. Acesse: {link}",
  email_subject: "{servico} — aceite necessário ({placa})",
  email_template: "Olá {responsavel},\n\nPara agendarmos o serviço de {servico} no veículo {placa} ({cliente}), precisamos do seu aceite no termo abaixo:\n\n{link}",
};

type Draft = Omit<TermType, "id" | "key" | "checklist"> & { id?: string; key?: string; checklistText: string };

function emptyDraft(position: number): Draft {
  return {
    label: "",
    title: "",
    body: "",
    checklistText: "",
    requires_equipment_id: false,
    is_active: true,
    position,
    ...DEFAULT_MESSAGES,
  };
}

function toDraft(t: TermType): Draft {
  const { checklist, ...rest } = t;
  return { ...rest, checklistText: checklist.join("\n") };
}

/** Configurações > CRM: cadastro completo dos tipos de termo de serviço técnico. */
export function TechnicalTermSettings() {
  const qc = useQueryClient();
  const { all: types, isLoading } = useTechnicalTermTypes();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<{ type: TermType; used: boolean; categories: string[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: TERM_TYPES_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["ticket-categories-admin"] });
  };

  const toggleActive = async (t: TermType, active: boolean) => {
    setBusyId(t.id);
    const { error } = await supabase.from("technical_term_types").update({ is_active: active }).eq("id", t.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(active ? `${t.label} ativado` : `${t.label} inativado`);
    refresh();
  };

  const askDelete = async (t: TermType) => {
    setBusyId(t.id);
    const [{ count }, { data: cats }] = await Promise.all([
      supabase.from("technical_service_terms").select("id", { count: "exact", head: true }).eq("service_type", t.key),
      supabase.from("ticket_categories").select("label").eq("technical_term_type", t.key),
    ]);
    setBusyId(null);
    setDeleting({ type: t, used: (count ?? 0) > 0, categories: (cats || []).map((c: any) => c.label) });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const t = deleting.type;
    setBusyId(t.id);
    const { data, error } = await supabase.rpc("delete_technical_term_type", { _id: t.id });
    setBusyId(null);
    setDeleting(null);
    if (error) return toast.error(error.message);
    toast.success(data === "inativado" ? `${t.label} já foi usado em termos: foi inativado para preservar o histórico.` : `${t.label} excluído`);
    refresh();
  };

  const action = deleting ? termDeletionAction({ usedInTerms: deleting.used, requiredByCategories: deleting.categories }) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Termos de serviço técnico</CardTitle>
            <CardDescription className="mt-1.5">
              Cada tipo tem título, texto, checklist do atendente e mensagens de envio próprios. Os tipos ativos aparecem no formulário do termo (chat e chamado) e em "Exige termo" das categorias, em Configurações &gt; Encaminhamento.
              Alterações valem só para novos envios: termos já enviados aos clientes não mudam.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing(emptyDraft((types.at(-1)?.position ?? 0) + 1))}>
            <Plus className="h-4 w-4 mr-1" /> Novo tipo de termo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de serviço</TableHead>
                <TableHead>Título do termo</TableHead>
                <TableHead className="text-center">Checklist</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id} className={t.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    {t.label}
                    {!t.is_active && <Badge variant="secondary" className="ml-2">Inativo</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{t.title}</TableCell>
                  <TableCell className="text-center text-sm">{t.checklist.length || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={t.is_active}
                      disabled={busyId === t.id}
                      onCheckedChange={(v) => toggleActive(t, v)}
                      aria-label={t.is_active ? `Inativar ${t.label}` : `Ativar ${t.label}`}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(toDraft(t))} aria-label={`Editar ${t.label}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === t.id} onClick={() => askDelete(t)} aria-label={`Excluir ${t.label}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum tipo de termo cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <GeneralOptions />
      </CardContent>

      {editing && (
        <TermTypeEditor
          draft={editing}
          existingKeys={types.map((t) => t.key)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "block" ? "Não é possível excluir" : action === "inactivate" ? `Inativar ${deleting?.type.label}?` : `Excluir ${deleting?.type.label}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "block" && <>Este termo é exigido pelas categorias: <strong>{deleting?.categories.join(", ")}</strong>. Altere-as em Configurações &gt; Encaminhamento antes de excluir.</>}
              {action === "inactivate" && "Este termo já foi usado em chamados. Para preservar o histórico, ele será apenas inativado: deixa de aparecer para novos envios, e os termos já enviados continuam como estão."}
              {action === "delete" && "Este termo nunca foi usado. Ele será excluído definitivamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{action === "block" ? "Fechar" : "Cancelar"}</AlertDialogCancel>
            {action !== "block" && (
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {action === "inactivate" ? "Inativar" : "Excluir"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Opções gerais da resposta do cliente (valem para todos os tipos). */
function GeneralOptions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<{ require_reject_reason: boolean; notify_creator: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: loaded } = useQuery({
    queryKey: ["technical-term-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technical_term_settings").select("require_reject_reason, notify_creator").eq("id", "default").maybeSingle();
      if (error) throw error;
      return data ?? { require_reject_reason: true, notify_creator: true };
    },
  });
  useEffect(() => {
    if (loaded && !form) setForm({ require_reject_reason: !!loaded.require_reject_reason, notify_creator: !!loaded.notify_creator });
  }, [loaded, form]);
  if (!form) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("technical_term_settings").upsert({ id: "default", ...form, updated_by: user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Opções da resposta salvas");
    qc.invalidateQueries({ queryKey: ["technical-term-settings"] });
  };

  return (
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-sm font-medium">Resposta do responsável (todos os tipos)</p>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={form.require_reject_reason} onCheckedChange={(v) => setForm({ ...form, require_reject_reason: v })} />
        Exigir motivo quando o responsável recusar
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={form.notify_creator} onCheckedChange={(v) => setForm({ ...form, notify_creator: v })} />
        Avisar o atendente que enviou quando houver aceite ou recusa
      </label>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar opções
        </Button>
      </div>
    </div>
  );
}

type MsgField = "whatsapp_template" | "email_subject" | "email_template";

function TermTypeEditor({ draft, existingKeys, onClose, onSaved }: {
  draft: Draft;
  existingKeys: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<MsgField>("whatsapp_template");
  const refs = {
    whatsapp_template: useRef<HTMLTextAreaElement>(null),
    email_subject: useRef<HTMLInputElement>(null),
    email_template: useRef<HTMLTextAreaElement>(null),
  };
  const isNew = !d.id;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  /** Insere a variável na posição do cursor do último campo de mensagem usado. */
  const insertVar = (key: string) => {
    const el = refs[focused].current;
    const token = `{${key}}`;
    const value = String(d[focused] ?? "");
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set(focused, value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const vars = useMemo(() => sampleTermVars({ servico: d.label.trim() || "Serviço" }), [d.label]);
  const preview = {
    whatsapp: renderTermTemplate(d.whatsapp_template, vars),
    subject: renderTermTemplate(d.email_subject, vars),
    email: renderTermTemplate(d.email_template, vars),
  };

  const save = async () => {
    const err = validateTermType(d);
    if (err) return toast.error(err);
    setSaving(true);
    const payload = {
      label: d.label.trim(),
      title: d.title.trim(),
      body: d.body.trim(),
      checklist: parseChecklistText(d.checklistText),
      requires_equipment_id: d.requires_equipment_id,
      whatsapp_template: d.whatsapp_template,
      email_subject: d.email_subject,
      email_template: d.email_template,
      is_active: d.is_active,
      position: Number(d.position) || 0,
      updated_by: user?.id ?? null,
    };
    const { error } = isNew
      ? await supabase.from("technical_term_types").insert({ ...payload, key: slugifyTermKey(payload.label, existingKeys) })
      : await supabase.from("technical_term_types").update(payload).eq("id", d.id!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? `Tipo "${payload.label}" criado` : `Tipo "${payload.label}" salvo`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo tipo de termo" : `Editar termo — ${draft.label}`}</DialogTitle>
          <DialogDescription>As mudanças valem para os próximos envios. Termos já enviados aos clientes continuam exatamente como foram enviados.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="termo">
          <TabsList>
            <TabsTrigger value="termo">Termo</TabsTrigger>
            <TabsTrigger value="mensagens">Mensagens de envio</TabsTrigger>
          </TabsList>

          <TabsContent value="termo" className="space-y-3 mt-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <Label htmlFor="tt-label">Tipo de serviço *</Label>
                <Input id="tt-label" value={d.label} onChange={(e) => set("label", e.target.value)} maxLength={60} placeholder="Ex.: Troca de equipamento" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tt-pos">Ordem</Label>
                <Input id="tt-pos" type="number" value={d.position} onChange={(e) => set("position", Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-title">Título do termo *</Label>
              <Input id="tt-title" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-body">Texto do termo *</Label>
              <Textarea id="tt-body" rows={7} value={d.body} onChange={(e) => set("body", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tt-check">Checklist obrigatório do atendente (um item por linha)</Label>
              <Textarea id="tt-check" rows={4} value={d.checklistText} onChange={(e) => set("checklistText", e.target.value)} placeholder="Sem checklist: só comunicado e aceite" />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={d.requires_equipment_id} onCheckedChange={(v) => set("requires_equipment_id", v)} />
                Exigir ID do equipamento
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={d.is_active} onCheckedChange={(v) => set("is_active", v)} />
                Ativo (aparece para novos envios)
              </label>
            </div>
          </TabsContent>

          <TabsContent value="mensagens" className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Clique numa variável para inserir no campo selecionado. A variável {"{link}"} é obrigatória.</p>
              <div className="flex flex-wrap gap-1.5">
                {TERM_MESSAGE_VARS.map((v) => (
                  <Button key={v.key} type="button" size="sm" variant="outline" className="h-7 text-xs" title={v.label} onClick={() => insertVar(v.key)}>
                    {`{${v.key}}`} <span className="ml-1 text-muted-foreground hidden sm:inline">{v.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tt-wa" className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> Mensagem de WhatsApp *</Label>
                  <Textarea id="tt-wa" ref={refs.whatsapp_template} rows={4} value={d.whatsapp_template}
                    onFocus={() => setFocused("whatsapp_template")} onChange={(e) => set("whatsapp_template", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tt-subj" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Assunto do e-mail *</Label>
                  <Input id="tt-subj" ref={refs.email_subject} value={d.email_subject}
                    onFocus={() => setFocused("email_subject")} onChange={(e) => set("email_subject", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tt-email">Texto do e-mail *</Label>
                  <Textarea id="tt-email" ref={refs.email_template} rows={6} value={d.email_template}
                    onFocus={() => setFocused("email_template")} onChange={(e) => set("email_template", e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Pré-visualização</p>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">WhatsApp</p>
                  <div className="rounded-lg rounded-tl-none bg-card border px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm">{preview.whatsapp}</div>
                </div>
                <div className="rounded-lg border bg-card">
                  <div className="border-b px-3 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground">E-mail</p>
                    <p className="text-sm font-semibold break-words">{preview.subject}</p>
                  </div>
                  <div className="px-3 py-3 text-sm whitespace-pre-wrap break-words">{preview.email}</div>
                  <div className="px-3 pb-3">
                    <span className="inline-block rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Ver termo e responder</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Exemplo com dados fictícios. No envio, cada variável é trocada pelos dados do termo.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {isNew ? "Criar termo" : "Salvar termo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
