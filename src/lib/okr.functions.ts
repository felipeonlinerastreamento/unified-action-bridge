import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===================== CYCLES =====================

export const listOkrCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("okr_cycles")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

const cycleInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  is_active: z.boolean().default(true),
});

export const upsertOkrCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => cycleInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { data: row, error } = await context.supabase
        .from("okr_cycles").update(rest).eq("id", id as string).select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("okr_cycles").insert(payload).select().single();
    if (error) throw error;
    return row;
  });

export const deleteOkrCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("okr_cycles").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ===================== OBJECTIVES =====================

export const listObjectives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cycle_id: z.string().uuid().optional() }).optional().parse(data))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("okr_objectives")
      .select("*, okr_key_results(*)")
      .order("created_at", { ascending: false });
    if (data?.cycle_id) q = q.eq("cycle_id", data.cycle_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const objectiveInput = z.object({
  id: z.string().uuid().optional(),
  cycle_id: z.string().uuid(),
  level: z.enum(["empresa", "setor", "individual"]),
  sector_id: z.string().uuid().nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  parent_objective_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.enum(["ativo", "concluido", "cancelado"]).default("ativo"),
});

export const upsertObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => objectiveInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { data: row, error } = await context.supabase
        .from("okr_objectives").update(rest).eq("id", id as string).select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("okr_objectives").insert(payload).select().single();
    if (error) throw error;
    return row;
  });

export const deleteObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("okr_objectives").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ===================== KEY RESULTS =====================

const krInput = z.object({
  id: z.string().uuid().optional(),
  objective_id: z.string().uuid(),
  title: z.string().min(1),
  kr_type: z.enum(["manual", "automatico"]).default("manual"),
  metric_key: z.string().nullable().optional(),
  metric_filter: z.record(z.string(), z.any()).default({}),
  unit: z.string().default(""),
  direction: z.enum(["increase", "decrease"]).default("increase"),
  initial_value: z.number().default(0),
  target_value: z.number(),
  current_value: z.number().default(0),
  responsible_user_id: z.string().uuid().nullable().optional(),
  display_order: z.number().int().default(0),
});

export const upsertKeyResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => krInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { data: row, error } = await context.supabase
        .from("okr_key_results").update(rest).eq("id", id as string).select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("okr_key_results").insert(data).select().single();
    if (error) throw error;
    return row;
  });

export const deleteKeyResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("okr_key_results").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ===================== CHECK-INS =====================

const checkinInput = z.object({
  key_result_id: z.string().uuid(),
  new_value: z.number(),
  confidence: z.enum(["verde", "amarelo", "vermelho"]),
  comment: z.string().default(""),
});

export const createCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => checkinInput.parse(data))
  .handler(async ({ data, context }) => {
    // load current
    const { data: kr, error: krErr } = await context.supabase
      .from("okr_key_results").select("current_value").eq("id", data.key_result_id).single();
    if (krErr) throw krErr;

    const { error: insErr } = await context.supabase.from("okr_checkins").insert({
      key_result_id: data.key_result_id,
      previous_value: kr.current_value,
      new_value: data.new_value,
      confidence: data.confidence,
      comment: data.comment,
      source: "manual",
      created_by: context.userId,
    });
    if (insErr) throw insErr;

    const { error: updErr } = await context.supabase
      .from("okr_key_results")
      .update({ current_value: data.new_value, confidence: data.confidence })
      .eq("id", data.key_result_id);
    if (updErr) throw updErr;

    return { ok: true };
  });

export const listCheckins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ key_result_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("okr_checkins")
      .select("*")
      .eq("key_result_id", data.key_result_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });
