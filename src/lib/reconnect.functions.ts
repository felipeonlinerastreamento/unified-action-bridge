import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildNotificationMessage } from "@/lib/reconnect";
import { destinatariosPorNotificacao } from "@/lib/contato-notificacoes";

async function assertReconnect(supabase: any) {
  const { data, error } = await supabase.rpc("reconnect_allowed");
  if (error || data !== true) throw new Error("Você não tem acesso ao Reconnect.");
}

/**
 * Envia a notificação de placas sem comunicação para um cliente do Reconnect,
 * pelo canal de WhatsApp da Central e pela caixa de e-mail já cadastrada no Gestão Online.
 * Depois do WhatsApp, manda a mensagem de encerramento (se houver modelo marcado).
 * Registra em rc_notification_logs e soma +1 notificação nas placas da sessão.
 */
export const enviarNotificacaoReconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientId: z.string().min(1).max(64),
      plates: z.array(z.string().trim().min(1).max(60)).min(1).max(500),
      templateId: z.string().uuid(),
      channels: z.array(z.enum(["whatsapp", "email"])).min(1).max(2),
      batchId: z.string().max(64).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertReconnect(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: client }, { data: tpl }, { data: closing }, { data: settings }, { data: prof }] = await Promise.all([
      supabase.from("rc_clients").select("id, name, emails, phones, company_id").eq("id", data.clientId).maybeSingle(),
      supabase.from("rc_message_templates").select("name, subject, body").eq("id", data.templateId).maybeSingle(),
      supabase.from("rc_message_templates").select("body").eq("is_closing_template", true).maybeSingle(),
      supabase.from("rc_settings").select("whatsapp_channel_id, email_channel_id").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle(),
    ]);
    if (!client) throw new Error("Cliente não encontrado no Reconnect.");
    if (!tpl) throw new Error("Modelo de mensagem não encontrado.");
    // Destinatários: só os contatos da empresa ligada marcados "Veículo sem comunicação" (Empresas › Contatos).
    let daEmpresa = { phones: [] as string[], emails: [] as string[] };
    if (client.company_id) {
      const { data: comp } = await supabaseAdmin.from("companies").select("contacts").eq("id", client.company_id).maybeSingle();
      daEmpresa = destinatariosPorNotificacao((comp as any)?.contacts, "sem_comunicacao");
    }
    const semEmpresa = !client.company_id;
    const phones: string[] = daEmpresa.phones;
    const emails: string[] = daEmpresa.emails;
    // A planilha pode trazer a placa dentro do texto ("I/BYD-DOLPHIN-MINI-TCL5A74", "SSO-3F57-(53)"):
    // a mensagem lista só a placa, sem repetir.
    const { extrairPlaca } = await import("./reconnect");
    const placasMsg = [...new Set(data.plates.map((p) => extrairPlaca(p) || p))];
    const message = buildNotificationMessage(tpl.body, client.name, placasMsg);
    const result: { whatsapp?: { ok: boolean; enviados: number; erro?: string }; email?: { ok: boolean; enviados: number; erro?: string } } = {};
    const sentChannels: string[] = [];

    if (data.channels.includes("whatsapp")) {
      try {
        if (!phones.length) throw new Error(semEmpresa ? "Cliente sem empresa ligada no cadastro de Empresas." : "Nenhum contato da empresa marcado \"Veículo sem comunicação\" com telefone.");
        let channelId = settings?.whatsapp_channel_id as string | null;
        if (!channelId) {
          const { data: ch } = await supabaseAdmin.from("channels").select("id").eq("is_active", true).not("zapi_instance_id", "is", null).order("created_at").limit(1).maybeSingle();
          channelId = (ch as any)?.id ?? null;
        }
        if (!channelId) throw new Error("Nenhum canal de WhatsApp ativo. Escolha um em Reconnect › Configurações.");
        const { loadZapiChannel, zapiSendText } = await import("./zapi.server");
        const channel = await loadZapiChannel(supabaseAdmin, channelId);
        let enviados = 0;
        const erros: string[] = [];
        for (const phone of phones) {
          try {
            await zapiSendText(channel, phone, message);
            if (closing?.body) await zapiSendText(channel, phone, String(closing.body).replace(/\{cliente\}/gi, client.name));
            enviados++;
          } catch (e: any) {
            erros.push(`${phone}: ${e?.message ?? e}`);
          }
        }
        result.whatsapp = { ok: enviados > 0, enviados, erro: erros.join("; ") || undefined };
        if (enviados > 0) sentChannels.push("whatsapp");
      } catch (e: any) {
        result.whatsapp = { ok: false, enviados: 0, erro: e?.message ?? "Falha no WhatsApp" };
      }
    }

    if (data.channels.includes("email")) {
      try {
        if (!emails.length) throw new Error(semEmpresa ? "Cliente sem empresa ligada no cadastro de Empresas." : "Nenhum contato da empresa marcado \"Veículo sem comunicação\" com e-mail.");
        const q = supabaseAdmin.from("email_channels").select("email_address, connection_key");
        const { data: ch } = settings?.email_channel_id
          ? await q.eq("id", settings.email_channel_id).maybeSingle()
          : await q.eq("is_active", true).order("created_at").limit(1).maybeSingle();
        if (!ch) throw new Error("Nenhuma caixa de e-mail ativa no Gestão Online.");
        const { getOutlookProfile, sendNewMail, DEFAULT_CONNECTION_KEY } = await import("./outlook.server");
        const { escapeHtml, loadSignature } = await import("./crm-proposal.functions");
        const connectionKey = (ch as any).connection_key || DEFAULT_CONNECTION_KEY;
        const me = await getOutlookProfile(connectionKey);
        const ctx = { connectionKey, mailbox: (ch as any).email_address, connectedEmail: me.mail || me.userPrincipalName || null };
        const sig = await loadSignature(supabaseAdmin as any, userId);
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937">${escapeHtml(message).replace(/\n/g, "<br/>")}${sig.html}</div>`;
        await sendNewMail(ctx, {
          to: emails,
          subject: (tpl.subject || "Veículos sem comunicação").replace(/\{cliente\}/gi, client.name),
          html,
          images: sig.images,
        });
        result.email = { ok: true, enviados: emails.length };
        sentChannels.push("email");
      } catch (e: any) {
        result.email = { ok: false, enviados: 0, erro: e?.message ?? "Falha no e-mail" };
      }
    }

    const erro = [result.whatsapp?.erro, result.email?.erro].filter(Boolean).join(" | ");
    const sentBy = prof?.name || "Usuário";
    await supabase.from("rc_notification_logs").insert({
      client_id: client.id, client_name: client.name, sent_by: sentBy, plates: data.plates, channels: sentChannels,
      template_name: tpl.name, status: sentChannels.length ? (erro ? "partial" : "success") : "error", error_message: erro, batch_id: data.batchId ?? "",
    });
    if (sentChannels.length) {
      const { data: veics } = await supabase.from("rc_vehicles").select("id, notifications").eq("client_id", client.id).in("plate", data.plates);
      for (const v of veics || []) await supabase.from("rc_vehicles").update({ notifications: Number(v.notifications || 0) + 1 }).eq("id", v.id);
      await supabase.from("rc_activity_logs").insert({ user_id: userId, action: "notification", details: { client: client.name, plates: data.plates, channels: sentChannels } });
    }
    return { ...result, channels: sentChannels };
  });

