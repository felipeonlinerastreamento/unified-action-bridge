import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Zap, Tag, Bell, ArrowRightLeft, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

type Rule = {
  id: string;
  name: string;
  is_enabled: boolean;
  keywords: string[];
  match_type: "any" | "all" | "regex";
  case_sensitive: boolean;
  action_type: "floating_alert" | "transfer_sector" | "both";
  alert_message: string;
  alert_target_type: "assigned" | "all" | "sector" | "users";
  alert_target_sector_ids: string[];
  alert_target_user_ids: string[];
  transfer_sector_id: string | null;
  transfer_sector_name: string | null;
  transfer_note: string;
  sound_enabled: boolean;
  cooldown_minutes: number;
  priority: number;
  create_ticket: boolean;
  ticket_sector: string | null;
  ticket_priority: string;
  ticket_note: string;
};

const EMPTY: Omit<Rule, "id"> = {
  name: "",
  is_enabled: true,
  keywords: [],
  match_type: "any",
  case_sensitive: false,
  action_type: "floating_alert",
  alert_message: "Atenção: palavra-chave detectada",
  alert_target_type: "sector",
  alert_target_sector_ids: [],
  alert_target_user_ids: [],
  transfer_sector_id: null,
  transfer_sector_name: null,
  transfer_note: "",
  sound_enabled: false,
  cooldown_minutes: 5,
  priority: 100,
  create_ticket: false,
  ticket_sector: null,
  ticket_priority: "alta",
  ticket_note: "",
};

