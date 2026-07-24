import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const triggerGsystemEquipamentosSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Só admin/gestor podem disparar manualmente
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isGestor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "gestor",
    });
    if (!isAdmin && !isGestor) {
      throw new Error("Sem permissão");
    }
    const { syncGsystemEquipamentos } = await import(
      "@/lib/gsystem-equipamentos-sync.server"
    );
    return syncGsystemEquipamentos();
  });
