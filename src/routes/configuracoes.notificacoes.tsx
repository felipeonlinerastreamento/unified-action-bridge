import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Megaphone, Users, User, Building2, Globe, CheckCheck, MessageCircle, Lock } from "lucide-react";

export const Route = createFileRoute("/configuracoes/notificacoes")({
  component: NotificacoesConfigPage,
});

type TargetType = "all" | "user" | "sector" | "group";

function NotificacoesConfigPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Notificações
          </h1>
          <p className="text-sm text-muted-foreground">
            Envie comunicados para usuários, setores, grupos ou todos. Marca leitura por usuário.
          </p>
        </div>
        <Tabs defaultValue="notification">
          <TabsList>
            <TabsTrigger value="notification" className="gap-1"><Send className="h-3.5 w-3.5" /> Nova notificação</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> Chat com operadores</TabsTrigger>
          </TabsList>
          <TabsContent value="notification" className="mt-4">
            <SendNotificationCard />
          </TabsContent>
          <TabsContent value="chat" className="mt-4">
            <StartOperatorChatCard />
          </TabsContent>
        </Tabs>
        <CampaignsHistoryCard />
      </div>
    </AppLayout>
  );
}

function SendNotificationCard() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [showAsPopup, setShowAsPopup] = useState(true);
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetId, setTargetId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").order("name");
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

  useEffect(() => { setTargetId(""); }, [targetType]);

  const resolveRecipients = async (): Promise<{ ids: string[]; label: string }> => {
    if (targetType === "all") {
      const { data } = await supabase.from("profiles").select("user_id");
      return { ids: (data || []).map((p) => p.user_id), label: "Todos os usuários" };
    }
    if (targetType === "user") {
      const u = users.find((x) => x.user_id === targetId);
      return { ids: targetId ? [targetId] : [], label: u?.name || "Usuário" };
    }
    if (targetType === "sector") {
      const s = sectors.find((x) => x.id === targetId);
      const { data } = await supabase
        .from("user_sector_assignments")
        .select("user_id")
        .eq("sector_id", targetId);
      const ids = Array.from(new Set((data || []).map((r) => r.user_id)));
      return { ids, label: `Setor: ${s?.name || ""}` };
    }
    if (targetType === "group") {
      const g = groups.find((x) => x.id === targetId);
      const { data: secs } = await supabase.from("sectors").select("id").eq("group_id", targetId);
      const sectorIds = (secs || []).map((s) => s.id);
      if (sectorIds.length === 0) return { ids: [], label: `Grupo: ${g?.name || ""}` };
      const { data } = await supabase
        .from("user_sector_assignments")
        .select("user_id")
        .in("sector_id", sectorIds);
      const ids = Array.from(new Set((data || []).map((r) => r.user_id)));
      return { ids, label: `Grupo: ${g?.name || ""}` };
    }
    return { ids: [], label: "" };
  };

  const handleSend = async () => {
    if (!title.trim()) return toast.error("Informe o título");
    if (!message.trim()) return toast.error("Informe a mensagem");
    if (targetType !== "all" && !targetId) return toast.error("Selecione o destino");

    setSending(true);
    try {
      const { ids, label } = await resolveRecipients();
      if (ids.length === 0) {
        toast.warning("Nenhum destinatário encontrado");
        setSending(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user?.id || "")
        .maybeSingle();

      const { data: campaign, error: cErr } = await supabase
        .from("notification_campaigns")
        .insert({
          title,
          message,
          target_type: targetType,
          target_id: targetType === "all" ? null : targetId,
          target_label: label,
          show_as_popup: showAsPopup,
          recipients_count: ids.length,
          created_by: user?.id,
          created_by_name: prof?.name || user?.email || "",
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const rows = ids.map((uid) => ({
        user_id: uid,
        type: "broadcast",
        title,
        message,
        show_as_popup: showAsPopup,
        campaign_id: campaign.id,
        metadata: { target_type: targetType, target_label: label },
      }));

      // Insert in chunks to avoid payload limits
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + chunkSize));
        if (error) throw error;
      }

      toast.success(`Notificação enviada para ${ids.length} usuário(s)`);
      setTitle(""); setMessage("");
      qc.invalidateQueries({ queryKey: ["notification-campaigns"] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" /> Nova Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aviso importante" />
        </div>
        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Conteúdo da notificação..." />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Destinatário</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Todos</span></SelectItem>
                <SelectItem value="user"><span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Pessoa</span></SelectItem>
                <SelectItem value="sector"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Setor</span></SelectItem>
                <SelectItem value="group"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Grupo</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetType !== "all" && (
            <div className="space-y-2">
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

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm">Exibir como pop-up</Label>
            <p className="text-xs text-muted-foreground">Aparece em destaque até o usuário marcar como visto.</p>
          </div>
          <Switch checked={showAsPopup} onCheckedChange={setShowAsPopup} />
        </div>

        <Button onClick={handleSend} disabled={sending} className="w-full gap-1">
          <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar notificação"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CampaignsHistoryCard() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ["notification-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const ids = useMemo(() => campaigns.map((c) => c.id), [campaigns]);

  const { data: readStats = {} } = useQuery({
    queryKey: ["campaigns-read-stats", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("campaign_id, is_read")
        .in("campaign_id", ids);
      const map: Record<string, { total: number; read: number }> = {};
      (data || []).forEach((n: any) => {
        if (!n.campaign_id) return;
        if (!map[n.campaign_id]) map[n.campaign_id] = { total: 0, read: 0 };
        map[n.campaign_id].total++;
        if (n.is_read) map[n.campaign_id].read++;
      });
      return map;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de notificações enviadas</CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum envio até o momento.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Pop-up</TableHead>
                <TableHead>Lidas</TableHead>
                <TableHead>Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c: any) => {
                const stats = (readStats as any)[c.id] || { total: c.recipients_count, read: 0 };
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-xs">{c.target_label}</TableCell>
                    <TableCell>
                      {c.show_as_popup ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <CheckCheck className="h-3 w-3 text-emerald-600" />
                        {stats.read}/{stats.total}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{c.created_by_name || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StartOperatorChatCard() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [lockUntilReply, setLockUntilReply] = useState(true);
  const [targetType, setTargetType] = useState<TargetType>("user");
  const [targetId, setTargetId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["all-users-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").order("name");
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

  useEffect(() => { setTargetId(""); }, [targetType]);

  const resolveRecipients = async (): Promise<string[]> => {
    if (targetType === "all") {
      const { data } = await supabase.from("profiles").select("user_id");
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

  const handleStart = async () => {
    if (!subject.trim()) return toast.error("Informe o assunto");
    if (!firstMessage.trim()) return toast.error("Informe a mensagem inicial");
    if (targetType !== "all" && !targetId) return toast.error("Selecione o destino");

    setSending(true);
    try {
      const recipients = await resolveRecipients();
      if (recipients.length === 0) {
        toast.warning("Nenhum destinatário encontrado");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: prof } = await supabase
        .from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      const senderName = prof?.name || user.email || "Atendimento";

      const campaignId = crypto.randomUUID();
      // Filter out self to avoid talking to yourself
      const others = recipients.filter((uid) => uid !== user.id);
      if (others.length === 0) {
        toast.warning("Nenhum destinatário (você não pode iniciar chat consigo mesmo)");
        return;
      }

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
      setSubject(""); setFirstMessage("");
      qc.invalidateQueries({ queryKey: ["operator-chats-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao iniciar chat");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Iniciar chat com operadores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Assunto</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Reunião urgente" />
        </div>
        <div className="space-y-2">
          <Label>Mensagem inicial</Label>
          <Textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} rows={3} placeholder="Conteúdo da primeira mensagem..." />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
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
            <div className="space-y-2">
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

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label className="text-sm flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Bloquear tela até a 1ª resposta</Label>
            <p className="text-xs text-muted-foreground">O destinatário verá um modal bloqueante até enviar uma resposta.</p>
          </div>
          <Switch checked={lockUntilReply} onCheckedChange={setLockUntilReply} />
        </div>

        <Button onClick={handleStart} disabled={sending} className="w-full gap-1">
          <MessageCircle className="h-4 w-4" /> {sending ? "Iniciando..." : "Iniciar chat"}
        </Button>
      </CardContent>
    </Card>
  );
}
