import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const linkPhoneToCompanySchema = z.object({
  companyName: z.string().min(1).max(255),
  companyCnpj: z.string().max(32).optional(),
  phone: z.string().max(32).optional(),
  ticketId: z.string().uuid().optional(),
});

const createSubClientSchema = z.object({
  companyName: z.string().min(1).max(255),
  companyCnpj: z.string().max(32).optional(),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(32),
  email: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  ticketId: z.string().uuid().optional(),
});

const contractItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  quantity: z.number().min(0).default(1),
  activationValue: z.number().min(0).default(0),
  monthlyValue: z.number().min(0).default(0),
});

const createCrmContactSchema = z.object({
  companyName: z.string().min(1).max(255).optional(),
  companyCnpj: z.string().max(32).optional(),
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(32),
  email: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  ticketId: z.string().uuid().optional(),
  originalPhone: z.string().max(32).optional(),
  contactType: z.enum(["PF", "PJ"]).optional(),
  categoryId: z.string().uuid().optional(),
  contractItems: z.array(contractItemSchema).optional(),
});

function cleanDigits(value?: string | null) {
  return value?.replace(/\D/g, "") || "";
}

async function ensureLocalCompany(
  supabase: any,
  companyName: string,
  companyCnpj?: string
): Promise<string> {
  const normalizedName = companyName.trim();
  const normalizedCnpj = cleanDigits(companyCnpj) || null;

  // Try find by CNPJ
  if (normalizedCnpj) {
    const { data: byCnpj } = await supabase
      .from("companies")
      .select("id")
      .eq("cnpj", normalizedCnpj)
      .limit(1);
    if (byCnpj && byCnpj.length > 0) return byCnpj[0].id;
  }

  // Try find by name
  const { data: byName } = await supabase
    .from("companies")
    .select("id")
    .eq("name", normalizedName)
    .limit(1);
  if (byName && byName.length > 0) return byName[0].id;

  // Create local company
  const { data: created, error: createError } = await supabase
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

async function updateTicketCompany(supabase: any, ticketId: string | undefined, companyId: string) {
  if (!ticketId) return;
  await supabase
    .from("service_tickets")
    .update({ company_id: companyId })
    .eq("id", ticketId);
}

export const linkPhoneToCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(linkPhoneToCompanySchema.parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const companyId = await ensureLocalCompany(supabase, data.companyName, data.companyCnpj);
    const cleanPhone = cleanDigits(data.phone);

    if (cleanPhone) {
      // Check if phone link already exists
      const { data: existingLinks } = await supabase
        .from("company_phones")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone_number", cleanPhone)
        .limit(1);

      if (!existingLinks || existingLinks.length === 0) {
        const { error: insertError } = await supabase.from("company_phones").insert({
          company_id: companyId,
          phone_number: cleanPhone,
        });
        if (insertError) throw new Error(insertError.message);
      }
    }

    await updateTicketCompany(supabase, data.ticketId, companyId);
    return { success: true, companyId };
  });

export const createSubClientWithParentCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createSubClientSchema.parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await ensureLocalCompany(supabase, data.companyName, data.companyCnpj);
    const cleanPhone = cleanDigits(data.phone);

    // Check if sub-client already exists
    const { data: existing } = await supabase
      .from("sub_clients")
      .select("id")
      .eq("company_id", companyId)
      .eq("phone", cleanPhone)
      .limit(1);

    let subClientId = existing?.[0]?.id;

    if (!subClientId) {
      const { data: created, error: createError } = await supabase
        .from("sub_clients")
        .insert({
          company_id: companyId,
          name: data.name.trim(),
          phone: cleanPhone,
          email: data.email || null,
          notes: data.notes || "",
          created_by: userId ?? null,
        })
        .select("id")
        .single();

      if (createError || !created) {
        throw new Error(createError?.message || "Não foi possível criar o sub-cliente.");
      }
      subClientId = created.id;
    }

    await updateTicketCompany(supabase, data.ticketId, companyId);
    return { success: true, companyId, subClientId };
  });

export const createCrmContactWithCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(createCrmContactSchema.parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = data.companyName
      ? await ensureLocalCompany(supabase, data.companyName, data.companyCnpj)
      : null;

    const cleanPhone = cleanDigits(data.phone);
    const cleanOriginal = cleanDigits(data.originalPhone);

    // If user corrected the phone, store both in notes for traceability
    const notesWithOriginal =
      cleanOriginal && cleanOriginal !== cleanPhone
        ? `${data.notes || ""}${data.notes ? "\n" : ""}Telefone original: ${cleanOriginal}`
        : data.notes || "";

    const contactType = data.contactType === "PJ" ? "PJ" : "PF";
    const categoryId = contactType === "PJ" ? (data.categoryId || null) : null;

    const items = (data.contractItems || []).filter((i) => i.categoryId);
    const { data: created, error } = await supabase
      .from("crm_contacts")
      .insert({
        company_id: companyId,
        name: data.name.trim(),
        phone: cleanPhone,
        email: data.email || null,
        notes: notesWithOriginal,
        created_by: userId ?? null,
        contact_type: contactType,
        category_id: categoryId,
        contract_items: items as any,
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new Error(error?.message || "Não foi possível criar o contato.");
    }

    // Update ticket with contact info
    if (data.ticketId) {
      await supabase
        .from("service_tickets")
        .update({
          contact_name: data.name.trim(),
          contact_phone: cleanPhone,
          company_id: companyId,
        })
        .eq("id", data.ticketId);
    }

    return { success: true, companyId, crmContactId: created.id };
  });
