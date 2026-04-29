import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Bell, MessageSquare, CheckSquare, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getDailyQuote } from "@/lib/daily-quote.functions";

const STORAGE_PREFIX = "daily-welcome-shown:";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyWelcomeDialog() {
  const { user, profile, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  // Load global settings (admin/gestor configurable)
  const { data: settings } = useQuery({
    queryKey: ["daily-welcome-settings"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_welcome_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      return (data as any) || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Decide whether to show on mount
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (settings && settings.is_enabled === false) return;
    const key = `${STORAGE_PREFIX}${user.id}:${todayKey()}`;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, user?.id, settings]);

  const showQuote = settings?.show_quote !== false;
  const quoteSource: "ai" | "manual" = settings?.quote_source === "manual" ? "manual" : "ai";

  const { data: aiQuote } = useQuery({
    queryKey: ["daily-quote", todayKey()],
    queryFn: () => getDailyQuote(),
    enabled: open && showQuote && quoteSource === "ai",
    staleTime: 1000 * 60 * 60,
  });

  const quote = showQuote
    ? quoteSource === "manual"
      ? settings?.manual_quote
        ? { content: settings.manual_quote, author: settings.manual_quote_author || "" }
        : null
      : aiQuote
    : null;

  const { data: pending } = useQuery({
    queryKey: ["daily-pending", user?.id],
    enabled: open && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return { reminders: [], tickets: [], tasks: [] };
      const nowIso = new Date().toISOString();

      const [remindersRes, ticketsRes, tasksRes] = await Promise.all([
        supabase
          .from("ticket_reminders")
          .select("id, ticket_id, reminder_date, reminder_note")
          .eq("created_by", user.id)
          .eq("is_dismissed", false)
          .lte("reminder_date", nowIso)
          .order("reminder_date", { ascending: true })
          .limit(20),
        supabase
          .from("service_tickets")
          .select("id, attendance_id, contact_name, status, priority, category")
          .eq("assigned_to", user.id)
          .in("status", ["aberto", "em_andamento"] as any)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("tasks" as any)
          .select("id, title, due_date, priority")
          .eq("assigned_to", user.id)
          .neq("status", "completed")
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(20),
      ]);

      return {
        reminders: remindersRes.data || [],
        tickets: ticketsRes.data || [],
        tasks: (tasksRes.data as any[]) || [],
      };
    },
  });

  const dismiss = () => {
    if (user?.id) {
      const key = `${STORAGE_PREFIX}${user.id}:${todayKey()}`;
      localStorage.setItem(key, "1");
    }
    setOpen(false);
  };

  const totalPending =
    (pending?.reminders.length || 0) + (pending?.tickets.length || 0) + (pending?.tasks.length || 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) dismiss();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Bom dia, {profile?.name?.split(" ")[0] || "tudo certo?"}
          </DialogTitle>
          <DialogDescription>Resumo das suas atividades pendentes hoje.</DialogDescription>
        </DialogHeader>

        {/* Motivational quote */}
        <div className="rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-4">
          {quote ? (
            <>
              <p className="text-sm italic leading-relaxed">"{quote.content}"</p>
              {quote.author && (
                <p className="text-xs text-muted-foreground mt-2 text-right">— {quote.author}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando inspiração do dia…</p>
          )}
        </div>

        <ScrollArea className="max-h-[40vh] pr-2">
          <div className="space-y-3">
            {totalPending === 0 && pending && (
              <p className="text-sm text-muted-foreground text-center py-6">
                🎉 Nenhuma pendência sua para hoje. Bom trabalho!
              </p>
            )}

            {pending && pending.reminders.length > 0 && (
              <Section
                icon={<Bell className="h-4 w-4 text-amber-500" />}
                title="Lembretes vencidos"
                count={pending.reminders.length}
              >
                {pending.reminders.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="text-xs p-2 rounded-md border bg-card">
                    <span className="font-medium">
                      {new Date(r.reminder_date).toLocaleDateString("pt-BR")}
                    </span>
                    {r.reminder_note && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">{r.reminder_note}</p>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {pending && pending.tickets.length > 0 && (
              <Section
                icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
                title="Atendimentos atribuídos"
                count={pending.tickets.length}
              >
                {pending.tickets.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="text-xs p-2 rounded-md border bg-card flex items-center gap-2">
                    <span className="font-medium truncate flex-1">
                      {t.contact_name || t.attendance_id}
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 h-5">
                      {t.priority}
                    </Badge>
                  </div>
                ))}
              </Section>
            )}

            {pending && pending.tasks.length > 0 && (
              <Section
                icon={<CheckSquare className="h-4 w-4 text-green-500" />}
                title="Tarefas pendentes"
                count={pending.tasks.length}
              >
                {pending.tasks.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="text-xs p-2 rounded-md border bg-card">
                    <p className="font-medium truncate">{t.title}</p>
                    {t.due_date && (
                      <p className="text-muted-foreground mt-0.5">
                        Até {new Date(t.due_date).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                ))}
              </Section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {pending && pending.tickets.length > 0 && (
            <Button asChild variant="outline" size="sm" onClick={dismiss}>
              <Link to="/atendimentos">
                Ver atendimentos <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
          <Button onClick={dismiss} size="sm">
            Vamos lá!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        <span>{title}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          {count}
        </Badge>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
