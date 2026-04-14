import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side middleware that injects the Supabase auth token
 * into server function requests as an Authorization header.
 * Chain this BEFORE requireSupabaseAuth in server function middleware arrays.
 */
export const withAuthHeaders = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data: { session } } = await supabase.auth.getSession();
    return next({
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    });
  }
);
