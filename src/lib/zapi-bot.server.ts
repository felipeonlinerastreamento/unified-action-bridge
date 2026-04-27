// Bot engine — evaluates flow nodes against an incoming message.
// Server-only. Used by the public Z-API webhook.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadZapiChannel, zapiSendText } from "./zapi.server";

export interface FlowNode {
  id: string;
  type: "message" | "menu" | "route_to_sector" | "route_to_least_loaded" | "end" | "gsystem_boleto";
  text?: string;
  options?: Array<{ key: string; label: string; next: string }>;
  next?: string;
  target_sector?: string;
  // gsystem_boleto specific
  fallback_sector?: string;
  text_success?: string;
  text_no_boletos?: string;
  text_no_client?: string;
}

export interface FlowDoc {
  id: string;
  channel_id: string | null;
  is_active: boolean;
  nodes: FlowNode[];
}

function renderText(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    if (key === "contactName") return v || "amigo(a)";
    return v || "";
  });
}

async function findActiveFlow(channelId: string): Promise<FlowDoc | null> {
  const { data: chFlow } = await supabaseAdmin
    .from("zapi_bot_flows")
    .select("id, channel_id, is_active, nodes")
    .eq("channel_id", channelId)
    .eq("is_active", true)
    .maybeSingle();
  if (chFlow) return chFlow as unknown as FlowDoc;

  const { data: globalFlow } = await supabaseAdmin
    .from("zapi_bot_flows")
    .select("id, channel_id, is_active, nodes")
    .is("channel_id", null)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (globalFlow as unknown as FlowDoc) || null;
}

function shouldRunBot(botMode: string | null): boolean {
  if (botMode === "never") return false;
  if (botMode === "always" || !botMode) return true;
  // off_hours: between 18h and 8h local
  const hour = new Date().getHours();
  return hour < 8 || hour >= 18;
}

async function pickLeastLoaded(sectorName: string): Promise<string | null> {
  const { data } = await supabaseAdmin.rpc("pick_least_loaded_agent", { _sector: sectorName });
  return (data as string | null) || null;
}

function matchMenuOption(node: FlowNode, incomingText: string) {
  if (node.type !== "menu" || !node.options) return null;

  // Normalize incoming text: trim, lowercase, strip common punctuation/brackets/emojis
  const raw = (incomingText || "").trim().toLowerCase();
  // Extract first number or first word for matching
  const numMatch = raw.match(/\d+/);
  const firstToken = raw.replace(/[\[\]\(\)\.\-\,\!\?\*]/g, " ").trim().split(/\s+/)[0] || "";
  const candidates = [raw, numMatch?.[0] || "", firstToken].filter(Boolean);

  return (
    node.options.find((o) => {
      const key = String(o.key || "").trim().toLowerCase();
      const label = String(o.label || "").trim().toLowerCase();
      return candidates.some((c) => c === key) || (label && raw.includes(label));
    }) || null
  );
}

interface ProcessParams {
  channelId: string;
  chatId: string;
  phone: string;
  contactName?: string | null;
  incomingText: string;
}

/**
 * Process an incoming customer message through the bot flow.
 * Returns true if the bot handled the message (sent a response or routed),
 * false if no flow active or routing complete (human takes over).
 */
