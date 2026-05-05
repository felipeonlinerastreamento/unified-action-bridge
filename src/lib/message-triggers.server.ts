import type { SupabaseClient } from "@supabase/supabase-js";

function normalize(s: string, caseSensitive: boolean) {
  const base = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return caseSensitive ? base : base.toLowerCase();
}

type Rule = {
  id: string;
  name: string;
  is_enabled: boolean;
  keywords: string[];
  match_type: "any" | "all" | "regex";
  case_sensitive: boolean;
  action_type: "floating_alert" | "transfer_sector" | "both";
  alert_message: string;
  alert_target_type: "assigned" | "all" | "sector" | "users";
  alert_target_sector_ids: string[];
  alert_target_user_ids: string[];
  transfer_sector_id: string | null;
  transfer_sector_name: string | null;
  transfer_note: string;
  sound_enabled: boolean;
  cooldown_minutes: number;
  priority: number;
  create_ticket: boolean;
  ticket_sector: string | null;
  ticket_priority: string;
  ticket_note: string;
};

function matchRule(text: string, rule: Rule): string | null {
  const norm = normalize(text, rule.case_sensitive);
  const kws = (rule.keywords || []).map((k) => String(k || "").trim()).filter(Boolean);
  if (!kws.length) return null;

  if (rule.match_type === "regex") {
    for (const k of kws) {
      try {
        const re = new RegExp(k, rule.case_sensitive ? "" : "i");
        const m = re.exec(text);
        if (m) return m[0];
      } catch { /* ignore invalid regex */ }
    }
    return null;
  }
  const matches = kws.filter((k) => norm.includes(normalize(k, rule.case_sensitive)));
  if (rule.match_type === "all") {
    return matches.length === kws.length ? kws[0] : null;
  }
  return matches[0] || null;
}

async function resolveRecipients(
  admin: SupabaseClient,
  rule: Rule,
  assignedTo: string | null,
): Promise<Array<{ id: string; name: string }>> {
  let userIds: string[] = [];
  switch (rule.alert_target_type) {
    case "assigned":
      if (assignedTo) userIds = [assignedTo];
      break;
    case "users":
      userIds = (rule.alert_target_user_ids || []).map(String);
      break;
    case "sector": {
      const sids = (rule.alert_target_sector_ids || []).map(String);
      if (sids.length) {
        const { data } = await admin
          .from("user_sector_assignments")
          .select("user_id")
          .in("sector_id", sids);
        userIds = Array.from(new Set((data || []).map((r: any) => r.user_id)));
      }
      break;
    }
    case "all": {
      const { data } = await admin.from("profiles").select("user_id");
      userIds = (data || []).map((r: any) => r.user_id);
      break;
    }
  }
  if (!userIds.length) return [];
  const { data: profs } = await admin
    .from("profiles")
    .select("user_id, name")
    .in("user_id", userIds);
  const nameMap = new Map<string, string>();
  for (const p of profs || []) nameMap.set((p as any).user_id, (p as any).name || "");
  return userIds.map((id) => ({ id, name: nameMap.get(id) || "" }));
}

