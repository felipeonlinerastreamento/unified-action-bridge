## Objetivo

Hoje, ao abrir um chat com contato não identificado, o popup "Cliente não identificado" abre automaticamente logo no início do atendimento. A proposta é **não abrir mais o popup no início** — ele só aparecerá quando o operador clicar em **Finalizar atendimento**, bloqueando a finalização até que o cadastro seja feito (ou o telefone vinculado a uma empresa/sub-cliente/CRM existente).

## Mudanças (somente `src/routes/central.tsx`)

### 1. Remover abertura automática no início
- Remover o `useEffect` (linhas ~1102-1107) que faz `setIdentModalOpen(true)` assim que `isUnidentified` fica verdadeiro.
- Manter o cálculo de `isUnidentified` — continua sendo usado para decidir se a finalização exige cadastro.
- Manter o estado `identModalDismissed` (não atrapalha) e o botão manual já existente no header (ícone de identificação) para quem quiser cadastrar antes.

### 2. Disparar o popup ao tentar finalizar
No `onClick` do botão **Finalizar** (linhas ~2741-2761), trocar o comportamento atual:

Hoje:
```ts
if (isUnidentified) {
  toast.error("É obrigatório identificar o contato antes de finalizar...");
  return;
}
```

Passa a ser:
```ts
if (isUnidentified) {
  setIdentModalOpen(true);
  toast.info("Cadastre o contato para concluir a finalização.");
  return;
}
```

Assim o popup abre exatamente no momento da finalização. Após o cadastro (sucesso da `createCrmContactMutation` / `createSubClientMutation` / `linkPhoneMutation`), o operador clica novamente em **Finalizar** e o fluxo segue normal (as queries de lookup já invalidam e `isUnidentified` passa a `false`).

### 3. Ajustes menores de copy/UX
- Tooltip do botão Finalizar passa de "Identifique o contato antes de finalizar" para "Finalizar atendimento" (sempre), já que agora o próprio clique conduz ao cadastro.
- Sem mudanças no conteúdo do diálogo de identificação em si (abas PF/PJ/Fornecedor, Sub-cliente, Vincular empresa) — apenas o gatilho muda.

## Fora do escopo
- Lógica de webhook, criação de protocolo no início do chat, regras do "A resolver" — nada disso é tocado.
- Backend (`company-sync.functions.ts`) e migrations — não há mudança.
- Grupos continuam isentos (já tratados por `isGroup`).

## Riscos
- Operador pode clicar Finalizar, ver o popup, fechar sem cadastrar e tentar de novo — o fluxo se repete (comportamento desejado: bloqueia até identificar).
- Se o lookup ainda estiver carregando (`lookupsReady=false`), `isUnidentified` é `false` e a finalização passa direto. Comportamento idêntico ao atual; sem regressão.
