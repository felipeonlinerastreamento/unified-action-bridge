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
    const { supabase, userId } = context;

    // Load the ticket with company
    const { data: ticket, error: tErr } = await supabase
      .from("service_tickets")
      .select("*, companies:company_id(id, name, cnpj, phone)")
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
    // Notas internas (transferências) ficam restritas aos operadores e
    // não são replicadas ao cliente / GSystem.
    const visibleComments = (comments || []).filter(
      (c: any) => c.comment_type !== "interno"
    );
    if (visibleComments.length > 0) {
      lines.push("HISTÓRICO DE COMENTÁRIOS:");
      for (const c of visibleComments) {
        const author = c.user_id ? profileMap[c.user_id] || "Usuário" : "Sistema";
        const date = new Date(c.created_at).toLocaleString("pt-BR");
        lines.push(`- [${date}] [${c.comment_type}] ${author}: ${c.content}`);
      }
    }

    const descricao = lines.join("\n");

    // GSystem sync uses the server-side credentials configured in secrets.
    // A Z-API channel is only useful to keep the optional local mapping context,
    // so the sync must not fail when there is no active WhatsApp channel.
    let mappingChannelId: string | null = ticket.channel_id || null;
    if (!mappingChannelId) {
      const { data: channels } = await supabase
        .from("channels")
        .select("id")
        .eq("is_active", true)
        .limit(1);
      mappingChannelId = channels?.[0]?.id || null;
    }

    // Build the pendência body. GSystem requires `TipoPendencia` (the Key of
    // a tipo cadastrado em /cadastros). Resolution order:
    //  1. ticket.pendencia_key (set explicitly when ticket was created)
    //  2. category_routing_rules.category_key matching the ticket category
    //  3. fallback to "186" (Assuntos Diversos)
    let tipoPendencia: string = ticket.pendencia_key || "";
    if (!tipoPendencia && ticket.category) {
      const { data: rules } = await supabase
        .from("category_routing_rules")
        .select("category_key")
        .eq("is_active", true)
        .or(`category_key.eq.${ticket.category},category_label.eq.${ticket.category}`)
        .limit(1);
      const ruleKey = rules?.[0]?.category_key;
      if (ruleKey && /^\d+$/.test(String(ruleKey))) {
        tipoPendencia = String(ruleKey);
      }
    }
    if (!tipoPendencia) tipoPendencia = "186";
    // Try to resolve gsystem veiculo key via plate
    let gsystemVeiculoKey: string | null = null;
    if (ticket.plate) {
      const { data: vlink } = await supabase
        .from("entity_links")
        .select("external_id")
        .eq("entity_type", "veiculo")
        .eq("local_id", String(ticket.plate).toUpperCase())
        .maybeSingle();
      if (vlink?.external_id) gsystemVeiculoKey = vlink.external_id;
    }

    // Resolve Colaborador (required by GSystem)
    // Priority: 1) per-user mapping (user_gsystem_links of assignee/author),
    //           2) env secret GSYSTEM_DEFAULT_COLABORADOR_KEY,
    //           3) auto-discover via /colaboradores
    let colaboradorKey: string | null = null;

    // 1) Try mapping from the assignee (or any author of comments)
    try {
      const candidateUserIds: string[] = [];
      if (ticket.assigned_to) candidateUserIds.push(ticket.assigned_to);
      if (ticket.opened_by && !candidateUserIds.includes(ticket.opened_by)) candidateUserIds.push(ticket.opened_by);
      if (userId && !candidateUserIds.includes(userId)) candidateUserIds.push(userId);
      for (const c of comments || []) {
        if (c.user_id && !candidateUserIds.includes(c.user_id)) {
          candidateUserIds.push(c.user_id);
        }
      }
      if (candidateUserIds.length > 0) {
        const { data: links } = await supabase
          .from("user_gsystem_links")
          .select("user_id, gsystem_user_id, gsystem_user_name")
          .in("user_id", candidateUserIds);
        if (links && links.length > 0) {
          // GSystem Colaborador must be a numeric Key. Older rows accidentally
          // stored the Supabase UUID in gsystem_user_id (same as user_id),
          // which the GSystem API rejects with 500 "Erro desconhecido".
          // Filter to numeric values only.
          const validLink = links.find(
            (l: any) => l.gsystem_user_id && /^\d+$/.test(String(l.gsystem_user_id))
          );
          if (validLink?.gsystem_user_id) {
            colaboradorKey = String(validLink.gsystem_user_id);
          } else {
            const namedLink = links.find((l: any) => String(l.gsystem_user_name || "").trim());
            if (namedLink?.gsystem_user_name) {
              const { findGSystemColaboradorKeyByName } = await import("@/lib/gsystem-api.server");
              colaboradorKey = await findGSystemColaboradorKeyByName(String(namedLink.gsystem_user_name));
            }
          }
        }
      }
    } catch (e) {
      console.warn("[ticket-finalize] user_gsystem_links lookup failed:", e);
    }

    // 2) Env override
    if (!colaboradorKey && process.env.GSYSTEM_DEFAULT_COLABORADOR_KEY) {
      colaboradorKey = String(process.env.GSYSTEM_DEFAULT_COLABORADOR_KEY);
    }

    // 3) Auto-discover (best-effort)
    if (!colaboradorKey) {
      try {
        const { getDefaultColaboradorKey } = await import("@/lib/gsystem-api.server");
        colaboradorKey = await getDefaultColaboradorKey();
      } catch (e) {
        console.warn("[ticket-finalize] Could not auto-resolve Colaborador:", e);
      }
    }

    if (!colaboradorKey) {
      return {
        ok: false,
        error:
          "Colaborador padrão do GSystem não configurado. Vincule este usuário a um colaborador do GSystem em Configurações → Usuários, ou configure o segredo GSYSTEM_DEFAULT_COLABORADOR_KEY.",
      };
    }

    // Fallback: if no link exists yet, try to auto-resolve (or create) the
    // GSystem cliente from the local company data and persist the mapping
    // so future finalizations don't repeat the work.
    if (!gsystemClienteKey && (ticket.companies || ticket.contact_name || ticket.contact_phone)) {
      try {
        const { findOrCreateGSystemClientByCompany } = await import("@/lib/gsystem-api.server");
        const resolved = await findOrCreateGSystemClientByCompany({
          name: (ticket.companies as any)?.name || ticket.contact_name || "Contato",
          cnpj: (ticket.companies as any)?.cnpj || null,
          phone: (ticket.companies as any)?.phone || ticket.contact_phone || null,
        });
        if (resolved) {
          gsystemClienteKey = resolved;
          if (ticket.company_id) try {
            await supabase.from("entity_links").insert({
              entity_type: "cliente",
              local_id: String(ticket.company_id),
              external_id: String(resolved),
            } as any);
            console.log("[ticket-finalize] auto-linked company to GSystem cliente:", {
              companyId: ticket.company_id,
              clienteKey: resolved,
            });
          } catch (linkErr) {
            console.warn("[ticket-finalize] could not persist entity_link:", linkErr);
          }
        }
      } catch (e) {
        console.warn("[ticket-finalize] auto-resolve GSystem cliente failed:", e);
      }
    }

    if (!gsystemClienteKey) {
      return {
        ok: false,
        error:
          "Cliente do GSystem não vinculado a esta empresa. Abra a empresa em Empresas e vincule ao cliente correspondente do GSystem antes de finalizar o atendimento.",
      };
    }

    const body: Record<string, unknown> = {
      Descricao: descricao,
      DataAbertura: new Date().toISOString().split("T")[0],
      TipoPendencia: tipoPendencia,
      Situacao: "A",
      Colaborador: colaboradorKey,
      colaborador: colaboradorKey,
      Cliente: gsystemClienteKey,
      cliente: gsystemClienteKey,
      Veiculos: [],
    };
    if (gsystemVeiculoKey) {
      body.Veiculos = [gsystemVeiculoKey];
      body.veiculos = [gsystemVeiculoKey];
    }

    console.log("[ticket-finalize] Resolved Colaborador:", colaboradorKey);

    try {
      console.log("[ticket-finalize] Creating pendência", {
        ticketId: ticket.id,
        tipoPendencia,
        clienteKey: gsystemClienteKey,
        colaboradorKey,
        veiculosCount: gsystemVeiculoKey ? 1 : 0,
        descricaoLen: descricao.length,
      });
      const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
      const result = await gsystemApiFetch("/pendencias", "POST", body);
      const pendenciaKey =
        (result as any)?.Key || (result as any)?.key || (result as any)?.id || null;

      // Persist mapping in entity_links for future reference
      if (pendenciaKey) {
        try {
          const linkPayload: Record<string, unknown> = {
            entity_type: "pendencia",
            local_id: String(ticket.id),
            external_id: String(pendenciaKey),
          };
          if (mappingChannelId) linkPayload.channel_id = mappingChannelId;
          await supabase.from("entity_links").insert(linkPayload as any);
        } catch {
          // ignore duplicate
        }
      }

      return { ok: true, pendenciaKey };
    } catch (err: any) {
      console.error("[ticket-finalize] Error creating pendência", {
        ticketId: ticket.id,
        tipoPendencia,
        hasCliente: Boolean(gsystemClienteKey),
        veiculosCount: Array.isArray(body.Veiculos) ? body.Veiculos.length : 0,
        error: err?.message || String(err),
      });
      return { ok: false, error: err?.message || "Falha ao criar pendência no GSystem" };
    }
  });
