import { supabase } from "@/integrations/supabase/client";

export interface EscalateGestaoInput {
  channelId?: string | null;
  companyId?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  plate?: string | null;
  protocolBase?: string | null;
  sourceTicketId?: string | null;
  openedBy?: string | null;
}

export interface EscalateGestaoResult {
  success: boolean;
  sectorName: string;
  ticketId?: string;
  error?: string;
}

/**
 * Cria automaticamente um chamado para o setor de Gestão usando as configurações
 * de `escalation_gestao_settings`. Reutilizado pelo botão "Gestão" no chat e no
 * detalhe de atendimento.
 */
export async function escalateToGestao(input: EscalateGestaoInput): Promise<EscalateGestaoResult> {
  const { data: cfg } = await supabase
    .from("escalation_gestao_settings" as any)
    .select("*")
    .limit(1)
    .maybeSingle();

  const sectorName = (cfg as any)?.target_sector_name || "Gestão";
  const defaultNotes = (cfg as any)?.default_notes || "Atendimento escalado para análise da Gestão";
  const defaultCategory = (cfg as any)?.default_category || "Escalado para Gestão";
  const isEnabled = (cfg as any)?.is_enabled ?? true;
  if (!isEnabled) {
    return { success: false, sectorName, error: "Escalonamento para Gestão está desativado nas configurações." };
  }

  const protocolBase = input.protocolBase || input.sourceTicketId || "";

  const { data: inserted, error: insErr } = await supabase
    .from("service_tickets")
    .insert({
      attendance_id: `gestao-${Date.now()}`,
      channel_id: input.channelId || null,
      company_id: input.companyId || null,
      contact_phone: input.contactPhone || null,
      contact_name: input.contactName || null,
      plate: input.plate || null,
      status: "aberto" as const,
      opened_by: input.openedBy || null,
      sector: sectorName,
      category: defaultCategory,
      notes: `${defaultNotes}${protocolBase ? `\n\nProtocolo de origem: ${protocolBase}` : ""}`,
      escalated_to_gestao: true,
      escalated_from_ticket_id: input.sourceTicketId || null,
    } as any)
    .select("id")
    .maybeSingle();

  if (insErr) {
    return { success: false, sectorName, error: insErr.message };
  }

  if (input.sourceTicketId) {
    await supabase
      .from("service_tickets")
      .update({ escalated_to_gestao: true } as any)
      .eq("id", input.sourceTicketId);
  }

  return { success: true, sectorName, ticketId: (inserted as any)?.id };
}
