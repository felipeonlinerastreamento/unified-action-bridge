import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Paperclip, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { anexarArquivoLancamento } from "@/lib/finance.functions";
import { toast } from "sonner";
import { TIPOS_DOCUMENTO, parseValorBR } from "@/lib/finance";
import { fin, useFinInvalidate, type Cat, type Emp, type Lanc } from "./use-fin";

const NONE = "__none__";

export function LancamentoDialog({
  open, onClose, tipo, lanc, categorias, empresas,
}: {
  open: boolean; onClose: () => void; tipo: "pagar" | "receber"; lanc?: Lanc | null; categorias: Cat[]; empresas: Emp[];
}) {
  const invalidate = useFinInvalidate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const anexar = useServerFn(anexarArquivoLancamento);
  useEffect(() => {
    if (!open) return;
    setArquivo(null);
    setF(lanc ? { ...lanc, valor: String(lanc.valor ?? "").replace(".", ",") } : {
      tipo, status: "aberto", valor: "", empresa_id: empresas.find((e) => e.codigo === "OR")?.id ?? null,
    });
  }, [open, lanc, tipo, empresas]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const catsDoTipo = categorias.filter((c) => c.ativo && c.tipo === (f.tipo === "receber" ? "receita" : "despesa"));

  const salvar = async () => {
    const valor = parseValorBR(f.valor);
    if (!valor) { toast.error("Informe o valor."); return; }
    setBusy(true);
    const payload: any = {
      tipo: f.tipo, empresa_id: f.empresa_id || null, categoria_id: f.categoria_id || null,
      contraparte: f.contraparte || null, documento_contraparte: f.documento_contraparte || null,
      descricao: f.descricao || null, valor, data_emissao: f.data_emissao || null, vencimento: f.vencimento || null,
      competencia: f.competencia || null, status: f.status, data_pagamento: f.status === "pago" ? (f.data_pagamento || f.vencimento || null) : null,
      valor_pago: f.status === "pago" ? parseValorBR(f.valor_pago ?? f.valor) || valor : null,
      forma_pagamento: f.forma_pagamento || null, tipo_documento: f.tipo_documento || null,
      numero_documento: f.numero_documento || null, linha_digitavel: f.linha_digitavel || null, observacao: f.observacao || null,
      revisado: true,
    };
    if (arquivo && arquivo.size > 15 * 1024 * 1024) { setBusy(false); toast.error("Arquivo maior que 15 MB."); return; }
    const res = lanc
      ? await fin.from("fin_lancamentos").update(payload).eq("id", lanc.id).select("id").single()
      : await fin.from("fin_lancamentos").insert(payload).select("id").single();
    if (res.error) { setBusy(false); toast.error(res.error.message); return; }
    toast.success(lanc ? "Lançamento atualizado." : "Lançamento criado.");
    if (arquivo) {
      try {
        const base64 = await paraBase64(arquivo);
        const r: any = await anexar({ data: { lancamentoId: res.data.id, nome: arquivo.name, mime: arquivo.type || "application/octet-stream", base64 } });
        if (r.drive) toast.success(`Anexo salvo no Google Drive (pasta ${r.pasta}).`);
        else toast.warning(r.aviso ?? "Anexo salvo só no sistema.");
      } catch (e: any) { toast.error(`O lançamento foi salvo, mas o anexo falhou: ${e?.message ?? e}`); }
    }
    setBusy(false);
    invalidate();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{lanc ? "Editar lançamento" : f.tipo === "receber" ? "Nova conta a receber" : "Nova conta a pagar"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><Label>{f.tipo === "receber" ? "Cliente" : "Fornecedor"}</Label><Input value={f.contraparte ?? ""} onChange={(e) => set("contraparte", e.target.value)} /></div>
          <div><Label>CNPJ/CPF</Label><Input value={f.documento_contraparte ?? ""} onChange={(e) => set("documento_contraparte", e.target.value)} /></div>
          <div><Label>Valor (R$)</Label><Input value={f.valor ?? ""} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" /></div>
          <div className="col-span-2"><Label>Descrição</Label><Input value={f.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} /></div>
          <div>
            <Label>Categoria</Label>
            <Select value={f.categoria_id || NONE} onValueChange={(v) => set("categoria_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem categoria</SelectItem>
                {catsDoTipo.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresa</Label>
            <Select value={f.empresa_id || NONE} onValueChange={(v) => set("empresa_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {empresas.filter((e) => e.ativo).map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo} · {e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Emissão</Label><Input type="date" value={f.data_emissao ?? ""} onChange={(e) => set("data_emissao", e.target.value)} /></div>
          <div><Label>Vencimento</Label><Input type="date" value={f.vencimento ?? ""} onChange={(e) => set("vencimento", e.target.value)} /></div>
          <div><Label>Competência (mês)</Label><Input type="month" value={(f.competencia ?? "").slice(0, 7)} onChange={(e) => set("competencia", e.target.value ? `${e.target.value}-01` : null)} /></div>
          <div>
            <Label>Tipo de documento</Label>
            <Select value={f.tipo_documento || NONE} onValueChange={(v) => set("tipo_documento", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={f.status ?? "aberto"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="pago">{f.tipo === "receber" ? "Recebido" : "Pago"}</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.status === "pago" && (
            <>
              <div><Label>Data do pagamento</Label><Input type="date" value={f.data_pagamento ?? ""} onChange={(e) => set("data_pagamento", e.target.value)} /></div>
              <div><Label>Valor pago</Label><Input value={f.valor_pago ?? ""} onChange={(e) => set("valor_pago", e.target.value)} placeholder="igual ao valor" /></div>
            </>
          )}
          <div><Label>Forma de pagamento</Label><Input value={f.forma_pagamento ?? ""} onChange={(e) => set("forma_pagamento", e.target.value)} placeholder="Boleto, Pix, cartão..." /></div>
          <div><Label>Nº do documento</Label><Input value={f.numero_documento ?? ""} onChange={(e) => set("numero_documento", e.target.value)} /></div>
          <div className="col-span-2"><Label>Linha digitável</Label><Input value={f.linha_digitavel ?? ""} onChange={(e) => set("linha_digitavel", e.target.value)} /></div>
          <div className="col-span-2">
            <Label>Anexo (nota, boleto, comprovante)</Label>
            {lanc?.arquivo_nome && !arquivo && <p className="text-xs text-muted-foreground mb-1">Atual: {lanc.arquivo_nome}{lanc.arquivo_url ? " (no Google Drive)" : ""}. Escolha outro para substituir.</p>}
            {arquivo ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2"><Paperclip className="h-4 w-4" /><span className="truncate flex-1">{arquivo.name}</span>
                <span className="text-xs text-muted-foreground">{(arquivo.size / 1024).toFixed(0)} KB</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setArquivo(null)}><X className="h-4 w-4" /></Button></div>
            ) : (
              <Input type="file" accept=".pdf,.xml,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            )}
            <p className="text-[11px] text-muted-foreground mt-1">Vai para o Google Drive em 00-Comprovantes Gerais, na pasta do mês, e fica ligado ao lançamento.</p>
          </div>
          <div className="col-span-2"><Label>Observação</Label><Textarea rows={2} value={f.observacao ?? ""} onChange={(e) => set("observacao", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lê o arquivo como base64 (sem o prefixo data:). */
function paraBase64(file: File): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(r.error ?? new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(file);
  });
}
