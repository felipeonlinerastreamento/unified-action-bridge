import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime updates of `zapi_chats` and `zapi_messages` and
 * invalidates relevant TanStack Query caches so the UI stays fresh without
 * polling. Pass a `chatId` to also subscribe to messages of that chat.
 */
export function useZapiRealtime(opts: { channelId?: string; chatId?: string } = {}) {
  const queryClient = useQueryClient();
  const { channelId, chatId } = opts;

  useEffect(() => {
    if (!channelId) return;

    const chatsChannel = supabase
      .channel(`zapi-chats-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zapi_chats", filter: `channel_id=eq.${channelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["zapi-chats", channelId] });
          queryClient.invalidateQueries({ queryKey: ["all-open-chats", channelId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatsChannel);
    };
  }, [channelId, queryClient]);

  useEffect(() => {
    if (!chatId) return;

    const msgChannel = supabase
      .channel(`zapi-messages-${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zapi_messages", filter: `chat_id=eq.${chatId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["zapi-messages", chatId] });
          queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
          queryClient.invalidateQueries({ queryKey: ["floating-chat-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [chatId, queryClient]);
}
