import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { NotificationsBell } from "@/components/notifications-bell";
import { DailyWelcomeDialog } from "@/components/daily-welcome-dialog";
import { PendingReminderPopup } from "@/components/pending-reminder-popup";
import { NotificationPopup } from "@/components/notification-popup";
import { OperatorChatLockOverlay } from "@/components/operator-chat/operator-chat-lock-overlay";
import { ChatInactivityAlert } from "@/components/chat-inactivity-alert";
import { MessageTriggerAlert } from "@/components/message-trigger-alert";
import { ChatAvailabilityToggle } from "@/components/chat-availability-toggle";
import { usePresence } from "@/hooks/use-presence";
import { useOperatorSoundNotifications } from "@/hooks/use-operator-sound-notifications";
import { useUserPermissions } from "@/hooks/use-user-permissions";

function PresenceTracker() {
  usePresence();
  return null;
}

function OperatorSoundTracker() {
  useOperatorSoundNotifications();
  return null;
}

/**
 * Usuários marcados como "Apenas Painel TV" (profiles.panel_only) só podem
 * acessar /painel-tv e /central (chat). Qualquer outra rota redireciona para o painel.
 */
function PanelOnlyGuard({ children }: { children: React.ReactNode }) {
  const { allowedMenus, isLoading } = useUserPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const isPanelOnly =
    allowedMenus !== null &&
    allowedMenus.has("painel-tv") &&
    [...allowedMenus].every((m) => m === "painel-tv" || m === "central");

  const isAllowedPath =
    location.pathname.startsWith("/painel-tv") ||
    (allowedMenus?.has("central") && location.pathname.startsWith("/central"));

  useEffect(() => {
    if (isLoading || !isPanelOnly) return;
    if (!isAllowedPath) {
      navigate({ to: "/painel-tv", replace: true });
    }
  }, [isLoading, isPanelOnly, isAllowedPath, navigate]);

  if (isPanelOnly && !isAllowedPath) return null;
  return <>{children}</>;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <PresenceTracker />
      <OperatorSoundTracker />
      <PanelOnlyGuard>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center justify-between border-b px-4 shrink-0">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <ChatAvailabilityToggle />
                <NotificationsBell />
              </div>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          </div>
        </div>
        <DailyWelcomeDialog />
        <PendingReminderPopup />
        <NotificationPopup />
        <OperatorChatLockOverlay />
        <ChatInactivityAlert />
        <MessageTriggerAlert />
      </PanelOnlyGuard>
      <Toaster />
    </SidebarProvider>
  );
}
