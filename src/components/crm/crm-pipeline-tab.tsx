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
import { Plus, Loader2, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { upsertOpportunity, moveOpportunityStage } from "@/lib/crm.functions";

export function CrmPipelineTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    title: "",
    expected_value: 0,
    probability: 25,
    opportunity_type: "new",
    notes: "",
    contact_id: null,
    company_id: null,
  });

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
  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-contacts-min"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_contacts").select("id, name, company_id").order("name").limit(500);
      return data || [];
    },
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name").limit(500);
      return data || [];
    },
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

  const createMut = useMutation({
    mutationFn: async () => {
      const stage = stages[0];
      await upsertOpportunity({
        data: {
          title: form.title,
          expected_value: Number(form.expected_value || 0),
          probability: Number(form.probability || stage?.default_probability || 0),
          opportunity_type: form.opportunity_type,
          notes: form.notes,
          contact_id: form.contact_id || undefined,
          company_id: form.company_id || undefined,
          stage_id: stage?.id,
          source: "manual",
        },
      });
    },
    onSuccess: () => {
      toast.success("Oportunidade criada");
      setOpen(false);
      setForm({ title: "", expected_value: 0, probability: 25, opportunity_type: "new", notes: "", contact_id: null, company_id: null });
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
                    {(o.crm_contacts?.name || o.companies?.name) && (
                      <div className="text-muted-foreground">
                        {o.companies?.name || o.crm_contacts?.name}
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
        <DialogContent>
          <DialogHeader><DialogTitle>Nova oportunidade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Valor esperado</Label><Input type="number" value={form.expected_value} onChange={(e) => setForm({ ...form, expected_value: e.target.value })} /></div>
              <div><Label>Probabilidade %</Label><Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
            </div>
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
            <div>
              <Label>Empresa</Label>
              <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nenhuma —</SelectItem>
                  {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contato</Label>
              <Select value={form.contact_id || "none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— nenhum —</SelectItem>
                  {contacts.slice(0, 200).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