/** Canais disponíveis para as notificações (WhatsApp da Central e caixas de e-mail). */
export const canaisReconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertReconnect(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: wa }, { data: em }] = await Promise.all([
      supabaseAdmin.from("channels").select("id, name, is_active, zapi_instance_id").eq("is_active", true).not("zapi_instance_id", "is", null).order("created_at"),
      supabaseAdmin.from("email_channels").select("id, email_address, is_active").eq("is_active", true).order("created_at"),
    ]);
    return {
      whatsapp: (wa || []).map((c: any) => ({ id: c.id as string, nome: (c.name as string) || "WhatsApp" })),
      email: (em || []).map((c: any) => ({ id: c.id as string, nome: c.email_address as string })),
    };
  });

/** Atualiza na carteira do Pós-venda as placas sem comunicação de cada cliente (chamado depois de cada importação). */
export const atualizarRiscoReconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertReconnect((context as any).supabase);
    const { sincronizarRiscoReconnect } = await import("./reconnect-risco.server");
    return sincronizarRiscoReconnect();
  });

/**
 * Painel de resultado do Reconnect. A receita (média mensal das faturas, vinda da carteira do Pós-venda)
 * só volta para quem já pode ver esse número: admin, acesso ao Financeiro ou aba Pós-venda do CRM.
 */
