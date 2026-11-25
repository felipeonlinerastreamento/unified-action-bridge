// Cliente Supabase tipado com as tabelas ge_ (Gestão de eventos). Mesmo cliente/sessão do Gestão.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { GeDatabase } from "@/lib/ge/db-types";

export const geDb = supabase as unknown as SupabaseClient<GeDatabase>;
