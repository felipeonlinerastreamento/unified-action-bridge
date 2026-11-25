import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDEM_TABELAS, lerArquivo, tabelaDoArquivo, type TabelaGe } from "@/lib/ge/importacao";
import { geDefinirSync, geImportarLote, geStatusMigracao, geVincularEmpresas } from "@/lib/ge/importacao.functions";

export const Route = createFileRoute("/gestao-eventos/admin/importacao")({
  component: ImportacaoGe,
});

type Resultado = { tabela: string; recebidas: number; gravadas: number; ignoradas: number; erros: string[]; usuarios_criados?: number; usuarios_existentes?: number };

function ImportacaoGe() {
  const { isPlatformAdmin } = useAuth();
  const importar = useServerFn(geImportarLote);
  const vincular = useServerFn(geVincularEmpresas);
  const definirSync = useServerFn(geDefinirSync);
  const lerStatus = useServerFn(geStatusMigracao);
  const status = useQuery({ queryKey: ["ge-migracao"], queryFn: () => lerStatus() });
  const [arquivos, setArquivos] = useState<{ tabela: TabelaGe; nome: string; linhas: Record<string, unknown>[] }[]>([]);
  const [naoReconhecidos, setNaoReconhecidos] = useState<string[]>([]);
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);

  if (!isPlatformAdmin) return <div className="text-muted-foreground">Apenas administradores.</div>;

  const escolher = async (files: FileList | null) => {
    if (!files) return;
    const lidos: typeof arquivos = [];
    const fora: string[] = [];
    for (const f of Array.from(files)) {
      const tabela = tabelaDoArquivo(f.name);
      if (!tabela) { fora.push(f.name); continue; }
      try {
        lidos.push({ tabela, nome: f.name, linhas: lerArquivo(f.name, await f.text()) });
      } catch (e) {
        fora.push(`${f.name} (${(e as Error).message})`);
      }
    }
    lidos.sort((a, b) => ORDEM_TABELAS.indexOf(a.tabela) - ORDEM_TABELAS.indexOf(b.tabela));
    setArquivos(lidos);
    setNaoReconhecidos(fora);
    setResultados([]);
  };

  const executar = async () => {
    setRodando(true);
    const res: Resultado[] = [];
    try {
      for (const a of arquivos) {
        const acc: Resultado = { tabela: a.tabela, recebidas: 0, gravadas: 0, ignoradas: 0, erros: [] };
        for (let i = 0; i < a.linhas.length; i += 500) {
          setProgresso(`${a.tabela}: ${i} de ${a.linhas.length}`);
          const r = (await importar({ data: { tabela: a.tabela, linhas: a.linhas.slice(i, i + 500) } })) as Resultado;
          acc.recebidas += r.recebidas; acc.gravadas += r.gravadas; acc.ignoradas += r.ignoradas;
          acc.erros.push(...r.erros);
          if (r.usuarios_criados != null) acc.usuarios_criados = (acc.usuarios_criados ?? 0) + r.usuarios_criados;
          if (r.usuarios_existentes != null) acc.usuarios_existentes = (acc.usuarios_existentes ?? 0) + r.usuarios_existentes;
        }
        res.push(acc);
        setResultados([...res]);
      }
      const v = await vincular();
      toast.success(`Importação concluída. ${v.vinculados} cliente(s) ligados ao cliente do Gestão.`);
      if (v.semPar.length) toast.info(`Sem cliente correspondente no Gestão: ${v.semPar.slice(0, 8).join(", ")}${v.semPar.length > 8 ? "…" : ""}. Ligue em Clientes.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRodando(false);
      setProgresso("");
      void status.refetch();
    }
  };

  const alternarSync = async (ativo: boolean) => {
    try {
      await definirSync({ data: { ativo } });
      toast.success(ativo ? "Busca automática nas APIs ligada no Gestão." : "Busca automática desligada.");
      void status.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Importar do sistema antigo (Gestão Telemetria e Fadiga)</CardTitle>
          <CardDescription>
            No projeto antigo, abra Cloud › Database e exporte cada tabela (CSV). Envie todos os arquivos de uma vez:
            a ordem é ajustada sozinha e a importação pode ser repetida sem duplicar. Usuários com e-mail já cadastrado
            no Gestão são reaproveitados; os demais viram usuários de cliente e precisam de senha nova (Usuários).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="file" multiple accept=".csv,.json" onChange={(e) => void escolher(e.target.files)} disabled={rodando} />
          {naoReconhecidos.length > 0 && (
            <p className="text-sm text-amber-600">Arquivos ignorados (nome não corresponde a uma tabela): {naoReconhecidos.join(", ")}</p>
          )}
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {arquivos.map((a) => <Badge key={a.nome} variant="secondary">{a.tabela}: {a.linhas.length}</Badge>)}
            </div>
          )}
          <Button onClick={() => void executar()} disabled={rodando || !arquivos.length}>
            {rodando ? `Importando… ${progresso}` : "Importar"}
          </Button>
          {resultados.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead><TableHead>Recebidas</TableHead><TableHead>Gravadas</TableHead>
                  <TableHead>Ignoradas</TableHead><TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((r) => (
                  <TableRow key={r.tabela}>
                    <TableCell>{r.tabela}</TableCell><TableCell>{r.recebidas}</TableCell><TableCell>{r.gravadas}</TableCell>
                    <TableCell>{r.ignoradas}</TableCell>
                    <TableCell className="text-xs">
                      {r.usuarios_criados != null && `${r.usuarios_criados} usuário(s) criados, ${r.usuarios_existentes ?? 0} já existiam. `}
                      {r.erros[0] ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Situação e virada</CardTitle>
          <CardDescription>
            Depois de importar e conferir, ligue a busca automática aqui e desligue o agendamento do projeto antigo,
            para os eventos não chegarem em dobro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {status.error ? (
            <p className="text-destructive">{(status.error as Error).message}</p>
          ) : (
            <>
              <p>Usuários mapeados: {status.data?.usuariosMapeados ?? 0}</p>
              <p>Gravado até agora: {Object.entries(status.data?.totais ?? {}).map(([t, n]) => `${t} ${n}`).join(" · ") || "nada"}</p>
              {status.data?.ultimoErro && <p className="text-amber-600">Último erro: {status.data.ultimoErro}</p>}
              <div className="flex items-center gap-2 pt-2">
                <Badge variant={status.data?.syncAtivo ? "default" : "outline"}>
                  {status.data?.syncAtivo ? "Busca automática ligada" : "Busca automática desligada"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => void alternarSync(!status.data?.syncAtivo)}>
                  {status.data?.syncAtivo ? "Desligar" : "Ligar busca automática (virada)"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
