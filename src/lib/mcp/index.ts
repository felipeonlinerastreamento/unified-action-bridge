import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listTicketsTool from "./tools/list-tickets";
import getTicketTool from "./tools/get-ticket";
import listChatsTool from "./tools/list-chats";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gs-hub",
  title: "GS Hub",
  version: "0.1.0",
  instructions:
    "Ferramentas do GS Hub (central de atendimento, chamados e conversas). Use `whoami` para identificar o usuário conectado, `list_tickets` e `get_ticket` para chamados e `list_chats` para conversas do WhatsApp. Todos os dados respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listTicketsTool, getTicketTool, listChatsTool],
});
