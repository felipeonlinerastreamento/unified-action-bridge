## Problema

No ticket #01838 (cliente *Etica Servicos de Engenharia Ltda*), o cadastro da empresa tem um **Padrão de Serviços** preenchido:

> Padrão — Plataforma: SSX · Equipamento: JR12 + Identificador de motorista (Dupla Frequência) · Sensor de fadiga Jimi

Esse conteúdo só aparece hoje no **diálogo de criação** de ticket (e apenas para a categoria *Liberação de equipamento*). Ao abrir um chamado já existente no painel de detalhes, o operador não vê o padrão da empresa — por isso parece "sumido".

## O que será feito

Adicionar uma nova seção **"Padrão de Serviços"** no painel de detalhes do chamado (`ticket-detail-panel.tsx`), exibida sempre que a empresa vinculada ao chamado possuir registros em `company_service_templates`.

### Comportamento

- Carrega os itens (`name`, `description`) da empresa do chamado, ordenados por `position`.
- Renderiza cada item em um card compacto com:
  - **Nome** do item (ex.: "Padrão")
  - **Descrição** completa em `whitespace-pre-wrap` (mantém quebras de linha)
  - Botão **"Inserir na descrição"** que anexa o texto ao campo *Descrição do serviço* do chamado (mesmo padrão usado no diálogo de criação).
- Se a empresa não tem padrões cadastrados, a seção fica oculta (não polui o painel).
- Funciona para **qualquer categoria** de chamado, não só Liberação — assim o operador sempre vê o "manual" do cliente ao atender.
- Atualização reativa: se a empresa do ticket for trocada via o campo *Empresa*, a seção recarrega.

### Posicionamento na UI

Logo abaixo dos dados da empresa/contato e acima da seção de Descrição/Atividades, para que o operador veja o padrão antes de descrever o serviço.

## Arquivos afetados

- `src/components/atendimentos/ticket-detail-panel.tsx` — nova seção + query `["ticket-company-service-templates", company_id]` usando `supabase.from("company_service_templates")`.

## Fora do escopo

- Não altera o cadastro da empresa nem o diálogo de criação de tickets.
- Não cria migrations (a tabela `company_service_templates` já existe).
- Não altera o conteúdo de `instructions` (campo amarelo) — esse continua vazio neste cliente; se quiser exibir também as Instruções de Atendimento no painel, é um próximo passo opcional.
