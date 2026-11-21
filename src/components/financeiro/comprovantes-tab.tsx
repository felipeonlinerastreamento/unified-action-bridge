import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Check, Paperclip, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { formatBRL, formatDataBR, parseValorBR, TIPOS_DOCUMENTO } from "@/lib/finance";
import { lerComprovanteUpload } from "@/lib/finance.functions";
import { fin, useFinInvalidate, type Cat, type Emp, type Lanc } from "./use-fin";
import { useAbrirAnexo } from "./lancamentos-tab";
import { LancamentoDialog } from "./lancamento-dialog";

const NONE = "__none__";

export function ComprovantesTab({ lancamentos, categorias, empresas }: { lancamentos: Lanc[]; categorias: Cat[]; empresas: Emp[] }) {
  const invalidate = useFinInvalidate();
  const abrirAnexo = useAbrirAnexo();
  const ler = useServerFn(lerComprovanteUpload);
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(0);
  const [edit, setEdit] = useState<Lanc | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, any>>({});
  const fila = lancamentos.filter((l) => !l.revisado).sort((a, b) => b.created_at.localeCompare(a.created_at));

  const enviar = async (files: FileList | null) => {
    if (!files?.length) return;
    const lista = Array.from(files);
    setEnviando(lista.length);
    let ok = 0;
    for (const file of lista) {
      try {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: arquivo acima de 15 MB.`);
        const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
        const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${safe}`;
        const up = await fin.storage.from("fin-comprovantes").upload(path, file, { contentType: file.type || undefined });
        if (up.error) throw new Error(up.error.message);
        await ler({ data: { path, nome: file.name } });
        ok++;
      } catch (e: any) {
        toast.error(e?.message ?? `Falha ao ler ${file.name}`);
      } finally {
        setEnviando((n) => n - 1);
      }
    }
    if (ok) toast.success(`${ok} comprovante(s) lido(s). Revise os dados abaixo.`);
    invalidate();
    if (inputRef.current) inputRef.current.value = "";
  };

  const val = (l: Lanc, k: keyof Lanc) => (rascunho[l.id]?.[k] !== undefined ? rascunho[l.id][k] : (l as any)[k]);
  const setVal = (l: Lanc, k: string, v: any) => setRascunho((r) => ({ ...r, [l.id]: { ...r[l.id], [k]: v } }));

  const confirmar = async (l: Lanc) => {
    const r = rascunho[l.id] ?? {};
    const payload: any = { ...r, revisado: true };
    if (r.valor !== undefined) payload.valor = parseValorBR(r.valor);
    const { error } = await fin.from("fin_lancamentos").update(payload).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    setRascunho((x) => { const c = { ...x }; delete c[l.id]; return c; });
    toast.success("Comprovante confirmado.");
    invalidate();
  };
  const descartar = async (l: Lanc) => {
    if (!confirm("Excluir este lançamento lido? O arquivo no Drive não é apagado.")) return;
    const { error } = await fin.from("fin_lancamentos").delete().eq("id", l.id);
    if (error) toast.error(error.message); else invalidate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px] text-sm">
            <p className="font-medium">Enviar comprovantes</p>
            <p className="text-muted-foreground text-xs">
              Fotos ou PDFs de cupons, notas, boletos e recibos. A IA lê fornecedor, valor, vencimento e escolhe a categoria.
              Os arquivos da pasta do Google Drive "00-Comprovantes Gerais" chegam aqui sozinhos pelo Claude.
            </p>
          </div>
          <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => enviar(e.target.files)} />
          <Button onClick={() => inputRef.current?.click()} disabled={enviando > 0}>
            {enviando > 0 ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {enviando > 0 ? `Lendo ${enviando}...` : "Enviar arquivos"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">A revisar</h3>
        <Badge variant="secondary">{fila.length}</Badge>
      </div>
      {fila.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comprovante aguardando revisão.</p>}

      <div className="grid gap-3 xl:grid-cols-2">
        {fila.map((l) => {
          const catsTipo = categorias.filter((c) => c.ativo && c.tipo === (l.tipo === "receber" ? "receita" : "despesa"));
          const baixa = (l.ia_confianca ?? 1) < 0.6;
          return (
            <Card key={l.id} className={baixa ? "border-amber-500/60" : undefined}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm truncate" title={l.arquivo_nome ?? ""}>{l.arquivo_nome ?? "Lançamento"}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">{l.origem === "drive" ? "Drive" : l.origem === "upload" ? "Upload" : l.origem}</Badge>
                  {l.ia_confianca != null && <Badge variant={baixa ? "destructive" : "secondary"} className="text-[10px]">confiança {Math.round(Number(l.ia_confianca) * 100)}%</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[11px] text-muted-foreground">Fornecedor</label>
                    <Input className="h-8" value={val(l, "contraparte") ?? ""} onChange={(e) => setVal(l, "contraparte", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Valor</label>
                    <Input className="h-8" value={rascunho[l.id]?.valor ?? String(l.valor).replace(".", ",")} onChange={(e) => setVal(l, "valor", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Vencimento</label>
                    <Input className="h-8" type="date" value={val(l, "vencimento") ?? ""} onChange={(e) => setVal(l, "vencimento", e.target.value || null)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-muted-foreground">Categoria</label>
                    <Select value={val(l, "categoria_id") || NONE} onValueChange={(v) => setVal(l, "categoria_id", v === NONE ? null : v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem categoria</SelectItem>
                        {catsTipo.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Empresa</label>
                    <Select value={val(l, "empresa_id") || NONE} onValueChange={(v) => setVal(l, "empresa_id", v === NONE ? null : v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Documento</label>
                    <Select value={val(l, "tipo_documento") || NONE} onValueChange={(v) => setVal(l, "tipo_documento", v === NONE ? null : v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate" title={l.descricao ?? ""}>
                  {l.descricao ?? "Sem descrição"} · emissão {formatDataBR(l.data_emissao)} · {formatBRL(l.valor)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => confirmar(l)}><Check className="h-4 w-4 mr-1" />Confirmar</Button>
                  {(l.arquivo_url || l.arquivo_path) && <Button size="sm" variant="outline" onClick={() => abrirAnexo(l)}><Paperclip className="h-4 w-4 mr-1" />Ver arquivo</Button>}
                  <Button size="sm" variant="outline" onClick={() => setEdit(l)}><Pencil className="h-4 w-4 mr-1" />Todos os campos</Button>
                  <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => descartar(l)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <LancamentoDialog open={!!edit} onClose={() => setEdit(null)} tipo={edit?.tipo ?? "pagar"} lanc={edit} categorias={categorias} empresas={empresas} />
    </div>
  );
}
