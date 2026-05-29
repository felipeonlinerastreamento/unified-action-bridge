## Objetivo

Permitir registrar e exportar **Tratativas de Ocorrências** (Telemetria e Fadiga) em PDF, exatamente no modelo do PDF anexo — com a logo da Online Rastreamento no topo e campos de assinatura no rodapé.

## Onde fica

- Novo item no menu lateral: **Tratativas** (rota `/tratativas`).
- Aba/seletor no topo da página para alternar entre **Telemetria** e **Fadiga** (o template do PDF é o mesmo; muda apenas o título "Tipo de Ocorrência" e o conjunto de "Tipos" disponíveis no select).
- Listagem das tratativas já registradas + botão **Nova tratativa**.
- Em cada linha: ações **Editar** e **Exportar PDF**.

## Formulário (espelha o modelo PDF)

- **Cabeçalho**: Nº da Ocorrência, Data de Exportação (auto na hora do PDF).
- **Detalhes**: Situação (Sem risco / Risco baixo / Risco médio / Risco alto), Cliente, Identificador, IMEI, Tipo (lista por categoria — ex.: Distração, Sonolência, Fumando, Celular… para Fadiga; Excesso de velocidade, Freada brusca, Curva agressiva… para Telemetria).
- **Tratativa**: Responsável (auto = e‑mail do usuário logado), Data da Tratativa, Primeiro Alarme, Último Alarme.
- **Alarmes** (lista dinâmica, +adicionar): Data/Hora, Latitude, Longitude, Velocidade.
- **Motorista**: Nome, Situação, Observações.

## PDF

- Gerado client‑side com **jsPDF + jspdf‑autotable** (sem dependência de servidor).
- Logo `Logo_Online_Rastreamento.png` salva em `src/assets/` e embutida no topo.
- Layout idêntico ao modelo: blocos "Detalhes da Ocorrência", "Alarmes", "Motorista" como tabelas com cabeçalho cinza claro.
- Rodapé com duas linhas de assinatura lado a lado: **Responsável da Tratativa** e **Motorista Apontado** (`Assinatura ____________________`).
- Nome do arquivo: `tratativa-{numero}-{YYYYMMDD}.pdf`.

## Persistência

- Nova tabela `tratativas` no Lovable Cloud:
  - categoria (`telemetria` | `fadiga`), numero_ocorrencia, situacao, cliente, identificador, imei, tipo, responsavel_email, data_tratativa, primeiro_alarme, ultimo_alarme, motorista_nome, motorista_situacao, motorista_observacoes, alarmes (jsonb: array `[{data_hora, lat, lng, velocidade}]`), created_by, timestamps.
- RLS: usuários autenticados leem/criam/editam; admin/gestor podem excluir.

## Arquivos afetados

- `supabase/migrations/...` — tabela `tratativas` + RLS + GRANTs.
- `src/assets/logo-online-rastreamento.png` — logo embutida.
- `src/routes/tratativas.tsx` — nova rota.
- `src/components/tratativas/tratativas-list.tsx` — listagem + filtros por categoria.
- `src/components/tratativas/tratativa-form-dialog.tsx` — form de criar/editar.
- `src/lib/tratativa-pdf.ts` — geração do PDF (jsPDF) com logo + tabelas + assinaturas.
- `src/components/app-sidebar.tsx` — novo item de menu.
- `package.json` — adicionar `jspdf` e `jspdf-autotable`.

## Fora de escopo

- Importação automática de ocorrências da plataforma externa (Telemetria/Fadiga) — registro é manual nesta fase.
- Assinatura digital — o PDF traz apenas linhas para assinatura manuscrita após impressão.
