import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listTicketsTool from "./tools/list-tickets";
import getTicketTool from "./tools/get-ticket";
import listChatsTool from "./tools/list-chats";
import financeiroCategoriasTool from "./tools/financeiro-categorias";
import financeiroRegistradosTool from "./tools/financeiro-documentos-registrados";
import financeiroRegistrarTool from "./tools/financeiro-registrar-documento";
import financeiroCriarCategoriaTool from "./tools/financeiro-criar-categoria";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gs-hub",
  title: "Gestão Online",
  version: "0.1.0",
  instructions:
    "Ferramentas do Gestão Online (central de atendimento, chamados e conversas). Use `whoami` para identificar o usuário conectado, `list_tickets` e `get_ticket` para chamados e `list_chats` para conversas do WhatsApp. Financeiro (só para quem tem acesso): `financeiro_categorias`, `financeiro_documentos_registrados`, `financeiro_registrar_documento` e `financeiro_criar_categoria`. Todos os dados respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listTicketsTool, getTicketTool, listChatsTool, financeiroCategoriasTool, financeiroRegistradosTool, financeiroRegistrarTool, financeiroCriarCategoriaTool],
});
