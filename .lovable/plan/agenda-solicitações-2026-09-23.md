# Agenda › Solicitações

Novo submenu em **Agenda › Solicitações**, visível para todos os usuários logados, com as três abas do outro sistema: **Verificar disponibilidade**, **Registrar solicitação** e **Direcionar por região** — tudo lendo e gravando direto no Seu Instalador.

## Antes de tudo: o que a integração permite hoje

Consultei a lista oficial de recursos da integração do Seu Instalador. Ela oferece apenas: timeline do dia, atividades (OS), clientes, tipos de serviço por cliente, técnicos, históricos e **criação de agendamento**. Não existe nenhum recurso de "solicitações" (fila de pedidos pendentes, aprovar/recusar).

Consequência: as três abas serão montadas com esses recursos. A aba **Registrar solicitação** cria o agendamento de verdade no Seu Instalador; não haverá uma fila separada de pedidos aguardando aprovação enquanto eles não liberarem esse recurso.

## Aba 1 — Verificar disponibilidade

- Escolha de data (setas anterior / Hoje / próximo), tipo de serviço e duração desejada.
- Grade com cada técnico ativo e as faixas de 07:00 às 20:00 (horário de Brasília), mostrando o que já está ocupado no dia e destacando em verde os espaços livres compatíveis com a duração.
- Filtros por técnico e por empresa; busca por texto.
- Clicar num espaço livre leva para a aba "Registrar solicitação" já com data, hora e técnico preenchidos.
- Clicar num bloco ocupado abre os detalhes da OS (mesma janela já usada em Atividades e Timeline).

## Aba 2 — Registrar solicitação

- Formulário: cliente (busca a partir de 3 letras), tipo de serviço do cliente, técnico, data, hora, duração, identificador, endereço (ou "sem endereço") e observações.
- Antes de enviar, checagem de conflito: avisa se o técnico já tem atendimento no horário.
- Envio com chave de idempotência (não duplica se a rede falhar); mensagens de erro em português (horário ocupado, identificador repetido etc.).
- Ao concluir, mostra a OS criada com botão para abrir os detalhes e as demais abas se atualizam.

## Aba 3 — Direcionar por região

- Mesma data selecionada nas outras abas.
- Lista as OSs do dia agrupadas por cidade/bairro, com contagem por região e por técnico.
- Para cada região, mostra quais técnicos já estão atuando ali e quantos atendimentos têm, sugerindo o técnico com menos carga na região — assim o direcionamento é feito por proximidade, não no chute.
- Painel lateral com as OSs sem endereço reconhecido, para tratamento manual.
- Clicar numa OS abre os detalhes; há botão "Agendar nesta região" que leva à aba 2 com técnico e cidade pré-selecionados.

## Acesso

O item aparece para todos os usuários logados, sem depender de liberação por grupo de setor (mesmo comportamento do Mapa).

## Detalhes técnicos

- Nova rota `src/routes/agenda.solicitacoes.tsx` com `Tabs` (3 abas, estado da data e dos filtros compartilhado no nível da rota) e `head()` próprio.
- Item "Solicitações" adicionado a `agendaSubItems` em `src/components/app-sidebar.tsx`; sem entrada em `MENU_CATALOG`/`URL_TO_MENU_SLUG`, portanto sempre visível (padrão atual do Mapa).
- Componentes novos em `src/components/agenda/`: `solicitacoes-disponibilidade.tsx`, `solicitacoes-registrar.tsx`, `solicitacoes-regiao.tsx`.
- Reaproveita `listarAtividades`, `buscarClientes`, `listarTiposServico`, `listarTecnicos` e `criarAgendamento` de `src/lib/seu-instalador.functions.ts` (nenhuma função nova de servidor), mais `shared.ts` (`STATUS_STYLES`, `statusStyle`, `osAddress`, `osCoords`, fuso de São Paulo) e `os-detalhes-dialog.tsx`.
- Cálculo de janelas livres feito no cliente sobre as atividades do dia (grade de 07:00–20:00 em passos de 30 min, descontando cada bloco ocupado por técnico).
- Agrupamento por região usa cidade/bairro do endereço da OS; quando faltar, cai em "Sem região identificada" (sem chamadas extras de geocodificação).
- Sem migração de banco e sem alteração nas telas existentes de Atividades, Timeline e Mapa.

## Pendência junto ao Seu Instalador

Enviar pedido para liberarem os recursos de solicitação (listar pedidos pendentes, aceitar/recusar, reagendar). Assim que liberarem, as abas passam a consumir a fila real sem mudança de layout.
