import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cake, CalendarDays } from "lucide-react";
import { toast } from "sonner";

function dayMonth(s?: string | null) {
  return s ? s.slice(5) : "";
}
function daysUntil(birth: string) {
  const today = new Date();
  const [, m, d] = birth.split("-").map((x) => Number(x));
  const next = new Date(today.getFullYear(), m - 1, d);
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    next.setFullYear(today.getFullYear() + 1);
  return Math.ceil((next.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
}

export function CrmBirthdaysTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "cliente" | "fornecedor" | "funcionario">("all");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-birthdays-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id, name, birth_date, contact_role, phone")
        .not("birth_date", "is", null);
      return data || [];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["crm-birthdays-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, birth_date")
        .not("birth_date", "is", null);
      return (data || []).map((p: any) => ({
        id: p.user_id,
        name: p.name,
        birth_date: p.birth_date,
        contact_role: "funcionario",
        phone: null,
      }));
    },
  });

  const all = useMemo(() => {
    return [...contacts, ...profiles]
      .filter((c) => filter === "all" || c.contact_role === filter)
      .map((c: any) => ({ ...c, days: daysUntil(c.birth_date) }))
      .sort((a, b) => a.days - b.days);
  }, [contacts, profiles, filter]);

  const today = all.filter((c) => c.days === 0);
  const week = all.filter((c) => c.days > 0 && c.days <= 7);
  const month = all.filter((c) => c.days > 7 && c.days <= 31);

  const triggerJob = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/public/crm-daily", { method: "POST" });
      if (!r.ok) throw new Error("Falha ao executar");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Job CRM executado");
      qc.invalidateQueries({ queryKey: ["crm-tasks-today"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {(["all", "cliente", "fornecedor", "funcionario"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={() => triggerJob.mutate()} disabled={triggerJob.isPending}>
          {triggerJob.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Gerar tarefas hoje
        </Button>
      </div>

      <Section title="🎂 Hoje" items={today} />
      <Section title="Próximos 7 dias" items={week} />
      <Section title="Este mês" items={month} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: any[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cake className="h-4 w-4" /> {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Nenhum aniversariante.</p>
        ) : (
          <div className="space-y-1">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 hover:bg-accent/30 rounded text-sm">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="h-3 w-3" /> {dayMonth(c.birth_date)}
                    <Badge variant="secondary" className="text-[10px]">{c.contact_role}</Badge>
                  </div>
                </div>
                <Badge variant={c.days === 0 ? "default" : "outline"}>
                  {c.days === 0 ? "Hoje" : `em ${c.days}d`}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
