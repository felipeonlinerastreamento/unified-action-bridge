import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { upsertPostsaleRule, deletePostsaleRule } from "@/lib/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Workflow, Loader2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Step = {
  delay_days: number;
  action_type: "task" | "whatsapp" | "email" | "nps";
  title: string;
  description: string;
  move_to_category_id?: string | null;
  move_to_stage_id?: string | null;
};

type RuleForm = {
  id?: string;
  name: string;
  trigger_type: "sector" | "pipeline_stage" | "contact_category" | "opportunity_lost";
  trigger_sector: string | null;
  trigger_stage_id: string | null;
  trigger_category_id: string | null;
  final_category_id: string | null;
  final_stage_id: string | null;
  is_active: boolean;
  steps: Step[];
};

const empty: RuleForm = {
  name: "",
  trigger_type: "pipeline_stage",
  trigger_sector: null,
  trigger_stage_id: null,
  trigger_category_id: null,
  final_category_id: null,
  final_stage_id: null,
  is_active: true,
  steps: [],
};

const TEMPLATES: { label: string; build: (ctx: { stages: any[]; categories: any[] }) => Partial<RuleForm> }[] = [
  {
    label: "Acompanhamento de proposta (D+3, D+6, D+13)",
    build: () => ({
      name: "Acompanhamento de proposta",
      trigger_type: "pipeline_stage",
      steps: [
        { delay_days: 3, action_type: "whatsapp", title: "Confirmar recebimento da proposta", description: "Olá! Confirmou o recebimento da nossa proposta?" },
        { delay_days: 6, action_type: "whatsapp", title: "Esclarecer dúvidas", description: "Posso esclarecer alguma dúvida sobre a proposta?" },
        { delay_days: 13, action_type: "task", title: "Ligar para fechar", description: "Última tentativa de contato comercial." },
      ],
    }),
  },
  {
    label: "Boas-vindas pós-venda",
    build: () => ({
      name: "Boas-vindas pós-venda",
      trigger_type: "pipeline_stage",
      steps: [
        { delay_days: 1, action_type: "whatsapp", title: "Agradecimento", description: "Obrigado pela confiança! Estamos à disposição." },
        { delay_days: 7, action_type: "whatsapp", title: "Onboarding", description: "Como está sendo a experiência inicial?" },
        { delay_days: 30, action_type: "nps", title: "Pesquisa NPS", description: "Pesquisa de satisfação." },
      ],
    }),
  },
  {
    label: "Recuperação de oportunidade perdida",
    build: () => ({
      name: "Recuperação de lead perdido",
      trigger_type: "opportunity_lost",
      steps: [
        { delay_days: 60, action_type: "whatsapp", title: "Reabordagem leve", description: "Fazendo um follow-up sem pressão." },
        { delay_days: 120, action_type: "task", title: "Ligar para reaquecer", description: "Tentar novo contato." },
        { delay_days: 180, action_type: "whatsapp", title: "Última tentativa", description: "Mensagem final de reabordagem." },
      ],
    }),
  },
  {
    label: "Reativação de cliente inativo (90 dias)",
    build: () => ({
      name: "Reativação de cliente inativo",
      trigger_type: "contact_category",
      steps: [
        { delay_days: 0, action_type: "task", title: "Revisar histórico do cliente", description: "" },
        { delay_days: 1, action_type: "whatsapp", title: "Mensagem de reativação", description: "Sentimos sua falta! Posso te ajudar em algo?" },
      ],
    }),
  },
  {
    label: "Pesquisa CSAT pós-fechamento",
    build: () => ({
      name: "CSAT pós-fechamento",
      trigger_type: "pipeline_stage",
      steps: [
        { delay_days: 7, action_type: "nps", title: "Enviar pesquisa de satisfação", description: "" },
      ],
    }),
  },
];

