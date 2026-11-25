import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geAdmin as supabaseAdmin } from "@/lib/ge/db.server";

type AppRole = "admin_platform" | "admin_client" | "admin_group" | "operator";

/**
 * Usuários da equipe do Gestão (com papel em user_roles) não são geridos por aqui:
 * a Gestão de eventos só cria/edita usuários de clientes.
 */
async function assertNaoEquipe(targetId: string) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data } = await admin.from("user_roles").select("role").eq("user_id", targetId).limit(1);
  if (data && data.length) throw new Error("Este é um usuário da equipe do Gestão. Altere em Configurações › Usuários.");
}

async function assertCanManageClient(
  callerId: string,
  clientId: string | null,
  groupId: string | null,
) {
  // ADM da plataforma = papel admin_platform ou equipe do Gestão liberada (ge_staff_allowed_for).
  const { data: isPlatform } = await supabaseAdmin.rpc("ge_is_platform_admin" as any, { _user_id: callerId } as any);
  if (isPlatform === true) return;
  const { data: rolesData } = await supabaseAdmin
    .from("ge_user_roles")
    .select("role")
    .eq("user_id", callerId);
  const roles = (rolesData ?? []).map((r) => r.role as AppRole);
  if (!clientId && !groupId) throw new Error("Sem permissão");

  const { data: caller } = await supabaseAdmin
    .from("ge_profiles")
    .select("client_id, group_id")
    .eq("id", callerId)
    .maybeSingle();

  if (roles.includes("admin_client") && clientId && caller?.client_id === clientId) return;
  if (roles.includes("admin_group") && caller?.group_id) {
    if (groupId && caller.group_id === groupId) return;
    if (clientId) {
      const { data: client } = await supabaseAdmin
        .from("ge_clients")
        .select("group_id")
        .eq("id", clientId)
        .maybeSingle();
      if (client?.group_id === caller.group_id) return;
    }
  }
  throw new Error("Sem permissão para gerenciar este cliente");
}

export const createClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(72),
        fullName: z.string().min(1).max(255),
        clientId: z.string().uuid().nullable(),
        groupId: z.string().uuid().nullable(),
        role: z.enum(["admin_client", "admin_group", "operator"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertCanManageClient(userId, data.clientId, data.groupId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      // tipo=ge_cliente: o gatilho do Gestão NÃO dá papel de equipe (o cliente só vê a Gestão de eventos).
      user_metadata: { full_name: data.fullName, name: data.fullName, tipo: "ge_cliente" },
    });
    if (error || !created.user) {
      const msg = error?.message ?? "Falha ao criar usuário";
      throw new Error(/already|registered|exists/i.test(msg) ? "Este e-mail já tem acesso ao Gestão Online (pode ser da equipe). Use outro e-mail." : msg);
    }

    const newId = created.user.id;

    const { error: profErr } = await supabaseAdmin
      .from("ge_profiles")
      .upsert(
        {
          id: newId,
          email: data.email,
          full_name: data.fullName,
          client_id: data.clientId,
          group_id: data.groupId,
          is_active: true,
        },
        { onConflict: "id" },
      );
    if (profErr) throw new Error(profErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("ge_user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { id: newId };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ targetUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: target } = await supabaseAdmin
      .from("ge_profiles")
      .select("email, client_id, group_id")
      .eq("id", data.targetUserId)
      .maybeSingle();
    if (!target?.email) throw new Error("Usuário não encontrado");

    await assertCanManageClient(userId, target.client_id, target.group_id);
    await assertNaoEquipe(data.targetUserId);

    const siteUrl =
      process.env.SITE_URL ??
      process.env.VITE_PUBLIC_SITE_URL ??
      "https://gestao.onlinerastreamento.com.br";

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(target.email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClientUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ clientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertCanManageClient(userId, data.clientId, null);

    const { data: profiles, error } = await supabaseAdmin
      .from("ge_profiles")
      .select("id, email, full_name, is_active, created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: rolesData } = ids.length
      ? await supabaseAdmin.from("ge_user_roles").select("user_id, role").in("user_id", ids)
      : { data: [] as { user_id: string; role: string }[] };

    const rolesByUser = new Map<string, string[]>();
    (rolesData ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      is_active: p.is_active,
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });

export const updateClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        fullName: z.string().trim().min(1).max(255).optional(),
        email: z.string().trim().email().max(255).optional(),
        clientId: z.string().uuid().nullable().optional(),
        groupId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: target } = await supabaseAdmin
      .from("ge_profiles")
      .select("id, email, full_name, client_id, group_id")
      .eq("id", data.targetUserId)
      .maybeSingle();
    if (!target) throw new Error("Usuário não encontrado");

    // Permissão sobre o escopo atual
    await assertCanManageClient(userId, target.client_id, target.group_id);
    await assertNaoEquipe(data.targetUserId);

    const scopeChanging =
      data.clientId !== undefined || data.groupId !== undefined;

    let nextClientId = target.client_id;
    let nextGroupId = target.group_id;
    if (scopeChanging) {
      // Mutuamente exclusivos
      nextClientId = data.clientId ?? null;
      nextGroupId = data.groupId ?? null;
      if (nextClientId && nextGroupId) {
        throw new Error("Defina cliente OU grupo, não ambos");
      }
      // Permissão sobre o novo escopo
      await assertCanManageClient(userId, nextClientId, nextGroupId);
    }

    // Atualiza auth (email/nome) se mudou
    const authPatch: { email?: string; user_metadata?: Record<string, unknown> } = {};
    if (data.email && data.email !== target.email) authPatch.email = data.email;
    if (data.fullName && data.fullName !== target.full_name) {
      authPatch.user_metadata = { full_name: data.fullName };
    }
    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        data.targetUserId,
        { ...authPatch, email_confirm: authPatch.email ? true : undefined },
      );
      if (error) throw new Error(error.message);
    }

    // Atualiza profile
    const profilePatch: {
      full_name?: string;
      email?: string;
      client_id?: string | null;
      group_id?: string | null;
    } = {};
    if (data.fullName !== undefined) profilePatch.full_name = data.fullName;
    if (data.email !== undefined) profilePatch.email = data.email;
    if (scopeChanging) {
      profilePatch.client_id = nextClientId;
      profilePatch.group_id = nextGroupId;
    }
    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseAdmin
        .from("ge_profiles")
        .update(profilePatch)
        .eq("id", data.targetUserId);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: target } = await supabaseAdmin
      .from("ge_profiles")
      .select("client_id, group_id")
      .eq("id", data.targetUserId)
      .maybeSingle();
    if (!target) throw new Error("Usuário não encontrado");

    await assertCanManageClient(userId, target.client_id, target.group_id);
    await assertNaoEquipe(data.targetUserId);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.targetUserId,
      { password: data.password },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
