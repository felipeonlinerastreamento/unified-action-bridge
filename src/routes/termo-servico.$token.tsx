import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Loader2, Mail, MapPin, Phone, ShieldCheck, Truck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPublicTerm, respondToTerm, unlockPublicTerm } from "@/lib/technical-terms.functions";
import { formatCpf, formatDateBR, isValidCpf } from "@/lib/crm-proposal";
import defaultLogo from "@/assets/logo-online-rastreamento.png";

const termQuery = (token: string) =>
  queryOptions({
    queryKey: ["public-technical-term", token],
    queryFn: () => getPublicTerm({ data: { token } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/termo-servico/$token")({
  loader: ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.token)) return null;
    return context.queryClient.ensureQueryData(termQuery(params.token));
  },
  head: ({ loaderData }) => {
    const company = loaderData?.branding.companyName || "Online Rastreamento";
    const title = loaderData ? `Termo de ${loaderData.serviceLabel} — ${company}` : "Termo indisponível";
    const description = loaderData
      ? `Termo ${loaderData.number} de serviço técnico enviado por ${company}. Leia e registre seu aceite ou recusa.`
      : "Este link de termo não está disponível.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  component: PublicTermPage,
  errorComponent: () => <Unavailable text="Não foi possível carregar este termo. Tente novamente em instantes." />,
});

function Unavailable({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md text-center space-y-2">
        <Ban className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Termo indisponível</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function PublicTermPage() {
  const { token } = Route.useParams();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return <Unavailable text="Link inválido." />;
  return <TermView token={token} />;
}

type GateData = NonNullable<Awaited<ReturnType<typeof getPublicTerm>>>;
type TermData = Awaited<ReturnType<typeof unlockPublicTerm>>;
const cpfKey = (token: string) => `termo-cpf:${token}`;

function TermView({ token }: { token: string }) {
  const { data: gate } = useSuspenseQuery(termQuery(token));
  const unlock = useServerFn(unlockPublicTerm);
  const [cpf, setCpf] = useState<string | null>(null);
  const [data, setData] = useState<TermData | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = sessionStorage.getItem(cpfKey(token));
    if (!saved || !isValidCpf(saved)) { setChecking(false); return; }
    unlock({ data: { token, cpf: saved } })
      .then((d) => { setCpf(saved); setData(d); })
      .catch(() => sessionStorage.removeItem(cpfKey(token)))
      .finally(() => setChecking(false));
  }, [token, unlock]);

  if (!gate) return <Unavailable text="Este link não existe ou foi removido." />;
  if (gate.status === "cancelado") return <Unavailable text="Este termo foi cancelado pela empresa. Entre em contato se tiver dúvidas." />;

  if (!data || !cpf) {
    if (checking) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <CpfGate
        gate={gate}
        onUnlock={async (value) => {
          const d = await unlock({ data: { token, cpf: value } });
          sessionStorage.setItem(cpfKey(token), value);
          setCpf(value);
          setData(d);
        }}
      />
    );
  }
  return <UnlockedTerm token={token} cpf={cpf} data={data} onRefresh={async () => setData(await unlock({ data: { token, cpf } }))} />;
}

function CpfGate({ gate, onUnlock }: { gate: GateData; onUnlock: (cpf: string) => Promise<void> }) {
  const b = gate.branding;
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidCpf(value)) return setError("Informe um CPF válido.");
    setSending(true);
    try {
      await onUnlock(value);
    } catch (err: any) {
      setError(err?.message || "Não foi possível abrir o termo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4" style={{ "--brand": b.primaryColor } as React.CSSProperties}>
      <form onSubmit={submit} className="w-full max-w-sm bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden">
        <div style={{ borderTop: "6px solid var(--brand)" }} className="p-6 space-y-5">
          <img src={b.logoUrl || defaultLogo} alt={b.companyName} className="h-16 w-auto object-contain mx-auto" />
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Termo de {gate.serviceLabel} {gate.number}</h1>
            <p className="text-sm text-muted-foreground">Para sua segurança, informe seu CPF para abrir o termo.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gate-cpf">CPF *</Label>
            <Input id="gate-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={value}
              onChange={(e) => setValue(formatCpf(e.target.value))} maxLength={14} autoFocus />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full text-primary-foreground hover:opacity-90" style={{ background: "var(--brand)" }}
            disabled={sending || value.replace(/\D/g, "").length < 11}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            Abrir termo
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">{b.companyName}</p>
        </div>
      </form>
    </div>
  );
}

