

## Adicionar "Estoque" ao menu lateral

### Resposta direta
**Sim, é totalmente possível via API.** A integração com o GSystem já existe e a página `/estoque` já está implementada — ela puxa equipamentos (rastreadores) e chips (ICCID) do endpoint `/cadastros` da API GSystem, com filtros por status (Disponível / Vinculado / Inativo) e por modelo.

O que falta apenas é **expor essa página no menu lateral principal**, hoje ela só pode ser acessada digitando a URL.

---

### O que será feito

**1. Adicionar item "Estoque" no menu lateral principal** (`src/components/app-sidebar.tsx`)
Inserir um novo item entre **Empresas** e **Relatórios**:
```
- Dashboard
- Atendimentos
- Central
- CRM
- Contatos
- Empresas
- Estoque        ← NOVO (ícone: Boxes)
- Relatórios
- Configurações
```
Aponta para a rota `/estoque` (já existente).

**2. Confirmar que a página atende o pedido**
A rota `/estoque` já oferece exatamente o que você descreveu:
- **Aba "Equipamentos"** — sincroniza os rastreadores cadastrados no GSystem (Serial / IMEI), via `/cadastros` com tipos: `Equipamentos`, `Rastreador`, `Equipamento_Rastreador`.
- **Aba "Chips"** — sincroniza os chips/SIM com ICCID, via `/cadastros` com tipos: `Chips`, `Chip`, `SIM`, `SimCard`, `Linhas`.
- **Aba "Veículos"** — bônus: lista veículos do GSystem.
- **Aba "Estoque Local"** — itens cadastrados localmente.

**Filtros já disponíveis em todas as abas:**
- Busca por descrição / serial / IMEI / ICCID
- Filtro por **Status**: Todos · **Disponível** · **Vinculado** · Inativo
- Filtro por Modelo
- Botão de refresh para sincronizar com o GSystem
- KPIs no topo: Total / Disponíveis / Vinculados / Inativos

**3. Pequeno ajuste de rótulo no submenu de Configurações**
Para evitar confusão, renomear o item nas Configurações de "Estoque" para **"Estoque (Regras)"** — esse submenu trata só de regras de mínimo e categorias locais, não da consulta sincronizada.

---

### Observações técnicas

- A classificação **Disponível / Vinculado / Inativo** é derivada do campo `Status` (ou `Ativado`) de cada cadastro do GSystem pela função `classifyStatus` — palavras como "disponível", "vinculado", "em uso", "ativo", "inativo" são reconhecidas automaticamente.
- A sincronização é sob demanda (cache de 5 min via React Query) com botão de refresh manual.
- Caso o GSystem use outro nome de "Tipo" para equipamentos/chips diferente dos candidatos atuais, a UI já mostra os tipos disponíveis para diagnóstico — basta avisar e adiciono o nome correto à lista.

### Arquivos alterados
- `src/components/app-sidebar.tsx` — adicionar item "Estoque" no menu principal, renomear submenu de Configurações.

