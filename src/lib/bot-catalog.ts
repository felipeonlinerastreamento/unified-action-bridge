/** Catálogo de assuntos prontos do Robô de Atendimento (usado na tela e, no modo observação, na classificação). */
export const SAUDACAO_TEXT = "Olá,\nFala com {{operatorName}},\n\nEm que posso ajudar?";

export type CatalogEntry = {
  catalog_key: string;
  name: string;
  keywords: string[];
  reply_text: string;
  required_fields: string[];
  target_sector: string;
  is_greeting?: boolean;
};

export const CATALOG: CatalogEntry[] = [
  {
    catalog_key: "relatorio",
    name: "Relatório de posições",
    keywords: ["relatorio", "relatório", "posições", "posicoes", "histórico", "historico"],
    reply_text: "Claro! Para gerar o relatório de posições, me informe a placa e o período desejado (data inicial e final).",
    required_fields: ["placa", "período"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "rastreamento",
    name: "Rastreamento / localização do veículo",
    keywords: ["rastreamento", "localização", "localizacao", "onde está", "onde esta", "localizar"],
    reply_text: "Vou verificar a localização. Me informe a placa do veículo, por favor.",
    required_fields: ["placa"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "sem_comunicacao",
    name: "Equipamento sem comunicação",
    keywords: ["sem comunicação", "sem comunicacao", "sem sinal", "offline", "não comunica", "nao comunica"],
    reply_text: "Entendi, vamos verificar o equipamento. Me informe a placa do veículo, por favor.",
    required_fields: ["placa"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "instalacao",
    name: "Instalação / agendamento",
    keywords: ["instalação", "instalacao", "agendar", "agendamento", "instalar"],
    reply_text: "Perfeito! Para agendar a instalação, me informe a cidade e o período desejado.",
    required_fields: ["cidade", "período desejado"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "financeiro",
    name: "Financeiro / 2ª via de boleto",
    keywords: ["boleto", "financeiro", "2ª via", "segunda via", "fatura", "pagamento"],
    reply_text: "Vou te ajudar com o financeiro. Me informe o CNPJ ou a razão social do cadastro, por favor.",
    required_fields: ["CNPJ ou razão social"],
    target_sector: "Financeiro",
  },
  {
    catalog_key: "app",
    name: "Suporte ao app / senha",
    keywords: ["app", "aplicativo", "senha", "login", "acesso", "entrar"],
    reply_text: "Vou te ajudar com o acesso ao app. Me informe o e-mail ou o usuário cadastrado, por favor.",
    required_fields: ["e-mail ou usuário"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "bloqueio",
    name: "Bloqueio / desbloqueio de veículo",
    keywords: ["bloqueio", "desbloqueio", "bloquear", "desbloquear"],
    reply_text: "Certo! Para bloqueio ou desbloqueio, me informe a placa do veículo, por favor.",
    required_fields: ["placa"],
    target_sector: "Atendimento",
  },
  {
    catalog_key: "saudacao",
    name: "Saudação sem assunto",
    keywords: ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "preciso de ajuda"],
    reply_text: SAUDACAO_TEXT,
    required_fields: [],
    target_sector: "Atendimento",
    is_greeting: true,
  },
];
