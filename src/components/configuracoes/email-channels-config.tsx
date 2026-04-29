import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw, Trash2, Plus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listEmailChannels,
  upsertEmailChannel,
  deleteEmailChannel,
  checkOutlookConnection,
} from "@/lib/email-channels.functions";

interface ChannelForm {
  id?: string;
  name: string;
  email_address: string;
  is_active: boolean;
  polling_enabled: boolean;
  default_sector: string;
  default_priority: "baixa" | "media" | "alta" | "urgente";
  ignore_domains: string;
  ignore_emails: string;
  mark_as_read: boolean;
}

const emptyForm: ChannelForm = {
  name: "",
  email_address: "",
  is_active: true,
  polling_enabled: true,
  default_sector: "",
  default_priority: "media",
  ignore_domains: "",
  ignore_emails: "",
  mark_as_read: true,
};

export function EmailChannelsConfig() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ChannelForm | null>(null);
  const [polling, setPolling] = useState<string | null>(null);

  const conn = useQuery({
    queryKey: ["outlook-connection"],
    queryFn: () => checkOutlookConnection(),
  });

  const channels = useQuery({
    queryKey: ["email-channels"],
    queryFn: () => listEmailChannels(),
  });

  const save = useMutation({
    mutationFn: (form: ChannelForm) =>
      upsertEmailChannel({
        data: {
          id: form.id,
          name: form.name.trim(),
          email_address: form.email_address.trim(),
          is_active: form.is_active,
          polling_enabled: form.polling_enabled,
          default_sector: form.default_sector.trim() || null,
          default_priority: form.default_priority,
          ignore_domains: form.ignore_domains.split(",").map(s => s.trim()).filter(Boolean),
          ignore_emails: form.ignore_emails.split(",").map(s => s.trim()).filter(Boolean),
          mark_as_read: form.mark_as_read,
        },
      }),
    onSuccess: () => {
      toast.success("Canal de e-mail salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["email-channels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteEmailChannel({ data: { id } }),
    onSuccess: () => {
      toast.success("Canal removido");
      qc.invalidateQueries({ queryKey: ["email-channels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  async function pollNow(channelId: string) {
    setPolling(channelId);
    try {
      const res = await fetch(`/api/public/email-poll?channelId=${channelId}`, { method: "POST" });
      const data = await res.json();
      if (data?.success) {
        const r = data.results?.[0];
        toast.success(`Verificação concluída: ${r?.created_tickets ?? 0} novo(s) atendimento(s)`);
        qc.invalidateQueries({ queryKey: ["email-channels"] });
      } else {
        toast.error(data?.error || "Falha ao verificar");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao verificar");
    } finally {
      setPolling(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> E-mail Office 365 → Atendimentos automáticos
        </CardTitle>
        <CardDescription>
          A cada novo e-mail recebido na caixa configurada, um atendimento é aberto automaticamente na fila.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status conexão Outlook */}
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          {conn.isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão...</>
          ) : conn.data?.connected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-medium">Outlook conectado</div>
                <div className="text-xs text-muted-foreground">
                  {conn.data.name ? `${conn.data.name} • ` : ""}{conn.data.email}
                </div>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <div className="text-sm font-medium">Outlook não conectado</div>
                <div className="text-xs text-muted-foreground">
                  {conn.data?.error || "Configure o conector Microsoft Outlook nas integrações Lovable."}
                </div>
              </div>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => conn.refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Lista de canais */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Caixas de e-mail configuradas</h3>
            <Button size="sm" onClick={() => setEditing(emptyForm)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar caixa
            </Button>
          </div>
          {channels.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : !channels.data?.channels?.length ? (
            <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
              Nenhuma caixa configurada. Adicione uma para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {channels.data.channels.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.is_active ? <Badge variant="default" className="text-xs">Ativo</Badge> : <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                      {c.polling_enabled && <Badge variant="outline" className="text-xs">Auto</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.email_address}
                      {c.default_sector ? ` • Setor: ${c.default_sector}` : ""}
                      {c.last_polled_at ? ` • Última verificação: ${new Date(c.last_polled_at).toLocaleString("pt-BR")}` : " • Nunca verificado"}
                    </div>
                    {c.last_poll_error && <div className="text-xs text-destructive truncate">⚠ {c.last_poll_error}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => pollNow(c.id)} disabled={polling === c.id}>
                    {polling === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing({
                    id: c.id, name: c.name, email_address: c.email_address,
                    is_active: c.is_active, polling_enabled: c.polling_enabled,
                    default_sector: c.default_sector || "", default_priority: c.default_priority,
                    ignore_domains: (c.ignore_domains || []).join(", "),
                    ignore_emails: (c.ignore_emails || []).join(", "),
                    mark_as_read: c.mark_as_read,
                  })}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (confirm(`Remover canal "${c.name}"?`)) del.mutate(c.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário */}
        {editing && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
            <h4 className="font-semibold text-sm">{editing.id ? "Editar caixa" : "Nova caixa de e-mail"}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Atendimento" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={editing.email_address} onChange={(e) => setEditing({ ...editing, email_address: e.target.value })} placeholder="atendimento@empresa.com" />
              </div>
              <div>
                <Label>Setor padrão</Label>
                <Input value={editing.default_sector} onChange={(e) => setEditing({ ...editing, default_sector: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <Label>Prioridade padrão</Label>
                <Select value={editing.default_priority} onValueChange={(v: any) => setEditing({ ...editing, default_priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Ignorar domínios (separados por vírgula)</Label>
                <Input value={editing.ignore_domains} onChange={(e) => setEditing({ ...editing, ignore_domains: e.target.value })} placeholder="newsletter.com, noreply.com" />
              </div>
              <div className="md:col-span-2">
                <Label>Ignorar e-mails específicos (separados por vírgula)</Label>
                <Input value={editing.ignore_emails} onChange={(e) => setEditing({ ...editing, ignore_emails: e.target.value })} placeholder="naoresponder@x.com" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.polling_enabled} onCheckedChange={(v) => setEditing({ ...editing, polling_enabled: v })} />
                <Label>Verificação automática</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.mark_as_read} onCheckedChange={(v) => setEditing({ ...editing, mark_as_read: v })} />
                <Label>Marcar como lido após processar</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.name || !editing.email_address}>
                {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
