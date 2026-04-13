

## Diagnostico: Autenticacao GSystem API

### Problema Identificado

O erro retornado pela API do GSystem e:
```
Falha na autenticação GSystem [400]: A senha informada está inválida!
```

Isso significa que a API esta recebendo a requisicao corretamente (CNPJ e Login foram aceitos), mas o campo de senha esta incorreto.

### Possiveis Causas

O codigo atual envia o campo `PasswordHash`, mas a API pode esperar:
- `Password` (senha em texto plano) em vez de `PasswordHash`
- O valor do secret `GSYSTEM_PASSWORD_HASH` pode estar incorreto (ex: hash errado, espacos extras)

### Plano de Acao

**Passo 1 -- Criar server function de teste de autenticacao**

Adicionar uma funcao `testGsystemAuth` em `src/lib/gsystem-api.functions.ts` que:
- Tente autenticar com `PasswordHash` (formato atual)
- Se falhar, tente com `Password` (mesmo valor)
- Retorne o resultado detalhado (status, mensagem, campos tentados) sem expor a senha

**Passo 2 -- Adicionar botao de teste na UI**

Na pagina de Configuracoes (`/configuracoes`), adicionar um card "Integracao GSystem API" com:
- Botao "Testar Conexao"
- Exibicao do resultado (sucesso/erro)
- Indicacao de qual campo funcionou

**Passo 3 -- Corrigir o campo de autenticacao**

Baseado no resultado do teste, ajustar `gsystem-api.server.ts` para usar o campo correto (`Password` ou `PasswordHash`).

Se ambos falharem, o secret `GSYSTEM_PASSWORD_HASH` precisa ser atualizado com o valor correto.

### Detalhes Tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/gsystem-api.functions.ts` | Nova funcao `testGsystemAuth` |
| `src/lib/gsystem-api.server.ts` | Possivel ajuste do campo de senha |
| `src/routes/configuracoes.tsx` | Card de teste de conexao |

