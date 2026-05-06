import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadZapiChannel, zapiSendText } from "@/lib/zapi.server";

type Rule = {
  id: string;
  name: string;
  is_enabled: boolean;
  target: "customer" | "operator";
  idle_minutes: number;
  message_template: string;
  cooldown_minutes: number;
  max_sends_per_ticket: number;
  apply_to_groups: boolean;
  channel_id: string | null;
};

function isGroupPhone(phone: string): boolean {
  const raw = String(phone || "");
  if (/-group$/i.test(raw) || /@g\.us$/i.test(raw)) return true;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 15;
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function processRule(rule: Rule, results: any[]) {
  const cutoff = new Date(Date.now() - rule.idle_minutes * 60_000).toISOString();
  let q = supabaseAdmin
    .from("zapi_chats")
    .select("id, channel_id, phone, contact_name, assigned_to, sector_name, status, last_message_at")
    .in("status", ["em_atendimento", "aguardando"])
    .lt("last_message_at", cutoff)
    .limit(200);
  if (rule.channel_id) q = q.eq("channel_id", rule.channel_id);

  const { data: chats, error } = await q;
  if (error) {
    results.push({ rule: rule.name, error: error.message });
    return;
  }

  for (const chat of chats || []) {
    try {
      if (!rule.apply_to_groups && isGroupPhone(chat.phone)) continue;

      // Last message direction
      const { data: lastMsg } = await supabaseAdmin
        .from("zapi_messages")
        .select("from_me, created_at")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastMsg) continue;

      const lastFromMe = !!(lastMsg as any).from_me;
      if (rule.target === "customer" && lastFromMe) continue; // operator already replied
      if (rule.target === "operator" && !lastFromMe) continue; // customer is the last one

      // Cooldown: any send for this rule+chat recently?
      const cooldownSince = new Date(Date.now() - rule.cooldown_minutes * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("chat_idle_auto_message_logs")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("chat_id", chat.id)
        .gte("sent_at", cooldownSince)
        .limit(1);
      if (recent && recent.length) continue;

      // Max sends per ticket window: count logs since last finalization of this chat
      const { data: lastClose } = await supabaseAdmin
        .from("attendance_event_logs")
        .select("created_at")
        .eq("chat_id", chat.id)
        .eq("event_type", "ticket_finalized")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sinceTs = (lastClose as any)?.created_at || "1970-01-01T00:00:00Z";
      const { count: sentCount } = await supabaseAdmin
        .from("chat_idle_auto_message_logs")
        .select("id", { count: "exact", head: true })
        .eq("rule_id", rule.id)
        .eq("chat_id", chat.id)
        .gte("sent_at", sinceTs);
      if ((sentCount || 0) >= rule.max_sends_per_ticket) continue;

      // Resolve operator name
      let operatorName = "";
      if (chat.assigned_to) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("name")
          .eq("user_id", chat.assigned_to)
          .maybeSingle();
        operatorName = (prof as any)?.name || "";
      }

      const text = render(rule.message_template, {
        contactName: chat.contact_name || "cliente",
        operatorName,
      });

      // Send via Z-API
      let creds;
      try {
        creds = await loadZapiChannel(supabaseAdmin, chat.channel_id);
      } catch (e: any) {
        results.push({ rule: rule.name, chat: chat.id, error: `channel: ${e?.message}` });
        continue;
      }
      await zapiSendText(creds, chat.phone, text);

      // Persist outgoing message + bump chat timestamps
      // Persist outgoing message + bump chat timestamps
      await supabaseAdmin.from("zapi_messages").insert({
        chat_id: chat.id,
        from_me: true,
        text,
        status: "sent",
      } as any);
      await supabaseAdmin
        .from("zapi_chats")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.slice(0, 120),
        } as any)
        .eq("id", chat.id);

      // Log
      const idleMin = Math.floor(
        (Date.now() - new Date(chat.last_message_at).getTime()) / 60_000,
      );
      await supabaseAdmin.from("chat_idle_auto_message_logs").insert({
        rule_id: rule.id,
        chat_id: chat.id,
        channel_id: chat.channel_id,
        phone: chat.phone,
        contact_name: chat.contact_name,
        target: rule.target,
        idle_minutes_at_send: idleMin,
        message_sent: text,
      } as any);

      await supabaseAdmin.from("attendance_event_logs").insert({
        event_type: "idle_auto_message",
        chat_id: chat.id,
        message: `Mensagem automática (ociosidade ${rule.target}) enviada após ${idleMin}min`,
        metadata: { rule_id: rule.id, target: rule.target } as any,
      } as any);

      results.push({ rule: rule.name, chat: chat.id, sent: true });
    } catch (e: any) {
      results.push({ rule: rule.name, chat: chat.id, error: e?.message || String(e) });
    }
  }
}

export const Route = createFileRoute("/api/public/chat-idle-scanner")({
  server: {
    handlers: {
      POST: async () => {
        const { data: rules, error } = await supabaseAdmin
          .from("chat_idle_auto_messages")
          .select("*")
          .eq("is_enabled", true);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: any[] = [];
        for (const r of (rules || []) as Rule[]) {
          await processRule(r, results);
        }
        return new Response(
          JSON.stringify({ ok: true, processed: results.length, results }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
      GET: async () => new Response("ok"),
    },
  },
});
