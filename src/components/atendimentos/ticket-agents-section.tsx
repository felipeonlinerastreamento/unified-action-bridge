import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, X, Plus } from "lucide-react";

interface TicketAgentsSectionProps {
  ticketId: string;
  userId: string | null;
  profiles: any[];
}

export function TicketAgentsSection({ ticketId, userId, profiles }: TicketAgentsSectionProps) {
  const [selectedAgent, setSelectedAgent] = useState("");

  const { data: agents = [], refetch } = useQuery({
    queryKey: ["ticket-agents", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_agents")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error loading agents:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!ticketId,
  });

  const linkedUserIds = agents.map((a: any) => a.user_id);
  const availableProfiles = profiles.filter((p) => !linkedUserIds.includes(p.user_id));

  const addAgent = async () => {
    if (!selectedAgent) return;
    const profile = profiles.find((p) => p.user_id === selectedAgent);
    const { error } = await supabase.from("ticket_agents").insert({
      ticket_id: ticketId,
      user_id: selectedAgent,
      assigned_by: userId,
    });
    if (error) {
      if (error.code === "23505") {
        toast.error("Atendente já vinculado");
      } else {
        toast.error("Erro ao vincular atendente: " + error.message);
      }
      return;
    }
    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content: `Atendente vinculado: ${profile?.name || selectedAgent}`,
      comment_type: "encaminhamento",
    });
    setSelectedAgent("");
    refetch();
    toast.success("Atendente vinculado");
  };

  const removeAgent = async (agentId: string, agentUserId: string) => {
    const profile = profiles.find((p) => p.user_id === agentUserId);
    const { error } = await supabase.from("ticket_agents").delete().eq("id", agentId);
    if (error) {
      toast.error("Erro ao remover atendente");
      return;
    }
    await supabase.from("ticket_comments").insert({
      ticket_id: ticketId,
      user_id: userId,
      content: `Atendente removido: ${profile?.name || agentUserId}`,
      comment_type: "encaminhamento",
    });
    refetch();
    toast.success("Atendente removido");
  };

  const getProfileName = (uid: string) => {
    const p = profiles.find((pr) => pr.user_id === uid);
    return p?.name || uid.substring(0, 8);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Users className="h-3.5 w-3.5" /> Atendentes Vinculados
      </label>

      {agents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a: any) => (
            <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
              {getProfileName(a.user_id)}
              <button
                onClick={() => removeAgent(a.id, a.user_id)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {availableProfiles.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-8 flex-1 text-sm">
              <SelectValue placeholder="Adicionar atendente..." />
            </SelectTrigger>
            <SelectContent>
              {availableProfiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.name || p.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addAgent} disabled={!selectedAgent} className="h-8">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {agents.length === 0 && availableProfiles.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum atendente disponível.</p>
      )}
    </div>
  );
}
