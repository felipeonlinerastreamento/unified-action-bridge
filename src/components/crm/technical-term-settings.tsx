import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { SERVICE_TYPE_LABELS, normalizeChecklistConfig, type TechnicalServiceType } from "@/lib/technical-terms";

const TYPES: TechnicalServiceType[] = ["instalacao", "manutencao", "retirada"];
const HINTS: Record<TechnicalServiceType, string> = {
  instalacao: "Instalação: só comunicado e aceite. Deixe o checklist vazio se não precisar.",
  manutencao: "Manutenção: o atendente precisa marcar todos os itens antes de enviar o termo.",
  retirada: "Retirada: o atendente precisa marcar todos os itens e informar o ID do equipamento.",
};

type Form = Record<string, any>;

export function TechnicalTermSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: loaded } = useQuery({
    queryKey: ["technical-term-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technical_term_settings").select("*").eq("id", "default").maybeSingle();
      if (error) throw error;
      if (data) return data as Form;
      const { data: created, error: insErr } = await supabase.from("technical_term_settings").insert({ id: "default" }).select("*").single();
      if (insErr) throw insErr;
      return created as Form;
    },
  });
  useEffect(() => {
    if (loaded && !form) {
      const f: Form = { ...loaded };
      for (const t of TYPES) f[`${t}_checklist_text`] = normalizeChecklistConfig(loaded[`${t}_checklist`], t).join("\n");
      setForm(f);
    }
  }, [loaded, form]);

  if (!form) return <Loader2 className="h-5 w-5 animate-spin" />;
  const set = (k: string, v: unknown) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const text = (k: string) => ({ value: form[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value) });

  const save = async () => {
    for (const t of TYPES) {
      if (!String(form[`${t}_title`] || "").trim() || !String(form[`${t}_text`] || "").trim()) {
        return toast.error(`Preencha título e texto do termo de ${SERVICE_TYPE_LABELS[t]}`);
      }
    }
    if (!String(form.whatsapp_template).includes("{link}")) return toast.error("A mensagem de WhatsApp precisa ter o marcador {link}");
    if (!String(form.email_template).includes("{link}")) return toast.error("O texto do e-mail precisa ter o marcador {link}");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: Form = {
      whatsapp_template: form.whatsapp_template,
      email_subject: form.email_subject,
      email_template: form.email_template,
      require_reject_reason: !!form.require_reject_reason,
      notify_creator: !!form.notify_creator,
      updated_by: u.user?.id ?? null,
    };
    for (const t of TYPES) {
      payload[`${t}_title`] = form[`${t}_title`];
      payload[`${t}_text`] = form[`${t}_text`];
      payload[`${t}_checklist`] = String(form[`${t}_checklist_text`] || "").split("\n").map((s) => s.trim()).filter(Boolean);
    }
    const { error } = await supabase.from("technical_term_settings").update(payload as any).eq("id", "default");
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Termos de serviço técnico salvos");
    qc.invalidateQueries({ queryKey: ["technical-term-settings"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Termos de serviço técnico</CardTitle>
        <CardDescription>
          Texto que o responsável pela frota aceita antes de liberar a solicitação na Agenda, e os itens que o atendente precisa conferir antes de enviar. Alterações valem para os próximos termos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs defaultValue="instalacao">
          <TabsList>
            {TYPES.map((t) => <TabsTrigger key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</TabsTrigger>)}
          </TabsList>
          {TYPES.map((t) => (
            <TabsContent key={t} value={t} className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">{HINTS[t]}</p>
              <div className="space-y-1.5"><Label>Título</Label><Input {...text(`${t}_title`)} maxLength={150} /></div>
              <div className="space-y-1.5"><Label>Texto do termo</Label><Textarea rows={6} {...text(`${t}_text`)} /></div>
              <div className="space-y-1.5">
                <Label>Checklist obrigatório do atendente (um item por linha)</Label>
                <Textarea rows={4} {...text(`${t}_checklist_text`)} placeholder="Sem checklist" />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Marcadores: {"{responsavel}"}, {"{cliente}"}, {"{placa}"}, {"{servico}"}, {"{numero}"}, {"{empresa}"}, {"{link}"}. O canal de WhatsApp, a caixa de e-mail, o logo e as cores são os mesmos da proposta (acima).
          </p>
          <div className="space-y-1.5"><Label>Mensagem de WhatsApp</Label><Textarea rows={3} {...text("whatsapp_template")} /></div>
          <div className="space-y-1.5"><Label>Assunto do e-mail</Label><Input {...text("email_subject")} /></div>
          <div className="space-y-1.5"><Label>Texto do e-mail</Label><Textarea rows={5} {...text("email_template")} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.require_reject_reason} onCheckedChange={(v) => set("require_reject_reason", v)} />
            Exigir motivo quando o responsável recusar
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.notify_creator} onCheckedChange={(v) => set("notify_creator", v)} />
            Avisar o atendente que enviou quando houver aceite ou recusa
          </label>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar termos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
