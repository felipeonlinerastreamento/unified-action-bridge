-- Contratos › regras automáticas: setores que recebem cada aviso (todos os usuários ativos do setor).
ALTER TABLE public.contratos_config
  ADD COLUMN IF NOT EXISTS lembrete_avisar_setores uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vencimento_avisar_setores uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reajuste_avisar_setores uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proposta_avisar_setores uuid[] NOT NULL DEFAULT '{}';
