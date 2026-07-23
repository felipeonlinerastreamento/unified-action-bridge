// Bot engine — evaluates flow nodes against an incoming message.
// Server-only. Used by the public Z-API webhook.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadZapiChannel, zapiSendText } from "./zapi.server";

export interface FlowNode {
  id: string;
  type:
    | "message"
    | "menu"
    | "route_to_sector"
    | "route_to_least_loaded"
    | "end"
    | "gsystem_boleto"
    | "ask_input"
    | "gsystem_boleto_by_doc";
  text?: string;
  options?: Array<{ key: string; label: string; next: string }>;
  next?: string;
  target_sector?: string;
  // gsystem_boleto specific
  fallback_sector?: string;
  text_success?: string;
  text_no_boletos?: string;
  text_no_client?: string;
  // ask_input specific
  state_key?: string;     // where to store user's reply in bot_state
  next_on_no_client?: string; // for gsystem_boleto: where to go if client not found by phone
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
  // 1ª tentativa: operador do setor ativo, disponível e com presença recente.
  const { data } = await supabaseAdmin.rpc("pick_least_loaded_agent", { _sector: sectorName });
  const strict = (data as string | null) || null;
  if (strict) return strict;
  // Fallback: qualquer operador ativo do setor (mesmo offline/indisponível),
  // para garantir que a conversa nunca fique sem responsável quando roteada.
  const { data: any } = await supabaseAdmin.rpc("pick_least_loaded_agent_any", { _sector: sectorName });
  return (any as string | null) || null;
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

