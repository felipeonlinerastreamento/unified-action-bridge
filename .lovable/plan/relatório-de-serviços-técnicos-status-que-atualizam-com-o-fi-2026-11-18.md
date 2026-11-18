# Relatório de Serviços Técnicos — status que atualizam com o filtro de data

## O que muda para o usuário
1. **Contadores nos botões de status**: Todos (N), Aberto (N), Em andamento (N), Finalizado (N), recalculados sempre que a data ou outros filtros mudarem.
2. **Cards de status no topo**: três novos cards (Abertos, Em andamento, Finalizados) ao lado dos cards de tipo de serviço, com a mesma contagem do período.
3. **Filtro de data mais abrangente**: entram no período os serviços criados OU finalizados nas datas selecionadas (igual à aba Chamados).

## Detalhes técnicos
- Arquivo: `src/components/relatorios/services-report-tab.tsx`.
- Consulta: trocar filtro só por `created_at` por `or(created_at entre período, closed_at entre período)`, mesmo padrão de `tickets-report-tab.tsx`.
- Contagens calculadas sobre os dados do período antes de aplicar o filtro de status (para os contadores não zerarem ao escolher um status).
- Reutilizar `report-kpi-card.tsx` para os novos cards; garantir que a query key inclua as datas para refazer a busca.
- Exportações (CSV/XLSX/PDF) passam a usar o mesmo conjunto filtrado.
