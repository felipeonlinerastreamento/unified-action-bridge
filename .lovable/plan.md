# Ciclo do Serviço Técnico — plano

## Como fica para o atendente

```text
Chat cliente -> escolhe categoria "Exige termo" -> [Enviar termo]
   protocolo criado/atualizado: A RESOLVER
Cliente abre link + CPF -> Aceita / Recusa  (sino + aviso no chat + histórico)
   Recusa  -> Reenviar | Gerar outro termo | Encerrar com motivo
   Sem resposta em 8h -> sino "Reenviar termo"
   Aceite  -> [Enviar solicitação] -> Agenda > Solicitações (Seu Instalador)
              protocolo: AGUARDANDO AGENDAMENTO
Grupo dos técnicos -> chamado "Teste de equipamento" (1 por teste)
   protocolo obrigatório -> Teste parcial (protocolo segue) | Serviço concluído (finaliza protocolo)
```

## Parte 1 — Termo e solicitação

1. **Botão "Enviar termo" no chat**: aparece no cabeçalho do chamado do chat só quando a categoria escolhida exige termo. Abre o formulário atual (dados do cliente/placa/contato + tipos de termo vindos de Configurações > CRM). Envia por WhatsApp e/ou e-mail sem encerrar a conversa. Se já houver termo no chamado, vira **"Ver termo"** (situação, reenviar, link), sem duplicar.
2. **Protocolo "A resolver"**: ao enviar o termo, o chamado é criado (ou atualizado, se já existia e mudou de categoria) com o status de serviço técnico "A resolver".
3. **Finalizar o chat**: termo não enviado -> abre o formulário; após enviar, a conversa encerra e o protocolo fica "A resolver" (forçado). Termo já enviado -> encerra direto. Substitui o bloqueio atual ("use A resolver e gere o termo...").
4. **Aceite/recusa**: grava no histórico do protocolo, gera notificação no sino para quem enviou o termo e, se a conversa estiver aberta, um aviso dentro do chat.
5. **Recusa**: três ações no "Ver termo" e em CRM > Serviços Técnicos: reenviar o mesmo termo (novo link, mesmo conteúdo congelado), gerar outro termo (o recusado fica no histórico), encerrar o protocolo com motivo obrigatório.
6. **Aceite**: só então aparece **"Enviar solicitação"** (reaproveita o "Enviar para agendamento" de hoje). A descrição recebe um prefixo fixo e não editável, ex.: `Protocolo #10999 – Manutenção – Placa ABC1D23`; o servidor recoloca o prefixo mesmo se alguém tentar removê-lo. Protocolo passa a "Aguardando agendamento".
7. **8 horas sem resposta**: aviso no sino para quem enviou, com botão "Reenviar termo". Um aviso por envio (reenviar zera o relógio).

## Parte 2 — Teste de equipamento (grupo dos técnicos)

8. **Vários testes no mesmo grupo**: hoje NÃO funciona bem. Ao finalizar, o chat reaproveita qualquer chamado aberto da mesma conversa; se um teste ficou "A resolver", o próximo teste cai nele. Mudança: em conversa de grupo com categoria "Teste de equipamento", sempre criar chamado novo (com opção de "vincular a um teste aberto" quando o atendente quiser continuar o mesmo).
9. **Campo "Protocolo de serviço técnico" obrigatório**: busca por número, placa ou cliente; aceita só protocolo de serviço técnico ainda aberto. Sem protocolo válido o teste não finaliza e fica "A resolver" na fila.
10. **Ao finalizar o teste**: escolher "Teste parcial" (protocolo segue aberto) ou "Serviço concluído" (finaliza o protocolo original, registrando no histórico). Um protocolo pode ter vários testes.
11. **Vínculo nos dois sentidos**: no protocolo, lista de testes (data, técnico, atendente, parcial/concluído); em cada teste, link para o protocolo.

## Regras gerais

12. **Status único**: o status mora só no protocolo (chamado). CRM > Serviços Técnicos passa a mostrar o status do protocolo (o status do termo — pendente/aceito/recusado — continua como informação do documento, não do serviço).
13. **Finalização fora do fluxo**: atendente não finaliza protocolo de serviço técnico manualmente (Atendimentos, chat, edição em massa). Admin/gestor podem, com justificativa obrigatória gravada no histórico. Única saída normal: "Serviço concluído" de um teste ou "Encerrar por recusa".

## O que muda no que já existe hoje

- O bloqueio atual de finalização (trigger exige termo "enviada") é trocado pela regra 13 + "A resolver" forçado.
- O formulário de termo, a página pública com CPF, o catálogo de tipos e as mensagens configuráveis continuam iguais.
- "Enviar para agendamento" vira "Enviar solicitação" com prefixo obrigatório do protocolo.
- Filtros de CRM > Serviços Técnicos (Pendentes/Recusados/Aceitos/Enviadas) ganham coluna/filtro pelo status do protocolo.
- Fluxo de Teste de Equipamento atual (regras em Configurações) ganha o campo de protocolo e a escolha parcial/concluído; chamados de teste antigos não são alterados.

