import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, DollarSign, TrendingUp, X, Pencil, Check, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { upsertOpportunity, moveOpportunityStage } from "@/lib/crm.functions";
import { ReferralPicker } from "@/components/crm/referral-picker";

type ContractItem = { categoryId: string; quantity: number; activationValue: number; monthlyValue: number };

const emptyForm = {
  title: "",
  probability: 25,
  opportunity_type: "new",
  notes: "",
  contact_name: "",
  company_name: "",
  contact_phone: "",
  contact_email: "",
  cnpj: "",
  category_id: "",
  referral_id: "",
  items: [] as ContractItem[],
};

export function CrmPipelineTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [catDraft, setCatDraft] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_pipeline_stages").select("*").eq("is_active", true).order("position");
      return data || [];
    },
  });
  const { data: opps = [], isLoading } = useQuery({
    queryKey: ["crm-opportunities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_opportunities")
        .select("*, crm_contacts(name), companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["crm-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_categories").select("id, name").order("name");
      return data || [];
    },
  });

  const createCatMut = useMutation({
    mutationFn: async () => {
      const name = catDraft.trim();
      if (!name) throw new Error("Informe o nome");
      const { error } = await supabase.from("crm_categories").insert({ name, description: "" });
      if (error) throw error;
    },
    onSuccess: () => { setCatDraft(""); qc.invalidateQueries({ queryKey: ["crm-categories"] }); toast.success("Categoria criada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateCatMut = useMutation({
    mutationFn: async () => {
      if (!editingCatId || !editingCatName.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("crm_categories").update({ name: editingCatName.trim() }).eq("id", editingCatId);
      if (error) throw error;
    },
    onSuccess: () => { setEditingCatId(null); setEditingCatName(""); qc.invalidateQueries({ queryKey: ["crm-categories"] }); toast.success("Atualizada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteCatMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_categories").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      if (form.category_id === id) setForm((f: any) => ({ ...f, category_id: "" }));
      setForm((f: any) => ({ ...f, items: f.items.filter((it: ContractItem) => it.categoryId !== id) }));
      qc.invalidateQueries({ queryKey: ["crm-categories"] });
      toast.success("Removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const open = opps.filter((o: any) => o.status === "open");
    const won = opps.filter((o: any) => o.status === "won");
    const valOpen = open.reduce((s: number, o: any) => s + Number(o.expected_value || 0), 0);
    const weighted = open.reduce(
      (s: number, o: any) => s + Number(o.expected_value || 0) * (Number(o.probability || 0) / 100),
      0
    );
    const valWon = won.reduce((s: number, o: any) => s + Number(o.expected_value || 0), 0);
    return { count: open.length, valOpen, weighted, valWon };
  }, [opps]);

  const activationTotal = useMemo(
    () => form.items.reduce((s: number, i: ContractItem) => s + (Number(i.activationValue) || 0) * (Number(i.quantity) || 0), 0),
    [form.items]
  );
  const monthlyTotal = useMemo(
    () => form.items.reduce((s: number, i: ContractItem) => s + (Number(i.monthlyValue) || 0) * (Number(i.quantity) || 0), 0),
    [form.items]
  );

  const createMut = useMutation({
    mutationFn: async () => {
      const stage = stages[0];
      const items = form.items.filter((i: ContractItem) => i.categoryId);
      await upsertOpportunity({
        data: {
          title: form.title,
          expected_value: activationTotal + monthlyTotal,
          probability: Number(form.probability || stage?.default_probability || 0),
          opportunity_type: form.opportunity_type,
          notes: form.notes,
          stage_id: stage?.id,
          source: "manual",
          contact_name: form.contact_name || null,
          company_name: form.company_name || null,
          contact_phone: form.contact_phone || null,
          contact_email: form.contact_email || null,
          cnpj: form.cnpj || null,
          category_id: form.category_id || null,
          contract_items: items,
        },
      });
    },
    onSuccess: () => {
      toast.success("Oportunidade criada");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, stage_id }: { id: string; stage_id: string }) => {
      await moveOpportunityStage({ data: { id, stage_id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-opportunities"] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KPI label="Oportunidades abertas" value={totals.count} />
        <KPI label="Valor em pipeline" value={`R$ ${totals.valOpen.toLocaleString("pt-BR")}`} />
        <KPI label="Previsão ponderada" value={`R$ ${Math.round(totals.weighted).toLocaleString("pt-BR")}`} />
        <KPI label="Ganho acumulado" value={`R$ ${totals.valWon.toLocaleString("pt-BR")}`} />
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Pipeline</h3>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova oportunidade</Button>
      </div>

      <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` }}>
        {stages.map((s: any) => {
          const stageOpps = opps.filter((o: any) => o.stage_id === s.id);
          const stageVal = stageOpps.reduce((sum: number, o: any) => sum + Number(o.expected_value || 0), 0);
          return (
            <Card key={s.id} className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center justify-between">
                  <span style={{ color: s.color }}>{s.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{stageOpps.length}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">R$ {stageVal.toLocaleString("pt-BR")}</p>
              </CardHeader>
              <CardContent className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                {stageOpps.map((o: any) => (
                  <div key={o.id} className="border rounded-md p-2 bg-card text-xs space-y-1">
                    <div className="font-medium">{o.title}</div>
                    {(o.company_name || o.contact_name || o.companies?.name || o.crm_contacts?.name) && (
                      <div className="text-muted-foreground">
                        {o.company_name || o.companies?.name || o.contact_name || o.crm_contacts?.name}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-600 font-medium">R$ {Number(o.expected_value || 0).toLocaleString("pt-BR")}</span>
                      <Badge variant="outline" className="text-[9px]">{o.probability}%</Badge>
                    </div>
                    <Select value={o.stage_id || ""} onValueChange={(v) => moveMut.mutate({ id: o.id, stage_id: v })}>
                      <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stages.map((st: any) => (
                          <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {stageOpps.length === 0 && <p className="text-[11px] text-muted-foreground p-2">Vazio</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova oportunidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nome do contato</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Nome da empresa</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div className="col-span-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={form.opportunity_type} onValueChange={(v) => setForm({ ...form, opportunity_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nova venda</SelectItem>
                    <SelectItem value="upsell">Upsell</SelectItem>
                    <SelectItem value="renewal">Renovação</SelectItem>
                    <SelectItem value="recovery">Recuperação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Probabilidade %</Label><Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Categoria</Label>
                <span className="text-[10px] text-muted-foreground">Crie / edite / exclua abaixo</span>
              </div>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm((f: any) => ({
                  ...f,
                  category_id: v,
                  items: f.items.length === 0 ? [{ categoryId: v, quantity: 1, activationValue: 0, monthlyValue: 0 }] : f.items,
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">Nenhuma categoria cadastrada.</div>
                  ) : categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="rounded-md border border-border bg-background p-2 space-y-2">
                <div className="flex gap-2">
                  <Input value={catDraft} onChange={(e) => setCatDraft(e.target.value)} placeholder="Nova categoria" className="h-8 text-xs" />
                  <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={() => createCatMut.mutate()} disabled={!catDraft.trim() || createCatMut.isPending}>
                    {createCatMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 py-1"><Tag className="h-3 w-3" /> Nenhuma categoria</p>
                  ) : categories.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent/50">
                      {editingCatId === c.id ? (
                        <>
                          <Input value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} className="h-7 text-xs" autoFocus />
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateCatMut.mutate()} disabled={!editingCatName.trim() || updateCatMut.isPending}>
                            {updateCatMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingCatId(null); setEditingCatName(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="flex-1 truncate text-left text-xs py-1" onClick={() => setForm((f: any) => ({ ...f, category_id: c.id }))}>
                            {form.category_id === c.id ? "✓ " : ""}{c.name}
                          </button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Remover categoria?")) deleteCatMut.mutate(c.id); }} disabled={deleteCatMut.isPending}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Itens da proposta</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => setForm((f: any) => ({ ...f, items: [...f.items, { categoryId: "", quantity: 1, activationValue: 0, monthlyValue: 0 }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar item
                </Button>
              </div>
              {form.items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Nenhum item. Adicione um item para definir quantidade, ativação e mensalidade.</p>
              ) : (
                <div className="space-y-2">
                  {form.items.map((it: ContractItem, idx: number) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-md border border-border bg-background p-2">
                      <div className="col-span-12 sm:col-span-4">
                        <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                        <Select value={it.categoryId} onValueChange={(v) => setForm((f: any) => ({
                          ...f, items: f.items.map((x: ContractItem, i: number) => i === idx ? { ...x, categoryId: v } : x)
                        }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Qtd.</Label>
                        <Input type="number" min={1} className="h-8 text-xs" value={it.quantity}
                          onChange={(e) => setForm((f: any) => ({ ...f, items: f.items.map((x: ContractItem, i: number) => i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x) }))} />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Ativação (R$)</Label>
                        <Input type="number" min={0} step="0.01" className="h-8 text-xs" value={it.activationValue}
                          onChange={(e) => setForm((f: any) => ({ ...f, items: f.items.map((x: ContractItem, i: number) => i === idx ? { ...x, activationValue: Number(e.target.value) || 0 } : x) }))} />
                      </div>
                      <div className="col-span-3 sm:col-span-3">
                        <Label className="text-[10px] text-muted-foreground">Mensalidade (R$)</Label>
                        <Input type="number" min={0} step="0.01" className="h-8 text-xs" value={it.monthlyValue}
                          onChange={(e) => setForm((f: any) => ({ ...f, items: f.items.map((x: ContractItem, i: number) => i === idx ? { ...x, monthlyValue: Number(e.target.value) || 0 } : x) }))} />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }))}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-end gap-4 text-xs pt-1">
                    <span className="text-muted-foreground">Total Ativação: <strong className="text-foreground">R$ {activationTotal.toFixed(2)}</strong></span>
                    <span className="text-muted-foreground">Total Mensal: <strong className="text-foreground">R$ {monthlyTotal.toFixed(2)}</strong></span>
                  </div>
                </div>
              )}
            </div>

            <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" disabled={!form.title || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <DollarSign className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
