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
import { MessageCircle, Plus, Lock, User, Building2, Users, Globe, UsersRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type TargetType = "all" | "user" | "sector" | "group" | "multi";

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
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("is_active", true)
        .eq("panel_only", false)
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
    setMultiIds([]);
  }, [targetType]);

  const resolveRecipients = async (): Promise<string[]> => {
    if (targetType === "all") {
      const { data } = await supabase.from("profiles").select("user_id").eq("is_active", true).eq("panel_only", false);
      return (data || []).map((p) => p.user_id);
    }
    if (targetType === "user") return targetId ? [targetId] : [];
    if (targetType === "multi") return multiIds;
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
    setMultiIds([]);
    setLockUntilReply(false);
  };

  const handleStart = async () => {
    if (!firstMessage.trim()) return toast.error("Informe a mensagem");
    if (targetType === "multi" && multiIds.length < 2)
      return toast.error("Selecione pelo menos 2 operadores");
    if (targetType !== "all" && targetType !== "multi" && !targetId)
      return toast.error("Selecione o destino");

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

      // Conversa em grupo: todos no mesmo histórico
      if (targetType === "multi") {
        const { data: createdGroup, error: gErr } = await supabase
          .from("operator_chats")
          .insert({
            campaign_id: crypto.randomUUID(),
            created_by: user.id,
            created_by_name: senderName,
            recipient_user_id: user.id,
            subject: subject.trim() || "Conversa em grupo",
            is_group: true,
            lock_until_reply: lockUntilReply,
            is_locked: false,
          })
          .select("id")
          .single();
        if (gErr) throw gErr;
        const groupId = (createdGroup as any).id as string;

        const nameById = new Map(users.map((u: any) => [u.user_id, u.name]));
        const rows = [
          { chat_id: groupId, user_id: user.id, user_name: senderName, is_locked: false },
          ...others.map((uid) => ({
            chat_id: groupId,
            user_id: uid,
            user_name: nameById.get(uid) || null,
            is_locked: lockUntilReply,
          })),
        ];
        const { error: pErr } = await supabase.from("operator_chat_participants").insert(rows);
        if (pErr) throw pErr;

        const { error: gmErr } = await supabase.from("operator_chat_messages").insert({
          chat_id: groupId,
          sender_user_id: user.id,
          sender_name: senderName,
          body: firstMessage.trim(),
        });
        if (gmErr) throw gmErr;

        toast.success(`Conversa em grupo criada com ${others.length} operador(es)`);
        qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
        reset();
        setOpen(false);
        if (onCreated) onCreated(groupId);
        return;
      }


      // Uma única conversa (histórico contínuo) por par de operadores
      const chatIds: string[] = [];
      for (const uid of others) {
        const { data: existing } = await supabase
          .from("operator_chats")
          .select("id, recipient_user_id")
          .or(
            `and(created_by.eq.${user.id},recipient_user_id.eq.${uid}),and(created_by.eq.${uid},recipient_user_id.eq.${user.id})`
          )
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const upd: any = { closed_at: null };
          if (lockUntilReply) {
            upd.created_by = user.id;
            upd.created_by_name = senderName;
            upd.recipient_user_id = uid;
            upd.lock_until_reply = true;
            upd.is_locked = true;
          }
          await supabase.from("operator_chats").update(upd).eq("id", (existing as any).id);
          chatIds.push((existing as any).id);
        } else {
          const { data: created, error: cErr } = await supabase
            .from("operator_chats")
            .insert({
              campaign_id: crypto.randomUUID(),
              created_by: user.id,
              created_by_name: senderName,
              recipient_user_id: uid,
              subject: subject.trim() || "Conversa",
              lock_until_reply: lockUntilReply,
              is_locked: lockUntilReply,
            })
            .select("id")
            .single();
          if (cErr) throw cErr;
          chatIds.push((created as any).id);
        }
      }

      const msgRows = chatIds.map((id) => ({
        chat_id: id,
        sender_user_id: user.id,
        sender_name: senderName,
        body: firstMessage.trim(),
      }));
      if (msgRows.length > 0) {
        const { error: mErr } = await supabase.from("operator_chat_messages").insert(msgRows);
        if (mErr) throw mErr;
      }
      const createdChats = chatIds.map((id) => ({ id }));

      toast.success(`Mensagem enviada para ${others.length} operador(es)`);
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
            <MessageCircle className="h-4 w-4" /> Enviar mensagem
          </DialogTitle>
          <DialogDescription>
            A mensagem entra no histórico já existente com cada operador.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Assunto (opcional)</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Usado apenas em conversas novas" />
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
                  <SelectItem value="multi"><span className="flex items-center gap-2"><UsersRound className="h-3.5 w-3.5" /> Vários operadores (conversa em grupo)</span></SelectItem>
                  <SelectItem value="all"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Todos</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType !== "all" && targetType !== "multi" && (
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
