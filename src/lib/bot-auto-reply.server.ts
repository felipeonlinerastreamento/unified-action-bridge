// Robô de Atendimento — motor de respostas automáticas por assunto.
// Server-only. Chamado pelo webhook da Z-API e pelo scanner público.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadZapiChannel, zapiSendText } from "./zapi.server";

export type BotSettings = {
  id: string;
  is_enabled: boolean;
  observe_only: boolean;
  greeting_seconds: number;
  follow_up_minutes: number;
  start_hour: string;
  end_hour: string;
  max_replies_per_chat: number;
  channel_id: string | null;
  skip_when_ticket_open: boolean;
};

export type BotRule = {
  id: string;
  name: string;
  is_enabled: boolean;
  keywords: string[];
  reply_text: string;
  reply_text_complete?: string | null;
  required_fields: string[];
  target_sector: string | null;
  priority: number;
  from_catalog: boolean;
  catalog_key: string | null;
  is_greeting: boolean;
  create_ticket: boolean;
  ticket_priority: string;
};

export function normalizeText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isGroupPhone(phone: string): boolean {
  const raw = String(phone || "");
  if (/-group$/i.test(raw) || /@g\.us$/i.test(raw)) return true;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 15;
}

const PLATE_RE = /\b([A-Z]{3}\s?-?\s?\d[A-Z0-9]\d{2})\b/i;

export function extractPlate(text: string): string | null {
  const m = String(text || "").toUpperCase().match(PLATE_RE);
  if (!m) return null;
  return m[1].replace(/[\s-]/g, "");
}

export function extractPeriod(text: string): string | null {
  const dates = String(text || "").match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g);
  if (dates && dates.length >= 2) return `${dates[0]} a ${dates[1]}`;
  if (dates && dates.length === 1) return dates[0];
  const rel = String(text || "").match(/\b(hoje|ontem|últimos?\s+\d+\s+dias?|ultimos?\s+\d+\s+dias?|essa semana|este m[eê]s)\b/i);
  return rel ? rel[0] : null;
}

function isValidCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function isValidCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (weights[i] as number);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Reconhece CPF (11) ou CNPJ (14) na mensagem, com ou sem pontuação. */
export function extractDocument(text: string): string | null {
  const candidates = String(text || "").match(/\d[\d.\-/\s]{9,20}\d/g) || [];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, "");
    for (const len of [14, 11]) {
      for (let i = 0; i + len <= digits.length; i++) {
        const slice = digits.slice(i, i + len);
        if (len === 11 && isValidCpf(slice)) return slice;
        if (len === 14 && isValidCnpj(slice)) return slice;
      }
    }
  }
  return null;
}

export const FIELD_LABELS: Record<string, string> = {
  cpf_cnpj: "CPF/CNPJ",
  placa: "placa",
  periodo: "período",
  cidade: "cidade",
  email: "e-mail ou usuário",
};

/** Normaliza rótulos livres para as chaves canônicas de dados exigidos. */
export function canonicalField(field: string): string | null {
  const f = normalizeText(field);
  if (!f) return null;
  if (f.includes("cpf") || f.includes("cnpj") || f.includes("documento")) return "cpf_cnpj";
  if (f.includes("placa")) return "placa";
  if (f.includes("periodo") || f.includes("data")) return "periodo";
  if (f.includes("cidade")) return "cidade";
  if (f.includes("mail") || f.includes("usuario")) return "email";
  return null;
}

/** Extrai da mensagem os dados que o robô sabe reconhecer. */
export function collectFields(text: string): Record<string, string> {
  const collected: Record<string, string> = {};
  const plate = extractPlate(text);
  if (plate) collected.placa = plate;
  const period = extractPeriod(text);
  if (period) collected.periodo = period;
  const doc = extractDocument(text);
  if (doc) collected.cpf_cnpj = doc;
  const email = String(text || "").match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) collected.email = email[0];
  return collected;
}

