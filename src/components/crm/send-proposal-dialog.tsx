import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, Loader2, Copy, MessageCircle, Mail, Eye, Ban, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { sendProposalToClient, cancelProposalLink } from "@/lib/crm-proposal.functions";
import { brl, buildProposalUrl, hasPhoneDigits, isProposalExpired, isValidEmail, type ProposalStatus } from "@/lib/crm-proposal";

export type ProposalLinkRow = {
  id: string;
  token: string;
  opportunity_id: string;
  status: ProposalStatus;
  expires_at: string | null;
  first_viewed_at: string | null;
  view_count: number;
  responded_at: string | null;
  responder_name: string | null;
  responder_note: string | null;
  sent_channels: string[];
  send_errors: Record<string, string> | null;
  snapshot: any;
  created_at: string;
};

export function ProposalStatusBadge({ link }: { link: Pick<ProposalLinkRow, "status" | "expires_at" | "first_viewed_at"> }) {
  if (link.status === "accepted") return <Badge className="text-[9px] bg-primary text-primary-foreground">Proposta aceita</Badge>;
  if (link.status === "rejected") return <Badge variant="destructive" className="text-[9px]">Proposta recusada</Badge>;
  if (link.status === "cancelled") return <Badge variant="outline" className="text-[9px]">Link cancelado</Badge>;
  if (isProposalExpired(link.expires_at)) return <Badge variant="outline" className="text-[9px]">Proposta vencida</Badge>;
  if (link.first_viewed_at) return <Badge variant="secondary" className="text-[9px]">Proposta visualizada</Badge>;
  return <Badge variant="secondary" className="text-[9px]">Proposta enviada</Badge>;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  opportunity,
  quote,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  opportunity: { id: string; title: string; contact_phone?: string | null; contact_email?: string | null } | null;
  quote?: { id: string; quote_number: number } | null;
}) {
  const qc = useQueryClient();
  const send = useServerFn(sendProposalToClient);
  const cancel = useServerFn(cancelProposalLink);
  const [useWhats, setUseWhats] = useState(true);
  const [useEmail, setUseEmail] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !opportunity) return;
    setPhone(opportunity.contact_phone || "");
    setEmail(opportunity.contact_email || "");
    setUseWhats(!!opportunity.contact_phone || !opportunity.contact_email);
    setUseEmail(!!opportunity.contact_email);
    setLastUrl(null);
  }, [open, opportunity]);

  const { data: baseUrl = "" } = useQuery({
    queryKey: ["crm-proposal-base-url"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("crm_proposal_settings").select("public_base_url").eq("id", "default").maybeSingle();
      return (data?.public_base_url as string) || window.location.origin;
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["crm-proposal-links", opportunity?.id],
    enabled: open && !!opportunity?.id,
    refetchInterval: open ? 15_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_proposal_links")
        .select("*")
        .eq("opportunity_id", opportunity!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProposalLinkRow[];
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!opportunity) throw new Error("Oportunidade não selecionada");
      if (!useWhats && !useEmail) throw new Error("Escolha WhatsApp e/ou e-mail");
      if (useWhats && !hasPhoneDigits(phone)) throw new Error("Informe um WhatsApp válido com DDD");
      if (useEmail && !isValidEmail(email)) throw new Error("Informe um e-mail válido");
      return send({
        data: {
          opportunityId: opportunity.id,
          quoteId: quote?.id ?? null,
          sendWhatsapp: useWhats,
          sendEmail: useEmail,
          phone: useWhats ? phone : null,
          email: useEmail ? email : null,
        },
      });
    },
    onSuccess: (res) => {
      setLastUrl(res.url);
      const parts: string[] = [];
      if (res.results.whatsapp) parts.push(res.results.whatsapp.ok ? "WhatsApp enviado" : `WhatsApp falhou: ${res.results.whatsapp.error}`);
      if (res.results.email) parts.push(res.results.email.ok ? "E-mail enviado" : `E-mail falhou: ${res.results.email.error}`);
      const anyFail = Object.values(res.results).some((r) => r && !r.ok);
      (anyFail ? toast.warning : toast.success)(parts.join(" · ") || "Link criado");
      qc.invalidateQueries({ queryKey: ["crm-proposal-links"] });
      qc.invalidateQueries({ queryKey: ["crm-proposal-links-all"] });
      qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar a proposta"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Link cancelado");
      qc.invalidateQueries({ queryKey: ["crm-proposal-links"] });
      qc.invalidateQueries({ queryKey: ["crm-proposal-links-all"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao cancelar"),
  });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Enviar proposta ao cliente</DialogTitle>
          <DialogDescription>
            {opportunity?.title}
            {quote ? ` · versão #${quote.quote_number}` : " · itens salvos da oportunidade"}. O cliente recebe um link para ver os itens e aceitar ou recusar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={useWhats} onCheckedChange={(v) => setUseWhats(!!v)} />
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </label>
            {useWhats && (
              <div>
                <Label className="text-xs">WhatsApp do cliente</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(31) 99999-9999" />
              </div>
            )}
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox checked={useEmail} onCheckedChange={(v) => setUseEmail(!!v)} />
              <Mail className="h-4 w-4" /> Enviar por e-mail
            </label>
            {useEmail && (
              <div>
                <Label className="text-xs">E-mail do cliente</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@empresa.com.br" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            O texto das mensagens, a validade e os dados da empresa são definidos em Configurações › CRM.
          </p>

          <Button className="w-full" onClick={() => sendMut.mutate()} disabled={sendMut.isPending || (!useWhats && !useEmail)}>
            {sendMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar proposta
          </Button>

          {lastUrl && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
              <Input readOnly value={lastUrl} className="h-8 text-xs" />
              <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copy(lastUrl)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          )}

          <div className="pt-2 space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Links enviados</Label>
            {links.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma proposta enviada ainda.</p>
            ) : (
              links.map((l) => {
                const url = buildProposalUrl(baseUrl || window.location.origin, l.token);
                const errs = Object.entries(l.send_errors || {});
                return (
                  <div key={l.id} className="rounded-md border p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ProposalStatusBadge link={l} />
                        {l.snapshot?.quoteNumber && <Badge variant="outline" className="text-[9px]">#{l.snapshot.quoteNumber}</Badge>}
                        {l.sent_channels.map((c) => (
                          <Badge key={c} variant="outline" className="text-[9px]">{c === "whatsapp" ? "WhatsApp" : "E-mail"}</Badge>
                        ))}
                      </div>
                      <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span>
                        Mensal {brl(l.snapshot?.totals?.monthly || 0)} · Ativação {brl(l.snapshot?.totals?.activation || 0)}
                        {l.view_count > 0 && <> · <Eye className="inline h-3 w-3" /> {l.view_count}x</>}
                      </span>
                      <span className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Copiar link" onClick={() => copy(url)}><Copy className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Abrir" asChild>
                          <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                        </Button>
                        {l.status === "pending" && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Cancelar link" disabled={cancelMut.isPending}
                            onClick={() => { if (confirm("Cancelar este link? O cliente não poderá mais responder.")) cancelMut.mutate(l.id); }}>
                            <Ban className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </span>
                    </div>
                    {l.responder_name && (
                      <p className="text-foreground">
                        {l.status === "accepted" ? "Aceita" : "Recusada"} por {l.responder_name}
                        {l.responded_at && ` em ${new Date(l.responded_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                        {l.responder_note && ` — "${l.responder_note}"`}
                      </p>
                    )}
                    {errs.map(([k, v]) => (
                      <p key={k} className="text-destructive">{k === "whatsapp" ? "WhatsApp" : "E-mail"}: {v}</p>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
