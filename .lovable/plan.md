

# Menu "Estoque" — equipamentos e chips do GSystem

## Diagnóstico

A tela `/estoque` hoje só mostra **veículos** e o estoque local (categorias criadas manualmente). Os endpoints GSystem que temos integrados são: `/clientes`, `/veiculos`, `/agendamentos`, `/faturas`, `/pendencias`, `/planos`, `/anexos`, `/cadastros`, `/parametros`. **Não existe** `/equipamentos` nem `/chips` no wrapper atual.

Como o GSystem usa `/cadastros` como repositório genérico (já uso isso para tipos de pendência, ver `getTiposPendencia`), o caminho mais provável é que equipamentos/chips estejam em `/cadastros` agrupados por `Tipo`. Vou descobrir os tipos disponíveis em runtime e expor as duas categorias na tela.

## O que vou construir

### A. Server function exploratória (1ª chamada para mapear)

Criar `getCadastrosByTipo({ tipo })` em `src/lib/gsystem-api.functions.ts`:

- Chama `/cadastros`, filtra por `Tipo` (case/underscore-insensitive como já fazemos em `getTiposPendencia`).
- Retorna registros normalizados: `{ key, descricao, status, modelo, identificador, raw }`.
- Aceita lista de tipos candidatos (ex.: `["Equipamentos","Equipamento","Rastreador"]`) e tenta na ordem.

Criar também `listCadastroTipos()` que retorna todos os `Tipo` distintos presentes em `/cadastros` — usado uma vez em dev para descobrir os nomes exatos que o GSystem usa para "equipamento" e "chip" no tenant atual.

### B. Nova tela "Estoque" (substitui a atual)

Reescrever `src/routes/estoque.tsx` mantendo a estrutura existente (tabs, filtros, cards de KPI):

**Tabs:**
1. **Equipamentos (GSystem)** — lista cadastros com tipo equipamento.
2. **Chips (GSystem)** — lista cadastros com tipo chip/SIM.
3. **Veículos (GSystem)** — mantém o que já funciona.
4. **Estoque local** — fallback atual, intacto.

**Por aba GSystem:**
- KPIs: Total, **Disponíveis**, Vinculados/Em uso, Inativos.
- Filtros: busca livre (descrição/serial/IMEI), status (`Disponível` / `Vinculado` / `Inativo` / `Todos`), modelo/tipo.
- Tabela: Identificador (serial/IMEI/ICCID) · Descrição · Modelo · Status (badge verde para Disponível) · Vínculo (se houver).
- **Padrão do filtro de status = "Disponível"** (atende ao pedido).
- Botão "Atualizar" reusa o `RefreshCw` já existente.

### C. Resolução automática dos tipos

Como não sei o nome exato dos `Tipo` no GSystem, a query roda em duas etapas:

1. `listCadastroTipos()` → cacheada por 5 min, retorna lista de `Tipo` distintos.
2. Faço um match heurístico (`/equip|rastr/i` para equipamentos, `/chip|sim|iccid/i` para chips) e uso o nome encontrado como filtro real em `getCadastrosByTipo`.
3. Se nenhum tipo bater, mostro um aviso na aba: *"Nenhum cadastro do tipo Equipamento/Chip encontrado no GSystem. Tipos disponíveis: …"* — assim você me confirma o nome exato em uma resposta e eu fixo na lista.

### D. Mapeamento de campos do cadastro

Como `/cadastros` é genérico, leio os campos comuns observados no projeto (`Codigo`, `DisplayName`, `Texto`, `Ativado`) e mais os que costumam aparecer nessas listas:

```ts
{
  key: c.Codigo ?? c.Key ?? c.Id,
  descricao: c.DisplayName ?? c.Texto ?? c.Descricao,
  modelo: c.Modelo ?? c.Categoria ?? c.SubTipo,
  identificador: c.Serial ?? c.IMEI ?? c.ICCID ?? c.Numero,
  status: c.Status ?? (c.Ativado === false ? "Inativo" : "Disponível"),
  vinculo: c.Veiculo ?? c.Cliente ?? null,
}
```

Se algum campo vier vazio na sua base, ele só aparece como "—" — ainda assim a tela funciona.

### E. Item de menu

`src/components/app-sidebar.tsx` já tem a entrada "Estoque" → mantém o mesmo link, só muda o conteúdo da rota. Sem mudança de navegação.

## Arquivos tocados

```text
src/lib/gsystem-api.functions.ts   (novas server functions getCadastrosByTipo + listCadastroTipos)
src/routes/estoque.tsx             (reescrita: 4 tabs, KPIs, filtro padrão "Disponível")
```

Sem migrações, sem novos secrets — usa a auth GSystem que já está configurada.

## O que pode ficar pendente

Se o GSystem deste tenant **não** guarda equipamentos/chips em `/cadastros` (e sim em outro endpoint não documentado no wrapper atual), a aba mostrará o aviso descrito em **C** com a lista de tipos reais. Aí eu adiciono o endpoint correto (ex.: `/equipamentos`) em uma iteração rápida, sem refazer o resto.