/** Quais dados exigidos pela automação ainda não vieram na mensagem. */
export function missingRequiredFields(
  rule: Pick<BotRule, "required_fields">,
  collected: Record<string, string>,
): string[] {
  const keys = (rule.required_fields || [])
    .map(canonicalField)
    .filter((k): k is string => !!k);
  const unique = [...new Set(keys)];
  // Campos que o robô não sabe reconhecer (ex.: cidade) são sempre tratados como faltantes.
  return unique.filter((k) => !collected[k]);
}


const MEDIA_MARKER_RE = /^\[(audio|áudio|imagem|image|video|vídeo|documento|document|arquivo|sticker|figurinha|localizacao|localização|contato)\]$/i;

/** Mensagens de mídia (áudio, imagem, etc.) não têm texto: tratamos como saudação. */
export function isMediaMarker(text: string): boolean {
  return MEDIA_MARKER_RE.test(String(text || "").trim());
}

export function matchRule(text: string, rules: BotRule[]): BotRule | null {
  const norm = normalizeText(text);
  if (!norm) return null;
  if (isMediaMarker(text)) {
    const greeting = rules
      .filter((r) => r.is_enabled && r.is_greeting)
      .sort((a, b) => a.priority - b.priority)[0];
    return greeting || null;
  }
  const active = rules
    .filter((r) => r.is_enabled)
    .sort((a, b) => a.priority - b.priority || (a.is_greeting ? 1 : 0) - (b.is_greeting ? 1 : 0));
  // Regras específicas antes da saudação genérica
  const specific = active.filter((r) => !r.is_greeting);
  const greetings = active.filter((r) => r.is_greeting);
  for (const r of [...specific, ...greetings]) {
    const hit = (r.keywords || []).some((k) => {
      const nk = normalizeText(k);
      return nk.length > 0 && norm.includes(nk);
    });
    if (hit) return r;
  }
  return null;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isWithinBotWindow(settings: BotSettings, now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const cur = hour * 60 + minute;
  const start = hhmmToMinutes(settings.start_hour);
  const end = hhmmToMinutes(settings.end_hour);
  if (start === end) return true;
  if (start < end) return cur >= start && cur < end;
  // janela que cruza a meia-noite
  return cur >= start || cur < end;
}

export async function loadBotSettings(): Promise<BotSettings | null> {
  const { data } = await supabaseAdmin
    .from("bot_auto_reply_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as unknown as BotSettings) || null;
}

export async function loadBotRules(): Promise<BotRule[]> {
  const { data } = await supabaseAdmin
    .from("bot_auto_reply_rules")
    .select("*")
    .order("priority", { ascending: true });
  return ((data as unknown as BotRule[]) || []).map((r) => ({
    ...r,
    keywords: r.keywords || [],
    required_fields: r.required_fields || [],
  }));
}

export function renderReply(
  template: string,
  vars: {
    operatorName?: string | null;
    contactName?: string | null;
    collected?: Record<string, string>;
  },
): string {
  const collected = vars.collected || {};
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (key === "operatorName") return vars.operatorName || "nossa equipe";
    if (key === "contactName") return vars.contactName || "";
    if (collected[key]) return collected[key];
    return "";
  });
}

async function operatorNameFor(chatId: string): Promise<string | null> {
  const { data: chat } = await supabaseAdmin
    .from("zapi_chats")
    .select("assigned_to")
    .eq("id", chatId)
    .maybeSingle();
  const uid = (chat as any)?.assigned_to as string | null;
  if (!uid) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, is_active")
    .eq("user_id", uid)
    .maybeSingle();
  if (!profile || (profile as any).is_active === false) return null;
  return ((profile as any).name as string) || null;
}

async function assignIfNeeded(chatId: string, sector: string | null): Promise<void> {
  const target = sector || "Atendimento";
  const { data: chat } = await supabaseAdmin
    .from("zapi_chats")
    .select("assigned_to, sector_name")
    .eq("id", chatId)
    .maybeSingle();
  if ((chat as any)?.assigned_to) return;
  let assignedTo: string | null = null;
  try {
    const { data } = await supabaseAdmin.rpc("pick_least_loaded_agent", { _sector: target });
    assignedTo = (data as string | null) || null;
    if (!assignedTo) {
      const { data: anyAgent } = await supabaseAdmin.rpc("pick_least_loaded_agent_any", {
        _sector: target,
      });
      assignedTo = (anyAgent as string | null) || null;
    }
  } catch (err) {
    console.warn("[bot-auto-reply] pick agent failed", err);
  }
  await supabaseAdmin
    .from("zapi_chats")
    .update({ sector_name: target, assigned_to: assignedTo })
    .eq("id", chatId);
}

