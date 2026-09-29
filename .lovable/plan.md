# Contato 31986379538 — empresa não aparece na conversa

## O que já foi verificado
- O vínculo **está sendo salvo**: o número 31986379538 está ligado a "Lok Auto Locadora de Veiculos Ltda" com o nome "Bruno - Lok Auto". O registro de auditoria mostra mais de 10 vínculos feitos (o último hoje às 08:02), todos gravados com sucesso — por isso não aparece erro.
- Em 28/09 às 15:33 o número chegou a ser vinculado por engano a "E S P Engenharia", e segundos depois voltou para Lok Auto.
- A conversa desse número (em atendimento, última mensagem 25/09) e os atendimentos antigos também apontam para Lok Auto.
- Conclusão: o problema está na **exibição** da empresa na Central, não na gravação. A causa exata ainda não está confirmada.

## Plano
1. **Reproduzir** abrindo a conversa do Bruno na Central (sessão de teste) e verificar qual número a tela usa para procurar a empresa — suspeita principal: a conversa aberta chega com o código interno do WhatsApp (em vez do número) ou com formato diferente, e a busca da empresa não encontra o vínculo.
2. **Corrigir a busca da empresa na Central**:
   - procurar direto pelo número (com e sem 55, últimos 10/11 dígitos), em vez de baixar a lista inteira de telefones;
   - usar também o número salvo na própria conversa quando o número vindo do WhatsApp for um código interno;
   - usar a empresa do atendimento atual/anterior como apoio.
3. **Atualizar a tela na hora** depois de vincular (sem precisar reabrir a conversa), e mostrar a empresa no cabeçalho da conversa.
4. **Evitar vínculos repetidos**: se o número já está na mesma empresa, avisar "Já vinculado a Lok Auto" em vez de gravar de novo.
5. Conferir com o contato 31986379538 que "Lok Auto Locadora de Veiculos Ltda" aparece na conversa.

## Detalhes técnicos
- `src/routes/central.tsx` ~linha 1003: `company-lookup` faz `select company_id, phone_number` de toda `company_phones` e compara no cliente; trocar por consulta filtrada (`in` com variantes do número) + fallback para `zapi_chats.phone` quando `contactPhone` for LID, e para `service_tickets.company_id` do ticket atual.
- Após `linkPhoneToCompany`, usar `setQueryData` com a empresa retornada além do `invalidateQueries`.
- `src/lib/company-sync.functions.ts`: retornar `alreadyLinked` quando nada mudou.
