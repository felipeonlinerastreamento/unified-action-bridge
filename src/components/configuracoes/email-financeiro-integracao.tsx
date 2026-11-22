import { useFinanceAccess } from "@/components/financeiro/use-fin";
import { EmailFinanceiroCard } from "@/components/financeiro/aprovacoes-tab";

/** Configurações › Integrações: leitura da caixa do financeiro. Só aparece para quem tem acesso ao Financeiro. */
export function EmailFinanceiroIntegracao() {
  const { canAccess, isLoading } = useFinanceAccess();
  if (isLoading || !canAccess) return null;
  return <EmailFinanceiroCard />;
}
