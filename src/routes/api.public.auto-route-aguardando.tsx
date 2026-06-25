import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth.server";

const TARGET_SECTOR = "Atendimento";
const IDLE_MINUTES = 10;

async function processAutoRoute() {
  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60_000).toISOString();

  const { data: chats, error } = await supabaseAdmin
    .from("zapi_chats")
    .select("id, phone, contact_name, created_at, last_message_at")
    .eq("status", "aguardando")
    .is("assigned_to", null)
    .is("sector_name", null)
    .lt("created_at", cutoff)
    .limit(100);

  if (error) {
    return { ok: false, error: error.message, results: [] };
  }

  const results: any[] = [];

  for (const chat of chats || []) {
    try {
      const { data: agentId, error: rpcErr } = await supabaseAdmin.rpc(
        "pick_least_loaded_agent_any",
        { _sector: TARGET_SECTOR },
      );

      if (rpcErr) {
        results.push({ chat: chat.id, error: `rpc: ${rpcErr.message}` });
        continue;
      }

      if (!agentId) {
        // Sem operador no setor — apenas marca o setor e segue aguardando.
        await supabaseAdmin
          .from("zapi_chats")
          .update({ sector_name: TARGET_SECTOR } as any)
          .eq("id", chat.id);

        await supabaseAdmin.from("attendance_event_logs").insert({
          event_type: "auto_route_aguardando_no_agent",
          chat_id: chat.id,
          message: `Sem operador disponível no setor ${TARGET_SECTOR} após ${IDLE_MINUTES}min aguardando`,
          metadata: { sector: TARGET_SECTOR } as any,
        } as any);

        results.push({ chat: chat.id, sector: TARGET_SECTOR, assigned: null });
        continue;
      }

      await supabaseAdmin
        .from("zapi_chats")
        .update({
          sector_name: TARGET_SECTOR,
          assigned_to: agentId as string,
          status: "em_atendimento",
        } as any)
        .eq("id", chat.id);

      await supabaseAdmin.from("attendance_event_logs").insert({
        event_type: "auto_route_aguardando",
        chat_id: chat.id,
        message: `Encaminhado automaticamente para ${TARGET_SECTOR} (operador com menor fila) após ${IDLE_MINUTES}min sem escolha de setor`,
        metadata: { sector: TARGET_SECTOR, assigned_to: agentId } as any,
      } as any);

      results.push({ chat: chat.id, sector: TARGET_SECTOR, assigned: agentId });
    } catch (e: any) {
      results.push({ chat: chat.id, error: e?.message || String(e) });
    }
  }

  return { ok: true, processed: results.length, results };
}

function isGroupPhone(phone: string): boolean {
  const raw = String(phone || "");
  if (/-group$/i.test(raw) || /@g\.us$/i.test(raw)) return true;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 15;
}

async function processBotStuck() {
  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60_000).toISOString();

  const { data: chats, error } = await supabaseAdmin
    .from("zapi_chats")
    .select("id, phone, contact_name, created_at, last_message_at")
    .eq("status", "bot")
    .is("assigned_to", null)
    .lt("last_message_at", cutoff)
    .limit(100);

  if (error) {
    return { ok: false, error: error.message, results: [] };
  }

  const results: any[] = [];

  for (const chat of chats || []) {
    try {
      if (isGroupPhone((chat as any).phone)) continue;

      const { data: agentId, error: rpcErr } = await supabaseAdmin.rpc(
        "pick_least_loaded_agent_any",
        { _sector: TARGET_SECTOR },
      );

      if (rpcErr) {
        results.push({ chat: chat.id, error: `rpc: ${rpcErr.message}` });
        continue;
      }

      if (!agentId) {
        // Sem operador: tira do bot e joga em aguardando para a outra rotina cuidar.
        await supabaseAdmin
          .from("zapi_chats")
          .update({
            status: "aguardando",
            sector_name: TARGET_SECTOR,
            bot_state: {},
          } as any)
          .eq("id", chat.id);

        await supabaseAdmin.from("attendance_event_logs").insert({
          event_type: "auto_route_bot_stuck_no_agent",
          chat_id: chat.id,
          message: `Chat preso no bot há ${IDLE_MINUTES}min sem operador disponível — movido para aguardando em ${TARGET_SECTOR}`,
          metadata: { sector: TARGET_SECTOR } as any,
        } as any);

        results.push({ chat: chat.id, sector: TARGET_SECTOR, assigned: null, from: "bot" });
        continue;
      }

      await supabaseAdmin
        .from("zapi_chats")
        .update({
          sector_name: TARGET_SECTOR,
          assigned_to: agentId as string,
          status: "em_atendimento",
          bot_state: {},
        } as any)
        .eq("id", chat.id);

      await supabaseAdmin.from("attendance_event_logs").insert({
        event_type: "auto_route_bot_stuck",
        chat_id: chat.id,
        message: `Chat preso no bot há ${IDLE_MINUTES}min — encaminhado automaticamente para ${TARGET_SECTOR} (operador com menor fila)`,
        metadata: { sector: TARGET_SECTOR, assigned_to: agentId } as any,
      } as any);

      results.push({ chat: chat.id, sector: TARGET_SECTOR, assigned: agentId, from: "bot" });
    } catch (e: any) {
      results.push({ chat: chat.id, error: e?.message || String(e) });
    }
  }

  return { ok: true, processed: results.length, results };
}


export const Route = createFileRoute("/api/public/auto-route-aguardando")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        const aguardando = await processAutoRoute();
        const bot = await processBotStuck();
        const ok = aguardando.ok && bot.ok;
        return new Response(
          JSON.stringify({ ok, aguardando, bot }),
          { status: ok ? 200 : 500, headers: { "Content-Type": "application/json" } },
        );
      },

      GET: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        return new Response("ok");
      },
    },
  },
});
