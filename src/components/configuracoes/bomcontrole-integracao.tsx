import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, KeyRound, Search, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFinanceAccess } from "@/components/financeiro/use-fin";
import { formatBRL } from "@/lib/finance";
import { janelasImportacao, type LinhaResumo } from "@/lib/finance-bomcontrole";
import {
  importarBomControleFn, integracaoBomControle, registrarImportacaoBomControleFn, salvarChaveBomControleFn,
} from "@/lib/finance.functions";

type Totais = {
  resumo: Record<string, LinhaResumo>;
  lidos: number; novos: number; atualizados: number; ignoradosGsystem: number; clientesGsystem: number; ignoradosOutros: number;
  categoriasNovas: Set<string>; empresasSemCadastro: Set<string>;
};
const vazio = (): Totais => ({ resumo: {}, lidos: 0, novos: 0, atualizados: 0, ignoradosGsystem: 0, clientesGsystem: 0, ignoradosOutros: 0, categoriasNovas: new Set(), empresasSemCadastro: new Set() });
const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const nomeMes = (m: string) => { const [a, mm] = m.split("-"); return `${mm}/${a}`; };

/** Configurações › Integrações: chave da API do Bom Controle e importação dos últimos 12 meses (+ contas em aberto). */
export function BomControleIntegracao() {
  const { canAccess, isLoading } = useFinanceAccess();
  if (isLoading || !canAccess) return null;
  return <Cartao />;
}

