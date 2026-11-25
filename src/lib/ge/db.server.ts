// Cliente de serviço (server-only) tipado com as tabelas ge_.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { GeDatabase } from "@/lib/ge/db-types";

export const geAdmin = supabaseAdmin as unknown as SupabaseClient<GeDatabase>;