## Detalhes técnicos

**Status**: o status do chamado é um enum (aberto, em_andamento, finalizado, reaberto) e "A resolver" hoje é só um rótulo do chat que grava "aberto". Para não mexer no enum usado em todo o sistema, criar coluna `service_tickets.tech_stage` (texto: `a_resolver`, `aguardando_agendamento`, `agendado`, `concluido`, `encerrado_recusa`) usada só em protocolos técnicos; `status` continua aberto/finalizado. Atendimentos e CRM leem `tech_stage`. Regras de transição em `src/lib/technical-service-cycle.ts` com testes.

**Banco (migrations)**
- `service_tickets`: `tech_stage`, `is_tech_protocol boolean`, `tech_protocol_id uuid` (no chamado de teste -> protocolo), `test_result` (`parcial`/`concluido`), `forced_close_reason`.
- `technical_service_terms`: `sent_by`, `sent_at`, `no_response_notified_at`, `superseded_by` (termo substituído), `resend_count`.
- Índices em `tech_protocol_id` e `(tech_stage)`.
- Trigger substituindo `enforce_technical_term_before_finalize`: bloqueia `status -> finalizado` de protocolo técnico se não for (a) teste "concluído" vinculado, (b) encerramento por recusa com motivo, ou (c) admin/gestor com `forced_close_reason`. Grava em `ticket_activities`/histórico.
- Trigger no aceite/recusa do termo: atualiza histórico, cria `notifications` para `sent_by`, e `tech_stage`.
- Validação no servidor do teste: protocolo existe, `is_tech_protocol`, não finalizado.

**Agendamento das 8h**: rota `src/routes/api/public/tech-term-reminders` protegida por segredo, chamada pelo pg_cron a cada 15 min; seleciona termos pendentes com `sent_at < now() - 8h` e `no_response_notified_at is null`, cria a notificação e marca. Sem envio ao cliente (só aviso interno).

**Telas/arquivos**
- `src/routes/central.tsx`: botão Enviar/Ver termo, finalização nova, aviso de aceite/recusa no chat, grupo sempre cria chamado novo para teste, campo de protocolo e parcial/concluído.
- `src/components/crm/technical-term-dialog.tsx`, novo `technical-term-status-panel.tsx` (Ver termo + ações de recusa + Enviar solicitação).
- `src/components/crm/ticket-technical-term-section.tsx` e detalhe do chamado: lista de testes e link do protocolo.
- `src/components/crm/crm-technical-services-tab.tsx`: status do protocolo.
- `src/components/atendimentos/*`: badge de `tech_stage`, bloqueio de finalizar, justificativa admin/gestor.
- `src/components/agenda/solicitacoes-registrar.tsx` + `src/lib/seu-instalador.functions.ts`: prefixo fixo do protocolo.
- `src/lib/technical-terms.functions.ts`: reenviar, gerar outro, encerrar por recusa, respostas -> notificação.
- `src/components/notifications-bell.tsx`: ação "Reenviar termo".

## Riscos para a produção

- Trocar a trigger de finalização pode travar finalizações legítimas -> regras testadas antes, e admin/gestor sempre com saída justificada.
- Mudar o reaproveitamento de chamados em grupos pode criar chamados duplicados -> restrito a grupo + categoria Teste de equipamento.
- `central.tsx` é grande e central -> mudanças isoladas em componentes novos, publicadas em etapas.
- Chamados técnicos já existentes ficam sem `tech_stage` -> backfill: abertos com termo = conforme termo; finalizados não mexem.
- Cron das 8h só gera aviso interno; nunca envia ao cliente.

## Etapas

1. Banco: colunas, índices, backfill, regras de transição + testes (sem mudar comportamento ainda).
2. Termo no chat: Enviar/Ver termo, "A resolver", nova finalização, nova trigger.
3. Aceite/recusa: histórico, sino, aviso no chat, ações de recusa.
4. Enviar solicitação com prefixo fixo e "Aguardando agendamento".
5. Cron de 8h.
6. Teste de equipamento: grupo multi-chamado, protocolo obrigatório, parcial/concluído, vínculo duplo.
7. Status único em Atendimentos e CRM; finalização fora do fluxo com justificativa.

## Como testar sem enviar nada a cliente

- Usar um contato/conversa de teste com número e e-mail da própria equipe e um grupo de WhatsApp de teste.
- Testes automáticos das regras (transições, validação de protocolo, prefixo, 8h com relógio simulado).
- Teste no navegador com usuários de teste (atendente e gestor): aceite/recusa pela página pública com CPF de teste.
- Solicitação ao Seu Instalador: conferir a descrição gerada antes de enviar; enviar só com placa de teste combinada, ou parar na pré-visualização.
- Cron de 8h: executar manualmente com termo de teste com data retroativa.
