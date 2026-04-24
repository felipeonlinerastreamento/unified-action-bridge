import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Clock, CheckCircle, MessageSquare, User, Layers, Package, MapPin } from "lucide-react";
import { LiberacaoBadge } from "./laboratorio-summary-panel";

interface TicketListViewProps {
  tickets: any[];
  onSelect: (ticket: any) => void;
  profiles?: any[];
}

function getPriorityBadge(priority: string) {
  const map: Record<string, { label: string; cls: string }> = {
    urgente: { label: "Urgente", cls: "bg-red-600 text-white" },
    alta: { label: "Alta", cls: "bg-orange-500 text-white" },
    media: { label: "Média", cls: "bg-amber-500 text-white" },
    baixa: { label: "Baixa", cls: "bg-emerald-600 text-white" },
  };
  const p = map[priority] || map.media;
  return <Badge className={`text-xs ${p.cls}`}>{p.label}</Badge>;
}

function getStatusBadge(status: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "finalizado") return <Badge className="bg-emerald-600 text-white">Finalizado</Badge>;
  if (s === "em_andamento") return <Badge className="bg-blue-500 text-white">Em Andamento</Badge>;
  if (s === "reaberto") return <Badge className="bg-orange-500 text-white">Reaberto</Badge>;
  if (s === "aberto") return <Badge variant="secondary">Aberto</Badge>;
  return <Badge variant="outline">{status || "—"}</Badge>;
}

export function TicketListView({ tickets, onSelect, profiles = [] }: TicketListViewProps) {
  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum ticket encontrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {tickets.map((t) => (
        <Card
          key={t.id}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onSelect(t)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {t.contact_name || t.attendance_id || "Ticket"}
                  </span>
                  {t.category && <Badge className="text-xs bg-violet-600 text-white">{t.category}</Badge>}
                  {getStatusBadge(t.status)}
                  {getPriorityBadge(t.priority || "media")}
                  <LiberacaoBadge ticket={t} />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {t.companies?.name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {t.companies.name}
                    </span>
                  )}
                  {t.sector && (
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" /> {t.sector}
                    </span>
                  )}
                  {t.assigned_to && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {profiles.find((p) => p.user_id === t.assigned_to)?.name || "Atribuído"}
                    </span>
                  )}
                  {t.contact_phone && <span>Tel: {t.contact_phone}</span>}
                  {t.plate && <span>Placa: {t.plate}</span>}
                  {t.created_at && (
                    <span className="flex items-center gap-1" title="Data de criação">
                      <Clock className="h-3 w-3" />
                      Criado: {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <span className="flex items-center gap-1" title="Última interação">
                    <MessageSquare className="h-3 w-3" />
                    {t.last_comment_at
                      ? `Última: ${new Date(t.last_comment_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                      : "Sem interações"}
                  </span>
                  {t.closed_at && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {new Date(t.closed_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {t.tracking_code && (() => {
                  const tr = Array.isArray(t.ticket_tracking) ? t.ticket_tracking[0] : t.ticket_tracking;
                  if (!tr && !t.tracking_code) return null;
                  const status = tr?.last_status || "Aguardando consulta";
                  const delivered = tr?.is_delivered;
                  return (
                    <div className="flex items-center gap-2 flex-wrap text-xs mt-1">
                      <Badge className={`text-[10px] ${delivered ? "bg-emerald-600 text-white" : "bg-blue-500 text-white"}`}>
                        <Package className="h-3 w-3 mr-1" />
                        {delivered ? "Entregue" : status}
                      </Badge>
                      <span className="font-mono text-muted-foreground">{t.tracking_code}</span>
                      {tr?.last_location && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {tr.last_location}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                #{t.id?.substring(0, 8)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
