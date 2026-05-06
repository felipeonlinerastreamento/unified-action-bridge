## Destacar nome do operador no card de chat

**Arquivo:** `src/components/central/chat-queue-list.tsx` (componente `ChatListItem`)

### Mudança
Mover o nome do operador para uma linha dedicada, na mesma hierarquia tipográfica do nome do cliente (`text-sm font-medium`), com um ponto colorido ao lado para preservar a identificação visual por cor do operador.

### Layout resultante
```
[Avatar]  ↑ Josué II Rachid Veiculos        12:30  (3)
          (31) 9659-1380  [Setor]
          ● Derick                                  ← novo, mesma fonte do nome
          ⏱ 31m 45s
          última mensagem...
```

### Implementação
1. Remover o badge atual de `agentName` (linhas ~367-374) da Row 2 (telefone + setor).
2. Inserir nova linha entre Row 2 e Row 3 (SLA), renderizada apenas quando `agentName` existir, contendo:
   - `<span>` circular de 10px com `backgroundColor: getAgentColor(agentName)` como dot indicador.
   - `<p className="text-sm font-medium truncate" style={{ color: getAgentColor(agentName) }}>` com o nome do operador — mesmas classes do nome do cliente (linha 339).
3. Manter o `getAgentColor` já existente (consistência de cor por operador em toda a fila).

Sem alterações em demais telas.