export const resultadoReconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertReconnect(supabase);
    const [fin, pos, adm] = await Promise.all([
      supabase.rpc("can_access_finance"),
      supabase.rpc("crm_tab_allowed", { _tab: "posvenda" }),
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    ]);
    const comReceita = fin.data === true || pos.data === true || !!adm.data;
    const { dadosResultadoReconnect } = await import("./reconnect-risco.server");
    const { metricasReconnect } = await import("./reconnect");
    const base = await dadosResultadoReconnect(data.de, data.ate, comReceita);
    const m = metricasReconnect({ ...base, de: data.de, ate: data.ate });
    return { ...m, comReceita, vinculados: base.vinculados };
  });

/** Empresas ligadas aos clientes do Reconnect: nome e contatos marcados "Veículo sem comunicação". */
export const contatosEmpresasReconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(5000) }).parse)
  .handler(async ({ data, context }) => {
    await assertReconnect((context as any).supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, { nome: string; phones: string[]; emails: string[]; nomes: string[] }> = {};
    for (let i = 0; i < data.ids.length; i += 200) {
      const { data: rows } = await supabaseAdmin.from("companies").select("id, name, contacts").in("id", data.ids.slice(i, i + 200));
      for (const e of (rows || []) as any[]) {
        const d = destinatariosPorNotificacao(e.contacts, "sem_comunicacao");
        out[e.id] = { nome: e.name, phones: d.phones, emails: d.emails, nomes: d.nomes };
      }
    }
    return out;
  });

/**
 * Unifica os clientes do Reconnect com o cadastro de Empresas (quem tem acesso ao Reconnect):
 * liga cada cliente à empresa (já ligado, nome igual, nome aproximado único ou escolha manual) e leva
 * os telefones/e-mails do cliente para os contatos da empresa marcados "Veículo sem comunicação"
 * (só marca quando o número/e-mail já existe; senão cadastra). Sem `aplicar`, só devolve a prévia.
 */
export const unificarContatosReconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ aplicar: z.boolean(), manuais: z.record(z.string().min(1).max(64), z.string().uuid()).optional() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    // Liberado para quem tem acesso ao Reconnect (admin/gestor ou setor com o menu reconnect).
    await assertReconnect(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lerTodas = async (tabela: string, cols: string) => {
      const out: any[] = [];
      for (let de = 0; ; de += 1000) {
        const { data: rows, error } = await supabaseAdmin.from(tabela as any).select(cols).order("id").range(de, de + 999);
        if (error) throw new Error(`${tabela}: ${error.message}`);
        out.push(...(rows || []));
        if (!rows || rows.length < 1000) break;
      }
      return out;
    };
    const [clientes, empresas] = await Promise.all([
      lerTodas("rc_clients", "id, name, company_id, phones, emails, vehicle_count"),
      lerTodas("companies", "id, name, contacts"),
    ]);
    const { planejarUnificacao } = await import("./reconnect-contatos");
    const plano = planejarUnificacao(clientes, empresas, data.manuais ?? {});
    if (!data.aplicar) return { aplicado: false, ...plano, empresas: plano.empresas.map(({ contacts: _c, ...e }) => e) };

    const porCliente = new Map(clientes.map((c: any) => [c.id, c]));
    for (const v of plano.vinculos) {
      if (porCliente.get(v.clientId)?.company_id === v.companyId) continue;
      const { error } = await supabaseAdmin.from("rc_clients" as any).update({ company_id: v.companyId }).eq("id", v.clientId);
      if (error) throw new Error(`Ligar cliente: ${error.message}`);
    }
    for (const e of plano.empresas) {
      const { error } = await supabaseAdmin.from("companies").update({ contacts: e.contacts as any }).eq("id", e.companyId);
      if (error) throw new Error(`Contatos de ${e.companyName}: ${error.message}`);
      // Telefones novos também entram em company_phones (identifica a empresa nas conversas da Central);
      // número que já pertence a outra empresa fica onde está (a coluna é única).
      const novos = e.cadastrados.filter((x) => !x.includes("@"));
      if (novos.length) await supabaseAdmin.from("company_phones").upsert(novos.map((phone_number) => ({ company_id: e.companyId, phone_number, contact_name: "Contato Reconnect" })) as any, { onConflict: "phone_number", ignoreDuplicates: true });
    }
    await supabase.from("rc_activity_logs").insert({
      user_id: userId, action: "unificacao_empresas",
      details: { totais: plano.totais, naoIdentificados: plano.naoIdentificados.map((n) => n.name), manuais: Object.keys(data.manuais ?? {}).length },
    });
    return { aplicado: true, ...plano, empresas: plano.empresas.map(({ contacts: _c, ...e }) => e) };
  });
