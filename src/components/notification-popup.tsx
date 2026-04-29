import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Megaphone } from "lucide-react";

export function NotificationPopup() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: popups = [] } = useQuery({
    queryKey: ["notification-popups", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("show_as_popup", true)
        .is("popup_dismissed_at", null)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // Realtime: open new popups instantly
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`popup-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notification-popups", userId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  const current = popups[0];

  const handleAck = async () => {
    if (!current) return;
    const now = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ popup_dismissed_at: now, is_read: true, read_at: now })
      .eq("id", current.id);
    qc.invalidateQueries({ queryKey: ["notification-popups", userId] });
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  if (!current) return null;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {current.title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-2 text-foreground">
            {current.message}
          </DialogDescription>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">
          {new Date(current.created_at).toLocaleString("pt-BR")}
        </p>
        <DialogFooter>
          <Button onClick={handleAck} className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Marcar como visto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
