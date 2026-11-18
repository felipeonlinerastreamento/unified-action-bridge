import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Loader2, Save, Building2, FileText, Send, GitBranch, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listEmailChannels } from "@/lib/email-channels.functions";
import { PROPOSAL_PLACEHOLDERS } from "@/lib/crm-proposal";
import defaultLogo from "@/assets/logo-online-rastreamento.png";
import { TechnicalTermSettings } from "@/components/crm/technical-term-settings";

export const Route = createFileRoute("/configuracoes/crm")({
  head: () => ({
    meta: [
      { title: "Configurações do CRM — GSystem Hub" },
      { name: "description", content: "Parâmetros da proposta comercial enviada ao cliente por WhatsApp e e-mail." },
      { property: "og:title", content: "Configurações do CRM — GSystem Hub" },
      { property: "og:description", content: "Parâmetros da proposta comercial enviada ao cliente por WhatsApp e e-mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmConfigPage,
});

const NONE = "__none__";

type Settings = {
  company_name: string;
  company_cnpj: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  company_address: string;
  logo_url: string;
  primary_color: string;
  public_base_url: string;
  intro_text: string;
  terms_text: string;
  footer_text: string;
  validity_days: number;
  require_reject_reason: boolean;
  sent_stage_id: string | null;
  accepted_stage_id: string | null;
  rejected_stage_id: string | null;
  whatsapp_channel_id: string | null;
  email_channel_id: string | null;
  whatsapp_template: string;
  email_subject: string;
  email_template: string;
  notify_owner: boolean;
};

function CrmConfigPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  const canManage = hasRole("admin") || hasRole("gestor");
  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileSignature className="h-6 w-6" /> CRM — Proposta ao cliente</h1>
          <p className="text-sm text-muted-foreground">
            Defina como fica o documento da proposta, as mensagens de WhatsApp e e-mail e o que acontece no pipeline quando o cliente aceita ou recusa.
          </p>
        </div>
        {canManage ? <><ProposalSettingsForm /><TechnicalTermSettings /></> : (
          <Card><CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Apenas administradores e gestores podem alterar estes parâmetros.</CardContent></Card>
        )}
      </div>
    </AppLayout>
  );
}

function ProposalSettingsForm() {
  const qc = useQueryClient();
  const fetchEmailChannels = useServerFn(listEmailChannels);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: loaded } = useQuery({
    queryKey: ["crm-proposal-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_proposal_settings").select("*").eq("id", "default").maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as Settings;
      // Primeira vez: cria a linha com os valores padrão.
      const { data: created, error: insErr } = await supabase.from("crm_proposal_settings").insert({ id: "default" }).select("*").single();
      if (insErr) throw insErr;
      return created as unknown as Settings;
    },
  });
  useEffect(() => { if (loaded && !form) setForm(loaded); }, [loaded, form]);

  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_pipeline_stages").select("*").eq("is_active", true).order("position");
      return data || [];
    },
  });
  const { data: zapiChannels = [] } = useQuery({
    queryKey: ["channels-safe"],
    queryFn: async () => {
      const { data } = await supabase.rpc("list_channels_safe");
      return ((data as any[]) || []).filter((c) => c.is_active);
    },
  });
  const { data: emailChannels = [] } = useQuery({
    queryKey: ["email-channels-list"],
    queryFn: async () => (await fetchEmailChannels()).channels.filter((c: any) => c.is_active),
  });

  if (!form) return <Loader2 className="h-5 w-5 animate-spin" />;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const text = (k: keyof Settings) => ({
    value: (form[k] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as any),
  });

  const save = async () => {
    if (!form.company_name.trim()) return toast.error("Informe o nome da empresa");
    if (!/^https?:\/\/.+/i.test(form.public_base_url.trim())) return toast.error("O endereço do link deve começar com https://");
    if (!/^#[0-9a-f]{6}$/i.test(form.primary_color)) return toast.error("Cor inválida (use o formato #RRGGBB)");
    if (!form.whatsapp_template.includes("{link}")) return toast.error("A mensagem de WhatsApp precisa ter o marcador {link}");
    if (!form.email_template.includes("{link}")) return toast.error("O texto do e-mail precisa ter o marcador {link}");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, validity_days: Math.max(1, Math.min(365, Number(form.validity_days) || 15)), updated_by: u.user?.id ?? null };
    delete (payload as any).id;
    delete (payload as any).updated_at;
    const { error } = await supabase.from("crm_proposal_settings").update(payload as any).eq("id", "default");
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parâmetros da proposta salvos");
    qc.invalidateQueries({ queryKey: ["crm-proposal-settings"] });
    qc.invalidateQueries({ queryKey: ["crm-proposal-base-url"] });
  };

  const stageSelect = (k: "sent_stage_id" | "accepted_stage_id" | "rejected_stage_id", emptyLabel: string, filter?: (s: any) => boolean) => (
    <Select value={form[k] || NONE} onValueChange={(v) => set(k, v === NONE ? null : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {stages.filter(filter || (() => true)).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Dados da empresa no documento</CardTitle>
          <CardDescription>Aparecem no cabeçalho da proposta que o cliente abre.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Nome da empresa *</Label><Input {...text("company_name")} /></div>
          <div><Label>CNPJ</Label><Input {...text("company_cnpj")} /></div>
          <div><Label>Telefone</Label><Input {...text("company_phone")} /></div>
          <div><Label>E-mail</Label><Input {...text("company_email")} /></div>
          <div><Label>Site</Label><Input {...text("company_website")} /></div>
          <div><Label>Endereço</Label><Input {...text("company_address")} /></div>
          <div>
            <Label>Endereço da imagem do logotipo</Label>
            <Input {...text("logo_url")} placeholder="Em branco = logotipo padrão da Online Rastreamento" />
          </div>
          <div>
            <Label>Cor principal</Label>
            <div className="flex gap-2">
              <Input type="color" className="w-14 p-1" value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
              <Input {...text("primary_color")} />
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3 rounded-md border p-3" style={{ borderTop: `4px solid ${form.primary_color}` }}>
            <img src={form.logo_url || defaultLogo} alt="Logotipo" className="h-10 w-auto object-contain" />
            <span className="text-sm font-semibold">{form.company_name}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">Prévia do cabeçalho</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Conteúdo da proposta</CardTitle>
          <CardDescription>Os itens e valores vêm da oportunidade. Alterações aqui valem para as próximas propostas enviadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Texto de abertura</Label><Textarea rows={3} {...text("intro_text")} /></div>
          <div><Label>Condições comerciais</Label><Textarea rows={6} {...text("terms_text")} placeholder="Ex.: forma de pagamento, fidelidade, prazo de instalação, garantia..." /></div>
          <div><Label>Rodapé</Label><Textarea rows={2} {...text("footer_text")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Validade da proposta (dias)</Label>
              <Input type="number" min={1} max={365} value={form.validity_days} onChange={(e) => set("validity_days", Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Exigir motivo na recusa</Label>
                <p className="text-xs text-muted-foreground">O cliente precisa escrever por que recusou.</p>
              </div>
              <Switch checked={form.require_reject_reason} onCheckedChange={(v) => set("require_reject_reason", v)} />
            </div>
          </div>
          <div>
            <Label>Endereço do site usado no link</Label>
            <Input {...text("public_base_url")} />
            <p className="text-xs text-muted-foreground mt-1">O cliente recebe: {form.public_base_url.replace(/\/+$/, "")}/proposta/…</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Envio por WhatsApp e e-mail</CardTitle>
          <CardDescription>
            Marcadores disponíveis:{" "}
            {PROPOSAL_PLACEHOLDERS.map((p) => (
              <Badge key={p.key} variant="secondary" className="mr-1 mb-1 text-[10px] font-mono" title={p.label}>{p.key}</Badge>
            ))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Número de WhatsApp que envia</Label>
              <Select value={form.whatsapp_channel_id || NONE} onValueChange={(v) => set("whatsapp_channel_id", v === NONE ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Primeiro canal ativo</SelectItem>
                  {zapiChannels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Caixa de e-mail que envia</Label>
              <Select value={form.email_channel_id || NONE} onValueChange={(v) => set("email_channel_id", v === NONE ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Primeira caixa ativa</SelectItem>
                  {emailChannels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.email_address})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Mensagem de WhatsApp</Label><Textarea rows={4} {...text("whatsapp_template")} /></div>
          <div><Label>Assunto do e-mail</Label><Input {...text("email_subject")} /></div>
          <div>
            <Label>Texto do e-mail</Label>
            <Textarea rows={7} {...text("email_template")} />
            <p className="text-xs text-muted-foreground mt-1">O e-mail inclui também um botão "Ver proposta e responder" e a assinatura do usuário que enviou.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4" /> Pipeline</CardTitle>
          <CardDescription>Para onde a oportunidade vai em cada momento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Ao enviar a proposta</Label>
            {stageSelect("sent_stage_id", "Não mover", (s) => !s.is_won && !s.is_lost)}
          </div>
          <div>
            <Label>Quando o cliente aceitar</Label>
            {stageSelect("accepted_stage_id", "Etapa marcada como ganha")}
          </div>
          <div>
            <Label>Quando o cliente recusar</Label>
            {stageSelect("rejected_stage_id", "Etapa marcada como perdida")}
          </div>
          <div className="sm:col-span-3 flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Avisar o responsável</Label>
              <p className="text-xs text-muted-foreground">Envia uma notificação ao responsável pela oportunidade quando o cliente responder.</p>
            </div>
            <Switch checked={form.notify_owner} onCheckedChange={(v) => set("notify_owner", v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Salvar parâmetros
        </Button>
      </div>
    </div>
  );
}
