import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const TIME_REF_LABELS: Record<string, string> = {
  from_open: "Desde a abertura",
  from_last_client_message: "Desde última msg do cliente",
  from_last_agent_message: "Desde última msg do atendente",
};

interface SlaRule {
  id: string;
  sector_name: string;
  rule_name: string;
  time_reference: string;
  green_limit_minutes: number;
  yellow_limit_minutes: number;
  orange_limit_minutes: number;
  red_limit_minutes: number;
  green_color: string;
  yellow_color: string;
  orange_color: string;
  red_color: string;
  is_active: boolean;
}

export function SlaRulesConfig() {
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<SlaRule | null>(null);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    const { data } = await supabase.from("attendance_sla_rules").select("*").order("sector_name");
    setRules((data as SlaRule[]) || []);
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      sector_name: fd.get("sector_name") as string,
      rule_name: fd.get("rule_name") as string,
      time_reference: fd.get("time_reference") as string,
      green_limit_minutes: Number(fd.get("green_limit")),
      yellow_limit_minutes: Number(fd.get("yellow_limit")),
      orange_limit_minutes: Number(fd.get("orange_limit")),
      red_limit_minutes: Number(fd.get("red_limit")),
      green_color: fd.get("green_color") as string,
      yellow_color: fd.get("yellow_color") as string,
      orange_color: fd.get("orange_color") as string,
      red_color: fd.get("red_color") as string,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("attendance_sla_rules").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("attendance_sla_rules").insert(payload));
    }

    if (error) toast.error(error.message);
    else { toast.success(editing ? "Regra atualizada!" : "Regra criada!"); setOpen(false); setEditing(null); loadRules(); }
    setSaving(false);
  };

  const toggleActive = async (rule: SlaRule) => {
    const { error } = await supabase.from("attendance_sla_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);
    if (error) toast.error(error.message);
    else loadRules();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("attendance_sla_rules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Regra removida"); loadRules(); }
  };

  const openEdit = (rule: SlaRule) => {
    setEditing(rule);
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">SLAs por Setor</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Configure faixas de tempo e cores por setor</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Regra" : "Nova Regra de SLA"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Input name="sector_name" defaultValue={editing?.sector_name || ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome da Regra</Label>
                  <Input name="rule_name" defaultValue={editing?.rule_name || ""} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Base de Contagem</Label>
                <Select name="time_reference" defaultValue={editing?.time_reference || "from_open"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="from_open">Desde a abertura do atendimento</SelectItem>
                    <SelectItem value="from_last_client_message">Desde última mensagem do cliente</SelectItem>
                    <SelectItem value="from_last_agent_message">Desde última interação do atendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Faixas de Tempo (minutos)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /> Verde (até)</Label>
                    <Input name="green_limit" type="number" min={1} defaultValue={editing?.green_limit_minutes || 2} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500" /> Amarelo (até)</Label>
                    <Input name="yellow_limit" type="number" min={1} defaultValue={editing?.yellow_limit_minutes || 4} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500" /> Laranja (até)</Label>
                    <Input name="orange_limit" type="number" min={1} defaultValue={editing?.orange_limit_minutes || 10} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /> Vermelho (acima de)</Label>
                    <Input name="red_limit" type="number" min={1} defaultValue={editing?.red_limit_minutes || 15} required />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cores Personalizadas</Label>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Verde</Label>
                    <Input name="green_color" type="color" defaultValue={editing?.green_color || "#22c55e"} className="h-9 p-1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amarelo</Label>
                    <Input name="yellow_color" type="color" defaultValue={editing?.yellow_color || "#eab308"} className="h-9 p-1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Laranja</Label>
                    <Input name="orange_color" type="color" defaultValue={editing?.orange_color || "#f97316"} className="h-9 p-1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Vermelho</Label>
                    <Input name="red_color" type="color" defaultValue={editing?.red_color || "#ef4444"} className="h-9 p-1" />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : editing ? "Atualizar Regra" : "Criar Regra"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma regra de SLA configurada. Clique em "Nova Regra" para começar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Faixas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.sector_name}</TableCell>
                  <TableCell>{rule.rule_name}</TableCell>
                  <TableCell className="text-xs">{TIME_REF_LABELS[rule.time_reference]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: rule.green_color }}>{rule.green_limit_minutes}</span>
                      <span className="inline-block w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: rule.yellow_color }}>{rule.yellow_limit_minutes}</span>
                      <span className="inline-block w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: rule.orange_color }}>{rule.orange_limit_minutes}</span>
                      <span className="inline-block w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: rule.red_color }}>{rule.red_limit_minutes}+</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
