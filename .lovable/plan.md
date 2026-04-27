## Visão geral

A boa notícia: o editor de fluxo do bot **já suporta** mensagens personalizadas por opção e submenus aninhados. O que falta é (1) deixar isso óbvio na UI/documentação e (2) adicionar um novo tipo de nó capaz de **consultar boletos no GSystem** automaticamente.

---

## Como o sistema atual já resolve mensagens personalizadas e submenus

Cada opção de um menu tem o campo "Próximo nó" — basta apontar para outro nó:

- **Mensagem personalizada por opção** → opção aponta para um nó tipo `Mensagem`.
- **Submenu** → opção aponta para outro nó tipo `Menu` com novas opções.

Exemplo do pedido:

```text
[menu] Principal
  1 → [route_to_sector] Vendas
  2 → [message] "Agora é só aguardar..." → [route_to_sector] Atendimento
  3 → [menu] Financeiro
        1 → [route_to_sector] Financeiro
        2 → [gsystem_boleto] Consulta boleto
```

Isso funciona hoje, mas o usuário não percebe porque a UI não dá um exemplo claro.

---

## O que será implementado

### 1. Novo tipo de nó: `gsystem_boleto`

Adicionar um quinto tipo no editor: **"Consultar boletos (GSystem)"**.

Comportamento em runtime (no `zapi-bot.server.ts`):
1. Tenta encontrar o cliente no GSystem usando o telefone do WhatsApp (rota `/clientes/?telefone=...`).
2. Se encontrar: chama `getFaturas(cpfCnpj)` e formata os boletos em aberto.
3. Envia ao cliente uma mensagem com: nº documento, vencimento, valor e link/linha digitável.
4. Após responder, encaminha para o setor configurado (default: **Financeiro**) como fallback humano.
5. Se não encontrar cliente OU nenhum boleto OU erro → mensagem amigável + encaminha para Financeiro.

Configuração do nó na UI:
- **Setor de fallback** (select de setores, default "Financeiro")
- **Mensagem quando há boletos** (template, default: "Encontrei {{count}} boleto(s) em aberto:")
- **Mensagem quando não há boletos** (default: "Não encontrei boletos em aberto no seu CPF/CNPJ. Vou te encaminhar para o Financeiro.")
- **Mensagem quando cliente não identificado** (default: "Não consegui identificar seu cadastro pelo telefone. Vou te encaminhar para o Financeiro.")

### 2. Melhorias UX no editor de fluxo

- Adicionar **bloco de ajuda colapsável** no topo do editor com o exemplo acima ("Como criar mensagens personalizadas e submenus por opção").
- Em cada opção de menu, mostrar **etiqueta visual do tipo do próximo nó** (ex: `→ Mensagem`, `→ Submenu`, `→ Boletos`) para deixar claro o destino.
- Botão **"Criar mensagem para esta opção"** ao lado de cada opção: cria automaticamente um nó tipo Mensagem em branco e já conecta no "next" da opção.
- Botão **"Criar submenu para esta opção"**: cria um novo nó Menu vazio e conecta.

### 3. Defaults adotados (perguntas puladas)

- **Identificação**: pelo telefone do WhatsApp; sem fallback de pedir CPF (encaminha para Financeiro se não achar).
- **Formato**: lista resumida com vencimento, valor e link/linha digitável (o que o GSystem retornar).
- **Sem boletos / erro**: mensagem informativa + encaminha para o Financeiro.

---

## Detalhes técnicos

**Arquivos a editar:**
- `src/components/configuracoes/zapi-bot-flow-editor.tsx` — novo tipo `gsystem_boleto`, bloco de ajuda, etiquetas e atalhos por opção.
- `src/lib/zapi-bot.server.ts` — handler do novo tipo: lookup de cliente por telefone, chamada `getFaturas`, formatação, fallback de roteamento.

**Reuso:**
- `gsystemApiFetch` (servidor) — chamadas autenticadas ao GSystem.
- Endpoint `/faturas/{cpfCnpj}` já existe (`getFaturas` em `gsystem-api.functions.ts`).
- Para lookup por telefone, usar o endpoint de clientes existente (mesma lógica usada hoje no fluxo de identificação de cliente).

**Schema do nó (TypeScript):**
```ts
type FlowNode = {
  ...
  type: "message" | "menu" | "route_to_sector" | "route_to_least_loaded" | "end" | "gsystem_boleto";
  fallback_sector?: string;
  text_success?: string;
  text_no_boletos?: string;
  text_no_client?: string;
};
```

Sem migração de banco — `nodes` já é `jsonb` em `zapi_bot_flows`.

---

## Resultado final

O usuário poderá montar o fluxo solicitado totalmente pela UI:

```text
Menu inicial
 1 → Falar com vendas        (route_to_sector)
 2 → "Agora é só aguardar..." (message → route_to_sector Atendimento)
 3 → Submenu Financeiro
      1 → Setor Financeiro    (route_to_sector)
      2 → Consulta boletos    (gsystem_boleto)
```
