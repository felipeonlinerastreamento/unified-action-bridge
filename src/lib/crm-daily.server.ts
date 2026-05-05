import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

  const { data: queue } = await supabaseAdmin
    .from("crm_postsale_queue")
    .select("*, crm_postsale_steps(title, description, action_type, move_to_category_id, move_to_stage_id), crm_postsale_rules(final_category_id, final_stage_id)")
    .eq("status", "pending")
    .lte("scheduled_for", today.toISOString())
    .limit(200);
  for (const q of queue || []) {
    const step = (q as any).crm_postsale_steps;
    const rule = (q as any).crm_postsale_rules;
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

    // Apply per-step reclassification
    if (step?.move_to_category_id && q.contact_id) {
      await supabaseAdmin.from("crm_contacts").update({ category_id: step.move_to_category_id }).eq("id", q.contact_id);
    }
    if (step?.move_to_stage_id && (q as any).opportunity_id) {
      await supabaseAdmin.from("crm_opportunities").update({ stage_id: step.move_to_stage_id }).eq("id", (q as any).opportunity_id);
    }

    await supabaseAdmin
      .from("crm_postsale_queue")
      .update({ status: "done", executed_at: today.toISOString(), task_id: t?.id })
      .eq("id", q.id);
    summary.postsale++;

    // If this was the last pending step of the queue for this rule+target, apply final moves
    const targetFilter: any = (q as any).opportunity_id
      ? { opportunity_id: (q as any).opportunity_id }
      : { contact_id: q.contact_id };
    const { data: pendingLeft } = await supabaseAdmin
      .from("crm_postsale_queue")
      .select("id")
      .eq("rule_id", q.rule_id)
      .eq("status", "pending")
      .match(targetFilter)
      .limit(1);
    if ((!pendingLeft || pendingLeft.length === 0) && rule) {
      if (rule.final_category_id && q.contact_id) {
        await supabaseAdmin.from("crm_contacts").update({ category_id: rule.final_category_id }).eq("id", q.contact_id);
      }
      if (rule.final_stage_id && (q as any).opportunity_id) {
        await supabaseAdmin.from("crm_opportunities").update({ stage_id: rule.final_stage_id }).eq("id", (q as any).opportunity_id);
      }
    }
  }

  return summary;
}
