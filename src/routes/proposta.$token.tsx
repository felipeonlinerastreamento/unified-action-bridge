import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, Ban, Loader2, Phone, Mail, Globe, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getPublicProposal, unlockPublicProposal, respondToProposal } from "@/lib/crm-proposal.functions";
import { brl, formatCpf, formatDateBR, isValidCpf, proposalNumberLabel } from "@/lib/crm-proposal";
import defaultLogo from "@/assets/logo-online-rastreamento.png";

const proposalQuery = (token: string) =>
  queryOptions({
    queryKey: ["public-proposal", token],
    queryFn: () => getPublicProposal({ data: { token } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/proposta/$token")({
  loader: ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.token)) return null;
    return context.queryClient.ensureQueryData(proposalQuery(params.token));
  },
  head: ({ loaderData }) => {
    const company = loaderData?.branding.companyName || "Online Rastreamento";
    const title = loaderData ? `Proposta comercial — ${company}` : "Proposta indisponível";
    const description = loaderData
      ? `Proposta ${proposalNumberLabel(loaderData.quoteNumber)} preparada por ${company}. Veja os itens e responda online.`
      : "Este link de proposta não está disponível.";
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
  component: PublicProposalPage,
  errorComponent: () => <Unavailable text="Não foi possível carregar esta proposta. Tente novamente em instantes." />,
});

function Unavailable({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md text-center space-y-2">
        <Ban className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Proposta indisponível</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function PublicProposalPage() {
  const { token } = Route.useParams();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return <Unavailable text="Link inválido." />;
  return <ProposalView token={token} />;
}

type GateData = NonNullable<Awaited<ReturnType<typeof getPublicProposal>>>;
type ProposalData = Awaited<ReturnType<typeof unlockPublicProposal>>;

const cpfStorageKey = (token: string) => `proposta-cpf:${token}`;

function ProposalView({ token }: { token: string }) {
  const { data: gate } = useSuspenseQuery(proposalQuery(token));
  const unlock = useServerFn(unlockPublicProposal);
  const [cpf, setCpf] = useState<string | null>(null);
  const [data, setData] = useState<ProposalData | null>(null);
  const [checking, setChecking] = useState(true);

  // Reabre sem pedir o CPF de novo enquanto a aba estiver aberta.
  useEffect(() => {
    const saved = sessionStorage.getItem(cpfStorageKey(token));
    if (!saved || !isValidCpf(saved)) { setChecking(false); return; }
    unlock({ data: { token, cpf: saved } })
      .then((d) => { setCpf(saved); setData(d); })
      .catch(() => sessionStorage.removeItem(cpfStorageKey(token)))
      .finally(() => setChecking(false));
  }, [token, unlock]);

  if (!gate) return <Unavailable text="Este link não existe ou foi removido." />;
  if (gate.status === "cancelled") return <Unavailable text="Esta proposta foi cancelada pela empresa. Entre em contato para receber uma versão atualizada." />;

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
          sessionStorage.setItem(cpfStorageKey(token), value);
          setCpf(value);
          setData(d);
        }}
      />
    );
  }

  return (
    <UnlockedProposal
      token={token}
      cpf={cpf}
      data={data}
      onRefresh={async () => setData(await unlock({ data: { token, cpf } }))}
    />
  );
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
      setError(err?.message || "Não foi possível abrir a proposta.");
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
            <h1 className="text-lg font-semibold text-foreground">
              Proposta comercial {proposalNumberLabel(gate.quoteNumber)}
            </h1>
            <p className="text-sm text-muted-foreground">Para sua segurança, informe seu CPF para abrir a proposta.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gate-cpf">CPF *</Label>
            <Input
              id="gate-cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={value}
              onChange={(e) => setValue(formatCpf(e.target.value))}
              maxLength={14}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button
            type="submit"
            className="w-full text-primary-foreground hover:opacity-90"
            style={{ background: "var(--brand)" }}
            disabled={sending || value.replace(/\D/g, "").length < 11}
          >
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
            Abrir proposta
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">{b.companyName}</p>
        </div>
      </form>
    </div>
  );
}

