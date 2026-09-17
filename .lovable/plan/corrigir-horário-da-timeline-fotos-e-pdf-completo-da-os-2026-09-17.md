# Corrigir horário da Timeline + fotos e PDF completo da OS

## O que está acontecendo (análise FMEA)

Conferi direto na conexão com o Seu Instalador. A OS GTN9D56 do dia 21/09 volta com o horário gravado em fuso universal (`2026-09-21T12:00:00+00:00`), que equivale a **09:00 em Brasília**.

| Falha | Causa | Efeito | Gravidade | Detecção | Ação |
|---|---|---|---|---|---|
| OS de 09:00 aparece às 12:00 na Timeline | A tela lê os dois primeiros números do horário como se já fossem hora local, ignorando o fuso | Agenda do dia inteira deslocada em 3 horas; risco de técnico ser enviado no horário errado | Alta | Baixa (parece um dado plausível) | Converter sempre para o horário de Brasília |
| Ao editar a OS, a hora carregada pode vir errada | A edição usa o fuso do computador de quem abre a tela | Um salvamento pode mover a OS de horário sem querer | Alta | Baixa | Fixar tudo no horário de Brasília |
| Data/hora nas listas depende do fuso do navegador | Mesma origem | Divergência entre usuários/servidor | Média | Média | Formatação única em Brasília |
| Fotos da OS não abrem aqui | O Seu Instalador não oferece as fotos na conexão (endpoint responde "não encontrado") | Não dá para conferir evidências sem entrar no outro sistema | Média | Alta | Pedir a liberação; deixar a tela pronta para exibir assim que vier |

## O que vou fazer

1. **Horário correto em toda a Agenda**
   - Passar a interpretar o horário respeitando o fuso enviado pela API e exibir sempre em horário de Brasília (Timeline, Atividades e detalhes).
   - O bloco na Timeline passa a cair na coluna certa (09:00) e a mostrar o horário no próprio bloco.
   - A edição da OS carrega e salva a hora também em Brasília, sem deslocamento.

2. **Detalhes da OS: fotos**
   - Nova seção "Fotos da OS" no diálogo de detalhes, em miniaturas, com ampliação ao clicar.
   - Hoje a conexão não entrega fotos: enquanto não liberarem, a seção mostra um aviso curto explicando isso. Vou incluir esse pedido no documento que já preparei para o Seu Instalador.

3. **Botão "Baixar PDF da OS completa"** no diálogo de detalhes
   - PDF com cabeçalho (identificador, título, status), dados completos (cliente, técnico, tipo, agendamento em Brasília, duração, endereço, descrição, criada em), o histórico da OS e as fotos quando estiverem disponíveis.
   - Nome do arquivo: `OS-{identificador}.pdf`.

## Detalhes técnicos

- `src/components/agenda/shared.ts`: novas funções de fuso (`saoPauloParts`) usadas por `formatDateTime`/`formatTime` com `timeZone: "America/Sao_Paulo"`; nova `minutesOfDaySP`.
- `src/components/agenda/timeline-content.tsx`: `minutesOfDay` substituída pela versão com fuso; horário exibido no bloco.
- `src/components/agenda/os-detalhes-dialog.tsx`: `splitDateTime` em Brasília; seção de fotos (lendo `photos`/`images`/`attachments` do registro quando existirem); botão de PDF via `jspdf` (já instalado), incluindo histórico e imagens via `addImage`.
- `src/components/agenda/atividades-content.tsx`: PDF da linha reaproveita o mesmo gerador completo.
- Sem alteração de banco de dados.
