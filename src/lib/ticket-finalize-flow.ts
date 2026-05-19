/**
 * Centralized ticket finalization flow.
 * Used by ticket detail panel, kanban drag-drop and central chat finalize.
 *
 * Behavior:
 *  - If category matches "Teste de Equipamento" (per settings) and the flow is enabled:
 *      route to teSettings.target_sector_name with target_status, clear assignee,
 *      register encaminhamento comment + ticket_assignments row, optionally sync GSystem.
 *  - Else if there is an active category_routing_rules match:
 *      same behavior using the rule values.
 *  - Else: standard finalize (status=finalizado, closed_at=now).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  isTesteEquipamentoCategory,
  type TesteEquipamentoSettings,
} from "@/hooks/use-teste-equipamento-settings";
import { syncTicketToGsystem } from "@/lib/ticket-finalize.functions";

export interface FinalizeFlowInput {
  ticket: {
    id: string;
    category?: string | null;
    sector?: string | null;
    status?: string | null;
    notes?: string | null;
    reopened_at?: string | null;
    attendance_id?: string | null;
  };
  userId: string | null;
  /** Pass current settings (already loaded via useTesteEquipamentoSettings). Optional. */
  teSettings?: TesteEquipamentoSettings | null;
  /** When true, will look up category_routing_rules as fallback. Default: true. */
  useRoutingRules?: boolean;
  /** When true, register a "status alterado" comment for normal finalize. Default: true. */
  registerStatusComment?: boolean;
  /** When true, ignora roteamento automático (Teste Equipamento + regras de categoria) e finaliza direto. Usado por admin. */
  bypassRouting?: boolean;
}

export interface FinalizeFlowResult {
  routed: boolean;
  routedTo?: { sector: string; status: string };
  syncedToGsystem?: boolean;
  pendenciaKey?: string | null;
  syncError?: string | null;
  error?: string | null;
}

async function insertSystemComment(
  ticketId: string,
  userId: string | null,
  content: string,
  type: string
) {
  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    user_id: userId,
    content,
    comment_type: type,
  });
  if (error) console.error("[finalize-flow] insert comment error:", error);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeFlowText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * When a ticket is bound to a Z-API chat (attendance_id is a UUID matching a
 * row in zapi_chats), finalizing the ticket must also remove that chat from
 * the Central de Atendimento by setting its status to "finalizado".
 * Safe to call for tickets without a chat — just no-ops.
 */
async function closeLinkedZapiChat(attendanceId: string | null | undefined) {
  if (!attendanceId || !UUID_RE.test(attendanceId)) return;
  try {
    const { error } = await supabase
      .from("zapi_chats")
      .update({ status: "finalizado", assigned_to: null })
      .eq("id", attendanceId);
    if (error) console.warn("[finalize-flow] close zapi chat error:", error.message);
  } catch (e: any) {
    console.warn("[finalize-flow] close zapi chat exception:", e?.message);
  }
}

