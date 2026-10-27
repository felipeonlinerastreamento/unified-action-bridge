import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

const db = supabase as any;
type S = {
  enabled: boolean; on_created: boolean; on_reassigned: boolean; on_email: boolean;
  sound_enabled: boolean; scope: string; user_ids: string[];
};

export function TicketAssignmentAlertConfig() {
  const [s, setS] = useState<S | null>(null);
  const [users, setUsers] = useState<{ user_id: string; name: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.from("ticket_assignment_alert_settings").select("*").eq("id", 1).maybeSingle()
      .then(({ data }: any) => setS(data ?? { enabled: true, on_created: true, on_reassigned: true, on_email: true, sound_enabled: true, scope: "all", user_ids: [] }));
    db.from("profiles").select("user_id,name,is_active").order("name")
      .then(({ data }: any) => setUsers((data || []).filter((u: any) => u.is_active !== false)));
  }, []);

  if (!s) return null;
  const set = (p: Partial<S>) => setS({ ...s, ...p });

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("ticket_assignment_alert_settings")
      .upsert({ id: 1, ...s, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error("Sem permissão ou falha ao salvar: " + error.message);
    else toast.success("Alertas de atribuição salvos");
  };

  const row = (label: string, desc: string, v: boolean, on: (b: boolean) => void) => (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div><Label className="text-sm">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={v} onCheckedChange={on} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><BellRing className="h-4 w-4" /> Alertas de Atribuição de Chamados</CardTitle>
        <p className="text-xs text-muted-foreground">Pop-up que bloqueia a tela do atendente até ele clicar em OK. Registrado em Relatórios › Gatilhos.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {row("Ativar alertas", "Liga ou desliga todos os alertas de atribuição.", s.enabled, (b) => set({ enabled: b }))}
        <div className={s.enabled ? "space-y-3" : "space-y-3 opacity-50 pointer-events-none"}>
          {row("Chamado criado para o atendente", "Quando alguém abre um chamado já atribuído a ele.", s.on_created, (b) => set({ on_created: b }))}
          {row("Chamado transferido / reatribuído", "Quando alguém associa o atendente a um chamado existente.", s.on_reassigned, (b) => set({ on_reassigned: b }))}
          {row("Chamado vindo de e-mail", "Quando um e-mail do suporte é distribuído ao atendente.", s.on_email, (b) => set({ on_email: b }))}
          {row("Alerta sonoro", "Toca um aviso quando o pop-up aparece.", s.sound_enabled, (b) => set({ sound_enabled: b }))}
          <div className="space-y-2">
            <Label>Quem recebe</Label>
            <Select value={s.scope} onValueChange={(v) => set({ scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os atendentes</SelectItem>
                <SelectItem value="selected">Somente os selecionados</SelectItem>
              </SelectContent>
            </Select>
            {s.scope === "selected" && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 max-h-56 overflow-auto">
                {users.map((u) => (
                  <label key={u.user_id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={s.user_ids.includes(u.user_id)}
                      onCheckedChange={(c) => set({ user_ids: c ? [...s.user_ids, u.user_id] : s.user_ids.filter((x) => x !== u.user_id) })}
                    />
                    {u.name || u.user_id.slice(0, 8)}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="w-full">{saving ? "Salvando..." : "Salvar"}</Button>
      </CardContent>
    </Card>
  );
}
