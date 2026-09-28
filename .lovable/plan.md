# Gatilhos: ação "Nenhuma" + filtro por palavra no relatório

## O que muda
1. **Z-API & Bot → Gatilhos → Nova regra → Ação**: nova opção **"Nenhuma (apenas registrar no relatório)"**.
   - Com ela, o gatilho não mostra alerta, não transfere e não trava a tela; só grava o disparo (palavra, contato, trecho da mensagem) em Relatórios → Gatilhos.
   - Os campos de alerta e de transferência ficam ocultos quando "Nenhuma" está selecionada.
   - Na lista de regras, aparece o selo "Somente registro".
   - A opção "Abrir chamado" continua independente, como hoje.
2. **Relatórios → Gatilhos**: novo filtro **"Palavra"** acima da tabela:
   - Lista de seleção com todas as palavras que dispararam no período (com a quantidade), mais "Todas as palavras".
   - Campo de busca por texto para achar uma palavra específica.
   - Cartões de resumo, tabela e exportação CSV passam a respeitar o filtro.
   - A coluna "Status" mostra "Registrado" para disparos sem destinatário.

## Detalhes técnicos
- `src/lib/message-triggers.server.ts`: tipo `action_type` ganha `"none"`; com `none` o fluxo já cai no ramo `else` que insere uma linha de log sem destinatário (sem alerta/transferência). Nenhuma mudança de banco (coluna `action_type` é texto, sem restrição).
- `src/components/configuracoes/message-triggers-config.tsx`: `SelectItem value="none"`, `actionLabel.none`, ícone neutro; blocos de alerta/transferência já condicionados ao tipo.
- `src/components/relatorios/message-triggers-tab.tsx`: estados `keyword` (select) e `keywordSearch` (texto, sem acento/maiúsculas); `filteredLogs` via `useMemo` alimenta KPIs, tabela e CSV. Ação "—" vira "Somente registro" quando `rule` sem alerta/transferência.
