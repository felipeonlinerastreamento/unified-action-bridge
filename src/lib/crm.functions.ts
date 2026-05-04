import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============== TASKS ==============
const taskInput = z.object({
  id: z.string().uuid().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  task_type: z.string().max(40).default("followup"),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  due_date: z.string().nullable().optional(),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  assigned_to: z.string().uuid().nullable().optional(),
});

export const upsertCrmTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(taskInput.parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      contact_id: data.contact_id ?? null,
      company_id: data.company_id ?? null,
      task_type: data.task_type,
      title: data.title,
      description: data.description,
      due_date: data.due_date ?? null,
      priority: data.priority,
      assigned_to: data.assigned_to ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("crm_tasks").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("crm_tasks")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const completeCrmTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), note: z.string().max(2000).default("") }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_tasks")
      .update({ status: "done", completed_at: new Date().toISOString(), completion_note: data.note })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== OPPORTUNITIES ==============
const oppInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  contact_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
  expected_value: z.number().min(0).default(0),
  probability: z.number().min(0).max(100).default(0),
  expected_close_date: z.string().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  source: z.string().max(40).default("manual"),
  opportunity_type: z.enum(["new", "upsell", "renewal", "recovery"]).default("new"),
  notes: z.string().max(4000).default(""),
});

export const upsertOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(oppInput.parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    delete payload.id;
    if (data.id) {
      const { error } = await supabase.from("crm_opportunities").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("crm_opportunities")
      .insert({ ...payload, created_by: userId, owner_id: data.owner_id ?? userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const moveOpportunityStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      stage_id: z.string().uuid(),
      loss_reason: z.string().max(500).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: stage } = await supabase
      .from("crm_pipeline_stages")
      .select("is_won, is_lost, default_probability")
      .eq("id", data.stage_id)
      .single();
    const update: any = { stage_id: data.stage_id };
    if (stage?.is_won) {
      update.status = "won";
      update.probability = 100;
      update.closed_at = new Date().toISOString();
    } else if (stage?.is_lost) {
      update.status = "lost";
      update.probability = 0;
      update.closed_at = new Date().toISOString();
      update.loss_reason = data.loss_reason ?? null;
    } else {
      update.status = "open";
      update.probability = stage?.default_probability ?? 0;
      update.closed_at = null;
    }
    const { error } = await supabase.from("crm_opportunities").update(update).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== RECURRING ==============
const recurringInput = z.object({
  id: z.string().uuid().optional(),
  contact_id: z.string().uuid(),
  cadence: z.enum(["weekly", "biweekly", "monthly", "quarterly", "semiannual", "yearly"]),
  next_run_at: z.string(),
  channel: z.string().max(20).default("whatsapp"),
  template_id: z.string().uuid().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).default(""),
  is_active: z.boolean().default(true),
});

export const upsertRecurringContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(recurringInput.parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    delete payload.id;
    if (data.id) {
      const { error } = await supabase.from("crm_recurring_contacts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("crm_recurring_contacts")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

// ============== POSTSALE RULES ==============
const ruleInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  trigger_sector: z.string().max(120).nullable().optional(),
  trigger_category: z.string().max(120).nullable().optional(),
  is_active: z.boolean().default(true),
  steps: z
    .array(
      z.object({
        delay_days: z.number().int().min(0).max(365),
        action_type: z.enum(["task", "whatsapp", "email", "nps"]).default("task"),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).default(""),
        template_id: z.string().uuid().nullable().optional(),
      })
    )
    .default([]),
});

export const upsertPostsaleRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ruleInput.parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let id = data.id;
    if (id) {
      const { error } = await supabase
        .from("crm_postsale_rules")
        .update({
          name: data.name,
          trigger_sector: data.trigger_sector ?? null,
          trigger_category: data.trigger_category ?? null,
          is_active: data.is_active,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await supabase.from("crm_postsale_steps").delete().eq("rule_id", id);
    } else {
      const { data: row, error } = await supabase
        .from("crm_postsale_rules")
        .insert({
          name: data.name,
          trigger_sector: data.trigger_sector ?? null,
          trigger_category: data.trigger_category ?? null,
          is_active: data.is_active,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row!.id;
    }
    if (data.steps.length > 0) {
      const { error: stepsErr } = await supabase.from("crm_postsale_steps").insert(
        data.steps.map((s, i) => ({
          rule_id: id,
          position: i,
          delay_days: s.delay_days,
          action_type: s.action_type,
          title: s.title,
          description: s.description,
          template_id: s.template_id ?? null,
        }))
      );
      if (stepsErr) throw new Error(stepsErr.message);
    }
    return { id };
  });

// ============== TEMPLATES ==============
const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  event_type: z.string().max(40).default("manual"),
  channel: z.string().max(20).default("whatsapp"),
  subject: z.string().max(255).nullable().optional(),
  body: z.string().min(1).max(4000),
  is_active: z.boolean().default(true),
});

export const upsertMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(templateInput.parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload: any = { ...data };
    delete payload.id;
    if (data.id) {
      const { error } = await supabase.from("crm_message_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("crm_message_templates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

// ============== DAILY JOB (called via cron route) ==============
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function runCrmDailyJob() {
  const today = new Date();
  const todayStr = isoDate(today);
  const week = isoDate(addDays(today, 7));

  let summary: any = { birthdays: 0, renewals: 0, recurring: 0, postsale: 0 };

  // 1. Aniversários: contatos
  const { data: contacts } = await supabaseAdmin
    .from("crm_contacts")
    .select("id, name, birth_date, contact_role, company_id")
    .not("birth_date", "is", null);
  for (const c of contacts || []) {
    if (!c.birth_date) continue;
    const bd = c.birth_date.slice(5);
    if (bd === todayStr.slice(5) || bd === week.slice(5)) {
      const isToday = bd === todayStr.slice(5);
      const title = isToday
        ? `🎂 Hoje é aniversário de ${c.name}`
        : `🎂 Aniversário em 7 dias: ${c.name}`;
      const { data: exists } = await supabaseAdmin
        .from("crm_tasks")
        .select("id")
        .eq("contact_id", c.id)
        .eq("task_type", "birthday")
        .gte("due_date", todayStr)
        .limit(1);
      if (!exists || exists.length === 0) {
        await supabaseAdmin.from("crm_tasks").insert({
          contact_id: c.id,
          company_id: c.company_id,
          task_type: "birthday",
          title,
          description: `Enviar mensagem de aniversário para ${c.name}.`,
          due_date: isToday ? today.toISOString() : addDays(today, 7).toISOString(),
          priority: isToday ? "alta" : "media",
        });
        summary.birthdays++;
      }
    }
  }

  // 2. Aniversários: funcionários
  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("user_id, name, birth_date")
    .not("birth_date", "is", null);
  for (const p of profs || []) {
    if (!p.birth_date) continue;
    const bd = p.birth_date.slice(5);
    if (bd === todayStr.slice(5)) {
      const { data: exists } = await supabaseAdmin
        .from("crm_tasks")
        .select("id")
        .eq("task_type", "birthday")
        .like("title", `%${p.name}%`)
        .gte("due_date", todayStr)
        .limit(1);
      if (!exists || exists.length === 0) {
        await supabaseAdmin.from("crm_tasks").insert({
          task_type: "birthday",
          title: `🎂 Hoje é aniversário do colaborador ${p.name}`,
          description: "Parabenizar internamente.",
          due_date: today.toISOString(),
          priority: "alta",
        });
        summary.birthdays++;
      }
    }
  }

  // 3. Renovações de contrato (D-60, D-30, D-15, D-7)
  const checkpoints = [60, 30, 15, 7];
  for (const days of checkpoints) {
    const target = isoDate(addDays(today, days));
    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("id, name, contract_end, contract_value")
      .eq("contract_end", target);
    for (const co of companies || []) {
      const { data: existsOpp } = await supabaseAdmin
        .from("crm_opportunities")
        .select("id")
        .eq("company_id", co.id)
        .eq("opportunity_type", "renewal")
        .eq("status", "open")
        .limit(1);
      if (!existsOpp || existsOpp.length === 0) {
        const { data: stage } = await supabaseAdmin
          .from("crm_pipeline_stages")
          .select("id, default_probability")
          .order("position")
          .limit(1)
          .single();
        await supabaseAdmin.from("crm_opportunities").insert({
          title: `Renovação ${co.name} (D-${days})`,
          company_id: co.id,
          stage_id: stage?.id ?? null,
          expected_value: co.contract_value ?? 0,
          probability: stage?.default_probability ?? 25,
          expected_close_date: co.contract_end,
          opportunity_type: "renewal",
          source: "renewal",
          notes: `Contrato vence em ${co.contract_end}.`,
        });
      }
      await supabaseAdmin.from("crm_tasks").insert({
        company_id: co.id,
        task_type: "renewal",
        title: `📄 Renovação ${co.name} em ${days} dias`,
        description: `Contrato vence em ${co.contract_end}. Iniciar negociação.`,
        due_date: today.toISOString(),
        priority: days <= 15 ? "alta" : "media",
      });
      summary.renewals++;
    }
  }

  // 4. Recorrências do dia
  const { data: recurring } = await supabaseAdmin
    .from("crm_recurring_contacts")
    .select("*, crm_contacts(name, company_id)")
    .lte("next_run_at", today.toISOString())
    .eq("is_active", true);
  for (const r of recurring || []) {
    await supabaseAdmin.from("crm_tasks").insert({
      contact_id: r.contact_id,
      company_id: (r.crm_contacts as any)?.company_id ?? null,
      task_type: "recurring",
      title: `🔁 Contato recorrente: ${(r.crm_contacts as any)?.name ?? ""}`,
      description: r.notes ?? "",
      due_date: today.toISOString(),
      priority: "media",
      assigned_to: r.owner_id,
    });
    const cadenceDays: Record<string, number> = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
      semiannual: 180,
      yearly: 365,
    };
    const next = addDays(today, cadenceDays[r.cadence] ?? 30);
    await supabaseAdmin
      .from("crm_recurring_contacts")
      .update({ next_run_at: next.toISOString() })
      .eq("id", r.id);
    summary.recurring++;
  }

  // 5. Pós-venda: materializar fila pendente em tarefas
  const { data: queue } = await supabaseAdmin
    .from("crm_postsale_queue")
    .select("*, crm_postsale_steps(title, description, action_type)")
    .eq("status", "pending")
    .lte("scheduled_for", today.toISOString())
    .limit(200);
  for (const q of queue || []) {
    const step = q.crm_postsale_steps as any;
    const { data: t } = await supabaseAdmin
      .from("crm_tasks")
      .insert({
        contact_id: q.contact_id,
        task_type: "postsale",
        title: step?.title ?? "Pós-venda",
        description: step?.description ?? "",
        due_date: today.toISOString(),
        priority: "media",
        source_type: "postsale_queue",
        source_id: q.id,
      })
      .select("id")
      .single();
    await supabaseAdmin
      .from("crm_postsale_queue")
      .update({ status: "done", executed_at: today.toISOString(), task_id: t?.id })
      .eq("id", q.id);
    summary.postsale++;
  }

  return summary;
}
