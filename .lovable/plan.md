# Estoque: Equipamentos e Chips, Kits de Acessórios e Auditoria

## O que muda para a equipe
1. **Aba "Estoque Local" removida.** O Estoque passa a refletir o GSystem.
2. **Indicadores no topo:** Prontos para instalação (equipamento + chip), Aguardando chip, Com técnicos, Vinculados em veículos.
3. **Resumo por modelo:** prontos com chip x sem chip, por modelo. Clicar filtra a tabela.
4. **Aba "Equipamentos e Chips":** todas as colunas do GSystem (ID, série/IMEI, modelo, chip/ICCID/linha, status, placa, cliente, técnico, plataforma, comunicação, observações). Filtros por ID, chip, série, placa, status, modelo e técnico.
5. **Vincular / Desvincular placa** por linha, gravando no GSystem (equipamento principal/secundário do veículo). A troca de chip segue sendo feita no GSystem (a API não expõe chips); a sincronização atual traz o resultado.
6. **Kit de acessórios (só no nosso sistema):** botão "Acessórios do kit" em cada equipamento, escolhendo modelo e quantidade do catálogo; o saldo é descontado e devolvido ao remover.
7. **Aba "Catálogo de Acessórios":** cadastro (nome, tipo, modelo, saldo, estoque mínimo, ativo).
8. **Aba "Histórico de Movimentações":** cada vinculação, desvinculação e alteração de kit com usuário, data/hora, equipamento, chip, placa e acessórios. Registros não podem ser editados nem apagados.

## Detalhes técnicos
- Migração: `accessory_catalog`, `equipment_kit_items` (equipamento_codigo, accessory_id, quantidade), `gsystem_vinculos_historico` (operação, equipamento, chip, veículo/placa, acessórios jsonb, user_id, user_name, created_at, sucesso/erro). GRANTs + RLS: autenticados leem; Admin/Gestor editam catálogo; histórico só INSERT pelo servidor, sem UPDATE/DELETE.
- Server functions novas em `src/lib/estoque.functions.ts` com `requireSupabaseAuth`: vincular/desvincular (reusa `gsystemApiFetch` PUT /veiculos/{id}, depois atualiza espelho `gsystem_equipamentos` e grava histórico), salvar kit (ajuste de saldo atômico via RPC).
- KPIs e resumo calculados a partir de `gsystem_equipamentos.raw` (Status, Chip, Tecnico, Modelo); regras puras em `src/lib/estoque-kpis.ts` com testes.
- `src/routes/estoque.tsx`: remove aba local; novos componentes em `src/components/estoque/`.
- Sem impacto em Atendimentos, Agenda, Dashboard ou na sincronização existente (conforme FMEA).
