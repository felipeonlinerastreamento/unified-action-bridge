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

// Get user email (from Auth) — admin only
export const getUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ email: string | null }> => {
    await requireAdmin(context.supabase, context.userId);

    const { data: result, error } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    if (error) throw new Error(`Erro ao buscar e-mail: ${error.message}`);
    return { email: result?.user?.email ?? null };
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

// Update user login e-mail (admin only). Confirms the new address right away so the
// person can log in with it immediately; the old address stops working.
export const updateUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      email: z.string().trim().toLowerCase().email().max(255),
    }).parse
  )
  .handler(async ({ data, context }): Promise<{ success: boolean; changed: boolean }> => {
    await requireAdmin(context.supabase, context.userId);

    const { data: current, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    if (getErr || !current?.user) throw new Error("Usuário não encontrado.");
    if ((current.user.email ?? "").toLowerCase() === data.email) return { success: true, changed: false };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      email: data.email,
      email_confirm: true,
    });
    if (error) {
      const msg = /already|registered|exists|duplicate/i.test(error.message)
        ? "Este e-mail já está em uso por outro usuário."
        : `Erro ao alterar e-mail: ${error.message}`;
      throw new Error(msg);
    }
    return { success: true, changed: true };
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

/**
 * Diagnóstico de login (admin): mostra o e-mail real da conta, confirmação, bloqueio e perfil, e
 * — se informada a senha — testa o login de verdade (cliente público, sem sessão). Com `corrigir`,
 * confirma o e-mail, tira o bloqueio de quem está ativo e (se informada) grava a senha antes do teste.
 */
export const diagnosticoAcessoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      targetUserId: z.string().uuid(),
      senha: z.string().min(6).max(128).optional(),
      corrigir: z.boolean().default(false),
    }).parse
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.targetUserId);
    if (error || !u?.user) throw new Error("Conta de acesso não encontrada para este usuário.");
    const { data: perfil } = await supabaseAdmin.from("profiles").select("name, is_active").eq("user_id", data.targetUserId).maybeSingle();
    const user: any = u.user;
    const banidoAte = user.banned_until && Date.parse(user.banned_until) > Date.now() ? user.banned_until : null;
    const ativo = perfil?.is_active !== false;
    const problemas: string[] = [];
    if (!user.email_confirmed_at) problemas.push("E-mail da conta não confirmado.");
    if (banidoAte) problemas.push(ativo ? "Conta bloqueada no login, embora o usuário esteja ativo no sistema." : "Usuário inativo (acesso bloqueado).");
    if (!ativo && !banidoAte) problemas.push("Usuário marcado como inativo no sistema.");
    if (user.email !== (user.email ?? "").trim().toLowerCase()) problemas.push("E-mail da conta com maiúsculas ou espaços.");

    const corrigido: string[] = [];
    if (data.corrigir) {
      const patch: Record<string, unknown> = {};
      if (!user.email_confirmed_at) { patch.email_confirm = true; corrigido.push("e-mail confirmado"); }
      if (banidoAte && ativo) { patch.ban_duration = "none"; corrigido.push("bloqueio removido"); }
      if (data.senha) { patch.password = data.senha; corrigido.push("senha gravada"); }
      if (Object.keys(patch).length) {
        const { error: e2 } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, patch as any);
        if (e2) throw new Error(`Erro ao corrigir: ${e2.message}`);
      }
    }

    let teste: { ok: boolean; mensagem: string } | null = null;
    if (data.senha) {
      const url = process.env.SUPABASE_URL;
      const chave = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (url && chave) {
        const { createClient } = await import("@supabase/supabase-js");
        const anon = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
        const r = await anon.auth.signInWithPassword({ email: user.email, password: data.senha });
        teste = r.error
          ? { ok: false, mensagem: r.error.message }
          : { ok: true, mensagem: "Login funcionou com este e-mail e senha." };
        if (!r.error) await anon.auth.signOut().catch(() => {});
      } else {
        teste = { ok: false, mensagem: "Não foi possível testar (chave pública do servidor ausente)." };
      }
    }

    return {
      emailConta: user.email as string,
      nome: perfil?.name ?? null,
      ativo,
      confirmado: !!user.email_confirmed_at,
      banidoAte,
      ultimoLogin: user.last_sign_in_at ?? null,
      problemas,
      corrigido,
      teste,
    };
  });
