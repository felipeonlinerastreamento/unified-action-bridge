import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Brain, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getAiManagerInstructions,
  updateAiManagerInstructions,
} from "@/lib/ai-manager.functions";

const EXAMPLES = [
  "Seja mais rigoroso ao avaliar operadores com TMA acima de 15 minutos.",
  "Priorize alertas de churn para clientes do setor industrial.",
  "Destaque apenas oportunidades comerciais acima de R$ 2.000 recorrentes.",
  "Sugira treinamentos práticos (role-play, scripts) em vez de teóricos.",
  "Use tom direto e objetivo, sem rodeios. Cite nomes de operadores e clientes.",
];

export function ManagerInstructionsCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const fetchFn = useServerFn(getAiManagerInstructions);
  const saveFn = useServerFn(updateAiManagerInstructions);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-manager-instructions"],
    queryFn: () => fetchFn(),
  });

  useEffect(() => {
    if (data?.instructions != null) setValue(data.instructions);
  }, [data?.instructions]);

  const mutation = useMutation({
    mutationFn: () => saveFn({ data: { instructions: value } }),
    onSuccess: () => {
      toast.success("Instruções do Gerente IA salvas.");
      queryClient.invalidateQueries({ queryKey: ["ai-manager-instructions"] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao salvar."),
  });

  const dirty = (data?.instructions || "") !== value;
  const hasContent = value.trim().length > 0;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="text-base flex items-center gap-2">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Brain className="h-4 w-4 text-primary" />
              Instruções do Gerente IA
              {hasContent && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  · {value.length} caracteres
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Estas instruções são usadas <strong>apenas pelo Gerente IA</strong> ao gerar relatórios
              (Análise de Clientes e Performance de Operadores). Não afetam o atendimento ao cliente
              no chat. Diferente do Prompt do Sistema, que orienta a conversa, este campo orienta a
              análise de dados.
            </p>

            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ex.: Foque em clientes com mais de 3 reaberturas no mês. Sugira sempre uma ação concreta para o gestor comercial..."
              maxLength={4000}
              rows={6}
              disabled={isLoading}
              className="font-mono text-sm"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{value.length} / 4000</span>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!dirty || mutation.isPending || isLoading}
                size="sm"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar instruções
              </Button>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs font-medium mb-2">Exemplos (clique para adicionar):</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setValue((v) => (v.trim() ? `${v.trim()}\n${ex}` : ex));
                    }}
                    className="text-xs rounded-full border border-dashed px-3 py-1 hover:bg-muted hover:border-solid transition-colors text-left"
                  >
                    + {ex}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
