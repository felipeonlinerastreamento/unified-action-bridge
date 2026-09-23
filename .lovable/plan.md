# Mapa da Agenda — pontos de atendimento no modelo do anexo

Substituir o espaço reservado da tela **Agenda › Mapa** por um mapa real, com os pontos de atendimento vindos do Seu Instalador.

## O que o usuário vai ver

- Mapa ocupando a área principal, com zoom/arraste, centralizado automaticamente nos pontos do dia.
- Um pino por OS, colorido pelo status (mesma paleta e legenda já usadas na Timeline).
- Ao clicar no pino: cartão com identificador da OS, cliente, tipo de serviço, técnico, horário agendado, endereço, botão **Ver detalhes da OS** (mesma janela da Atividades, com histórico e PDF).
- Painel lateral esquerdo mantido: busca (cliente, OS, endereço), filtro de técnico, filtro de status e a lista "Destaques na Região" — clicar em um item destaca e centraliza o pino correspondente.
- Seletor de data com dia anterior / hoje / próximo dia (hoje por padrão), no lugar da janela fixa de ±7 dias.
- Legenda de status clicável para ligar/desligar categorias no mapa.
- Rodapé do painel mostra quantas OS têm endereço localizado e quantas não puderam ser posicionadas (com a lista delas), em vez de sumirem silenciosamente.

## Como os pontos são localizados

1. Se a atividade já vier com latitude/longitude do Seu Instalador, usamos direto.
2. Caso contrário, o endereço é convertido em coordenadas no servidor e guardado em cache no banco, para não repetir a consulta a cada abertura.
3. Endereço vazio ou não localizado → a OS aparece apenas na lista lateral, marcada como "sem localização".

## Detalhes técnicos

- Mapa com **Leaflet + react-leaflet** e blocos do OpenStreetMap (sem chave de API). Carregado só no navegador: componente isolado em `src/components/agenda/mapa-leaflet.tsx`, importado via `React.lazy` dentro de `<ClientOnly>` em `src/routes/agenda.mapa.tsx`; o CSS do Leaflet entra por `<link>` no `__root.tsx`.
- `src/routes/agenda.mapa.tsx` reescrito: data selecionada, filtros, consulta `listarAtividades` (scheduledFrom = scheduledTo = data) via `useServerFn` + TanStack Query, e reuso de `STATUS_STYLES` da Timeline (extraído para `src/components/agenda/shared.ts` para uso comum) e de `os-detalhes-dialog.tsx`.
- `shared.ts` ganha `osCoords(activity)` lendo `latitude/longitude`, `lat/lng`, `lat/lon` ou `coordinates`, e `osAddress(activity)` compondo rua/número/bairro/cidade/UF quando vierem separados.
- Geocodificação em `src/lib/geocode.functions.ts` (server fn com `requireSupabaseAuth`): recebe até 40 endereços, consulta cache, e para os ausentes chama Nominatim (`User-Agent` próprio, 1 req/s sequencial) gravando o resultado.
- Migration: tabela `public.geocode_cache` (`id uuid pk`, `address_key text unique`, `address text`, `lat double precision`, `lng double precision`, `not_found boolean default false`, `created_at timestamptz default now()`), com `GRANT SELECT/INSERT/UPDATE` para `authenticated`, `GRANT ALL` para `service_role`, RLS ligada e política de leitura/escrita para `authenticated` (dado não sensível, sem PII).
- Marcadores customizados via `divIcon` com as cores de status; agrupamento simples por proximidade quando dois pontos coincidem (deslocamento mínimo) — sem dependência extra de clustering.
- `head()` próprio da rota mantido/atualizado; nenhuma alteração nas telas Atividades e Timeline além da extração de `STATUS_STYLES`.
