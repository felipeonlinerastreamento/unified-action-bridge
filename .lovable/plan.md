# Concluir as três partes restantes da integração Seu Instalador

## 1. Direcionar por região (fluxo oficial)
- O formulário atual (empresa, atividade, identificador, prioridade, endereço, data, duração, horário exato ou janela, contato, telefone, observações) continua igual.
- Ao enviar: o endereço é localizado no mapa (usando o localizador que o sistema já tem), o pedido é registrado no Seu Instalador e a análise oficial é solicitada.
- A tela mostra a recomendação do Seu Instalador (técnico sugerido, horário e justificativa). O usuário pode aceitar ou trocar técnico e horário e clica em **Confirmar**, o que cria a OS.
- Abaixo do formulário, uma lista dos direcionamentos já feitos (status, cliente, data). Clicar em um item permite analisar de novo ou confirmar os que ainda estão pendentes.
- Prioridade passa a ter só Normal, Alta e Urgente, como o Seu Instalador aceita. "Baixa" vira Normal.

## 2. Verificar disponibilidade (oficial)
- A grade de técnicos por horário passa a vir da disponibilidade oficial do Seu Instalador para o dia escolhido.
- Se a resposta oficial não trouxer dados, a grade volta ao cálculo atual automaticamente e mostra um aviso discreto.
- Clicar num horário livre continua abrindo "Registrar solicitação" já preenchida.

## 3. Técnico terceiro no Novo agendamento
- Nova escolha no topo: **Técnico da equipe** / **Técnico terceiro**.
- Com "Técnico terceiro", a lista mostra os terceiros cadastrados no Seu Instalador.
- Depois de criar, a janela mostra o link público e o botão **Enviar pelo WhatsApp**. A mensagem não é enviada sozinha.
- Enquanto o Seu Instalador não liberar essa parte, aparece o aviso "recurso ainda não liberado".

## Extra: "Registrar solicitação" cria solicitação de verdade
- A aba passa a registrar uma **solicitação** no Seu Instalador, que entra na fila para aprovação, em vez de criar a OS direto.
- Contato e telefone ficam obrigatórios, como o Seu Instalador exige.

## Detalhes técnicos
- Todas as chamadas usam as funções de servidor já criadas: `criarDirecionamento`, `analisarDirecionamento`, `confirmarDirecionamento`, `listarDirecionamentos`, `disponibilidadeSolicitacoes`, `listarTecnicosTerceiros`, `criarAgendamentoTerceiro` e `criarSolicitacao`. A chave de idempotência é gerada uma vez por envio e reaproveitada nas repetições.
- Arquivos: `solicitacoes-direcionar.tsx` (novo fluxo e lista), `solicitacoes-disponibilidade.tsx` (adaptador da resposta oficial com alternativa local), `solicitacoes-registrar.tsx` (troca para `criarSolicitacao` e inclusão de contato), `novo-agendamento-dialog.tsx` (opção de terceiro e WhatsApp).
- A localização no mapa usa `geocode.functions.ts`. Se o endereço não for encontrado, a tela pede para ajustá-lo.
- Não há mudança no banco de dados.
