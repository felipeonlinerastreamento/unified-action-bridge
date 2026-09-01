import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// Helper to verify caller is admin
async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .single();
  if (!data) throw new Error("Acesso restrito a administradores");
}

// Create a new user (admin invite)
export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(128),
      name: z.string().min(1).max(255),
      role: z.enum(["admin", "gestor", "atendente"]),
      groupId: z.string().uuid().nullable().optional(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ userId: string }> => {
    await requireAdmin(context.supabase, context.userId);

    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });

    if (error) throw new Error(`Erro ao criar usuário: ${error.message}`);
    if (!newUser.user) throw new Error("Falha ao criar usuário");

    // The handle_new_user trigger creates profile + default 'atendente' role
    // Wait for trigger to complete
    await new Promise((r) => setTimeout(r, 500));

    if (data.role !== "atendente") {
      await supabaseAdmin
        .from("user_roles")
        .update({ role: data.role })
        .eq("user_id", newUser.user.id);
    }

    // Assign group if provided
    if (data.groupId) {
      await supabaseAdmin
        .from("profiles")
        .update({ group_id: data.groupId })
        .eq("user_id", newUser.user.id);
    }

    return { userId: newUser.user.id };
  });

// Update user role
export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      role: z.enum(["admin", "gestor", "atendente"]),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    // Prevent self-demotion
    if (data.targetUserId === context.userId) {
      throw new Error("Você não pode alterar seu próprio papel");
    }

    // This action is already allowed by RLS for admins, so use the authenticated
    // client to avoid depending on service-role secrets just to change roles.
    const { error } = await context.supabase
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", data.targetUserId);

    if (error) throw new Error(`Erro ao atualizar papel: ${error.message}`);
    return { success: true };
  });

// Update user name
export const updateUserName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      name: z.string().min(1).max(255),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ name: data.name })
      .eq("user_id", data.targetUserId);

    if (error) throw new Error(`Erro ao atualizar nome: ${error.message}`);

    // Also update auth metadata
    await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      user_metadata: { name: data.name },
    });

    return { success: true };
  });

// Reset user password
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      newPassword: z.string().min(6).max(128),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      password: data.newPassword,
    });

    if (error) throw new Error(`Erro ao redefinir senha: ${error.message}`);
    return { success: true };
  });

// Update user group
export const updateUserGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      groupId: z.string().uuid().nullable(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ group_id: data.groupId })
      .eq("user_id", data.targetUserId);

    if (error) throw new Error(`Erro ao atualizar grupo: ${error.message}`);
    return { success: true };
  });

// Delete user
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    if (data.targetUserId === context.userId) {
      throw new Error("Você não pode excluir sua própria conta");
    }

    // Delete from auth (cascades to profiles, user_roles, gsystem_links via FK)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(`Erro ao excluir usuário: ${error.message}`);

    return { success: true };
  });

// Activate / Inactivate user
// - Inativo: bane no Auth (impede login), marca is_active=false e is_chat_available=false (não recebe chats)
// - Ativo: remove ban, marca is_active=true
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      active: z.boolean(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    if (data.targetUserId === context.userId) {
      throw new Error("Você não pode inativar sua própria conta");
    }

    const patch: Record<string, unknown> = { is_active: data.active };
    if (!data.active) {
      patch.is_chat_available = false;
      patch.last_seen_at = null;
    }

    // Atualiza primeiro o perfil com a sessão do admin. Assim, mesmo se o
    // bloqueio no Auth falhar, o usuário já deixa de ser elegível para filas.
    const { error: profErr } = await context.supabase
      .from("profiles")
      .update(patch as any)
      .eq("user_id", data.targetUserId);
    if (profErr) throw new Error(`Erro ao atualizar perfil: ${profErr.message}`);

    // Atualiza ban no Auth: 'none' libera, '876000h' (~100 anos) bloqueia
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: data.active ? "none" : "876000h",
    } as any);
    if (authErr) throw new Error(`Erro ao atualizar acesso: ${authErr.message}`);

    // Ao inativar: remove o usuário de todos os vínculos operacionais
    if (!data.active) {
      const uid = data.targetUserId;

      // Conversas em aberto voltam para a fila (setor preservado)
      await supabaseAdmin
        .from("zapi_chats")
        .update({ assigned_to: null, status: "aguardando" } as any)
        .eq("assigned_to", uid)
        .neq("status", "finalizado");

      // Chats já finalizados: apenas desvincula o responsável atual
      await supabaseAdmin
        .from("zapi_chats")
        .update({ assigned_to: null } as any)
        .eq("assigned_to", uid);

      // Tickets / tarefas: desatribui
      await supabaseAdmin
        .from("service_tickets")
        .update({ assigned_to: null } as any)
        .eq("assigned_to", uid)
        .neq("status", "finalizado");
      await supabaseAdmin.from("ticket_assignments").update({ assigned_to: null } as any).eq("assigned_to", uid);
      await supabaseAdmin.from("tasks").update({ assigned_to: null } as any).eq("assigned_to", uid);
      await supabaseAdmin.from("crm_tasks").update({ assigned_to: null } as any).eq("assigned_to", uid);

      // Vínculos diretos: remove
      await supabaseAdmin.from("ticket_agents").delete().eq("user_id", uid);
      await supabaseAdmin.from("task_participants").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_sector_assignments").delete().eq("user_id", uid);
    }

    return { success: true };
  });


// List all profiles (bypasses RLS) — needed so atendentes can see/select
// any user when forwarding tickets or linking ticket agents.
export const listAllProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, avatar_url, group_id")
      .eq("is_active", true)
      .eq("panel_only", false)
      .order("name", { ascending: true });
    return (data || []).filter((p: any) => p.user_id);
  });
