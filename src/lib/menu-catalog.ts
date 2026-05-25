// Catálogo dos menus do sistema usados para configurar permissões por
// grupo de setores. Os slugs são estáveis e usados em `sector_groups.allowed_menus`.

export type MenuCategory = "main" | "config";

export interface MenuEntry {
  slug: string;
  label: string;
  category: MenuCategory;
}

export const MENU_CATALOG: MenuEntry[] = [
  // Principais
  { slug: "dashboard", label: "Dashboard", category: "main" },
  { slug: "central", label: "Chat / Central de Atendimento", category: "main" },
  { slug: "crm", label: "CRM", category: "main" },
  { slug: "contatos", label: "Contatos", category: "main" },
  { slug: "empresas", label: "Empresas", category: "main" },
  { slug: "estoque", label: "Estoque", category: "main" },
  { slug: "relatorios", label: "Relatórios", category: "main" },
  { slug: "okr", label: "OKR", category: "main" },
  { slug: "atendimentos", label: "Atendimentos", category: "main" },
  { slug: "chat-operadores", label: "Chat com Operadores", category: "main" },

  // Configurações
  { slug: "config.integracoes", label: "Integrações", category: "config" },
  { slug: "config.central-atendimento", label: "Central de Atendimento", category: "config" },
  { slug: "config.fluxo-atendimento", label: "Fluxo de Atendimento", category: "config" },
  { slug: "config.estoque", label: "Estoque (Regras)", category: "config" },
  { slug: "config.assistente-ia", label: "Assistente IA", category: "config" },
  { slug: "config.zapi", label: "Z-API & Bot", category: "config" },
  { slug: "config.encaminhamento", label: "Encaminhamento", category: "config" },
  { slug: "config.automacao-sem-comunicacao", label: "Automação Sem Comunicação", category: "config" },
  { slug: "config.popup-diario", label: "Popup Diário", category: "config" },
  { slug: "config.usuarios", label: "Usuários", category: "config" },
  { slug: "config.status-usuarios", label: "Status de Usuários", category: "config" },
  { slug: "config.notificacoes", label: "Notificações", category: "config" },
  { slug: "config.okr", label: "OKR (Ciclos)", category: "config" },
  { slug: "config.auditoria", label: "Auditoria", category: "config" },
];

export const ALL_MENU_SLUGS = MENU_CATALOG.map((m) => m.slug);

// Menus liberados por padrão para operadores quando o grupo não restringe nada
// (mantém o comportamento histórico antes da introdução de allowed_menus).
export const DEFAULT_OPERATOR_MENUS: string[] = [
  "central",
  "crm",
  "contatos",
  "empresas",
  "atendimentos",
  "chat-operadores",
];

// Mapeia URL do menu (em app-sidebar) → slug do catálogo.
export const URL_TO_MENU_SLUG: Record<string, string> = {
  "/dashboard": "dashboard",
  "/central": "central",
  "/crm": "crm",
  "/contatos": "contatos",
  "/empresas": "empresas",
  "/estoque": "estoque",
  "/relatorios": "relatorios",
  "/okr": "okr",
  "/atendimentos": "atendimentos",
  "/chat-operadores": "chat-operadores",
  "/configuracoes": "config.integracoes",
  "/configuracoes/central-atendimento": "config.central-atendimento",
  "/configuracoes/fluxo-atendimento": "config.fluxo-atendimento",
  "/configuracoes/estoque": "config.estoque",
  "/configuracoes/assistente-ia": "config.assistente-ia",
  "/configuracoes/zapi": "config.zapi",
  "/configuracoes/encaminhamento": "config.encaminhamento",
  "/configuracoes/automacao-sem-comunicacao": "config.automacao-sem-comunicacao",
  "/configuracoes/popup-diario": "config.popup-diario",
  "/configuracoes/usuarios": "config.usuarios",
  "/configuracoes/status-usuarios": "config.status-usuarios",
  "/configuracoes/notificacoes": "config.notificacoes",
  "/configuracoes/okr": "config.okr",
  "/configuracoes/auditoria": "config.auditoria",
};
