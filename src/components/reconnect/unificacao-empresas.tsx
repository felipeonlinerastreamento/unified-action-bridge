import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { unificarContatosReconnect } from "@/lib/reconnect.functions";
import { rc, useRcInvalidate } from "./use-rc";

type Plano = Awaited<ReturnType<typeof unificarContatosReconnect>>;

/**
 * Leva os contatos dos clientes do Reconnect para Empresas › Contatos (marcados "Veículo sem comunicação")
 * e lista, como evidência, os clientes que não foi possível ligar a nenhuma empresa.
 */
export function UnificacaoEmpresas() {
  const unificar = useServerFn(unificarContatosReconnect);
  const invalidate = useRcInvalidate();
  const [plano, setPlano] = useState<Plano | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [manuais, setManuais] = useState<Record<string, string>>({});
  const [texto, setTexto] = useState<Record<string, string>>({});
  const { data: empresas = [] } = useQuery({
    queryKey: ["rc-empresas-lista"],
    enabled: !!plano?.naoIdentificados.length,
    queryFn: async () => ((await rc.from("companies").select("id, name").order("name").limit(10000)).data || []) as { id: string; name: string }[],
  });
  const porNome = new Map(empresas.map((e) => [e.name, e.id]));

  const rodar = async (aplicar: boolean) => {
    setBusy(aplicar ? "Gravando nas empresas..." : "Calculando prévia...");
    try {
      const r = await unificar({ data: { aplicar, manuais } });
      setPlano(r);
      if (aplicar) {
        toast.success(`Pronto: ${r.totais.ligados} cliente(s) ligados, ${r.totais.marcados} contato(s) marcados e ${r.totais.cadastrados} cadastrados nas empresas.`);
        setManuais({});
        setTexto({});
        invalidate();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na unificação.");
    } finally {
      setBusy(null);
    }
  };

  const exportar = async () => {
    if (!plano) return;
    const XLSX: any = await import("@/vendor/xlsx/xlsx.mjs");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plano.naoIdentificados.map((n) => ({
      "Cliente (Reconnect)": n.name, Motivo: n.motivo, Placas: n.vehicle_count, Telefones: n.phones.join(", "), "E-mails": n.emails.join(", "), "Empresas parecidas": n.sugestoes.join(" | "),
    }))), "Não identificados");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plano.empresas.map((e) => ({
      Empresa: e.companyName, "Já existiam (só marcados)": e.marcados.join(", "), "Cadastrados agora": e.cadastrados.join(", "),
    }))), "Contatos nas empresas");
    XLSX.writeFile(wb, `reconnect-unificacao-empresas.xlsx`);
  };

  const escolher = (clientId: string, nome: string) => {
    setTexto((t) => ({ ...t, [clientId]: nome }));
    const id = porNome.get(nome);
    setManuais((m) => { const n = { ...m }; if (id) n[clientId] = id; else delete n[clientId]; return n; });
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Contatos das notificações = Empresas</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          As notificações saem só para os contatos da empresa marcados <b>"Veículo sem comunicação"</b> (Empresas › Contatos).
          Esta rotina liga cada cliente do Reconnect à empresa e leva os telefones/e-mails que estavam no Reconnect:
          se o número ou e-mail já existe na empresa, só marca a opção; se não existe, cadastra o contato já marcado.
          Clientes que não forem identificados aparecem abaixo para ligar à mão.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => rodar(false)} disabled={!!busy}><Search className="h-4 w-4 mr-1" />Ver prévia</Button>
          <Button size="sm" onClick={() => rodar(true)} disabled={!!busy || !plano}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
            {busy ?? `Aplicar${Object.keys(manuais).length ? ` (+${Object.keys(manuais).length} ligação(ões) manual(is))` : ""}`}
          </Button>
          {plano && <Button size="sm" variant="ghost" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar evidências (.xlsx)</Button>}
        </div>
        {plano && (
          <>
            <p className="text-xs">
              {plano.aplicado ? "Aplicado" : "Prévia"}: {plano.totais.clientes} cliente(s) · <b>{plano.totais.ligados}</b> ligados a empresas ·
              {" "}<b>{plano.totais.marcados}</b> contato(s) já existentes a marcar · <b>{plano.totais.cadastrados}</b> a cadastrar ·
              {" "}<span className={plano.totais.naoIdentificados ? "text-amber-600" : ""}><b>{plano.totais.naoIdentificados}</b> não identificados</span>
            </p>
            {plano.naoIdentificados.length > 0 && (
              <div className="max-h-96 overflow-y-auto rounded border">
                <datalist id="rc-empresas">{empresas.map((e) => <option key={e.id} value={e.name} />)}</datalist>
                <Table>
                  <TableHeader><TableRow><TableHead>Cliente (Reconnect)</TableHead><TableHead>Motivo</TableHead><TableHead>Contatos</TableHead><TableHead className="min-w-[260px]">Ligar à empresa</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {plano.naoIdentificados.map((n) => (
                      <TableRow key={n.clientId}>
                        <TableCell className="text-xs font-medium">{n.name}<div className="font-normal text-muted-foreground">{n.vehicle_count} placa(s)</div></TableCell>
                        <TableCell className="text-xs">{n.motivo}{n.sugestoes.length > 0 && <div className="text-muted-foreground">Parecidas: {n.sugestoes.join(" · ")}</div>}</TableCell>
                        <TableCell className="text-xs break-all">{[...n.phones, ...n.emails].join(", ") || "—"}</TableCell>
                        <TableCell>
                          <Input list="rc-empresas" className={`h-7 text-xs ${texto[n.clientId] && !manuais[n.clientId] ? "border-amber-500" : ""}`} placeholder="Digite o nome da empresa..." value={texto[n.clientId] ?? ""} onChange={(e) => escolher(n.clientId, e.target.value)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