export function CrmFlowsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(empty);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["crm-flow-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_postsale_rules")
        .select("*, crm_postsale_steps(*)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages"],
    queryFn: async () => (await supabase.from("crm_pipeline_stages").select("*").eq("is_active", true).order("position")).data || [],
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["crm-categories"],
    queryFn: async () => (await supabase.from("crm_categories").select("id, name").order("name")).data || [],
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome");
      await upsertPostsaleRule({
        data: {
          id: form.id,
          name: form.name,
          trigger_type: form.trigger_type,
          trigger_sector: form.trigger_sector,
          trigger_stage_id: form.trigger_stage_id,
          trigger_category_id: form.trigger_category_id,
          final_category_id: form.final_category_id,
          final_stage_id: form.final_stage_id,
          is_active: form.is_active,
          steps: form.steps,
        } as any,
      });
    },
    onSuccess: () => {
      toast.success(form.id ? "Fluxo atualizado" : "Fluxo criado");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["crm-flow-rules"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => { await deletePostsaleRule({ data: { id } }); },
    onSuccess: () => { toast.success("Fluxo removido"); qc.invalidateQueries({ queryKey: ["crm-flow-rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("crm_postsale_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-flow-rules"] }),
  });

  const triggerLabel = (r: any) => {
    if (r.trigger_type === "pipeline_stage") {
      const st = stages.find((s: any) => s.id === r.trigger_stage_id);
      return `Quando entrar na etapa: ${st?.name || "—"}`;
    }
    if (r.trigger_type === "contact_category") {
      const c = categories.find((c: any) => c.id === r.trigger_category_id);
      return `Quando contato entra na categoria: ${c?.name || "—"}`;
    }
    if (r.trigger_type === "opportunity_lost") return "Quando oportunidade for perdida";
    return `Setor: ${r.trigger_sector || "—"}`;
  };

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      name: r.name,
      trigger_type: r.trigger_type || "sector",
      trigger_sector: r.trigger_sector,
      trigger_stage_id: r.trigger_stage_id,
      trigger_category_id: r.trigger_category_id,
      final_category_id: r.final_category_id,
      final_stage_id: r.final_stage_id,
      is_active: r.is_active,
      steps: (r.crm_postsale_steps || []).sort((a: any, b: any) => a.position - b.position).map((s: any) => ({
        delay_days: s.delay_days,
        action_type: s.action_type,
        title: s.title,
        description: s.description || "",
        move_to_category_id: s.move_to_category_id,
        move_to_stage_id: s.move_to_stage_id,
      })),
    });
    setOpen(true);
  };

  const applyTemplate = (idx: number) => {
    const t = TEMPLATES[idx].build({ stages, categories });
    setForm((f) => ({ ...f, ...t, steps: (t.steps as Step[]) || f.steps }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1"><Workflow className="h-4 w-4" /> Fluxos & Lembretes Automáticos</h3>
          <p className="text-xs text-muted-foreground">Configure sequências automáticas de mensagens e tarefas para seus contatos e oportunidades.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo fluxo</Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : rules.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum fluxo cadastrado. Crie um para começar.</CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rules.map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{r.name}</CardTitle>
                  <Switch checked={r.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: r.id, is_active: v })} />
                </div>
                <p className="text-xs text-muted-foreground">{triggerLabel(r)}</p>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex flex-wrap gap-1">
                  {(r.crm_postsale_steps || []).sort((a: any, b: any) => a.position - b.position).map((s: any, i: number) => (
                    <Badge key={s.id} variant="outline" className="text-[10px]">D+{s.delay_days} · {s.action_type} · {s.title}</Badge>
                  ))}
                  {(!r.crm_postsale_steps || r.crm_postsale_steps.length === 0) && <span className="text-muted-foreground italic">Sem passos</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(r)}><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Excluir fluxo?")) delMut.mutate(r.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar fluxo" : "Novo fluxo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!form.id && (
              <div className="rounded-md border bg-muted/30 p-2">
                <Label className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> Começar a partir de um modelo</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {TEMPLATES.map((t, i) => (
                    <Button key={i} type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyTemplate(i)}>{t.label}</Button>
                  ))}
                </div>
              </div>
            )}

            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo de gatilho</Label>
                <Select value={form.trigger_type} onValueChange={(v: any) => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pipeline_stage">Etapa do pipeline</SelectItem>
                    <SelectItem value="contact_category">Categoria do contato</SelectItem>
                    <SelectItem value="opportunity_lost">Oportunidade perdida</SelectItem>
                    <SelectItem value="sector">Setor (atendimento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disparar em</Label>
                {form.trigger_type === "pipeline_stage" && (
                  <Select value={form.trigger_stage_id || ""} onValueChange={(v) => setForm({ ...form, trigger_stage_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                    <SelectContent>{stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {form.trigger_type === "contact_category" && (
                  <Select value={form.trigger_category_id || ""} onValueChange={(v) => setForm({ ...form, trigger_category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {form.trigger_type === "sector" && (
                  <Input value={form.trigger_sector || ""} onChange={(e) => setForm({ ...form, trigger_sector: e.target.value })} placeholder="Nome do setor" />
                )}
                {form.trigger_type === "opportunity_lost" && (
                  <Input disabled value="Automático ao marcar como perdida" />
                )}
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Passos</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, { delay_days: 3, action_type: "whatsapp", title: "", description: "" }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar passo
                </Button>
              </div>
              {form.steps.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Adicione passos com tempo de espera, tipo de ação e mensagem.</p>
              ) : form.steps.map((s, idx) => (
                <div key={idx} className="rounded-md border bg-background p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">#{idx + 1}</Badge>
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      <div>
                        <Label className="text-[10px]">D+ dias</Label>
                        <Input type="number" min={0} className="h-8 text-xs" value={s.delay_days}
                          onChange={(e) => setForm((f) => ({ ...f, steps: f.steps.map((x, i) => i === idx ? { ...x, delay_days: Number(e.target.value) || 0 } : x) }))} />
                      </div>
                      <div>
                        <Label className="text-[10px]">Ação</Label>
                        <Select value={s.action_type} onValueChange={(v: any) => setForm((f) => ({ ...f, steps: f.steps.map((x, i) => i === idx ? { ...x, action_type: v } : x) }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="task">Tarefa</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="nps">NPS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 ml-auto"
                          onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Título</Label>
                    <Input className="h-8 text-xs" value={s.title}
                      onChange={(e) => setForm((f) => ({ ...f, steps: f.steps.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Mensagem / descrição</Label>
                    <Textarea rows={2} className="text-xs" value={s.description}
                      onChange={(e) => setForm((f) => ({ ...f, steps: f.steps.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Reclassificar contato (opcional)</Label>
                      <Select value={s.move_to_category_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, steps: f.steps.map((x, i) => i === idx ? { ...x, move_to_category_id: v === "none" ? null : v } : x) }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— manter —</SelectItem>
                          {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Mover oportunidade (opcional)</Label>
                      <Select value={s.move_to_stage_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, steps: f.steps.map((x, i) => i === idx ? { ...x, move_to_stage_id: v === "none" ? null : v } : x) }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— manter —</SelectItem>
                          {stages.map((st: any) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ao final, mover contato para categoria</Label>
                <Select value={form.final_category_id || "none"} onValueChange={(v) => setForm({ ...form, final_category_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— manter —</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ao final, mover oportunidade para etapa</Label>
                <Select value={form.final_stage_id || "none"} onValueChange={(v) => setForm({ ...form, final_stage_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— manter —</SelectItem>
                    {stages.map((st: any) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">Ativo</Label>
            </div>

            <Button className="w-full" disabled={!form.name || saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {form.id ? "Salvar alterações" : "Criar fluxo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
