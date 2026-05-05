import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  ExternalLink,
  MessageSquare,
  Clock,
  User,
} from "lucide-react";
import { formatTicketProtocol } from "@/lib/protocol-format";

type Ticket = {
  id: string;
  protocol_number?: number | null;
  contact_name?: string | null;
  status: string;
  plate?: string | null;
  notes?: string | null;
  category?: string | null;
  sector?: string | null;
  created_at: string;
  closed_at?: string | null;
  companies?: { name?: string | null } | null;
};

function statusBadge(status: string) {
  switch (status) {
    case "finalizado":
      return "border-muted text-muted-foreground";
    case "em_andamento":
      return "border-emerald-300 text-emerald-700";
    case "aberto":
      return "border-blue-300 text-blue-700";
    default:
      return "border-amber-300 text-amber-700";
  }
}

function dateGroupLabel(d: Date): string {
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Hoje";
  if (isSameDay(d, yesterday)) return "Ontem";
  const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diff < 7) return "Esta semana";
  if (diff < 30) return "Este mês";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function ContactHistoryPanel({
  tickets,
}: {
  tickets: Ticket[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullTicketId, setFullTicketId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const label = dateGroupLabel(new Date(t.created_at));
      const arr = map.get(label) || [];
      arr.push(t);
      map.set(label, arr);
    }
    return Array.from(map.entries());
  }, [tickets]);

  if (!tickets.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum atendimento anterior.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {groups.map(([label, items]) => (
          <div key={label} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="space-y-1.5">
              {items.map((t) => {
                const expanded = expandedId === t.id;
                return (
                  <div
                    key={t.id}
                    className="border rounded-md overflow-hidden bg-card"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((cur) => (cur === t.id ? null : t.id))
                      }
                      className="w-full text-left p-2 hover:bg-muted/40 transition-colors flex items-start gap-2"
                    >
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground truncate">
                            {formatTicketProtocol(t)} ·{" "}
                            {t.category || "Atendimento"}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${statusBadge(t.status)}`}
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {new Date(t.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {t.sector ? ` · ${t.sector}` : ""}
                        </p>
                      </div>
                    </button>

                    {expanded && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t bg-muted/20">
                        {t.companies?.name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {t.companies.name}
                          </p>
                        )}
                        {t.contact_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {t.contact_name}
                          </p>
                        )}
                        {t.plate && (
                          <p className="text-xs text-muted-foreground">
                            Placa:{" "}
                            <span className="font-medium">{t.plate}</span>
                          </p>
                        )}
                        {t.notes && (
                          <p className="text-xs text-foreground line-clamp-3">
                            {t.notes}
                          </p>
                        )}
                        {t.closed_at && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Finalizado em{" "}
                            {new Date(t.closed_at).toLocaleString("pt-BR")}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setFullTicketId(t.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver completo
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <FullTicketDialog
        ticketId={fullTicketId}
        ticket={tickets.find((t) => t.id === fullTicketId) || null}
        onClose={() => setFullTicketId(null)}
      />
    </>
  );
}

function FullTicketDialog({
  ticketId,
  ticket,
  onClose,
}: {
  ticketId: string | null;
  ticket: Ticket | null;
  onClose: () => void;
}) {
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["ticket-history-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data } = await supabase
        .from("ticket_comments")
        .select("id, content, comment_type, created_at, user_id")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!ticketId,
  });

  const userIds = useMemo(
    () =>
      Array.from(
        new Set(
          (comments || [])
            .map((c: any) => c.user_id)
            .filter((u: any): u is string => !!u),
        ),
      ),
    [comments],
  );
  const { data: profiles = [] } = useQuery({
    queryKey: ["ticket-history-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles as any[]) m.set(p.user_id, p.name || "");
    return m;
  }, [profiles]);

  return (
    <Dialog open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {ticket
              ? `${formatTicketProtocol(ticket)} · ${ticket.category || "Atendimento"}`
              : "Atendimento"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {ticket && (
            <div className="space-y-4 pb-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] mt-0.5 ${statusBadge(ticket.status)}`}
                  >
                    {ticket.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Setor</p>
                  <p className="font-medium text-foreground">
                    {ticket.sector || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Aberto em</p>
                  <p className="font-medium text-foreground">
                    {new Date(ticket.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Finalizado em</p>
                  <p className="font-medium text-foreground">
                    {ticket.closed_at
                      ? new Date(ticket.closed_at).toLocaleString("pt-BR")
                      : "—"}
                  </p>
                </div>
                {ticket.companies?.name && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Empresa</p>
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {ticket.companies.name}
                    </p>
                  </div>
                )}
                {ticket.plate && (
                  <div>
                    <p className="text-muted-foreground">Placa</p>
                    <p className="font-medium text-foreground">{ticket.plate}</p>
                  </div>
                )}
              </div>

              {ticket.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Observação inicial
                  </p>
                  <div className="text-xs text-foreground whitespace-pre-wrap rounded-md border bg-muted/30 p-2">
                    {ticket.notes}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Histórico de comentários
                </p>
                {isLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando…</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem comentários registrados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(comments as any[]).map((c) => (
                      <div
                        key={c.id}
                        className="border rounded-md p-2 bg-card text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-foreground">
                            {nameById.get(c.user_id) || "Sistema"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">
                          {c.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
