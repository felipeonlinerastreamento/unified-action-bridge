

## Plano: Diagnóstico e correção do campo de categoria (sincronização com GSystem)

### Problema
O seletor de categoria está vazio porque a chamada a `/pendencias/tipos` na API de Gestão do GSystem (`api.gsystem.com.br`) está falhando silenciosamente — o `catch` retorna `[]` sem exibir erro.

### O que será feito

**1. Adicionar logging para diagnóstico**
- No handler `getTiposPendencia` em `gsystem-api.functions.ts`, adicionar `console.log` do resultado e `console.error` em caso de falha, para identificar se o endpoint retorna dados, retorna vazio, ou dá erro de autenticação.

**2. Melhorar tratamento de erro no useQuery**
- No `central.tsx`, ao invés de silenciar o erro com `catch { return [] }`, exibir o erro no console para facilitar diagnóstico.
- Adicionar um indicador visual no Select quando a lista está vazia (ex: "Erro ao carregar tipos" ao invés de "Nenhum tipo disponível").

**3. Normalizar resposta da API**
- A API do GSystem pode retornar os tipos em formatos variados (array direto, objeto com propriedade `Items`, `Resultado`, etc.). Adicionar normalização robusta no handler para extrair o array correto, similar ao que já é feito em outros endpoints.

**4. Retry automático**
- Adicionar `retry: 2` na configuração do `useQuery` de `tipos-pendencia` para tentar novamente em caso de falha transitória de autenticação.

### Arquivos modificados
- `src/lib/gsystem-api.functions.ts` — logging e normalização de resposta em `getTiposPendencia`
- `src/routes/central.tsx` — melhor tratamento de erro e retry no useQuery

### Detalhes técnicos
- O endpoint `/pendencias/tipos` é chamado via `gsystemApiFetch` que faz autenticação JWT automática
- Se a autenticação OTP estiver falhando, o token pode estar inválido — o logging ajudará a identificar
- A normalização verificará `result`, `result.Items`, `result.Resultado`, `result.Data` antes de retornar

