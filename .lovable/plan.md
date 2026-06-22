## Objetivo

Na categoria "Liberação de Equipamento" (e demais), o balão amarelo **"Padrão de Serviços do cliente"** é carregado automaticamente a partir do cadastro da empresa. Adicionar a opção de **ocultar esse balão apenas para o ticket aberto**, sem afetar o cadastro da empresa nem outros chamados.

## Comportamento

- Novo botão "X" (ícone de fechar) no canto superior direito do balão amarelo, ao lado de "Padrão de Serviços do cliente".
- Ao clicar:
  - O balão some imediatamente (UI otimista).
  - É gravado no ticket que esse balão foi dispensado.
  - Toast de confirmação ("Padrão ocultado neste atendimento").
- A dispensa é **por ticket** — abrir outro ticket da mesma empresa continua mostrando o balão normalmente.
- O cadastro de "Padrão de Serviços" da empresa **não é alterado**.
- Permissões: qualquer usuário autenticado que já enxerga o ticket pode ocultar.

## Reversão

Por padrão, uma vez ocultado fica ocultado. Caso o usuário queira reexibir, há um pequeno link discreto **"Mostrar padrão do cliente"** no rodapé das observações, que limpa a flag e traz o balão de volta.

## Detalhes técnicos

- Nova coluna `service_tickets.hide_service_templates boolean not null default false` (migration).
- `src/components/atendimentos/ticket-detail-panel.tsx`:
  - Condicionar a renderização do bloco `serviceTemplates.length > 0` também a `!ticket.hide_service_templates`.
  - Botão "X" chama `supabase.from('service_tickets').update({ hide_service_templates: true }).eq('id', ticket.id)`, depois `onRefetch()`.
  - Quando `hide_service_templates === true` e existir `serviceTemplates.length > 0`, renderizar o link "Mostrar padrão do cliente" (ação reversa).
- Sem alterações em RLS (a tabela `service_tickets` já permite update pelos papéis autorizados). Tipos do Supabase serão regenerados após a migration.