export async function evaluateMessageTriggers(
  admin: SupabaseClient,
  args: {
    channelId: string;
    chatId: string;
    phone: string;
    contactName: string | null;
    text: string;
    assignedTo: string | null;
    messageId?: string | null;
  },
): Promise<void> {
  const { text } = args;
  if (!text || !text.trim()) return;
  const { data: rulesRaw } = await admin
    .from("message_trigger_rules")
    .select("*")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  const rules = (rulesRaw || []) as unknown as Rule[];
  if (!rules.length) return;

  for (const rule of rules) {
    const matched = matchRule(text, rule);
    if (!matched) continue;

    // Cooldown: skip if same rule fired for this chat recently.
    if (rule.cooldown_minutes > 0) {
      const since = new Date(Date.now() - rule.cooldown_minutes * 60_000).toISOString();
      const { data: recent } = await admin
        .from("message_trigger_logs")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("chat_id", args.chatId)
        .gte("triggered_at", since)
        .limit(1);
      if (recent && recent.length) continue;
    }

    const excerpt = text.slice(0, 240);
    const actionTaken: Record<string, unknown> = {};

    // Transfer sector
    if (rule.action_type === "transfer_sector" || rule.action_type === "both") {
      if (rule.transfer_sector_name) {
        await admin
          .from("zapi_chats")
          .update({
            sector_name: rule.transfer_sector_name,
            assigned_to: null,
            status: "aguardando",
          } as any)
          .eq("id", args.chatId);
        actionTaken.transferred_to = rule.transfer_sector_name;

        await admin.from("attendance_event_logs").insert({
          event_type: "trigger_transfer",
          chat_id: args.chatId,
          message: `Gatilho "${rule.name}" → transferido para ${rule.transfer_sector_name} (palavra: "${matched}")`,
          metadata: { rule_id: rule.id, matched_keyword: matched, note: rule.transfer_note } as any,
        } as any);
      }
    }

    // Auto-create ticket quando a regra do gatilho pedir.
    if (rule.create_ticket) {
      try {
        // Tenta vincular empresa pelo telefone do contato
        let companyId: string | null = null;
        try {
          const { data: contact } = await admin
            .from("crm_contacts")
            .select("company_id")
            .eq("phone", args.phone)
            .maybeSingle();
          if (contact && (contact as any).company_id) companyId = (contact as any).company_id;
        } catch { /* ignore */ }

        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        const attendanceId = `GT-${ts}-${rand}`;

        const noteHeader = rule.ticket_note?.trim()
          ? `${rule.ticket_note.trim()}\n\n`
          : "";
        const notes = `${noteHeader}🔔 Gatilho "${rule.name}" disparado (palavra: "${matched}")\nMensagem: ${excerpt}`.slice(0, 8000);

        const { data: ticket, error: tErr } = await admin
          .from("service_tickets")
          .insert({
            attendance_id: attendanceId,
            contact_phone: args.phone,
            contact_name: args.contactName || args.phone,
            status: "aberto",
            priority: rule.ticket_priority || "media",
            category: rule.name,
            sector: rule.ticket_sector || rule.transfer_sector_name || null,
            company_id: companyId,
            assigned_to: args.assignedTo,
            notes,
          } as any)
          .select()
          .single();

        if (tErr) throw tErr;

        actionTaken.ticket_created = (ticket as any)?.id || true;
        actionTaken.ticket_attendance_id = attendanceId;

        await admin.from("attendance_event_logs").insert({
          event_type: "trigger_ticket_created",
          chat_id: args.chatId,
          message: `Gatilho "${rule.name}" abriu chamado ${attendanceId} (palavra: "${matched}")`,
          metadata: { rule_id: rule.id, matched_keyword: matched, ticket_id: (ticket as any)?.id } as any,
        } as any);
      } catch (e: any) {
        console.warn("[triggers] create_ticket exception:", e?.message);
        try {
          await admin.from("attendance_event_logs").insert({
            event_type: "trigger_ticket_failed",
            chat_id: args.chatId,
            message: `Falha ao criar chamado pelo gatilho "${rule.name}": ${e?.message || e}`,
            metadata: { rule_id: rule.id, matched_keyword: matched } as any,
          } as any);
        } catch { /* ignore */ }
      }
    }

    // Floating alerts
    if (rule.action_type === "floating_alert" || rule.action_type === "both") {
      const recipients = await resolveRecipients(admin, rule, args.assignedTo);
      actionTaken.alert_recipients = recipients.length;
      if (recipients.length) {
        const rows = recipients.map((r) => ({
          rule_id: rule.id,
          rule_name: rule.name,
          chat_id: args.chatId,
          channel_id: args.channelId,
          phone: args.phone,
          contact_name: args.contactName,
          matched_keyword: matched,
          message_excerpt: excerpt,
          action_taken: { ...actionTaken, sound: rule.sound_enabled },
          recipient_user_id: r.id,
          recipient_name: r.name,
        }));
        await admin.from("message_trigger_logs").insert(rows as any);
      }
    } else {
      // Insert a single log row even without recipients (audit only)
      await admin.from("message_trigger_logs").insert({
        rule_id: rule.id,
        rule_name: rule.name,
        chat_id: args.chatId,
        channel_id: args.channelId,
        phone: args.phone,
        contact_name: args.contactName,
        matched_keyword: matched,
        message_excerpt: excerpt,
        action_taken: actionTaken,
      } as any);
    }
  }
}
