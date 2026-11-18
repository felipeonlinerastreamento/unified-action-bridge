import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, Send, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createTechnicalTerm } from "@/lib/technical-terms.functions";
import {
  SERVICE_TYPE_LABELS,
  missingChecklistItems,
  normalizeChecklistConfig,
  type TechnicalServiceType,
} from "@/lib/technical-terms";

export type TermTicketPrefill = {
  id: string;
  companyId?: string | null;
  clientName?: string | null;
  plate?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allowedTypes?: TechnicalServiceType[];
  ticket?: TermTicketPrefill | null;
  onCreated?: () => void;
}

const ALL: TechnicalServiceType[] = ["instalacao", "manutencao", "retirada"];

export function TechnicalTermDialog({ open, onOpenChange, allowedTypes = ALL, ticket, onCreated }: Props) {
  const qc = useQueryClient();
  const create = useServerFn(createTechnicalTerm);
  const [type, setType] = useState<TechnicalServiceType>(allowedTypes[0]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [plate, setPlate] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [address, setAddress] = useState("");
  const [respName, setRespName] = useState("");
  const [respPhone, setRespPhone] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [description, setDescription] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ url: string; sent: string[]; errors: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(allowedTypes[0]);
    setCompanyId(ticket?.companyId ?? null);
    setClientName(ticket?.clientName ?? "");
    setCompanySearch("");
    setPlate(ticket?.plate ?? "");
    setEquipmentId("");
    setAddress("");
    setRespName(ticket?.contactName ?? "");
    setRespPhone(ticket?.contactPhone ?? "");
    setRespEmail(ticket?.contactEmail ?? "");
    setDescription("");
    setChecked({});
    setSendWhatsapp(true);
    setSendEmail(false);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: settings } = useQuery({
    queryKey: ["technical-term-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("technical_term_settings").select("*").eq("id", "default").maybeSingle();
      return (data as any) || null;
    },
    enabled: open,
  });
  const required = useMemo(() => normalizeChecklistConfig(settings?.[`${type}_checklist`], type), [settings, type]);
  useEffect(() => setChecked({}), [type]);

  const { data: companies = [] } = useQuery({
    queryKey: ["term-company-search", companySearch],
    enabled: open && companySearch.trim().length >= 3,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name, cnpj").ilike("name", `%${companySearch.trim()}%`).order("name").limit(8);
      return data || [];
    },
  });

  const submit = async () => {
    const checklist = required.map((label) => ({ label, checked: !!checked[label] }));
    const missing = missingChecklistItems(required, checklist);
    if (missing.length) return toast.error(`Marque o checklist: ${missing.join(", ")}`);
    if (respName.trim().length < 2) return toast.error("Informe o responsável pela frota");
    if (type === "retirada" && !equipmentId.trim()) return toast.error("Informe o ID do equipamento");
    if (!sendWhatsapp && !sendEmail) return toast.error("Escolha WhatsApp e/ou e-mail");
    setSending(true);
    try {
      const r = await create({
        data: {
          serviceType: type,
          ticketId: ticket?.id ?? null,
          companyId,
          clientName: clientName.trim(),
          plate: plate.trim(),
          equipmentId: equipmentId.trim(),
          address: address.trim(),
          responsibleName: respName.trim(),
          responsiblePhone: respPhone.trim(),
          responsibleEmail: respEmail.trim(),
          description: description.trim(),
          checklist,
          sendWhatsapp,
          sendEmail,
        },
      });
      setResult(r);
      if (r.sent.length) toast.success("Termo enviado para aceite");
      else toast.warning("Termo criado, mas o envio falhou. Copie o link e envie manualmente.");
      qc.invalidateQueries({ queryKey: ["technical-terms"] });
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar o termo");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termo de serviço técnico</DialogTitle>
          <DialogDescription>O responsável pela frota recebe o link, informa o CPF e aceita ou recusa. Só depois do aceite a solicitação é liberada na Agenda.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Termo criado e aguardando aceite.</p>
                {result.sent.length > 0 && <p className="text-muted-foreground">Enviado por {result.sent.map((c) => (c === "whatsapp" ? "WhatsApp" : "e-mail")).join(" e ")}.</p>}
                {Object.entries(result.errors).map(([k, v]) => (
                  <p key={k} className="text-destructive">{k === "whatsapp" ? "WhatsApp" : "E-mail"}: {v}</p>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={result.url} />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(result.url); toast.success("Link copiado"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end"><Button onClick={() => onOpenChange(false)}>Fechar</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de serviço *</Label>
                <Select value={type} onValueChange={(v) => setType(v as TechnicalServiceType)} disabled={allowedTypes.length === 1}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map((t) => <SelectItem key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                {clientName ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 h-9 text-sm">
                    <span className="flex-1 truncate">{clientName}</span>
                    <button type="button" aria-label="Trocar cliente" onClick={() => { setClientName(""); setCompanyId(null); }}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input placeholder="Buscar empresa (3 letras)" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} />
                    {companies.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                        {companies.map((c: any) => (
                          <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => { setCompanyId(c.id); setClientName(c.name); setCompanySearch(""); }}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {companySearch.trim().length >= 3 && companies.length === 0 && (
                      <button type="button" className="text-xs underline text-muted-foreground mt-1" onClick={() => { setClientName(companySearch.trim()); setCompanySearch(""); }}>
                        Usar "{companySearch.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5"><Label>Placa</Label><Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} maxLength={10} placeholder="ABC1D23" /></div>
              <div className="space-y-1.5">
                <Label>ID do equipamento {type === "retirada" && "*"}</Label>
                <Input value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Endereço do serviço</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} placeholder="Rua, número, bairro, cidade - UF" /></div>
            </div>

            {required.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Checklist de {SERVICE_TYPE_LABELS[type]} (obrigatório)</p>
                {required.map((label) => (
                  <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={!!checked[label]} onCheckedChange={(v) => setChecked((c) => ({ ...c, [label]: v === true }))} />
                    {label}
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Responsável pela frota</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Nome *</Label><Input value={respName} onChange={(e) => setRespName(e.target.value)} maxLength={200} /></div>
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={respPhone} onChange={(e) => setRespPhone(e.target.value)} maxLength={40} placeholder="31 99999-9999" /></div>
                <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} maxLength={200} /></div>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Observações para o termo</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} /></div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={sendWhatsapp} onCheckedChange={(v) => setSendWhatsapp(v === true)} /> Enviar por WhatsApp</label>
              <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} /> Enviar por e-mail</label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Enviar para aceite
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
