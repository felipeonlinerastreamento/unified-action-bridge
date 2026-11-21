import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sincronizarFaturasGsystem } from "@/lib/finance.functions";
import { fin, useFinInvalidate } from "./use-fin";

const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nunca";

/** Faturas do GSystem → Contas a receber: situação da última importação e botão para importar agora. */
export function GsystemSyncCard() {
  const sync = useServerFn(sincronizarFaturasGsystem);
  const invalidate = useFinInvalidate();
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const estado = useQuery({
    queryKey: ["fin-gsystem-sync"],
    queryFn: async () => {
      const { data } = await fin.from("fin_gsystem_sync").select("*").eq("id", "faturas").maybeSingle();
      return data as any;
    },
  });

  const importar = async () => {
    setRodando(true);
    try {
      // Cada chamada processa um lote de clientes; repete até terminar a rodada.
      for (let i = 0; i < 200; i++) {
        const r = await sync();
        if (!r.ok) throw new Error(r.error || "Falha na importação.");
        setProgresso(`${r.concluido ? r.totalClientes : r.proximoIndice} de ${r.totalClientes} clientes · ${r.novas} nova(s) · ${r.atualizadas} atualizada(s)`);
        if (r.concluido) {
          toast.success(`GSystem importado: ${r.novas} fatura(s) nova(s), ${r.atualizadas} atualizada(s)${r.erros ? `, ${r.erros} cliente(s) com erro` : ""}.`);
          break;
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível importar do GSystem.");
    } finally {
      setRodando(false);
      setProgresso(null);
      invalidate();
      estado.refetch();
    }
  };

  const s = estado.data;
  return (
    <Card>
      <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="space-y-0.5">
          <div className="font-medium">Faturas do GSystem</div>
          <div className="text-muted-foreground">
            {rodando && progresso
              ? `Importando… ${progresso}`
              : `Última importação completa: ${dataHora(s?.ultima_rodada_concluida_em)}${s?.total_clientes ? ` · ${s.total_clientes} clientes` : ""}${s?.erros ? ` · ${s.erros} com erro` : ""}`}
          </div>
          {!rodando && s?.ultimo_erro && <div className="text-xs text-destructive truncate max-w-[520px]" title={s.ultimo_erro}>Último erro: {s.ultimo_erro}</div>}
        </div>
        <Button variant="outline" onClick={importar} disabled={rodando}>
          {rodando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Importar do GSystem
        </Button>
      </CardContent>
    </Card>
  );
}
