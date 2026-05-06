## Problema
Z-API retorna **HTTP 400** com `PoseidonException` ao enviar áudio. Esse erro acontece porque a Z-API só aceita áudios em **OGG/Opus** (ou MP3) no endpoint `/send-audio`. O `MediaRecorder` do navegador, em Chrome no Windows/Linux, geralmente cai para `audio/webm;codecs=opus` em vez de `audio/ogg;codecs=opus`, e o data URL vai com prefixo `data:audio/webm;...`. A Z-API valida pelo prefixo do data URL e rejeita com Poseidon.

O conteúdo binário Opus é compatível — só o "container/MIME" anunciado precisa ser OGG.

## Correção (mínima e cirúrgica)

### 1. `src/lib/zapi.server.ts` — `zapiSendMedia`
No ramo `kind === "audio"`, normalizar o data URL antes de enviar para Z-API:
- Se o prefixo for `data:audio/webm...` (ou qualquer coisa diferente de `audio/ogg`/`audio/mpeg`), reescrever o cabeçalho para `data:audio/ogg;codecs=opus;base64,` mantendo o payload base64 intacto.
- Se já vier `audio/ogg` ou `audio/mpeg`/`audio/mp3`, enviar como está.

```ts
function normalizeAudioDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;,]+)(;[^,]*)?,(.+)$/);
  if (!m) return dataUrl;
  const mime = m[1].toLowerCase();
  const payload = m[3];
  if (mime === "audio/ogg" || mime === "audio/mpeg" || mime === "audio/mp3") return dataUrl;
  // webm/opus, mp4, etc → reanunciar como ogg/opus (binário Opus é compatível)
  return `data:audio/ogg;codecs=opus;base64,${payload}`;
}
```

Usar dentro de `if (kind === "audio") { … audio: normalizeAudioDataUrl(dataUrl) … }`.

### 2. `src/components/central/audio-recorder-button.tsx` — `pickMimeType`
Reordenar candidatos para priorizar formatos que a Z-API aceita nativamente, evitando a normalização quando possível:
1. `audio/ogg;codecs=opus`
2. `audio/mp4` (Safari → AAC; deixaremos a Z-API rejeitar via fallback no servidor se for o caso — Safari raramente suporta opus/ogg)
3. `audio/webm;codecs=opus`
4. `audio/webm`

(Sem mudanças de UI/comportamento; apenas a ordem de preferência.)

## Por que isso resolve
- Em Chrome/Edge: o navegador grava em webm/opus → o servidor reanuncia como ogg/opus → Z-API aceita.
- Em navegadores que já suportam ogg nativamente: passa direto.
- Não exige conversão real de container (sem ffmpeg/wasm), o que manteria o áudio pequeno e a função de servidor rápida.

## Fora de escopo
- Suporte 100% a Safari/iOS (que grava em mp4/AAC). Pode ser tratado depois com transmuxing client-side ou enviando como documento.
- Outras findings de segurança listadas no painel.