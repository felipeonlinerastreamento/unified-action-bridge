## Objetivo

Aumentar o tamanho máximo de arquivos enviados pelo chat (Central de Atendimento) de **12 MB → 15 MB**, respeitando o teto do WhatsApp para imagens, áudios e vídeos.

## Contexto

Hoje o limite de 12 MB está aplicado em dois pontos:

1. **Validação no navegador** (`src/routes/central.tsx`, linha 1328) — bloqueia o arquivo antes de fazer o upload, exibindo o toast `"Arquivo muito grande (máx. 12 MB)"`.
2. **Validação no servidor** (`src/lib/zapi.functions.ts`, linha 432) — o validador Zod do Server Function `sendMedia` aceita uma `dataUrl` (base64) de no máximo 16.000.000 caracteres, o que dá ~12 MB de arquivo bruto.

Esse fluxo se aplica tanto ao botão **Anexar (📎)** quanto à colagem (Ctrl+V) implementada recentemente — ambos passam pela mesma função `handleFilePicked`.

## Mudanças

### 1. `src/routes/central.tsx` (linha 1328)

Trocar o limite e a mensagem do toast:

```ts
if (file.size > 15 * 1024 * 1024) {
  toast.error("Arquivo muito grande (máx. 15 MB)");
  return;
}
```

### 2. `src/lib/zapi.functions.ts` (linha 432)

Aumentar o teto do `dataUrl` no validador para acomodar 15 MB em base64 (15 MB × 1.37 ≈ 20.5 MB de string base64):

```ts
// base64 data URL — capped at ~15MB encoded to stay safe with Worker payload limits
dataUrl: z.string().min(1).max(21_000_000),
```

## Observações

- **Por que não mais que 15 MB?** O WhatsApp limita imagens, áudios e vídeos a 16 MB. Documentos suportariam até 100 MB, mas isso exigiria mudar a arquitetura para subir o arquivo a um storage e enviar a URL para a Z-API (escolha rejeitada nesta rodada).
- **Sem custo extra**: nenhuma nova infraestrutura, dependência ou secret é necessária.
- **Risco**: payloads próximos do limite do Worker serverless podem ocasionalmente falhar em conexões instáveis. Caso isso ocorra com frequência, o próximo passo seria migrar para upload via storage (Lovable Cloud Storage) — disponível para uma futura iteração.
