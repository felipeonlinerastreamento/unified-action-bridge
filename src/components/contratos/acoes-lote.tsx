import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FolderInput, Loader2, Send, X, RefreshCw, Tags } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { categorizarContratos, moverContratosPasta, pastasContratos, reenviarContratosLote, sincronizarPendentesAutentiqueFn } from "@/lib/contratos.functions";

type Sel = { id: string; numero: number; status: string; provedor: string; pasta?: string | null; signatario_email: string | null; signatario_telefone: string | null };
type Modo = "autentique" | "whatsapp" | "email" | "whatsapp_email";

/** Barra que aparece ao marcar contratos na lista: reenviar para assinatura, mover de pasta e atualizar do Autentique. */
export function AcoesLote({ selecionados, pastasLocais, onLimpar }: { selecionados: Sel[]; pastasLocais: string[]; onLimpar: () => void }) {
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<"reenviar" | "pasta" | null>(null);
  const sincronizar = useServerFn(sincronizarPendentesAutentiqueFn);
  const categorizar = useServerFn(categorizarContratos);
  const [sinc, setSinc] = useState(false);
  if (!selecionados.length) return null;
  const pendentes = selecionados.filter((c) => c.status === "enviado");
  const doAutentique = selecionados.filter((c) => c.provedor === "autentique");

  const atualizar = async () => {
    setSinc(true);
    try {
      const r: any = await sincronizar();
      toast.success(`${r.verificados} contrato(s) conferido(s) no Autentique: ${r.assinados} assinado(s), ${r.cancelados} recusado(s).`);
      qc.invalidateQueries({ queryKey: ["contratos"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha ao atualizar do Autentique."); }
    finally { setSinc(false); }
  };

  const marcar = async (categoria: "cliente" | "fornecedor") => {
    try {
      const r: any = await categorizar({ data: { ids: selecionados.map((c) => c.id), categoria } });
      toast.success(`${r.alterados} contrato(s) marcado(s) como ${categoria === "fornecedor" ? "fornecedor" : "cliente"}.`);
      qc.invalidateQueries({ queryKey: ["contratos"] });
      onLimpar();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao categorizar."); }
  };

  return (
    <>
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium px-1">{selecionados.length} selecionado(s)</span>
          <Button size="sm" onClick={() => setDlg("reenviar")} disabled={!pendentes.length} title={pendentes.length ? "" : "Nenhum dos marcados aguarda assinatura"}>
            <Send className="h-4 w-4 mr-1" />Reenviar para assinatura{pendentes.length !== selecionados.length ? ` (${pendentes.length})` : ""}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Tags className="h-4 w-4 mr-1" />Categoria</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => marcar("cliente")}>Contrato com cliente</DropdownMenuItem>
              <DropdownMenuItem onClick={() => marcar("fornecedor")}>Contrato com fornecedor</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => setDlg("pasta")}><FolderInput className="h-4 w-4 mr-1" />Mudar de pasta</Button>
          {doAutentique.length > 0 && (
            <Button size="sm" variant="outline" onClick={atualizar} disabled={sinc}>{sinc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}Atualizar do Autentique</Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onLimpar}><X className="h-4 w-4 mr-1" />Limpar seleção</Button>
        </CardContent>
      </Card>
      {dlg === "reenviar" && <ReenviarDialog contratos={pendentes} onClose={() => setDlg(null)} onFeito={() => { qc.invalidateQueries({ queryKey: ["contratos"] }); onLimpar(); }} />}
      {dlg === "pasta" && <PastaDialog contratos={selecionados} pastasLocais={pastasLocais} onClose={() => setDlg(null)} onFeito={() => { qc.invalidateQueries({ queryKey: ["contratos"] }); onLimpar(); }} />}
    </>
  );
}

function ReenviarDialog({ contratos, onClose, onFeito }: { contratos: Sel[]; onClose: () => void; onFeito: () => void }) {
  const reenviar = useServerFn(reenviarContratosLote);
  const temAut = contratos.some((c) => c.provedor === "autentique");
  const temProprio = contratos.some((c) => c.provedor !== "autentique");
  const [modo, setModo] = useState<Modo>(temAut && !temProprio ? "autentique" : "whatsapp");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ numero: number; ok: boolean; detalhe: string }[] | null>(null);
  const semFone = contratos.filter((c) => !String(c.signatario_telefone || "").replace(/\D/g, "")).length;
  const semEmail = contratos.filter((c) => !String(c.signatario_email || "").includes("@")).length;

  const enviar = async () => {
    setBusy(true);
    try {
      const r: any = await reenviar({ data: { ids: contratos.map((c) => c.id), modo } });
      setRes(r.resultado);
      const ok = r.resultado.filter((x: any) => x.ok).length;
      (ok ? toast.success : toast.error)(`${ok} de ${r.resultado.length} contrato(s) reenviado(s).`);
      onFeito();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao reenviar."); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reenviar {contratos.length} contrato(s) para assinatura</DialogTitle>
          <DialogDescription>Só os contratos que ainda aguardam assinatura são reenviados.</DialogDescription>
        </DialogHeader>
        {!res ? (
          <div className="space-y-3 text-sm">
            <Label>Modo de envio</Label>
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="space-y-2">
              {temAut && (
                <label className="flex items-start gap-2"><RadioGroupItem value="autentique" className="mt-0.5" />
                  <span><b>Pelo Autentique</b> — o Autentique reenvia o convite pelo mesmo canal do envio. Contratos de assinatura própria são pulados.</span></label>
              )}
              <label className="flex items-start gap-2"><RadioGroupItem value="whatsapp" className="mt-0.5" />
                <span><b>WhatsApp da Central</b> — manda o link de assinatura{temAut ? " (do Autentique ou o nosso)" : ""}.{semFone ? <span className="text-amber-600"> {semFone} sem WhatsApp cadastrado.</span> : null}</span></label>
              <label className="flex items-start gap-2"><RadioGroupItem value="email" className="mt-0.5" />
                <span><b>E-mail</b> — pela caixa de e-mail do Gestão Online.{semEmail ? <span className="text-amber-600"> {semEmail} sem e-mail cadastrado.</span> : null}</span></label>
              <label className="flex items-start gap-2"><RadioGroupItem value="whatsapp_email" className="mt-0.5" />
                <span><b>WhatsApp e e-mail</b></span></label>
            </RadioGroup>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded border divide-y text-xs">
            {res.map((r) => (
              <div key={r.numero} className={`px-2 py-1.5 ${r.ok ? "" : "text-destructive"}`}>Nº {r.numero}: {r.ok ? "✓ " : "✗ "}{r.detalhe}</div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{res ? "Fechar" : "Cancelar"}</Button>
          {!res && <Button onClick={enviar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Reenviar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PastaDialog({ contratos, pastasLocais, onClose, onFeito }: { contratos: Sel[]; pastasLocais: string[]; onClose: () => void; onFeito: () => void }) {
  const mover = useServerFn(moverContratosPasta);
  const listar = useServerFn(pastasContratos);
  const temAut = contratos.some((c) => c.provedor === "autentique");
  const { data, isLoading } = useQuery({ queryKey: ["contratos-pastas"], queryFn: () => listar() });
  const nomes = [...new Set([...pastasLocais, ...(data?.locais ?? []), ...(data?.autentique ?? []).map((p) => p.name)])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const [pasta, setPasta] = useState("");
  const [noAut, setNoAut] = useState(true);
  const [busy, setBusy] = useState(false);

  const salvar = async (nome: string) => {
    setBusy(true);
    try {
      const r: any = await mover({ data: { ids: contratos.map((c) => c.id), pasta: nome.trim(), noAutentique: temAut && noAut } });
      toast.success(`${r.movidos} contrato(s) ${nome.trim() ? `movido(s) para "${nome.trim()}"` : "retirado(s) da pasta"}${temAut && noAut ? `; ${r.noAutentique} também no Autentique` : ""}.`);
      if (r.falhasAutentique?.length) toast.error(`No Autentique não foi possível mover: ${r.falhasAutentique.slice(0, 3).join(" · ")}`);
      onFeito(); onClose();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao mover."); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mudar {contratos.length} contrato(s) de pasta</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Pasta (escolha ou digite uma nova)</Label>
            <Input list="pastas-contratos" value={pasta} onChange={(e) => setPasta(e.target.value)} placeholder="Ex.: Clientes 2026, Renovação, Jurídico" maxLength={80} />
            <datalist id="pastas-contratos">{nomes.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          {isLoading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Buscando pastas do Autentique…</p>}
          {nomes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {nomes.slice(0, 30).map((n) => <Button key={n} size="sm" variant={pasta === n ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPasta(n)}>{n}</Button>)}
            </div>
          )}
          {temAut && (
            <label className="flex items-start gap-2"><Checkbox checked={noAut} onCheckedChange={(v) => setNoAut(!!v)} className="mt-0.5" />
              <span>Mover também no Autentique (cria a pasta lá se não existir){data?.erroAutentique ? <span className="text-destructive"> — {data.erroAutentique}</span> : null}</span></label>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => salvar("")} disabled={busy}>Tirar da pasta</Button>
          <Button onClick={() => salvar(pasta)} disabled={busy || !pasta.trim()}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Mover</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
