/**
 * Server function to sync a finalized ticket to GSystem as a pendência.
 * Called from the client when finalizing a ticket.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const syncTicketToGsystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ticketId: z.string().uuid(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Load the ticket with company
    const { data: ticket, error: tErr } = await supabase
      .from("service_tickets")
      .select("*, companies:company_id(id, name, cnpj)")
      .eq("id", data.ticketId)
      .single();
    if (tErr || !ticket) {
      return { ok: false, error: "Ticket não encontrado" };
    }

    // Load comments
    const { data: comments } = await supabase
      .from("ticket_comments")
      .select("content, created_at, user_id, comment_type")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });

    // Load author profile
    let attendantName = "Sistema";
    if (ticket.assigned_to) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", ticket.assigned_to)
        .maybeSingle();
      if (prof?.name) attendantName = prof.name;
    }

    // Load profile names for comments
    const userIds = Array.from(
      new Set((comments || []).map((c: any) => c.user_id).filter(Boolean))
    );
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      for (const p of profs || []) profileMap[p.user_id] = p.name || "Usuário";
    }

    // Try to resolve gsystem cliente key from entity_links
    let gsystemClienteKey: string | null = null;
    if (ticket.company_id) {
      const { data: link } = await supabase
        .from("entity_links")
        .select("external_id")
        .eq("entity_type", "cliente")
        .eq("local_id", String(ticket.company_id))
        .maybeSingle();
      if (link?.external_id) gsystemClienteKey = link.external_id;
    }

    // Parse Teste de Equipamento extra fields out of notes (if present)
    const notesStr = String(ticket.notes || "");
    const TE_START = "[Teste de Equipamento]";
    const TE_END = "---";
    const teIdx = notesStr.indexOf(TE_START);
    let teBlock = "";
    let teData: Record<string, string> = {};
    let isTesteEquip = false;
    if (teIdx !== -1) {
      isTesteEquip = true;
      const teEnd = notesStr.indexOf(TE_END, teIdx);
      teBlock = notesStr.substring(teIdx, teEnd === -1 ? notesStr.length : teEnd);
      const grab = (label: string) => {
        const m = teBlock.match(new RegExp(`${label}:\\s*(.+)`));
        return m ? m[1].trim() : "";
      };
      teData = {
        Subtipo: grab("Subtipo"),
        "Necessário cobrar": grab("Necessário cobrar"),
        Motivo: grab("Motivo"),
        Garantia: grab("Garantia"),
      };
    }
    if (!isTesteEquip && /teste de equipamento/i.test(String(ticket.category || ""))) {
      isTesteEquip = true;
    }

    // Build description
    const fmt = (d: string | null | undefined) =>
      d ? new Date(d).toLocaleString("pt-BR") : "—";
    const lines: string[] = [];
    lines.push(`TICKET #${String(ticket.id).substring(0, 8)}`);
    lines.push(`Origem: ${ticket.attendance_id?.startsWith("auto-") ? "Automática" : (ticket.channel_id ? "Chat" : "Manual")}`);
    lines.push(`Empresa: ${ticket.companies?.name || "—"}`);
    lines.push(
      `Contato: ${ticket.contact_name || "—"}    Telefone: ${ticket.contact_phone || "—"}`
    );
    if (ticket.plate) lines.push(`Placa: ${ticket.plate}`);
    if (ticket.tracking_code) lines.push(`Tracking: ${ticket.tracking_code}`);
    lines.push(`Categoria: ${ticket.category || "—"}`);
    lines.push(`Prioridade: ${ticket.priority || "—"}`);
    lines.push(`Setor destino: ${ticket.sector || "—"}`);
    lines.push(`Aberto em: ${fmt(ticket.created_at)}`);
    lines.push(`Finalizado em: ${fmt(new Date().toISOString())}`);
    lines.push(`Atendente: ${attendantName}`);

    if (isTesteEquip) {
      lines.push("");
      lines.push("=== TESTE DE EQUIPAMENTO ===");
      if (teData.Subtipo) lines.push(`Subtipo: ${teData.Subtipo}`);
      if (teData["Necessário cobrar"])
        lines.push(`Necessário cobrar: ${teData["Necessário cobrar"]}`);
      if (teData.Motivo) lines.push(`Motivo da cobrança: ${teData.Motivo}`);
      if (teData.Garantia) lines.push(`Garantia: ${teData.Garantia}`);
      if (!teData.Subtipo && !teData.Garantia) {
        lines.push("(campos extras não preenchidos)");
      }
    }

    lines.push("");
    lines.push("OBSERVAÇÕES:");
    // Strip TE block from notes for cleaner output
    const cleanedNotes = teIdx !== -1
      ? (notesStr.substring(0, teIdx) +
         notesStr.substring(notesStr.indexOf(TE_END, teIdx) === -1
           ? notesStr.length
           : notesStr.indexOf(TE_END, teIdx) + TE_END.length)).trim()
      : notesStr.trim();
    lines.push(cleanedNotes || "(sem observações)");
    lines.push("");
    if (comments && comments.length > 0) {
      lines.push("HISTÓRICO DE COMENTÁRIOS:");
      for (const c of comments) {
        const author = c.user_id ? profileMap[c.user_id] || "Usuário" : "Sistema";
        const date = new Date(c.created_at).toLocaleString("pt-BR");
        lines.push(`- [${date}] [${c.comment_type}] ${author}: ${c.content}`);
      }
    }

    const descricao = lines.join("\n");

    // Look up the active channel for GSystem token
    const { data: channels } = await supabase
      .from("channels")
      .select("id, token")
      .eq("is_active", true)
      .limit(1);
    const channel = channels?.[0];
    if (!channel?.token) {
      return { ok: false, error: "Nenhum canal GSystem ativo configurado" };
    }

    // Build the pendência body — fields based on common GSystem schema.
    // For Teste de Equipamento we send a generic "Atendimento" type since the
    // GSystem enum may not include "Teste de Equipamento" — the subtype is
    // preserved inside the description.
    const tipo = isTesteEquip
      ? "Atendimento"
      : (ticket.pendencia_key || ticket.category || "Atendimento");
    const body: Record<string, unknown> = {
      Descricao: descricao,
      Tipo: tipo,
    };
    if (gsystemClienteKey) body.Cliente = gsystemClienteKey;
    if (ticket.plate) body.Veiculo = ticket.plate;

    try {
      const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
      const result = await gsystemApiFetch("/pendencias", "POST", body);
      const pendenciaKey =
        (result as any)?.Key || (result as any)?.key || (result as any)?.id || null;

      // Persist mapping in entity_links for future reference
      if (pendenciaKey) {
        try {
          await supabase.from("entity_links").insert({
            entity_type: "pendencia",
            local_id: String(ticket.id),
            external_id: String(pendenciaKey),
            channel_id: channel.id,
          });
        } catch {
          // ignore duplicate
        }
      }

      return { ok: true, pendenciaKey };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Falha ao criar pendência no GSystem" };
    }
  });
