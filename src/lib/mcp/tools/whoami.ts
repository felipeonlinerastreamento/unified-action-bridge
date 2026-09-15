import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Quem sou eu",
  description: "Retorna o perfil do usuário conectado (nome, e-mail, cargo e setores).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [{ data: profile }, { data: roles }, { data: sectors }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, is_active, panel_only").eq("user_id", userId!).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId!),
      supabase
        .from("user_sector_assignments")
        .select("sectors:sector_id(name)")
        .eq("user_id", userId!),
    ]);

    const result = {
      user_id: userId,
      email: ctx.getUserEmail() ?? (profile as any)?.email ?? null,
      full_name: (profile as any)?.full_name ?? null,
      is_active: (profile as any)?.is_active ?? null,
      roles: (roles ?? []).map((r: any) => r.role),
      sectors: (sectors ?? []).map((s: any) => s?.sectors?.name).filter(Boolean),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
