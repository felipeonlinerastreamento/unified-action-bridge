import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_OPERATOR_MENUS } from "@/lib/menu-catalog";

interface PermissionsResult {
  /** null = sem restrição (admin/gestor ou grupo sem allowed_menus). */
  allowedMenus: Set<string> | null;
  canFinalizeWithoutMessage: boolean;
  isLoading: boolean;
  canSeeMenu: (slug: string) => boolean;
}

/**
 * Permissões herdadas dos grupos dos setores em que o usuário está atribuído.
 * União entre grupos: se QUALQUER grupo libera o menu, libera. Se NENHUM grupo
 * tem allowed_menus configurado, aplica `DEFAULT_OPERATOR_MENUS`.
 */
export function useUserPermissions(): PermissionsResult {
  const { user, hasRole } = useAuth();
  const isAdminOrGestor = hasRole("admin") || hasRole("gestor");

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id, isAdminOrGestor],
    enabled: !!user?.id && !isAdminOrGestor,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from("user_sector_assignments")
        .select("sectors:sector_id(group_id, sector_groups:group_id(allowed_menus, can_finalize_without_message))")
        .eq("user_id", user!.id);
      if (error) throw error;

      const groups: Array<{ allowed_menus: string[] | null; can_finalize_without_message: boolean }> = [];
      for (const a of (assignments ?? []) as any[]) {
        const grp = a?.sectors?.sector_groups;
        if (grp) groups.push(grp);
      }
      return groups;
    },
  });

  return useMemo<PermissionsResult>(() => {
    if (isAdminOrGestor) {
      return {
        allowedMenus: null,
        canFinalizeWithoutMessage: true,
        isLoading: false,
        canSeeMenu: () => true,
      };
    }

    const groups = data ?? [];
    const groupsWithRestriction = groups.filter((g) => Array.isArray(g.allowed_menus));

    let allowedMenus: Set<string>;
    if (groupsWithRestriction.length === 0) {
      // Nenhum grupo configurou restrição → usa default histórico.
      allowedMenus = new Set(DEFAULT_OPERATOR_MENUS);
    } else {
      // União dos menus liberados.
      allowedMenus = new Set<string>();
      for (const g of groupsWithRestriction) {
        for (const slug of g.allowed_menus ?? []) allowedMenus.add(slug);
      }
    }

    const canFinalizeWithoutMessage = groups.some((g) => g.can_finalize_without_message === true);

    return {
      allowedMenus,
      canFinalizeWithoutMessage,
      isLoading,
      canSeeMenu: (slug: string) => allowedMenus.has(slug),
    };
  }, [data, isAdminOrGestor, isLoading]);
}
