import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Ban, CheckCircle2, Loader2, ShieldCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { abrirContrato, assinarContrato, enviarCodigoAssinatura, getContratoPublico } from "@/lib/contratos.functions";
import { formatCpf, isValidCpf } from "@/lib/crm-proposal";
import defaultLogo from "@/assets/logo-online-rastreamento.png";
import { CONTRATO_CSS } from "@/components/contratos/contrato-css";

const gateQuery = (token: string) =>
  queryOptions({ queryKey: ["contrato-publico", token], queryFn: () => getContratoPublico({ data: { token } }), staleTime: 30_000 });

export const Route = createFileRoute("/contrato/$token")({
  loader: ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.token)) return null;
    return context.queryClient.ensureQueryData(gateQuery(params.token));
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Contrato nº ${loaderData.numero} — ${loaderData.branding.companyName}` : "Contrato indisponível" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Pagina,
  errorComponent: () => <Indisponivel texto="Não foi possível carregar este contrato. Tente novamente em instantes." />,
});

function Indisponivel({ texto }: { texto: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md text-center space-y-2">
        <Ban className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Contrato indisponível</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

type Aberto = Awaited<ReturnType<typeof abrirContrato>>;

function Pagina() {
  const { token } = Route.useParams();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return <Indisponivel texto="Link inválido." />;
  return <Contrato token={token} />;
}

function Contrato({ token }: { token: string }) {
  const { data: gate } = useSuspenseQuery(gateQuery(token));
  const abrir = useServerFn(abrirContrato);
  const [cpf, setCpf] = useState("");
  const [doc, setDoc] = useState<Aberto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  if (!gate) return <Indisponivel texto="Este link não existe ou foi removido." />;
  if (gate.status === "cancelado") return <Indisponivel texto="Este contrato foi cancelado pela empresa." />;
  const b = gate.branding;

  const cabecalho = (
    <header className="flex items-center justify-between gap-3 border-b pb-3 mb-4">
      <img src={b.logoUrl || defaultLogo} alt={b.companyName} className="h-10 w-auto" />
      <div className="text-right text-xs text-muted-foreground">Contrato nº {gate.numero}<br />{gate.cliente}</div>
    </header>
  );

  if (!doc) {
    const entrar = async (e: React.FormEvent) => {
      e.preventDefault();
      setErro(null);
      if (!isValidCpf(cpf)) { setErro("Informe um CPF válido."); return; }
      setCarregando(true);
      try { setDoc(await abrir({ data: { token, cpf } })); } catch (err: any) { setErro(err?.message ?? "Não foi possível abrir."); }
      finally { setCarregando(false); }
    };
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-10">
        <form onSubmit={entrar} className="max-w-md mx-auto bg-background rounded-lg border p-6 space-y-4">
          {cabecalho}
          <h1 className="text-lg font-semibold">Contrato para assinatura eletrônica</h1>
          <p className="text-sm text-muted-foreground">Para ver o contrato, informe o CPF do responsável pela assinatura.</p>
          <div><Label>CPF</Label><Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" /></div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" className="w-full" disabled={carregando}>{carregando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Abrir contrato</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-2 sm:px-4 py-6">
      <style>{CONTRATO_CSS}</style>
      <div className="max-w-3xl mx-auto bg-background rounded-lg border p-4 sm:p-8">
        {cabecalho}
        <article className="contrato-doc" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <p className="text-[11px] text-muted-foreground mt-6 break-all">Código de integridade (SHA-256) do documento: {doc.hash}</p>
        {doc.status === "assinado" ? (
          <div className="mt-6 rounded-md border border-emerald-600/40 bg-emerald-50 p-4 text-sm flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>Contrato assinado eletronicamente{doc.assinadoEm ? ` em ${new Date(doc.assinadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}.
              <Button variant="link" className="px-1 h-auto" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir / salvar PDF</Button></div>
          </div>
        ) : (
          <Assinar token={token} cpf={cpf} doc={doc} onAssinado={(em) => setDoc({ ...doc, status: "assinado", assinadoEm: em })} />
        )}
      </div>
    </div>
  );
}

function Assinar({ token, cpf, doc, onAssinado }: { token: string; cpf: string; doc: Aberto; onAssinado: (em: string) => void }) {
  const pedir = useServerFn(enviarCodigoAssinatura);
  const assinar = useServerFn(assinarContrato);
  const [canal, setCanal] = useState<"whatsapp" | "email">(doc.destinos.whatsapp ? "whatsapp" : "email");
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState(doc.signatario || "");
  const [aceite, setAceite] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    setErro(null); setOcupado(true);
    try { const r = await pedir({ data: { token, cpf, canal } }); setEnviadoPara(r.destino); } catch (e: any) { setErro(e?.message ?? "Falha ao enviar o código."); }
    finally { setOcupado(false); }
  };
  const confirmar = async () => {
    setErro(null);
    if (!aceite) { setErro("Marque a declaração de concordância."); return; }
    setOcupado(true);
    try { const r = await assinar({ data: { token, cpf, codigo, nome, aceite: true } }); onAssinado(r.assinadoEm); } catch (e: any) { setErro(e?.message ?? "Falha ao assinar."); }
    finally { setOcupado(false); }
  };

  return (
    <div className="mt-6 rounded-md border p-4 space-y-3 print:hidden">
      <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Assinar eletronicamente</h2>
      {!enviadoPara ? (
        <>
          <p className="text-sm text-muted-foreground">Vamos enviar um código de 6 dígitos para confirmar que é você.</p>
          <div className="flex flex-wrap gap-2">
            {doc.destinos.whatsapp && <Button type="button" variant={canal === "whatsapp" ? "default" : "outline"} onClick={() => setCanal("whatsapp")}>WhatsApp {doc.destinos.whatsapp}</Button>}
            {doc.destinos.email && <Button type="button" variant={canal === "email" ? "default" : "outline"} onClick={() => setCanal("email")}>E-mail {doc.destinos.email}</Button>}
          </div>
          {!doc.destinos.whatsapp && !doc.destinos.email && <p className="text-sm text-destructive">Não há contato cadastrado para enviar o código. Fale com a empresa.</p>}
          <Button onClick={enviar} disabled={ocupado || (!doc.destinos.whatsapp && !doc.destinos.email)}>{ocupado && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Enviar código</Button>
        </>
      ) : (
        <>
          <p className="text-sm">Código enviado para <b>{enviadoPara}</b>. <button className="underline text-muted-foreground" onClick={enviar} disabled={ocupado}>Reenviar</button></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Código</Label><Input inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} /></div>
            <div><Label>Seu nome completo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
            <span>Li o contrato e o Anexo I e concordo com todos os termos. Reconheço esta assinatura eletrônica como válida, nos termos do art. 10, §2º, da MP 2.200-2/2001 e da Lei 14.063/2020.</span>
          </label>
          <Button onClick={confirmar} disabled={ocupado || codigo.length !== 6 || nome.trim().length < 3}>{ocupado && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Assinar contrato</Button>
        </>
      )}
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <p className="text-[11px] text-muted-foreground">Registramos data, hora, IP, navegador, CPF e o código confirmado como prova da assinatura.</p>
    </div>
  );
}