function Cartao() {
  const status = useServerFn(integracaoBomControle);
  const salvar = useServerFn(salvarChaveBomControleFn);
  const importar = useServerFn(importarBomControleFn);
  const registrar = useServerFn(registrarImportacaoBomControleFn);
  const q = useQuery({ queryKey: ["bomcontrole-integracao"], queryFn: () => status(), retry: false });
  const s = q.data as any;
  const [chave, setChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [incluirClientesGsystem, setIncluirClientesGsystem] = useState(false);
  const [rodando, setRodando] = useState<"previa" | "importar" | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ tipo: "previa" | "importar"; t: Totais } | null>(null);

  const doSalvar = async (apagar = false) => {
    setSalvando(true);
    try {
      const r = await salvar({ data: { chave: apagar ? "" : chave.trim() } });
      if (apagar) toast.success("Chave removida.");
      else if (r.ok) toast.success("Bom Controle conectado.");
      else toast.error(`Chave salva, mas o Bom Controle recusou: ${r.erro}`);
      setChave("");
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar."); }
    finally { setSalvando(false); }
  };

  const executar = async (gravar: boolean) => {
    const tipo = gravar ? "importar" : "previa";
    setRodando(tipo); setResultado(null);
    const t = vazio();
    const janelas = janelasImportacao(hojeSP());
    try {
      for (const [i, j] of janelas.entries()) {
        let pagina: number | null = 1;
        while (pagina) {
          setProgresso(`${gravar ? "Importando" : "Conferindo"} ${nomeMes(j.mes)} (${i + 1} de ${janelas.length})${pagina > 1 ? ` · página ${pagina}` : ""}…`);
          let r: any = null;
          for (let tentativa = 1; ; tentativa++) {
            try {
              r = await importar({ data: { de: j.de, ate: j.ate, pagina, gravar, incluirClientesGsystem } });
              break;
            } catch (e: any) {
              const msg = String(e?.message ?? "");
              if (!/LIMITE_BOMCONTROLE|Too Many Requests/i.test(msg) || tentativa >= 6) {
                throw new Error(/LIMITE_BOMCONTROLE|Too Many Requests/i.test(msg)
                  ? "O Bom Controle continua limitando as consultas. Aguarde alguns minutos e rode de novo (nada é duplicado)."
                  : msg);
              }
              for (let s = 30; s > 0; s--) {
                setProgresso(`Bom Controle pediu uma pausa (limite de consultas). Continuando em ${s}s… (${nomeMes(j.mes)}, tentativa ${tentativa + 1})`);
                await new Promise((res) => setTimeout(res, 1000));
              }
            }
          }
          await new Promise((res) => setTimeout(res, 1200)); // folga entre consultas para não estourar o limite
          t.lidos += r.lidos; t.novos += r.novos; t.atualizados += r.atualizados; t.ignoradosGsystem += r.ignoradosGsystem;
          t.clientesGsystem += r.clientesGsystem; t.ignoradosOutros += r.ignoradosOutros;
          r.categoriasNovas.forEach((c: string) => t.categoriasNovas.add(c));
          r.empresasSemCadastro.forEach((c: string) => t.empresasSemCadastro.add(c));
          for (const [mes, l] of Object.entries(r.resumo as Record<string, LinhaResumo>)) {
            const a = (t.resumo[mes] ??= { mes, pagarQtd: 0, pagarTotal: 0, receberQtd: 0, receberTotal: 0, ignoradosGsystem: 0, jaImportados: 0 });
            a.pagarQtd += l.pagarQtd; a.pagarTotal += l.pagarTotal; a.receberQtd += l.receberQtd; a.receberTotal += l.receberTotal;
            a.ignoradosGsystem += l.ignoradosGsystem; a.jaImportados += l.jaImportados;
          }
          pagina = r.proximaPagina ?? null;
        }
      }
      const linhas = Object.values(t.resumo);
      if (gravar) {
        await registrar({ data: {
          de: janelas[0].de, ate: janelas[janelas.length - 1].ate, novos: t.novos, atualizados: t.atualizados,
          ignoradosGsystem: t.ignoradosGsystem + t.clientesGsystem, ignoradosOutros: t.ignoradosOutros,
          totalPagar: linhas.reduce((a, l) => a + l.pagarTotal, 0), totalReceber: linhas.reduce((a, l) => a + l.receberTotal, 0),
        } });
        toast.success(`${t.novos} lançamento(s) importado(s) do Bom Controle; ${t.atualizados} baixa(s) atualizada(s).`);
        q.refetch();
      }
      setResultado({ tipo, t });
    } catch (e: any) {
      toast.error(`${e?.message ?? "Falha ao ler o Bom Controle."}${gravar && t.novos ? ` (${t.novos} já gravados; rode de novo para continuar, sem duplicar)` : ""}`);
    } finally { setRodando(null); setProgresso(null); }
  };

  const situacao = q.isLoading ? { cor: "", texto: "Verificando…" }
    : q.error ? { cor: "destructive", texto: "Erro ao verificar" }
    : !s?.configurado ? { cor: "destructive", texto: "Não configurado" }
    : s?.conectado ? { cor: "ok", texto: "Conectado" }
    : { cor: "destructive", texto: "Chave recusada" };
  const linhas = resultado ? Object.values(resultado.t.resumo).sort((a, b) => a.mes.localeCompare(b.mes)) : [];
  const soma = (k: keyof LinhaResumo) => linhas.reduce((a, l) => a + (l[k] as number), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          Bom Controle — importação do financeiro
          <Badge variant={situacao.cor === "destructive" ? "destructive" : "outline"} className={situacao.cor === "ok" ? "bg-emerald-600 hover:bg-emerald-600 text-white border-transparent" : ""}>
            {q.isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}{situacao.texto}
          </Badge>
        </CardTitle>
        <CardDescription>
          Traz para o Financeiro as contas a pagar e a receber dos últimos 12 meses e as em aberto (até 12 meses à frente).
          Mensalidades que já vêm do GSystem não são importadas de novo. Pode rodar mais de uma vez: nada é duplicado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {s && (
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              {s.configurado ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5" />}
              <div>{s.configurado ? <>Chave configurada {s.origem === "ambiente" ? "nas variáveis do projeto" : "por esta tela"} (termina em <b>…{s.finalChave}</b>).</> : "Nenhuma chave cadastrada."}</div>
            </div>
            {s.configurado && !s.conectado && <div className="flex items-start gap-2 text-destructive"><XCircle className="h-4 w-4 mt-0.5" />{s.erro}</div>}
            <div className="text-muted-foreground">
              Lançamentos do Bom Controle no Financeiro: <b className="text-foreground">{s.importados}</b>
              {s.ultima && <> · última importação em {new Date(s.ultima.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} ({s.ultima.novos} novos)</>}
            </div>
          </div>
        )}

        <div className="rounded-md border p-3 space-y-3">
          <div className="text-sm font-medium flex items-center gap-1"><KeyRound className="h-4 w-4" />{s?.configurado ? "Trocar a chave" : "Cadastrar a chave"}</div>
          <div className="max-w-md"><Label>Chave de API (Bom Controle › Configurações › Configuração de API Key)</Label>
            <Input type="password" autoComplete="off" placeholder={s?.finalChave ? `…${s.finalChave}` : "Cole a chave gerada no Bom Controle"} value={chave} onChange={(e) => setChave(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => doSalvar(false)} disabled={salvando || !chave.trim()}>{salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar e testar</Button>
            {s?.origem === "tela" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => doSalvar(true)} disabled={salvando}>Remover chave</Button>}
          </div>
          <p className="text-xs text-muted-foreground">A chave fica guardada no servidor e nunca volta para a tela (só os 4 últimos caracteres).</p>
        </div>

        {s?.conectado && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={incluirClientesGsystem} onCheckedChange={setIncluirClientesGsystem} />
              Importar também recebíveis de clientes do GSystem que não têm fatura igual no GSystem (ex.: venda de equipamento)</label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => executar(false)} disabled={!!rodando}>
                {rodando === "previa" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}Conferir antes (prévia)</Button>
              <Button size="sm" onClick={() => executar(true)} disabled={!!rodando || resultado?.tipo !== "previa"} title={resultado?.tipo !== "previa" ? "Faça a prévia primeiro" : undefined}>
                {rodando === "importar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Importar</Button>
            </div>
            {progresso && <p className="text-sm text-muted-foreground">{progresso}</p>}
          </div>
        )}

        {resultado && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{resultado.tipo === "previa" ? "Prévia — nada foi gravado. Confira os totais com o Bom Controle." : "Importação concluída."}</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Mês (vencimento)</TableHead><TableHead className="text-right">A pagar</TableHead><TableHead className="text-right">Total a pagar</TableHead>
                  <TableHead className="text-right">A receber</TableHead><TableHead className="text-right">Total a receber</TableHead>
                  <TableHead className="text-right">Já no GSystem</TableHead><TableHead className="text-right">Já importados</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow key={l.mes}>
                      <TableCell>{nomeMes(l.mes)}</TableCell><TableCell className="text-right">{l.pagarQtd}</TableCell><TableCell className="text-right">{formatBRL(l.pagarTotal)}</TableCell>
                      <TableCell className="text-right">{l.receberQtd}</TableCell><TableCell className="text-right">{formatBRL(l.receberTotal)}</TableCell>
                      <TableCell className="text-right">{l.ignoradosGsystem}</TableCell><TableCell className="text-right">{l.jaImportados}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total</TableCell><TableCell className="text-right">{soma("pagarQtd")}</TableCell><TableCell className="text-right">{formatBRL(soma("pagarTotal"))}</TableCell>
                    <TableCell className="text-right">{soma("receberQtd")}</TableCell><TableCell className="text-right">{formatBRL(soma("receberTotal"))}</TableCell>
                    <TableCell className="text-right">{soma("ignoradosGsystem")}</TableCell><TableCell className="text-right">{soma("jaImportados")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>{resultado.t.lidos} linha(s) lida(s) do Bom Controle no período.{resultado.t.lidos === 0 ? " O Bom Controle não devolveu nada: confira se a chave tem acesso ao módulo Financeiro e à empresa certa." : ""}</li>
              <li>{resultado.tipo === "previa" ? `${resultado.t.novos} lançamento(s) novo(s) serão gravados.` : `${resultado.t.novos} gravado(s); ${resultado.t.atualizados} baixa(s) atualizada(s).`}</li>
              {resultado.t.clientesGsystem > 0 && <li>{resultado.t.clientesGsystem} recebível(is) de clientes do GSystem sem fatura igual ficaram de fora (ligue a opção acima para incluir).</li>}
              {resultado.t.ignoradosOutros > 0 && <li>{resultado.t.ignoradosOutros} linha(s) ignorada(s) (transferências entre contas ou valor zero).</li>}
              {resultado.t.categoriasNovas.size > 0 && <li>Categorias do Bom Controle que não existem aqui e serão criadas (em "Outras despesas/receitas" no DRE, para você reclassificar): {[...resultado.t.categoriasNovas].join(", ")}.</li>}
              {resultado.t.empresasSemCadastro.size > 0 && <li>Empresas sem cadastro no Financeiro (lançadas como Online Rastreamento): {[...resultado.t.empresasSemCadastro].join(", ")}.</li>}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