function UnlockedTerm({ token, cpf, data, onRefresh }: { token: string; cpf: string; data: TermData; onRefresh: () => Promise<void> }) {
  const respond = useServerFn(respondToTerm);
  const [decision, setDecision] = useState<"accept" | "reject" | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = data.branding;
  const needReason = decision === "reject" && data.requireRejectReason;

  const submit = async () => {
    if (!decision) return;
    setError(null);
    if (decision === "reject" && name.trim().length < 2) return setError("Informe seu nome completo.");
    if (needReason && !note.trim()) return setError("Conte o motivo da recusa.");
    setSending(true);
    try {
      await respond({ data: { token, cpf, decision, name: decision === "reject" ? name.trim() : "", note: note.trim() } });
      await onRefresh();
      setDecision(null);
    } catch (e: any) {
      setError(e?.message || "Não foi possível registrar sua resposta.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 py-6 sm:py-10 px-3" style={{ "--brand": b.primaryColor } as React.CSSProperties}>
      <div className="mx-auto max-w-3xl bg-card text-card-foreground rounded-xl shadow-sm border overflow-hidden">
        <header className="border-b" style={{ borderTop: "6px solid var(--brand)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6">
            <img src={b.logoUrl || defaultLogo} alt={b.companyName} className="h-16 w-auto object-contain self-start" />
            <div className="text-xs text-muted-foreground space-y-0.5 sm:text-right">
              <p className="font-semibold text-foreground text-sm">{b.companyName}</p>
              {b.phone && <p className="flex sm:justify-end items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</p>}
              {b.email && <p className="flex sm:justify-end items-center gap-1"><Mail className="h-3 w-3" />{b.email}</p>}
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--brand)" }}>
              Termo de {data.serviceLabel} {data.number}
            </p>
            <h1 className="text-2xl font-bold text-foreground">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">Emitido em {formatDateBR(data.createdAt)}</p>
          </div>

          {data.status === "aceito" || data.status === "enviada" ? (
            <div className="rounded-lg border p-4 flex gap-3 items-start bg-muted/40" style={{ borderColor: "var(--brand)" }}>
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Termo aceito</p>
                <p className="text-muted-foreground">Aceito por {data.responderName} em {formatDateBR(data.respondedAt)}. Nossa equipe vai agendar o serviço e entrar em contato.</p>
              </div>
            </div>
          ) : data.status === "recusado" ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex gap-3 items-start">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Termo recusado</p>
                <p className="text-muted-foreground">Recusado por {data.responderName} em {formatDateBR(data.respondedAt)}.{data.responderNote ? ` Motivo: ${data.responderNote}` : ""}</p>
              </div>
            </div>
          ) : null}

          <section className="grid sm:grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Cliente</p>
              <p className="font-semibold text-foreground">{data.clientName || "—"}</p>
              <p className="text-muted-foreground">Responsável pela frota: {data.responsibleName}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Serviço</p>
              <p className="flex items-center gap-1 text-foreground"><Truck className="h-3.5 w-3.5" /> {data.serviceLabel}{data.plate ? ` — placa ${data.plate}` : ""}</p>
              {data.equipmentId && <p className="text-muted-foreground">Equipamento: {data.equipmentId}</p>}
              {data.address && <p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {data.address}</p>}
            </div>
          </section>

          <section>
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{data.text}</p>
          </section>

          {data.checklist.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-1 text-foreground">Verificações já realizadas pela nossa equipe</h2>
              <ul className="text-sm text-muted-foreground space-y-0.5">
                {data.checklist.filter((i) => i.checked).map((i) => <li key={i.label}>✔ {i.label}</li>)}
              </ul>
            </section>
          )}

          {data.description && (
            <section>
              <h2 className="text-sm font-semibold mb-1 text-foreground">Observações</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{data.description}</p>
            </section>
          )}

          {data.canRespond && (
            <section className="rounded-lg border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-foreground">Está de acordo com o termo? Registre sua resposta.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDecision("reject"); setError(null); }}>
                  <XCircle className="h-4 w-4 mr-1" /> Recusar
                </Button>
                <Button className="text-primary-foreground hover:opacity-90" style={{ background: "var(--brand)" }} onClick={() => { setDecision("accept"); setError(null); }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aceitar termo
                </Button>
              </div>
            </section>
          )}
        </main>
        {b.footer && <footer className="border-t px-6 py-4 text-[11px] text-muted-foreground whitespace-pre-line">{b.footer}</footer>}
      </div>

      <Dialog open={!!decision} onOpenChange={(o) => { if (!o && !sending) setDecision(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{decision === "accept" ? "Aceitar termo" : "Recusar termo"}</DialogTitle>
            <DialogDescription>
              {decision === "accept"
                ? "Ao confirmar, você declara estar de acordo com este termo e autoriza o serviço técnico."
                : "Sua resposta será enviada à nossa equipe."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {decision === "reject" && (
              <div>
                <Label htmlFor="resp-name">Seu nome completo *</Label>
                <Input id="resp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
            )}
            <div>
              <Label htmlFor="resp-note">{decision === "reject" ? `Motivo da recusa${needReason ? " *" : ""}` : "Observação (opcional)"}</Label>
              <Textarea id="resp-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDecision(null)} disabled={sending}>Voltar</Button>
              <Button onClick={submit} disabled={sending} variant={decision === "reject" ? "destructive" : "default"}
                className={decision === "accept" ? "text-primary-foreground hover:opacity-90" : undefined}
                style={decision === "accept" ? { background: "var(--brand)" } : undefined}>
                {sending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {decision === "accept" ? "Confirmar aceite" : "Confirmar recusa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
