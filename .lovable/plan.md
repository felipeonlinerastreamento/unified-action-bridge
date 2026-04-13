

## Correcao da Autenticacao GSystem - Campo JWT

### Problema Identificado

A autenticacao com a API do GSystem esta funcionando (credenciais corretas), mas a resposta retorna um objeto JSON com a estrutura:

```json
{
  "JWT": { ... },  // pode ser objeto ou string
  "Database": "...",
  "UserKey": "...",
  "RegisterKey": "...",
  "Logo": "...",
  "CompanyInfo": "...",
  "Empresa": "...",
  "Permissions": "..."
}
```

O codigo atual verifica `data?.JWT` mas so aceita se for uma string. Se `JWT` for um objeto (ex: `{ token: "eyJ..." }` ou `{ accessToken: "eyJ..." }`), o token nao e extraido.

### Plano

**Passo 1 -- Melhorar logging para diagnostico**

Em `gsystem-api.server.ts`, adicionar log do tipo e conteudo de `data.JWT` para descobrir a estrutura exata:

```
console.log("[GSystem Auth] JWT field type:", typeof data.JWT);
console.log("[GSystem Auth] JWT field value:", JSON.stringify(data.JWT).substring(0, 500));
```

**Passo 2 -- Tratar JWT como objeto**

Atualizar a funcao `authenticate()` para:
- Se `data.JWT` for string, usar diretamente (ja funciona)
- Se `data.JWT` for um objeto, tentar extrair o token de sub-campos comuns (`token`, `accessToken`, `access_token`, ou o proprio valor se tiver apenas uma chave string)

**Passo 3 -- Atualizar testGsystemAuth**

Melhorar a funcao de teste para mostrar o tipo e valor (truncado) do campo JWT na resposta, permitindo diagnostico visual na UI.

### Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/gsystem-api.server.ts` | Tratar `data.JWT` como objeto, extrair token recursivamente |
| `src/lib/gsystem-api.functions.ts` | Exibir tipo/valor do campo JWT no teste |

