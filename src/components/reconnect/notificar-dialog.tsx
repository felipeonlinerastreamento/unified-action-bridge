import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { enviarNotificacaoReconnect } from "@/lib/reconnect.functions";
import { buildNotificationMessage, extrairPlaca, type VehicleRow } from "@/lib/reconnect";
import { destinosCliente, useRcInvalidate, type RcClient, type RcTemplate } from "./use-rc";

export function NotificarDialog({ client, vehicles, templates, onClose }: { client: RcClient | null; vehicles: VehicleRow[]; templates: RcTemplate[]; onClose: () => void }) {
  const enviar = useServerFn(enviarNotificacaoReconnect);
  const invalidate = useRcInvalidate();
  const [plates, setPlates] = useState<string[]>([]);
  const [tplId, setTplId] = useState("");
  const [canais, setCanais] = useState<("whatsapp" | "email")[]>([]);
  const [busy, setBusy] = useState(false);
  const usaveis = templates.filter((t) => !t.is_closing_template);

  useEffect(() => {
    if (!client) return;
    setPlates(vehicles.map((v) => v.plate));
    setTplId(usaveis[0]?.id ?? "");
    const c: ("whatsapp" | "email")[] = [];
    const d = destinosCliente(client);
    if (d.phones.length) c.push("whatsapp");
    if (d.emails.length) c.push("email");
    setCanais(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  if (!client) return null;
  const tpl = templates.find((t) => t.id === tplId);
  const dest = destinosCliente(client);
  const toggle = (c: "whatsapp" | "email") => setCanais((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  const submit = async () => {
    setBusy(true);
    try {
      const r: any = await enviar({ data: { clientId: client.id, plates, templateId: tplId, channels: canais } });
      const partes = [r.whatsapp && (r.whatsapp.ok ? `WhatsApp: ${r.whatsapp.enviados}` : `WhatsApp falhou: ${r.whatsapp.erro}`), r.email && (r.email.ok ? "E-mail enviado" : `E-mail falhou: ${r.email.erro}`)].filter(Boolean);
      (r.channels?.length ? toast.success : toast.error)(partes.join(" · ") || "Nada enviado.");
      invalidate();
      if (r.channels?.length) onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Notificar {client.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">Placas ({plates.length}/{vehicles.length})</Label>
            <div className="max-h-36 overflow-y-auto rounded border p-2 grid grid-cols-3 gap-1">
              {vehicles.map((v) => (
                <label key={v.id} className="flex items-center gap-1 text-xs">
                  <Checkbox checked={plates.includes(v.plate)} onCheckedChange={(c) => setPlates((p) => (c ? [...p, v.plate] : p.filter((x) => x !== v.plate)))} />
                  <span className="font-mono">{v.plate}</span><span className="text-muted-foreground">{v.days_offline}d</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Modelo de mensagem</Label>
            <Select value={tplId} onValueChange={setTplId}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Escolha um modelo" /></SelectTrigger>
              <SelectContent>{usaveis.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2"><Checkbox checked={canais.includes("whatsapp")} onCheckedChange={() => toggle("whatsapp")} disabled={!dest.phones.length} /><MessageCircle className="h-4 w-4" /> WhatsApp ({dest.phones.length})</label>
            <label className="flex items-center gap-2"><Checkbox checked={canais.includes("email")} onCheckedChange={() => toggle("email")} disabled={!dest.emails.length} /><Mail className="h-4 w-4" /> E-mail ({dest.emails.length})</label>
          </div>
          {(dest.phones.length > 0 || dest.emails.length > 0) && (
            <p className="text-[11px] text-muted-foreground">Vai para: {[...dest.phones, ...dest.emails].join(", ")}{client.empresa_nomes?.length ? ` (contatos da empresa: ${client.empresa_nomes.join(", ")})` : ""}</p>
          )}
          {tpl && <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs max-h-40 overflow-y-auto">{buildNotificationMessage(tpl.body, client.name, [...new Set(plates.map((p) => extrairPlaca(p) || p))])}</pre>}
          {!dest.phones.length && !dest.emails.length && (
            <p className="text-xs text-amber-600">{client.company_id
              ? "A empresa não tem contato marcado \"Veículo sem comunicação\". Marque em Empresas › Contatos."
              : "Cliente sem empresa ligada. Ligue em Reconnect › Configurações › Contatos das notificações."}</p>
          )}
          <p className="text-[11px] text-muted-foreground">Os destinos são os contatos da empresa marcados "Veículo sem comunicação" (Empresas › Contatos). O WhatsApp sai pelo canal da Central (as respostas do cliente chegam lá) e o e-mail pela caixa cadastrada no Gestão Online.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !plates.length || !tplId || !canais.length}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
