# Atualizar integração com o Seu Instalador

Ampliar a integração para usar todos os recursos que o Seu Instalador passou a oferecer: edição de OS, reagendamento, troca de status, técnicos terceiros, fila real de Solicitações e Direcionamento regional.

## O que muda para o usuário

**Atividades / Timeline / Mapa (detalhes da OS)**
- Botão **Editar** passa a salvar de verdade (técnico, tipo, data/hora, duração, identificador, endereço, observações).
- Novos botões: **Reagendar**, **Alterar status** (com motivo), **Duplicar OS** e **Excluir** (só Admin/Gestor, com confirmação).
- Detalhes carregam da OS completa (fotos, se a API retornar).

**Técnicos terceiros**
- No "Novo agendamento", opção **Técnico terceiro** com lista própria.
- Ao criar, aparece o link público e o botão **Enviar pelo WhatsApp** (abre o WhatsApp; nada é enviado automaticamente).
- Na OS de terceiro: **Renovar link** (avisa que o anterior deixa de funcionar) e **Revogar link**.

**Agenda › Solicitações** (agora espelhando a fila real do Seu Instalador)
- Lista vem de `/requests` com os chips de status (Pendentes, Aprovadas, etc.).
- Ao abrir uma solicitação: dados, comentários, e ações **Aprovar**, **Recusar**, **Cancelar**, **Recriar**, **Editar** e **Comentar**.
- Aba **Verificar disponibilidade** usa a disponibilidade oficial da API.
- Aba **Registrar solicitação** cria a solicitação no Seu Instalador (em vez de criar a OS direto).
- Aba **Direcionar por região** usa o direcionamento oficial: cria o pedido, pede a análise (sugestão de técnico e horário) e confirma.

## Segurança (mantida e reforçada)
- Chave só no servidor, nome do usuário tirado do cadastro, `X-Request-Id` em toda chamada.
- `Idempotency-Key` em todo POST/PATCH/DELETE, reaproveitada em repetição por rede/timeout e nova quando o conteúdo muda.
- Em "muitas solicitações", espera o tempo indicado e tenta uma vez; mensagens da API exibidas em português.
- Nada de chave, link público ou cabeçalhos nos registros.

## Detalhes técnicos
- Primeiro passo: ler `/openapi.json` com a chave (exige autenticação) para confirmar nomes de campos e corpos antes de montar telas.
- `src/lib/seu-instalador.functions.ts`: `callApi` passa a suportar DELETE, retry único em 429 com `Retry-After` e em erro de rede reutilizando a mesma chave; todas as mutações exigem `idempotencyKey` gerada no cliente (hook `useIdempotentKey` que renova quando o payload muda, via hash).
- Novas server fns (Zod + `requireSupabaseAuth`): `obterOS`, `atualizarOS` (PATCH), `excluirOS`, `reagendarOS`, `clonarOS`, `alterarStatusOS`, `listarTecnicosTerceiros`, `criarAgendamentoTerceiro`, `renovarLinkTerceiro`, `revogarLinkTerceiro`, `listarSolicitacoes`, `obterSolicitacao`, `criarSolicitacao`, `atualizarSolicitacao`, `comentarSolicitacao`, `aprovar/recusar/cancelar/recriarSolicitacao`, `disponibilidadeSolicitacoes`, `listar/obter/criar/analisar/confirmarDirecionamento`. Substituem `atualizarAgendamento`/`alterarStatusAgendamento` antigos.
- Mutações de exclusão/status restritas a Admin/Gestor no servidor (`has_role`).
- UI: `os-detalhes-dialog.tsx` (ações), `novo-agendamento-dialog.tsx` (terceiro + WhatsApp), `agenda.solicitacoes.tsx` + `solicitar-servico-dialog.tsx` + abas (dados reais), novo `solicitacao-detalhes-dialog.tsx`.
- Sem mudança no banco.
