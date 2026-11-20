import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications, setChatUnread } from "@/hooks/use-notifications";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, CheckCheck, Package, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { OperatorChatList } from "@/components/operator-chat/operator-chat-list";

export function NotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { userId, notifications, unread, chatUnread, totalUnread, markAllRead, markRead } = useNotifications();

  // Realtime (montado uma vez aqui; o balão flutuante usa os mesmos dados)
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as any;
          toast(n.title, { description: n.message });
          qc.invalidateQueries({ queryKey: ["notifications", userId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const onClickNotification = async (n: any) => {
    if (!n.is_read) await markRead(n.id);
    if (n.ticket_id) navigate({ to: "/atendimentos" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-12 w-12">
          <Bell className={`h-7 w-7 ${totalUnread > 0 ? "animate-pulse text-primary" : ""}`} />
          {totalUnread > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 bg-red-600 text-white text-[11px] font-bold animate-pulse">
              {totalUnread > 9 ? "9+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <Tabs defaultValue="notifications">
          <div className="flex items-center justify-between p-2 border-b gap-2">
            <TabsList className="h-8">
              <TabsTrigger value="notifications" className="text-xs gap-1">
                <Bell className="h-3 w-3" /> Notificações
                {unread > 0 && <Badge variant="secondary" className="h-4 text-[10px] px-1">{unread}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="chats" className="text-xs gap-1">
                <MessageCircle className="h-3 w-3" /> Conversas
                {chatUnread > 0 && <Badge variant="secondary" className="h-4 text-[10px] px-1">{chatUnread}</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="notifications" className="m-0">
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3" /> Marcar lidas
                </Button>
              )}
            </TabsContent>
          </div>

          <TabsContent value="notifications" className="m-0">
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onClickNotification(n)}
                    className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${!n.is_read ? "bg-accent/20" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {n.type === "tracking_delivered" ? (
                        <Package className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="chats" className="m-0">
            <OperatorChatList onUnreadChange={setChatUnread} />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