  const botState = (chat.bot_state || {}) as { current_node?: string; [k: string]: any };
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
        // Invalid choice. Avoid spamming: only re-send the menu if it has not been
        // re-sent in the last 10 minutes for this chat. Otherwise, stay silent and
        // wait for the customer to pick a valid option (or for a human to take over).
        const lastMenuSentAt = typeof botState.last_menu_sent_at === "number" ? botState.last_menu_sent_at : 0;
        const nowMs = Date.now();
        const TEN_MIN_MS = 10 * 60 * 1000;
        if (nowMs - lastMenuSentAt < TEN_MIN_MS) {
          console.log(`[bot] menu no match for input="${incomingText}", suppressing re-send (cooldown active)`);
          return true;
        }
        console.log(`[bot] menu no match for input="${incomingText}", re-sending menu (cooldown elapsed)`);
        await sendAndPersist(creds, phone, chatId, renderText(node.text || "", vars));
        await supabaseAdmin
          .from("zapi_chats")
          .update({ bot_state: { ...botState, current_node: node.id, last_menu_sent_at: nowMs }, status: "bot" })
          .eq("id", chatId);
        return true;
      }
    } else if (node.type === "ask_input") {
      // Capture user reply into bot_state under state_key, then advance
      const key = node.state_key || "input";
      botState[key] = (incomingText || "").trim();
      currentNodeId = node.next || currentNodeId;
    } else if (node.next) {
      currentNodeId = node.next;
    }
  }

  // Walk through chain of message/route nodes
  for (let i = 0; i < 10; i++) {
    const node = flow.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    if (node.type === "menu") {
      await sendAndPersist(creds, phone, chatId, renderText(node.text || "", vars));
      await supabaseAdmin
        .from("zapi_chats")
        .update({ bot_state: { ...botState, current_node: node.id, last_menu_sent_at: Date.now() }, status: "bot" })
        .eq("id", chatId);
      return true;
    }

    if (node.type === "message") {
      await sendAndPersist(creds, phone, chatId, renderText(node.text || "", vars));
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
      // Sempre tenta atribuir automaticamente ao operador menos sobrecarregado
      // do setor (respeita presença/disponibilidade e cai para fallback "any").
      // Antes, `route_to_sector` deixava assigned_to = null, o que fazia o chat
      // ficar em atendimento sem responsável (bug: nenhum operador designado).
      let assignedTo: string | null = null;
      try {
        assignedTo = await pickLeastLoaded(sector);
      } catch (err) {
        console.warn("[bot] pickLeastLoaded failed for sector", sector, err);
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


    if (node.type === "ask_input") {
      // Send the prompt and wait for user reply
      await sendAndPersist(creds, phone, chatId, renderText(node.text || "", vars));
      await supabaseAdmin
        .from("zapi_chats")
        .update({ bot_state: { ...botState, current_node: node.id }, status: "bot" })
        .eq("id", chatId);
      return true;
    }

    if (node.type === "gsystem_boleto") {
      const fallbackSector = node.fallback_sector || "Financeiro";
      const textSuccess = node.text_success || "Encontrei {{count}} boleto(s) em aberto no seu cadastro:";
      const textNoBoletos = node.text_no_boletos || "Não encontrei boletos em aberto no seu cadastro. Vou te encaminhar para o Financeiro.";
      const textNoClient = node.text_no_client || "Não consegui identificar seu cadastro pelo seu telefone. Vou te encaminhar para o Financeiro.";

      let clientFound = false;
      let messageToSend = textNoClient;
      try {
        const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
        const cliente = await findGSystemClientByPhone(gsystemApiFetch, phone);
        if (cliente?.cpfCnpj) {
          clientFound = true;
          const faturas = await gsystemApiFetch(`/faturas/${encodeURIComponent(cliente.cpfCnpj)}`);
          const abertos = filterOpenBoletos(faturas);
          if (abertos.length > 0) {
            messageToSend = textSuccess.replace(/\{\{count\}\}/g, String(abertos.length))
              + "\n\n" + formatBoletos(abertos);
          } else {
            messageToSend = textNoBoletos;
          }
        }
      } catch (err) {
        console.error("[bot:gsystem_boleto] error", err);
        messageToSend = textNoBoletos;
        clientFound = true; // erro real — não vale ir para ask_doc
      }

      // Se cliente não foi identificado por telefone e há um próximo nó configurado (ask CPF/CNPJ), redireciona pra ele
      if (!clientFound && node.next_on_no_client) {
        currentNodeId = node.next_on_no_client;
        continue;
      }

      await sendAndPersist(creds, phone, chatId, renderText(messageToSend, vars));

      // Roteia para humano após enviar boletos (fallback / continuidade)
      let assignedTo: string | null = null;
      try {
        assignedTo = await pickLeastLoaded(fallbackSector);
      } catch {
        // ignore
      }
      await supabaseAdmin
        .from("zapi_chats")
        .update({
          status: "em_atendimento",
          sector_name: fallbackSector,
          assigned_to: assignedTo,
          bot_state: {},
        })
        .eq("id", chatId);
      return true;
    }

    if (node.type === "gsystem_boleto_by_doc") {
      const fallbackSector = node.fallback_sector || "Financeiro";
      const textSuccess = node.text_success || "Encontrei {{count}} boleto(s) em aberto no seu cadastro:";
      const textNoBoletos = node.text_no_boletos || "Não encontrei boletos em aberto no seu cadastro. Vou te encaminhar para o Financeiro.";
      const textNoClient = node.text_no_client || "Não consegui localizar seu cadastro com esse CPF/CNPJ. Vou te encaminhar para o Financeiro.";

      const stateKey = node.state_key || "cpf_cnpj";
      const rawDoc = String(botState[stateKey] || "").replace(/\D/g, "");

      let messageToSend = textNoClient;
      if (rawDoc.length === 11 || rawDoc.length === 14) {
        try {
          const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
          // Tenta buscar cliente pelo doc; se achar, usa o doc retornado, senão tenta direto faturas
          let docToQuery = rawDoc;
          try {
            const result = await gsystemApiFetch(`/clientes/${encodeURIComponent(rawDoc)}`);
            const first = Array.isArray(result) ? result[0] : result;
            const cpfCnpj = first?.CNPJ || first?.CPF || first?.cnpj || first?.cpf;
            if (cpfCnpj) docToQuery = String(cpfCnpj).replace(/\D/g, "");
          } catch {
            // segue tentando faturas direto
          }

          const faturas = await gsystemApiFetch(`/faturas/${encodeURIComponent(docToQuery)}`);
          const abertos = filterOpenBoletos(faturas);
          if (abertos.length > 0) {
            messageToSend = textSuccess.replace(/\{\{count\}\}/g, String(abertos.length))
              + "\n\n" + formatBoletos(abertos);
          } else if (Array.isArray(faturas) ? faturas.length > 0 : !!faturas) {
            messageToSend = textNoBoletos;
          }
        } catch (err) {
          console.error("[bot:gsystem_boleto_by_doc] error", err);
        }
      }

      await sendAndPersist(creds, phone, chatId, renderText(messageToSend, vars));

      let assignedTo: string | null = null;
      try {
        assignedTo = await pickLeastLoaded(fallbackSector);
      } catch {
        // ignore
      }
      await supabaseAdmin
        .from("zapi_chats")
        .update({
          status: "em_atendimento",
          sector_name: fallbackSector,
          assigned_to: assignedTo,
          bot_state: {},
        })
        .eq("id", chatId);
      return true;
    }

    if (node.type === "end") {
      if (node.text) {
        await sendAndPersist(creds, phone, chatId, renderText(node.text, vars));
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

async function persistOutgoing(chatId: string, text: string, sendResult?: any) {
  const zapiMessageId =
    sendResult?.messageId || sendResult?.id || sendResult?.zaapId || null;
  await supabaseAdmin.from("zapi_messages").insert({
    chat_id: chatId,
    zapi_message_id: zapiMessageId,
    from_me: true,
    text,
    status: "sent",
  });
  await supabaseAdmin
    .from("zapi_chats")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: text.slice(0, 120) })
    .eq("id", chatId);
}

async function sendAndPersist(
  creds: Parameters<typeof zapiSendText>[0],
  phone: string,
  chatId: string,
  text: string,
) {
  const result = await zapiSendText(creds, phone, text);
  await persistOutgoing(chatId, text, result);
  return result;
}

// ============================================================
// GSystem boleto helpers
// ============================================================

type GsApiFetch = (endpoint: string, method?: string, body?: unknown) => Promise<any>;

/**
 * Try to find a client in GSystem using only the WhatsApp phone number.
 * Strategy: GSystem's `/clientes/{identifier}` accepts multiple identifiers
 * (CPF, CNPJ, phone). We try a few normalised variants.
 */
async function findGSystemClientByPhone(
  gsApi: GsApiFetch,
  phone: string
): Promise<{ key?: string; cpfCnpj?: string } | null> {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;

  // Variants: full, without country code (55), last 11 digits, last 10 digits
  const variants = Array.from(
    new Set([
      digits,
      digits.startsWith("55") ? digits.slice(2) : digits,
      digits.slice(-11),
      digits.slice(-10),
    ].filter((v) => v.length >= 8))
  );

  for (const v of variants) {
    try {
      const result = await gsApi(`/clientes/${encodeURIComponent(v)}`);
      const first = Array.isArray(result) ? result[0] : result;
      if (first && (first.CPF || first.CNPJ || first.cpf || first.cnpj || first.Key || first.key)) {
        return {
          key: String(first.Key || first.key || ""),
          cpfCnpj: String(first.CNPJ || first.CPF || first.cnpj || first.cpf || ""),
        };
      }
    } catch {
      // try next variant
    }
  }
  return null;
}

interface BoletoSummary {
  numero?: string;
  vencimento?: string;
  valor?: number | string;
  link?: string;
  linhaDigitavel?: string;
  status?: string;
}

/** Filter only open / pending invoices from a GSystem `/faturas/...` response. */
function filterOpenBoletos(faturas: any): BoletoSummary[] {
  const arr: any[] = Array.isArray(faturas) ? faturas : (faturas?.items || faturas?.Items || []);
  return arr
    .map((f) => {
      const status = String(
        f.Status || f.status || f.SituacaoDescricao || f.Situacao || ""
      ).toLowerCase();
      const isPaid = /pago|quitad|liquidad|baixad/.test(status);
      if (isPaid) return null;
      return {
        numero: f.NumeroDocumento || f.Numero || f.numero || f.Documento || f.Id || f.id,
        vencimento: f.DataVencimento || f.Vencimento || f.vencimento || f.dataVencimento,
        valor: f.Valor || f.valor || f.ValorTotal || f.valorTotal,
        link: f.LinkBoleto || f.UrlBoleto || f.linkBoleto || f.url || f.Url,
        linhaDigitavel: f.LinhaDigitavel || f.linhaDigitavel || f.CodigoBarras || f.codigoBarras,
        status: f.SituacaoDescricao || f.Situacao || f.Status || f.status,
      } as BoletoSummary;
    })
    .filter((x): x is BoletoSummary => x !== null);
}

function formatBoletos(boletos: BoletoSummary[]): string {
  return boletos
    .map((b, i) => {
      const lines: string[] = [`*${i + 1})* Documento ${b.numero || "-"}`];
      if (b.vencimento) {
        const d = String(b.vencimento).split("T")[0];
        const [y, m, dd] = d.includes("-") ? d.split("-") : ["", "", ""];
        lines.push(`📅 Vencimento: ${y && m && dd ? `${dd}/${m}/${y}` : d}`);
      }
      if (b.valor != null) {
        const num = typeof b.valor === "string" ? Number(b.valor.replace(",", ".")) : b.valor;
        if (!Number.isNaN(num)) {
          lines.push(`💵 Valor: R$ ${num.toFixed(2).replace(".", ",")}`);
        }
      }
      if (b.link) lines.push(`🔗 ${b.link}`);
      if (b.linhaDigitavel) lines.push(`🧾 ${b.linhaDigitavel}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