export async function finalizeTicketWithFlow(
  input: FinalizeFlowInput
): Promise<FinalizeFlowResult> {
  const { ticket, userId, teSettings, useRoutingRules = true, registerStatusComment = true, bypassRouting = false } = input;
  if (!ticket?.id) return { routed: false, error: "Ticket inválido" };

  // Admin bypass: finaliza direto sem criar vínculos/encaminhamentos
  if (bypassRouting) {
    const { error } = await supabase
      .from("service_tickets")
      .update({
        status: "finalizado" as const,
        closed_at: new Date().toISOString(),
        closed_by: userId,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", ticket.id);
    if (error) return { routed: false, error: error.message };
    if (registerStatusComment) {
      await insertSystemComment(ticket.id, userId, "Status alterado para finalizado (admin — sem encaminhamento)", "status_change");
    }
    await closeLinkedZapiChat(ticket.attendance_id);
    return { routed: false };
  }

  // 1. Detect Teste de Equipamento
  const isTE = isTesteEquipamentoCategory(ticket.category, teSettings);
  const teEnabled = teSettings?.is_enabled ?? true;

  if (isTE && teEnabled) {
    const targetSector = teSettings?.target_sector_name || "Administrativo";
    const targetStatus = (teSettings?.target_status || "aberto") as
      | "aberto"
      | "em_andamento";

    // Idempotente: TE NUNCA finaliza o ticket via este fluxo. Sempre garante
    // que o ticket fica aberto no setor alvo (Administrativo). Re-cliques em
    // Finalizar apenas reaplicam o mesmo estado sem duplicar artefatos.
    let liveSectorTE: string | null = ticket.sector ?? null;
    let hasAssignmentToTarget = false;
    let hasEncaminhamentoComment = false;
    let existingPendenciaKey: string | null = null;
    try {
      const [{ data: fresh }, { data: assignments }, { data: routeComments }] = await Promise.all([
        supabase
          .from("service_tickets")
          .select("sector, pendencia_key")
          .eq("id", ticket.id)
          .maybeSingle(),
        supabase
          .from("ticket_assignments")
          .select("sector_name")
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("ticket_comments")
          .select("content")
          .eq("ticket_id", ticket.id)
          .eq("comment_type", "encaminhamento")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (fresh?.sector !== undefined) liveSectorTE = fresh.sector;
      existingPendenciaKey = (fresh as any)?.pendencia_key || null;
      const targetNorm = normalizeFlowText(targetSector);
      hasAssignmentToTarget = Boolean(
        assignments?.some((a: any) => normalizeFlowText(a.sector_name) === targetNorm)
      );
      hasEncaminhamentoComment = Boolean(
        routeComments?.some((c: any) => {
          const content = normalizeFlowText(c.content);
          return content.includes("encaminhado automaticamente") && content.includes(targetNorm);
        })
      );
    } catch {
      // ignore — segue com defaults
    }

    const { error } = await supabase
      .from("service_tickets")
      .update({
        status: targetStatus,
        sector: targetSector,
        assigned_to: null,
        closed_at: null,
        closed_by: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", ticket.id);
    if (error) return { routed: false, error: error.message };

    // Só registra assignment se ainda não existe um para o setor alvo
    if (!hasAssignmentToTarget) {
      await supabase.from("ticket_assignments").insert({
        ticket_id: ticket.id,
        assigned_by: userId,
        sector_name: targetSector,
      });
    }

    // Só registra comentário de encaminhamento se ainda não houver
    if (!hasEncaminhamentoComment) {
      await insertSystemComment(
        ticket.id,
        userId,
        `Atendimento finalizado e encaminhado automaticamente para o setor "${targetSector}" com status "${targetStatus}" (fluxo Teste de Equipamento).`,
        "encaminhamento"
      );
    }

    let syncedToGsystem = false;
    let pendenciaKey: string | null = existingPendenciaKey;
    let syncError: string | null = null;
    // Sync GSystem apenas na primeira vez (sem pendência ainda)
    if ((teSettings?.auto_sync_gsystem ?? true) && !existingPendenciaKey) {
      try {
        const res = await syncTicketToGsystem({ data: { ticketId: ticket.id } });
        if ((res as any)?.ok) {
          syncedToGsystem = true;
          pendenciaKey = (res as any).pendenciaKey || null;
          await insertSystemComment(
            ticket.id,
            userId,
            `Sincronizado com GSystem (pendência ${pendenciaKey || "criada"})`,
            "sistema"
          );
        } else {
          syncError = (res as any)?.error || "erro desconhecido";
          await insertSystemComment(
            ticket.id,
            userId,
            `Falha ao sincronizar com GSystem: ${syncError}. Tente novamente em Ações.`,
            "sistema"
          );
        }
      } catch (e: any) {
        syncError = e?.message || String(e);
      }
    }

    await closeLinkedZapiChat(ticket.attendance_id);
    return {
      routed: true,
      routedTo: { sector: targetSector, status: targetStatus },
      syncedToGsystem,
      pendenciaKey,
      syncError,
    };
  }


  // 2. Try category_routing_rules
  if (useRoutingRules && ticket.category) {
    try {
      const { data: rules } = await supabase
        .from("category_routing_rules")
        .select("*")
        .eq("is_active", true)
        .or(`category_key.eq.${ticket.category},category_label.eq.${ticket.category}`);
      const rule = rules?.[0];
      // Liberação de Equipamento é fluxo interno — nunca sincroniza com GSystem
      const isLiberacao = /libera[cç][aã]o de equipamento/i.test(String(ticket.category || ""));

      // Re-fetch the live sector from DB to avoid using stale prop data.
      // This prevents re-routing a ticket that is already in the target sector.
      let liveSector: string | null = ticket.sector ?? null;
      try {
        const { data: fresh } = await supabase
          .from("service_tickets")
          .select("sector")
          .eq("id", ticket.id)
          .maybeSingle();
        if (fresh?.sector !== undefined) liveSector = fresh.sector;
      } catch {
        // ignore — fall back to prop value
      }

      const ticketSectorNorm = String(liveSector || "").trim().toLowerCase();
      const ruleSectorNorm = String(rule?.target_sector_name || "").trim().toLowerCase();
      const alreadyRouted = Boolean(
        ruleSectorNorm && ticketSectorNorm && ticketSectorNorm === ruleSectorNorm
      );
      console.log("[finalize-flow] routing check", {
        ticketId: ticket.id,
        category: ticket.category,
        propSector: ticket.sector,
        liveSector,
        ruleTargetSector: rule?.target_sector_name,
        alreadyRouted,
        ruleFound: Boolean(rule),
      });

      // Check if a pendência already exists for this ticket
      let pendenciaAlreadyExists = false;
      if (rule?.auto_create_ticket && !isLiberacao) {
        const { data: existingLink } = await supabase
          .from("entity_links")
          .select("external_id")
          .eq("entity_type", "pendencia")
          .eq("local_id", String(ticket.id))
          .maybeSingle();
        pendenciaAlreadyExists = Boolean(existingLink?.external_id);
      }

      if (rule && rule.target_sector_name && !alreadyRouted) {
        const targetSector = rule.target_sector_name;
        const targetStatus = "aberto" as const;
        const { error } = await supabase
          .from("service_tickets")
          .update({
            status: targetStatus,
            sector: targetSector,
            assigned_to: null,
            closed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ticket.id);
        if (error) return { routed: false, error: error.message };

        await supabase.from("ticket_assignments").insert({
          ticket_id: ticket.id,
          assigned_by: userId,
          sector_name: targetSector,
        });
        await insertSystemComment(
          ticket.id,
          userId,
          `Atendimento finalizado e encaminhado automaticamente para o setor "${targetSector}" (regra de categoria "${rule.category_label || rule.category_key}").`,
          "encaminhamento"
        );

        let syncedToGsystem = false;
        let pendenciaKey: string | null = null;
        let syncError: string | null = null;
        if (rule.auto_create_ticket && !isLiberacao && !pendenciaAlreadyExists) {
          try {
            const res = await syncTicketToGsystem({ data: { ticketId: ticket.id } });
            if ((res as any)?.ok) {
              syncedToGsystem = true;
              pendenciaKey = (res as any).pendenciaKey || null;
              await insertSystemComment(
                ticket.id,
                userId,
                `Sincronizado com GSystem (pendência ${pendenciaKey || "criada"})`,
                "sistema"
              );
            } else {
              syncError = (res as any)?.error || "erro desconhecido";
            }
          } catch (e: any) {
            syncError = e?.message || String(e);
          }
        } else if (pendenciaAlreadyExists) {
          // Pendência já foi criada anteriormente — não duplicar
          syncedToGsystem = true;
        }

        await closeLinkedZapiChat(ticket.attendance_id);
        return {
          routed: true,
          routedTo: { sector: targetSector, status: targetStatus },
          syncedToGsystem,
          pendenciaKey,
          syncError,
        };
      }
    } catch (e) {
      console.warn("[finalize-flow] routing rules lookup failed:", e);
    }
  }

  // 3. Standard finalize
  const { error } = await supabase
    .from("service_tickets")
    .update({
      status: "finalizado" as const,
      closed_at: new Date().toISOString(),
      closed_by: userId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", ticket.id);
  if (error) return { routed: false, error: error.message };

  if (registerStatusComment) {
    await insertSystemComment(ticket.id, userId, "Status alterado para finalizado", "status_change");
  }
  await closeLinkedZapiChat(ticket.attendance_id);
  return { routed: false };
}