async function repliesSentToChat(chatId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("bot_auto_reply_log")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("outcome", "sent");
  return count || 0;
}

type PendingState = {
  rule_id: string;
  due_at: number;
  kind: "greeting" | "follow_up";
  incoming_text: string;
  use_complete?: boolean;
};

export type InboundParams = {
  channelId: string;
  chatId: string;
  phone: string;
  contactName?: string | null;
  incomingText: string;
  messageId?: string | null;
};

/**
 * Avalia uma mensagem recebida. Quando casa com uma automação, agenda a
 * resposta (o envio real acontece no scanner, respeitando a espera).
 * Retorna true quando o robô assumiu a mensagem.
 */
export async function evaluateInboundForAutoReply(params: InboundParams): Promise<boolean> {
  const { channelId, chatId, phone, incomingText } = params;
  try {
    const settings = await loadBotSettings();
    if (!settings || !settings.is_enabled) return false;
    if (settings.channel_id && settings.channel_id !== channelId) return false;
    if (isGroupPhone(phone)) return false;
    if (!isWithinBotWindow(settings)) return false;

    const rules = await loadBotRules();
    const rule = matchRule(incomingText, rules);
    if (!rule) {
      await supabaseAdmin.from("bot_auto_reply_log").insert({
        chat_id: chatId,
        channel_id: channelId,
        message_id: null,
        incoming_text: incomingText,
        outcome: "unmatched",
      });
      return false;
    }

    if (settings.skip_when_ticket_open) {
      const { data: chat } = await supabaseAdmin
        .from("zapi_chats")
        .select("phone_normalized")
        .eq("id", chatId)
        .maybeSingle();
      const normPhone = (chat as any)?.phone_normalized as string | null;
      if (normPhone) {
        const { count } = await supabaseAdmin
          .from("service_tickets")
          .select("id", { count: "exact", head: true })
          .eq("contact_phone", normPhone)
          .in("status", ["aberto", "em_andamento", "reaberto"]);
        if ((count || 0) > 0) {
          await supabaseAdmin.from("bot_auto_reply_log").insert({
            chat_id: chatId,
            channel_id: channelId,
            rule_id: rule.id,
            rule_name: rule.name,
            incoming_text: incomingText,
            outcome: "skipped_ticket_open",
          });
          return false;
        }
      }
    }

    const alreadySent = await repliesSentToChat(chatId);
    if (alreadySent >= settings.max_replies_per_chat) {
      await supabaseAdmin.from("bot_auto_reply_log").insert({
        chat_id: chatId,
        channel_id: channelId,
        rule_id: rule.id,
        rule_name: rule.name,
        incoming_text: incomingText,
        outcome: "skipped_limit",
      });
      return false;
    }

    await assignIfNeeded(chatId, rule.target_sector);

    const collected: Record<string, string> = {};
    const collected = collectFields(incomingText);
    const missing = missingRequiredFields(rule, collected);
    const dataComplete = (rule.required_fields || []).length > 0 && missing.length === 0;
    const template = dataComplete ? (rule.reply_text_complete || "") : rule.reply_text;

    if (settings.observe_only) {
      const operatorName = await operatorNameFor(chatId);
      await supabaseAdmin.from("bot_auto_reply_log").insert({
        chat_id: chatId,
        channel_id: channelId,
        rule_id: rule.id,
        rule_name: rule.name,
        incoming_text: incomingText,
        detected_intent: rule.name,
        collected_data: collected,
        reply_text: renderReply(template, {
          operatorName,
          contactName: params.contactName,
          collected,
        }),
        outcome: "simulated",
      });
      return false;
    }

    // Guarda o que já foi coletado, mesmo quando não há resposta a enviar.
    const { data: chatRow } = await supabaseAdmin
      .from("zapi_chats")
      .select("bot_state")
      .eq("id", chatId)
      .maybeSingle();
    const state = ((chatRow as any)?.bot_state || {}) as Record<string, unknown>;

    if (dataComplete && !template.trim()) {
      // Cliente já mandou tudo e não há texto de confirmação: não repete o pedido.
      await supabaseAdmin
        .from("zapi_chats")
        .update({ bot_state: { ...state, auto_reply_collected: collected } })
        .eq("id", chatId);
      await supabaseAdmin.from("bot_auto_reply_log").insert({
        chat_id: chatId,
        channel_id: channelId,
        rule_id: rule.id,
        rule_name: rule.name,
        incoming_text: incomingText,
        detected_intent: rule.name,
        collected_data: collected,
        outcome: "skipped_data_complete",
      });
      return false;
    }

    // Agenda o envio: o scanner despacha depois da espera configurada.
    const pending: PendingState = {
      rule_id: rule.id,
      due_at: Date.now() + Math.max(0, settings.greeting_seconds) * 1000,
      kind: "greeting",
      incoming_text: incomingText,
      use_complete: dataComplete,
    };
    await supabaseAdmin
      .from("zapi_chats")
      .update({ bot_state: { ...state, auto_reply_pending: pending, auto_reply_collected: collected } })
      .eq("id", chatId);
    return true;
  } catch (err) {
    console.error("[bot-auto-reply] evaluate failed", err);
    return false;
  }
}

