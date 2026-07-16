import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PREF_KEY = (uid: string) => `pref:reminder-notifications:${uid}`;

export function TicketReminderNotifications() {
  const notifiedRef = useRef<Set<string>>(new Set());
  const [prefEnabled, setPrefEnabled] = useState(true);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data?.user ?? null;
    },
  });

  const { data: dueReminders = [] } = useQuery({
    queryKey: ["due-reminders"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("ticket_reminders")
        .select("*, service_tickets(id, contact_name, attendance_id, assigned_to)")
        .eq("is_dismissed", false)
        .lte("reminder_date", now)
        .order("reminder_date", { ascending: true });
      if (error) return [];
      return data || [];
    },
    refetchInterval: 30000, // check every 30s
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (!currentUser || dueReminders.length === 0) return;

    for (const reminder of dueReminders as any[]) {
      if (notifiedRef.current.has(reminder.id)) continue;
      
      const ticket = reminder.service_tickets;
      // Only notify if user is assigned or created the reminder
      if (ticket?.assigned_to !== currentUser.id && reminder.created_by !== currentUser.id) continue;

      notifiedRef.current.add(reminder.id);
      const ticketName = ticket?.contact_name || ticket?.attendance_id || "Ticket";
      toast.warning(`⏰ Lembrete: ${ticketName}`, {
        description: reminder.reminder_note || "Lembrete vencido",
        duration: 10000,
        action: {
          label: "Dispensar",
          onClick: async () => {
            await supabase.from("ticket_reminders").update({ is_dismissed: true }).eq("id", reminder.id);
          },
        },
      });
    }
  }, [dueReminders, currentUser]);

  return null;
}