function UnlockedProposal({ token, cpf, data, onRefresh }: { token: string; cpf: string; data: ProposalData; onRefresh: () => Promise<void> }) {
  const respond = useServerFn(respondToProposal);
  const [decision, setDecision] = useState<"accept" | "reject" | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { snapshot: s, branding: b } = data;
  const brand = { "--brand": b.primaryColor } as React.CSSProperties;
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
    <div className="min-h-screen bg-muted/40 py-6 sm:py-10 px-3" style={brand}>
      <div className="mx-auto max-w-4xl bg-card text-card-foreground rounded-xl shadow-sm border overflow-hidden">
        {/* Cabeçalho */}
        <header className="border-b" style={{ borderTop: "6px solid var(--brand)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6">
            <img src={b.logoUrl || defaultLogo} alt={b.companyName} className="h-20 w-auto object-contain self-start" />
            <div className="text-xs text-muted-foreground space-y-0.5 sm:text-right">
              <p className="font-semibold text-foreground text-sm">{b.companyName}</p>
              {b.cnpj && <p>CNPJ {b.cnpj}</p>}
              {b.phone && <p className="flex sm:justify-end items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</p>}
              {b.email && <p className="flex sm:justify-end items-center gap-1"><Mail className="h-3 w-3" />{b.email}</p>}
              {b.website && <p className="flex sm:justify-end items-center gap-1"><Globe className="h-3 w-3" />{b.website}</p>}
              {b.address && <p className="flex sm:justify-end items-center gap-1"><MapPin className="h-3 w-3" />{b.address}</p>}
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--brand)" }}>
                Proposta comercial {proposalNumberLabel(s.quoteNumber)}
              </p>
              <h1 className="text-2xl font-bold text-foreground">{s.title}</h1>
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              <p>Emitida em {formatDateBR(s.issuedAt)}</p>
              {s.validUntil && <p>Válida até <strong className="text-foreground">{formatDateBR(s.validUntil)}</strong></p>}
            </div>
          </div>

          <StatusBanner data={data} />

          <section className="grid sm:grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Cliente</p>
              <p className="font-semibold text-foreground">{s.client.companyName || s.client.contactName || "—"}</p>
              {s.client.cnpj && <p className="text-muted-foreground">CNPJ/CPF {s.client.cnpj}</p>}
              {s.client.contactName && s.client.companyName && <p className="text-muted-foreground">A/C {s.client.contactName}</p>}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Responsável</p>
              <p className="font-semibold text-foreground">{s.owner.name || b.companyName}</p>
              {s.owner.email && <p className="text-muted-foreground">{s.owner.email}</p>}
            </div>
          </section>

          {s.introText && <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{s.introText}</p>}

          <section>
            <h2 className="text-sm font-semibold mb-2 text-foreground">Itens da proposta</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-primary-foreground" style={{ background: "var(--brand)" }}>
                    <th className="p-2.5 font-medium">Item</th>
                    <th className="p-2.5 font-medium text-center">Qtd</th>
                    <th className="p-2.5 font-medium text-right">Ativação (un.)</th>
                    <th className="p-2.5 font-medium text-right">Mensal (un.)</th>
                    <th className="p-2.5 font-medium text-right">Subtotal mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((it, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="p-2.5">
                        <p className="font-medium text-foreground">{it.name}</p>
                        {it.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{it.description}</p>}
                        {it.unit && <p className="text-[11px] text-muted-foreground">{it.unit}</p>}
                      </td>
                      <td className="p-2.5 text-center">{it.quantity}</td>
                      <td className="p-2.5 text-right whitespace-nowrap">{brl(it.activationValue)}</td>
                      <td className="p-2.5 text-right whitespace-nowrap">{brl(it.monthlyValue)}</td>
                      <td className="p-2.5 text-right whitespace-nowrap font-medium">{brl(it.monthlyValue * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Total de ativação (pagamento único)</p>
                <p className="text-xl font-bold text-foreground">{brl(s.totals.activation)}</p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--brand)" }}>
                <p className="text-xs text-muted-foreground">Total mensal</p>
                <p className="text-xl font-bold" style={{ color: "var(--brand)" }}>{brl(s.totals.monthly)}</p>
              </div>
            </div>
          </section>

          {s.termsText && (
            <section>
              <h2 className="text-sm font-semibold mb-1 text-foreground">Condições comerciais</h2>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{s.termsText}</p>
            </section>
          )}

          {data.canRespond && (
            <section className="rounded-lg border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-foreground">Está de acordo com a proposta? Registre sua resposta abaixo.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDecision("reject"); setError(null); }}>
                  <XCircle className="h-4 w-4 mr-1" /> Recusar
                </Button>
                <Button className="text-primary-foreground hover:opacity-90" style={{ background: "var(--brand)" }} onClick={() => { setDecision("accept"); setError(null); }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aceitar proposta
                </Button>
              </div>
            </section>
          )}
        </main>

        {b.footer && <footer className="border-t px-6 py-4 text-[11px] text-muted-foreground whitespace-pre-line">{b.footer}</footer>}
      </div>

      <Dialog open={!!decision} onOpenChange={(o) => { if (!o && !sending) setDecision(null); }}>
        <DialogContent className="max-w-md" style={brand}>
          <DialogHeader>
            <DialogTitle>{decision === "accept" ? "Aceitar proposta" : "Recusar proposta"}</DialogTitle>
            <DialogDescription>
              {decision === "accept"
                ? "Ao confirmar, você declara estar de acordo com os itens e condições desta proposta."
                : "Sua resposta será enviada ao responsável pela proposta."}
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
              <Button
                onClick={submit}
                disabled={sending}
                variant={decision === "reject" ? "destructive" : "default"}
                className={decision === "accept" ? "text-primary-foreground hover:opacity-90" : undefined}
                style={decision === "accept" ? { background: "var(--brand)" } : undefined}
              >
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

function StatusBanner({ data }: { data: ProposalData }) {
  if (data.status === "accepted") {
    return (
      <div className="rounded-lg border p-4 flex gap-3 items-start bg-muted/40" style={{ borderColor: "var(--brand)" }}>
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Proposta aceita</p>
          <p className="text-muted-foreground">Aceita por {data.responderName} em {formatDateBR(data.respondedAt)}. Nossa equipe entrará em contato para os próximos passos.</p>
        </div>
      </div>
    );
  }
  if (data.status === "rejected") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex gap-3 items-start">
        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Proposta recusada</p>
          <p className="text-muted-foreground">Recusada por {data.responderName} em {formatDateBR(data.respondedAt)}.{data.responderNote ? ` Motivo: ${data.responderNote}` : ""}</p>
        </div>
      </div>
    );
  }
  if (data.expired) {
    return (
      <div className="rounded-lg border bg-muted p-4 flex gap-3 items-start">
        <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">Esta proposta venceu em {formatDateBR(data.expiresAt)}. Fale com o responsável para receber uma versão atualizada.</p>
      </div>
    );
  }
  return null;
}
