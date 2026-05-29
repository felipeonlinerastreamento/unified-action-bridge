## Causa raiz

O nome do operador está sendo prefixado **duas vezes** ao enviar uma mensagem de texto:

1. **No cliente** (`src/routes/central.tsx`, linha 2421), quando `nicknameMode` está ativo, o texto vira:
   ```
   *Patrícia:* teste
   ```

2. **No servidor** (`src/lib/zapi.functions.ts`, linhas 510-512), a server function `sendText` também prefixa:
   ```
   _*Patrícia*_\n<texto>
   ```
   A verificação `text.startsWith("_*Nome*_")` falha porque o cliente usou o formato `*Nome:*` (negrito comum), e não `_*Nome*_` (negrito+itálico). Resultado final enviado ao WhatsApp:
   ```
   _*Patrícia*_
   *Patrícia:* teste
   ```
   Que aparece no WhatsApp como:
   ```
   Patrícia
   Patrícia: teste
   ```

Isso só afeta usuários cujo "apelido" enviado pelo cliente coincide com o primeiro nome do perfil (cenário comum). Quando o toggle "sem nome" está ligado no cliente, o servidor ainda prefixa — ou seja, o toggle também está parcialmente quebrado.

## Solução

Tornar o **servidor a única fonte de verdade** para o prefixo do nome do operador, e deixar o toggle do cliente realmente desabilitar o prefixo.

### Mudanças

**1. `src/lib/zapi.functions.ts` — `sendText`**
- Adicionar parâmetro opcional `includeOperatorName?: boolean` no input validator (default `true`).
- Reforçar a detecção de prefixo já existente para cobrir formatos legados antes de prefixar:
  - `_*Nome*_` (atual)
  - `*Nome:*` (formato enviado pelo cliente hoje)
  - `Nome:` no início da primeira linha
- Se `includeOperatorName === false`, não prefixar.
- Aplicar a mesma lógica ao envio com mídia/caption se existir caminho equivalente que prefixe nome (verificar `sendMedia`/`sendImage` correlatos no mesmo arquivo e ajustar de forma consistente).

**2. `src/routes/central.tsx` — `handleSend` (linhas 2416-2428)**
- Remover o prefixo manual `*${nicknameSource}:* ...`. Enviar somente o texto puro.
- Passar `includeOperatorName: nicknameMode && !whisperMode` para `sendMutation`.
- Atualizar a chamada de `sendMutation.mutate` e a definição de `sendMutation` para repassar a flag à server function.

**3. Render da bolha (`src/routes/central.tsx`, linhas 3323-3336)**
- A regex de strip do prefixo `^\*[^*\n]+:\*\s+` pode ser mantida por compatibilidade com mensagens antigas, mas adicionar também o strip de `^_\*[^*\n]+\*_\n` para a nova primeira linha (caso a UI local também precise esconder — verificar se já é feito; se a UI mostra o nome separadamente via `senderFirstName`, remover a duplicata visual).

## Detalhes técnicos

- Não alterar o schema do banco nem mensagens já persistidas.
- O servidor continua sendo o único ponto que decide o formato final enviado ao Z-API, garantindo consistência entre todos os operadores e clientes (web, mobile etc.).
- Backward compatibility: a detecção ampliada no servidor evita re-prefixar mensagens que ainda venham com o formato antigo durante a transição/cache.

## Fora de escopo

- Caminhos de envio diferentes de texto puro (áudio, anexos sem caption) — não causam essa duplicação.
- Mensagens automáticas de bot / templates — fluxo separado.
