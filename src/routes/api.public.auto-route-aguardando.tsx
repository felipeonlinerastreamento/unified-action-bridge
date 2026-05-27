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

export const Route = createFileRoute("/api/public/auto-route-aguardando")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        const result = await processAutoRoute();
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        return new Response("ok");
      },
    },
  },
});
