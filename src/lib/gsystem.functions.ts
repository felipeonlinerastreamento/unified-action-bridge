// Backward-compat shim. The codebase migrated from GChat (GSystem) to Z-API.
// All existing imports of these functions continue to work; the implementations
// are now backed by Z-API + the local zapi_chats / zapi_messages tables.
//
// Do not add new imports from this file — import from "@/lib/zapi.functions" directly.
export {
  listAllOpenChats,
  listChats,
  getChatDetail,
  getChatMessages,
  sendText,
  finalizeChat,
  transferChat,
  getChannelStatus,
  createChat,
  listSectors,
  listGSystemUsers,
  listContacts,
  joinChatAsCoAgent,
  leaveChatAsCoAgent,
} from "./zapi.functions";
