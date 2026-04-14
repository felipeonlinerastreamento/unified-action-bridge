import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const selectedCompanySchema = z.object({
  companyName: z.string().min(1).max(255),
  companyCnpj: z.string().max(32).optional(),
});

const linkPhoneToCompanySchema = selectedCompanySchema.extend({
  phone: z.string().max(32).optional(),
  ticketId: z.string().uuid().optional(),
});

const createSubClientSchema = selectedCompanySchema.extend({
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(32),
  email: z.string().email().max(255).optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
  ticketId: z.string().uuid().optional(),
});

const createCrmContactSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  companyCnpj: z.string().max(32).optional(),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(32),
  email: z.string().email().max(255).optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
  ticketId: z.string().uuid().optional(),
});

function cleanDigits(value?: string | null) {
  return value?.replace(/\D/g, "") || "";
}

async function ensureLocalCompany(companyName: string, companyCnpj?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const normalizedName = companyName.trim();
  const normalizedCnpj = cleanDigits(companyCnpj) || null;

  if (normalizedCnpj) {
    const { data: byCnpj, error } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("cnpj", normalizedCnpj)
      .limit(1);

    if (error) throw new Error(error.message);
    if (byCnpj && byCnpj.length > 0) return byCnpj[0].id;
  }

  const { data: byName, error: byNameError } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("name", normalizedName)
    .limit(1);

  if (byNameError) throw new Error(byNameError.message);
  if (byName && byName.length > 0) return byName[0].id;

  const { data: created, error: createError } = await supabaseAdmin
    .from("companies")
    .insert({
      name: normalizedName,
      cnpj: normalizedCnpj,
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || "Não foi possível sincronizar a empresa.");
  }

  return created.id;
}

async function updateTicketCompany(ticketId: string | undefined, companyId: string) {
  if (!ticketId) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("service_tickets")
    .update({ company_id: companyId })
    .eq("id", ticketId);

  if (error) throw new Error(error.message);
}

export const linkPhoneToCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(linkPhoneToCompanySchema.parse)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const companyId = await ensureLocalCompany(data.companyName, data.companyCnpj);
    const cleanPhone = cleanDigits(data.phone);

    if (cleanPhone) {
      const { data: existingLinks, error: existingError } = await supabaseAdmin
        .from("company_phones")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone_number", cleanPhone)
        .limit(1);

      if (existingError) throw new Error(existingError.message);

      if (!existingLinks || existingLinks.length === 0) {
        const { error: insertError } = await supabaseAdmin.from("company_phones").insert({
          company_id: companyId,
          phone_number: cleanPhone,
        });

        if (insertError) throw new Error(insertError.message);
      }
    }

    await updateTicketCompany(data.ticketId, companyId);

    return { success: true, companyId };
  });

export const createSubClientWithParentCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createSubClientSchema.parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const companyId = await ensureLocalCompany(data.companyName, data.companyCnpj);
    const cleanPhone = cleanDigits(data.phone);

    const { data: existingSubClients, error: existingError } = await supabaseAdmin
      .from("sub_clients")
      .select("id")
      .eq("company_id", companyId)
      .eq("phone", cleanPhone)
      .limit(1);

    if (existingError) throw new Error(existingError.message);

    let subClientId = existingSubClients?.[0]?.id;

    if (!subClientId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("sub_clients")
        .insert({
          company_id: companyId,
          name: data.name.trim(),
          phone: cleanPhone,
          email: data.email || null,
          notes: data.notes || "",
          created_by: context.userId ?? null,
        })
        .select("id")
        .single();

      if (createError || !created) {
        throw new Error(createError?.message || "Não foi possível criar o sub-cliente.");
      }

      subClientId = created.id;
    }

    await updateTicketCompany(data.ticketId, companyId);

    return { success: true, companyId, subClientId };
  });

export const createCrmContactWithCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createCrmContactSchema.parse)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const companyId = data.companyName
      ? await ensureLocalCompany(data.companyName, data.companyCnpj)
      : null;

    const { data: created, error } = await supabaseAdmin
      .from("crm_contacts")
      .insert({
        company_id: companyId,
        name: data.name.trim(),
        phone: cleanDigits(data.phone),
        email: data.email || null,
        notes: data.notes || "",
        created_by: context.userId ?? null,
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new Error(error?.message || "Não foi possível criar o contato.");
    }

    if (companyId) {
      await updateTicketCompany(data.ticketId, companyId);
    }

    return { success: true, companyId, crmContactId: created.id };
  });