export async function processIncomingForBot(params: ProcessParams): Promise<boolean> {
  const { channelId, chatId, phone, contactName, incomingText } = params;

  // Load chat state
  const { data: chat } = await supabaseAdmin
    .from("zapi_chats")
    .select("id, status, bot_state, sector_name")
    .eq("id", chatId)
    .single();
  if (!chat) return false;

  // If chat already in human attendance, skip bot
  if (chat.status === "em_atendimento" || chat.status === "finalizado") return false;

  // Channel bot mode
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id, bot_mode")
    .eq("id", channelId)
    .single();

  if (!shouldRunBot(channel?.bot_mode || null)) {
    // Skip bot, mark as waiting for human
    await supabaseAdmin
      .from("zapi_chats")
      .update({ status: "aguardando" })
      .eq("id", chatId);
    return false;
  }

  const flow = await findActiveFlow(channelId);
  if (!flow || !Array.isArray(flow.nodes) || flow.nodes.length === 0) return false;

  const botState = (chat.bot_state || {}) as { current_node?: string };
  const vars = { contactName: contactName || undefined };

  let creds;
  try {
    creds = await loadZapiChannel(supabaseAdmin, channelId);
  } catch (e) {
    console.error("[bot] cannot load channel creds", e);
    return false;
  }

  // Determine current node
  let currentNodeId = botState.current_node;
  if (!currentNodeId) {
    // If the state was lost by webhook presence events, still accept a reply to the first menu.
    const firstNode = flow.nodes[0];
    const matched = matchMenuOption(firstNode, incomingText);
    if (matched) {
      console.log(`[bot] menu fallback match: input="${incomingText}" → key="${matched.key}" → next="${matched.next}"`);
      currentNodeId = matched.next;
    } else {
      // First contact — start at first node
      currentNodeId = firstNode.id;
    }
  } else {
    // Resume: evaluate current node based on incoming response
    const node = flow.nodes.find((n) => n.id === currentNodeId);
    if (!node) {
      // Orphan state (node id no longer exists in flow) — restart from first node
      console.warn(`[bot] orphan current_node="${currentNodeId}", restarting flow`);
      currentNodeId = flow.nodes[0].id;
    } else if (node.type === "menu" && node.options) {
      const matched = matchMenuOption(node, incomingText);

      if (matched) {
        console.log(`[bot] menu match: input="${incomingText}" → key="${matched.key}" → next="${matched.next}"`);
        currentNodeId = matched.next;
      } else {
        console.log(`[bot] menu no match for input="${incomingText}", re-sending menu`);
        // Invalid choice, re-send menu
        await zapiSendText(creds, phone, renderText(node.text || "", vars));
        await persistOutgoing(chatId, renderText(node.text || "", vars));
        return true;
      }
    } else if (node.next) {
      currentNodeId = node.next;
    }
  }

  // Walk through chain of message/route nodes
  for (let i = 0; i < 10; i++) {
    const node = flow.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    if (node.type === "menu") {
      await zapiSendText(creds, phone, renderText(node.text || "", vars));
      await persistOutgoing(chatId, renderText(node.text || "", vars));
      await supabaseAdmin
        .from("zapi_chats")
        .update({ bot_state: { current_node: node.id }, status: "bot" })
        .eq("id", chatId);
      return true;
    }

    if (node.type === "message") {
      await zapiSendText(creds, phone, renderText(node.text || "", vars));
      await persistOutgoing(chatId, renderText(node.text || "", vars));
      if (!node.next) {
        await supabaseAdmin
          .from("zapi_chats")
          .update({ bot_state: {}, status: "aguardando" })
          .eq("id", chatId);
        return true;
      }
      currentNodeId = node.next;
      continue;
    }

    if (node.type === "route_to_sector" || node.type === "route_to_least_loaded") {
      const sector = node.target_sector || "Atendimento";
      let assignedTo: string | null = null;
      if (node.type === "route_to_least_loaded") {
        assignedTo = await pickLeastLoaded(sector);
      }
      await supabaseAdmin
        .from("zapi_chats")
        .update({
          status: "em_atendimento",
          sector_name: sector,
          assigned_to: assignedTo,
          bot_state: {},
        })
        .eq("id", chatId);
      return true;
    }

    if (node.type === "end") {
      if (node.text) {
        await zapiSendText(creds, phone, renderText(node.text, vars));
        await persistOutgoing(chatId, renderText(node.text, vars));
      }
      await supabaseAdmin
        .from("zapi_chats")
        .update({ status: "finalizado", bot_state: {} })
        .eq("id", chatId);
      return true;
    }

    break;
  }

  return false;
}

async function persistOutgoing(chatId: string, text: string) {
  await supabaseAdmin.from("zapi_messages").insert({
    chat_id: chatId,
    from_me: true,
    text,
    status: "sent",
  });
  await supabaseAdmin
    .from("zapi_chats")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 120) })
    .eq("id", chatId);
}
