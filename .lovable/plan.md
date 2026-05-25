# Corrigir cálculo de "Minha média"

## Problema

No card `Minha média` (componente `src/components/central/my-attendance-kpis.tsx`), o filtro de período usa `closed_at >= início do período`, mas a duração é calculada como `closed_at - created_at`. Resultado: um chat criado dias atrás e finalizado hoje entra na média do "Dia" com a duração total da vida do chat (ex.: 47h num filtro de "hoje").

## Regra correta (confirmada)

- **Quais chats entram:** finalizados dentro do período selecionado (`closed_at` no período), independente de quando foram criados.
- **Base de duração:** do **primeiro envio meu** (`from_me = true`, `is_whisper = false`, `sent_by_user_id = eu`) até `closed_at`.
- Se eu finalizei o chat mas nunca mandei mensagem (raro: finalização sem resposta), o chat **não entra** na média (não houve atendimento meu mensurável).

## Implementação

Arquivo único: `src/components/central/my-attendance-kpis.tsx` (query `my-avg-attendance-time`).

1. Buscar os chats finalizados por mim no período:
   ```ts
   supabase.from("zapi_chats")
     .select("id, closed_at, updated_at")
     .eq("closed_by_user_id", user.id)
     .eq("status", "finalizado")
     .gte("closed_at", since.toISOString());
   ```
2. Se houver chats, buscar a **primeira mensagem minha** em cada um:
   ```ts
   supabase.from("zapi_messages")
     .select("chat_id, created_at")
     .in("chat_id", chatIds)
     .eq("sent_by_user_id", user.id)
     .eq("from_me", true)
     .or("is_whisper.is.null,is_whisper.eq.false")
     .order("created_at", { ascending: true });
   ```
   Reduzir para um `Map<chat_id, firstMineAt>` pegando só o primeiro por chat.
3. Para cada chat finalizado: se existe `firstMineAt`, somar `closed_at - firstMineAt` (clamp em 0). Ignorar chats sem mensagem minha.
4. Média = `totalMs / countComMinhaMensagem / 60000`.

## Verificação

- Selecionar "Dia": chat criado ontem e fechado hoje → contado apenas do meu primeiro envio (hoje) até o fechamento. Sem mais valores > 24h num filtro de dia.
- Selecionar "Semana"/"Mês": mesma lógica, janela maior em `closed_at`.
- Tooltip/legendinha: manter rótulo "Minha média" (sem mudar UI).

## Fora de escopo

- Não mudar o card "Meu setor" nem "Minha meta".
- Não alterar tabelas, RLS ou outros relatórios (operator-performance segue como está).