export function MessageTriggersConfig() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [draft, setDraft] = useState<Omit<Rule, "id">>(EMPTY);
  const [keywordInput, setKeywordInput] = useState("");

  const { data: rules = [] } = useQuery<Rule[]>({
    queryKey: ["message-trigger-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("message_trigger_rules" as any)
        .select("*")
        .order("priority", { ascending: true });
      return ((data as any[]) || []) as Rule[];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors-active"],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").order("name");
      return data || [];
    },
  });

  const startNew = () => {
    setEditing(null);
    setDraft(EMPTY);
    setKeywordInput("");
    setOpen(true);
  };

  const startEdit = (r: Rule) => {
    setEditing(r);
    setDraft({ ...EMPTY, ...r, keywords: r.keywords || [] });
    setKeywordInput("");
    setOpen(true);
  };

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (!k) return;
    if (draft.keywords.includes(k)) return;
    setDraft({ ...draft, keywords: [...draft.keywords, k] });
    setKeywordInput("");
  };

  const removeKeyword = (k: string) => {
    setDraft({ ...draft, keywords: draft.keywords.filter((x) => x !== k) });
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error("Informe um nome para a regra"); return; }
    if (!draft.keywords.length) { toast.error("Adicione pelo menos uma palavra-chave"); return; }

    const payload: any = {
      ...draft,
      transfer_sector_name: draft.transfer_sector_id
        ? sectors.find((s: any) => s.id === draft.transfer_sector_id)?.name || draft.transfer_sector_name
        : null,
    };

    if (editing) {
      const { error } = await supabase
        .from("message_trigger_rules" as any)
        .update(payload)
        .eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Regra atualizada");
    } else {
      const { error } = await supabase.from("message_trigger_rules" as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Regra criada");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["message-trigger-rules"] });
  };

  const toggle = async (r: Rule) => {
    await supabase.from("message_trigger_rules" as any).update({ is_enabled: !r.is_enabled }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["message-trigger-rules"] });
  };

  const remove = async (r: Rule) => {
    if (!confirm(`Excluir a regra "${r.name}"?`)) return;
    await supabase.from("message_trigger_rules" as any).delete().eq("id", r.id);
    toast.success("Regra removida");
    qc.invalidateQueries({ queryKey: ["message-trigger-rules"] });
  };

  const toggleSector = (sid: string) => {
    const cur = new Set(draft.alert_target_sector_ids);
    if (cur.has(sid)) cur.delete(sid); else cur.add(sid);
    setDraft({ ...draft, alert_target_sector_ids: Array.from(cur) });
  };
  const toggleUser = (uid: string) => {
    const cur = new Set(draft.alert_target_user_ids);
    if (cur.has(uid)) cur.delete(uid); else cur.add(uid);
    setDraft({ ...draft, alert_target_user_ids: Array.from(cur) });
  };

  const actionLabel = useMemo(() => ({
    floating_alert: "Balão flutuante",
    transfer_sector: "Transferir setor",
    both: "Alerta + transferência",
  }), []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-amber-500" /> Gatilhos por palavra-chave
          </CardTitle>
          <CardDescription>
            Detecta termos em mensagens recebidas (ex.: "Ignição ligado", "Urgente", "Recorrente") e
            dispara balão flutuante e/ou transferência automática para um setor.
          </CardDescription>
        </div>
        <Button size="sm" onClick={startNew} className="gap-1">
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma regra configurada.
          </p>
        )}
        {rules.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{r.name}</span>
                <Badge variant={r.is_enabled ? "default" : "outline"} className="text-xs">
                  {r.is_enabled ? "Ativa" : "Inativa"}
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  {r.action_type === "transfer_sector" ? <ArrowRightLeft className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                  {actionLabel[r.action_type]}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                {(r.keywords || []).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5">
                    <Tag className="h-3 w-3" /> {k}
                  </span>
                ))}
              </div>
              {(r.action_type !== "floating_alert") && r.transfer_sector_name && (
                <div className="text-xs text-muted-foreground">
                  Transferir → <strong>{r.transfer_sector_name}</strong>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={r.is_enabled} onCheckedChange={() => toggle(r)} />
              <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar regra" : "Nova regra de gatilho"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Urgência veicular" />
              </div>
              <div>
                <Label>Tipo de match</Label>
                <Select value={draft.match_type} onValueChange={(v: any) => setDraft({ ...draft, match_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer palavra (OU)</SelectItem>
                    <SelectItem value="all">Todas as palavras (E)</SelectItem>
                    <SelectItem value="regex">Expressão regular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={draft.case_sensitive} onCheckedChange={(v) => setDraft({ ...draft, case_sensitive: v })} />
                <Label>Diferenciar maiúsculas</Label>
              </div>
            </div>

            <div>
              <Label>Palavras-chave / expressões</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="Digite e pressione Enter"
                />
                <Button type="button" onClick={addKeyword} variant="outline">Adicionar</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {draft.keywords.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs hover:bg-destructive/20"
                  >
                    {k} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label>Ação</Label>
              <Select value={draft.action_type} onValueChange={(v: any) => setDraft({ ...draft, action_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="floating_alert">Balão flutuante (alerta visual)</SelectItem>
                  <SelectItem value="transfer_sector">Transferir para setor</SelectItem>
                  <SelectItem value="both">Alerta + transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(draft.action_type === "floating_alert" || draft.action_type === "both") && (
              <div className="space-y-3 rounded border p-3 bg-muted/30">
                <div className="font-medium text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Alerta flutuante</div>
                <div>
                  <Label>Mensagem do balão</Label>
                  <Input value={draft.alert_message} onChange={(e) => setDraft({ ...draft, alert_message: e.target.value })} />
                </div>
                <div>
                  <Label>Destinatários</Label>
                  <Select value={draft.alert_target_type} onValueChange={(v: any) => setDraft({ ...draft, alert_target_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assigned">Apenas operador atribuído</SelectItem>
                      <SelectItem value="all">Todos os usuários</SelectItem>
                      <SelectItem value="sector">Setores específicos</SelectItem>
                      <SelectItem value="users">Usuários específicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.alert_target_type === "sector" && (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2">
                    {(sectors as any[]).map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={draft.alert_target_sector_ids.includes(s.id)}
                          onCheckedChange={() => toggleSector(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}
                {draft.alert_target_type === "users" && (
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2">
                    {(users as any[]).map((u) => (
                      <label key={u.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={draft.alert_target_user_ids.includes(u.user_id)}
                          onCheckedChange={() => toggleUser(u.user_id)}
                        />
                        {u.name || u.user_id}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={draft.sound_enabled} onCheckedChange={(v) => setDraft({ ...draft, sound_enabled: v })} />
                  <Label>Tocar som ao disparar</Label>
                </div>
              </div>
            )}

            {(draft.action_type === "transfer_sector" || draft.action_type === "both") && (
              <div className="space-y-3 rounded border p-3 bg-muted/30">
                <div className="font-medium text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Transferência automática</div>
                <div>
                  <Label>Setor destino</Label>
                  <Select
                    value={draft.transfer_sector_id || ""}
                    onValueChange={(v) => {
                      const s = (sectors as any[]).find((x) => x.id === v);
                      setDraft({ ...draft, transfer_sector_id: v, transfer_sector_name: s?.name || null });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(sectors as any[]).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observação (registrada no histórico)</Label>
                  <Textarea
                    rows={2}
                    value={draft.transfer_note}
                    onChange={(e) => setDraft({ ...draft, transfer_note: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cooldown (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.cooldown_minutes}
                  onChange={(e) => setDraft({ ...draft, cooldown_minutes: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={draft.is_enabled} onCheckedChange={(v) => setDraft({ ...draft, is_enabled: v })} />
              <Label>Regra ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar regra"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// X import shim (used inside the chip remove button)
function X({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

