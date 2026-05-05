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
const contractItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  quantity: z.number().min(0).default(1),
  activationValue: z.number().min(0).default(0),
  monthlyValue: z.number().min(0).default(0),
});

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
  contact_name: z.string().max(200).nullable().optional(),
  company_name: z.string().max(200).nullable().optional(),
  contact_phone: z.string().max(40).nullable().optional(),
  contact_email: z.string().max(200).nullable().optional(),
  cnpj: z.string().max(40).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  referral_id: z.string().uuid().nullable().optional(),
  contract_items: z.array(contractItemSchema).default([]),
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

// Daily job lives in src/lib/crm-daily.server.ts (server-only).

