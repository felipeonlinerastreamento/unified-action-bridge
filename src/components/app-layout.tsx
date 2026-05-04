import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { NotificationsBell } from "@/components/notifications-bell";
import { DailyWelcomeDialog } from "@/components/daily-welcome-dialog";
import { PendingReminderPopup } from "@/components/pending-reminder-popup";
import { NotificationPopup } from "@/components/notification-popup";
import { ChatInactivityAlert } from "@/components/chat-inactivity-alert";
import { ChatAvailabilityToggle } from "@/components/chat-availability-toggle";
import { usePresence } from "@/hooks/use-presence";
import { useOperatorSoundNotifications } from "@/hooks/use-operator-sound-notifications";

function PresenceTracker() {
  usePresence();
  return null;
}

function OperatorSoundTracker() {
  useOperatorSoundNotifications();
  return null;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <PresenceTracker />
      <OperatorSoundTracker />
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
      <ChatInactivityAlert />
      <Toaster />
    </SidebarProvider>
  );
}
