import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Plus, Lock, User, Building2, Users, Globe } from "lucide-react";
import { toast } from "sonner";

type TargetType = "all" | "user" | "sector" | "group";

interface Props {
  onCreated?: (firstChatId: string) => void;
  triggerLabel?: string;
}

export function NewOperatorChatDialog({ onCreated, triggerLabel }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [lockUntilReply, setLockUntilReply] = useState(false);
  const [targetType, setTargetType] = useState<TargetType>("user");
  const [targetId, setTargetId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });
  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors-min"],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["sector-groups-min"],
    queryFn: async () => {
      const { data } = await supabase.from("sector_groups").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  useEffect(() => {
    setTargetId("");
  }, [targetType]);

  const resolveRecipients = async (): Promise<string[]> => {
    if (targetType === "all") {
      const { data } = await supabase.from("profiles").select("user_id").eq("is_active", true);
      return (data || []).map((p) => p.user_id);
    }
    if (targetType === "user") return targetId ? [targetId] : [];
    if (targetType === "sector") {
      const { data } = await supabase
        .from("user_sector_assignments").select("user_id").eq("sector_id", targetId);
      return Array.from(new Set((data || []).map((r) => r.user_id)));
    }
    if (targetType === "group") {
      const { data: secs } = await supabase.from("sectors").select("id").eq("group_id", targetId);
      const sectorIds = (secs || []).map((s) => s.id);
      if (sectorIds.length === 0) return [];
      const { data } = await supabase
        .from("user_sector_assignments").select("user_id").in("sector_id", sectorIds);
      return Array.from(new Set((data || []).map((r) => r.user_id)));
    }
    return [];
  };

  const reset = () => {
    setSubject("");
    setFirstMessage("");
    setTargetType("user");
    setTargetId("");
    setLockUntilReply(false);
  };

  const handleStart = async () => {
    if (!subject.trim()) return toast.error("Informe o assunto");
    if (!firstMessage.trim()) return toast.error("Informe a mensagem inicial");
    if (targetType !== "all" && !targetId) return toast.error("Selecione o destino");

    setSending(true);
    try {
      const recipients = await resolveRecipients();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const others = recipients.filter((uid) => uid !== user.id);
      if (others.length === 0) {
        toast.warning("Nenhum destinatário válido");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      const senderName = prof?.name || user.email || "Atendimento";

      const campaignId = crypto.randomUUID();
      const chatRows = others.map((uid) => ({
        campaign_id: campaignId,
        created_by: user.id,
        created_by_name: senderName,
        recipient_user_id: uid,
        subject: subject.trim(),
        lock_until_reply: lockUntilReply,
        is_locked: lockUntilReply,
      }));

      const { data: createdChats, error: cErr } = await supabase
        .from("operator_chats").insert(chatRows).select("id");
      if (cErr) throw cErr;

      const msgRows = (createdChats || []).map((c: any) => ({
        chat_id: c.id,
        sender_user_id: user.id,
        sender_name: senderName,
        body: firstMessage.trim(),
      }));
      if (msgRows.length > 0) {
        const { error: mErr } = await supabase.from("operator_chat_messages").insert(msgRows);
        if (mErr) throw mErr;
      }

      toast.success(`Chat iniciado com ${others.length} operador(es)`);
      qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
      const firstId = (createdChats || [])[0]?.id;
      reset();
      setOpen(false);
      if (firstId && onCreated) onCreated(firstId);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao iniciar chat");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1 w-full">
          <Plus className="h-4 w-4" /> {triggerLabel || "Nova conversa"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Iniciar nova conversa
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem para um operador, setor ou grupo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Dúvida sobre processo X" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Destinatário</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user"><span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Pessoa</span></SelectItem>
                  <SelectItem value="sector"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Setor</span></SelectItem>
                  <SelectItem value="group"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Grupo</span></SelectItem>
                  <SelectItem value="all"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Todos</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType !== "all" && (
              <div className="space-y-1.5">
                <Label>{targetType === "user" ? "Usuário" : targetType === "sector" ? "Setor" : "Grupo"}</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {targetType === "user" && users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.name || u.user_id.slice(0, 8)}</SelectItem>
                    ))}
                    {targetType === "sector" && sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {targetType === "group" && groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem inicial</Label>
            <Textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} rows={3} placeholder="Escreva sua mensagem..." />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Bloquear tela do destinatário</Label>
              <p className="text-xs text-muted-foreground">Modal bloqueante até receber resposta.</p>
            </div>
            <Switch checked={lockUntilReply} onCheckedChange={setLockUntilReply} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleStart} disabled={sending} className="gap-1">
            <MessageCircle className="h-4 w-4" /> {sending ? "Iniciando..." : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
