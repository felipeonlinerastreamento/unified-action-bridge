# Responsável automático ao abrir ticket com setor

## O que muda
- Ao criar um ticket em Atendimentos → Novo Ticket e escolher um setor, o responsável deixa de ser quem criou e passa a ser um operador daquele setor.
- O escolhido é o operador **ativo** do setor com **menos tickets em aberto** (aberto, em andamento, reaberto). Empate: quem está online primeiro, depois quem recebeu ticket há mais tempo.
- Se o setor não tiver nenhum operador ativo, o ticket fica no setor sem responsável (aparece na fila do setor) e um aviso informa isso.
- Sem setor escolhido: mantém o comportamento atual (responsável = quem criou).
- Após criar, a mensagem de confirmação mostra o nome do operador que recebeu o ticket.
- Usuários inativos ou "somente painel" nunca recebem tickets.

## Detalhes técnicos
- Migration: função `pick_least_loaded_ticket_agent(_sector text) returns uuid` (SECURITY DEFINER, search_path public) — junta `user_sector_assignments` + `sectors.name = _sector` + `profiles.is_active and not panel_only`, conta `service_tickets` com status em (aberto, em_andamento, reaberto) por `assigned_to`, ordena por contagem, sessão online em `user_presence_sessions`, último ticket recebido. GRANT EXECUTE a authenticated.
- `ticket-create-dialog.tsx` (~linha 522–561): quando há setor, chamar a RPC antes do insert e usar o resultado em `assigned_to` (null se nenhum); toast com o nome.
- Nenhuma alteração nas rotinas de chat do WhatsApp.