/** Despacha as respostas agendadas que já venceram. Usado pelo scanner público. */
export async function dispatchDueAutoReplies(): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  const settings = await loadBotSettings();
  if (!settings || !settings.is_enabled || settings.observe_only) return { sent, skipped };

  const { data: chats } = await supabaseAdmin
    .from("zapi_chats")
    .select("id, channel_id, phone, contact_name, bot_state, assigned_to")
    .not("bot_state->auto_reply_pending", "is", null)
    .limit(100);

  const rules = await loadBotRules();

  for (const chat of (chats as any[]) || []) {
    const state = (chat.bot_state || {}) as Record<string, any>;
    const pending = state.auto_reply_pending as PendingState | undefined;
    if (!pending) continue;
    if (Date.now() < Number(pending.due_at || 0)) continue;

    const clearPending = async () => {
      const next = { ...state };
      delete next.auto_reply_pending;
      await supabaseAdmin.from("zapi_chats").update({ bot_state: next }).eq("id", chat.id);
    };

    try {
      // Cancela se o operador já respondeu depois da mensagem do cliente
      const { data: lastMsg } = await supabaseAdmin
        .from("zapi_messages")
        .select("from_me")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if ((lastMsg as any)?.from_me) {
        await clearPending();
        skipped++;
        continue;
      }

      const rule = rules.find((r) => r.id === pending.rule_id);
      if (!rule || !rule.is_enabled) {
        await clearPending();
        skipped++;
        continue;
      }

      const operatorName = await operatorNameFor(chat.id);
      const text = renderReply(rule.reply_text, {
        operatorName,
        contactName: chat.contact_name,
      });
      if (!text.trim()) {
        await clearPending();
        skipped++;
        continue;
      }

      const creds = await loadZapiChannel(supabaseAdmin, chat.channel_id);
      await zapiSendText(creds, chat.phone, text);
      await supabaseAdmin.from("zapi_messages").insert({
        chat_id: chat.id,
        from_me: true,
        text,
        status: "sent",
      });
      await supabaseAdmin.from("bot_auto_reply_log").insert({
        chat_id: chat.id,
        channel_id: chat.channel_id,
        rule_id: rule.id,
        rule_name: rule.name,
        incoming_text: pending.incoming_text,
        detected_intent: rule.name,
        collected_data: state.auto_reply_collected || {},
        reply_text: text,
        outcome: "sent",
      });
      await clearPending();
      sent++;
    } catch (err) {
      console.error("[bot-auto-reply] dispatch failed for chat", chat.id, err);
      await clearPending();
      skipped++;
    }
  }

  return { sent, skipped };
}
