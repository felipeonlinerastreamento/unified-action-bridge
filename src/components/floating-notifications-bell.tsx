import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Check, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";

/** Balão flutuante de notificações, acima do balão da IA. Mesmos dados do sino do topo. */
export function FloatingNotificationsBell() {
  const navigate = useNavigate();
  const { userId, notifications, unread, totalUnread, markRead, markAllRead, dismiss } = useNotifications();
  if (!userId) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificações${totalUnread ? ` (${totalUnread} não lidas)` : ""}`}
          className="fixed bottom-24 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-card text-primary shadow-xl transition-transform hover:scale-105 active:scale-95"
        >
          <Bell className={`h-8 w-8 ${totalUnread > 0 ? "animate-pulse" : ""}`} />
          {totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-7 min-w-[28px] items-center justify-center rounded-full bg-destructive px-1.5 text-sm font-bold text-destructive-foreground shadow ring-2 ring-background">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b p-2">
          <p className="text-sm font-semibold">Notificações {unread > 0 && <span className="text-muted-foreground">({unread})</span>}</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={unread === 0} onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma notificação</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`border-b p-3 ${!n.is_read ? "bg-accent/20" : ""}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 text-left"
                  onClick={async () => {
                    if (!n.is_read) await markRead(n.id);
                    if (n.ticket_id) navigate({ to: "/atendimentos" });
                  }}
                >
                  {n.type === "tracking_delivered"
                    ? <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    : <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
                <div className="mt-2 flex justify-end gap-1">
                  {!n.is_read && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => markRead(n.id)}>
                      <Check className="h-3.5 w-3.5" /> Marcar como lida
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => dismiss(n.id)}>
                    <X className="h-3.5 w-3.5" /> Fechar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
