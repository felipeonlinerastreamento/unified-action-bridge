import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gsystemApiFetch } from "./gsystem-api.server";

export const debugGsystemColaborador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const results: Record<string, any> = {};
    const endpoints = [
      "/colaboradores",
      "/Colaboradores",
      "/usuarios",
      "/Usuarios",
      "/Funcionarios",
      "/funcionarios",
      "/pendencias?$top=1",
    ];
    for (const ep of endpoints) {
      try {
        const data = await gsystemApiFetch(ep, "GET");
        const sample = Array.isArray(data) ? data.slice(0, 2) : data;
        results[ep] = {
          ok: true,
          isArray: Array.isArray(data),
          sample: JSON.stringify(sample).substring(0, 800),
        };
      } catch (e: any) {
        results[ep] = { ok: false, error: String(e?.message || e).substring(0, 300) };
      }
    }
    return results;
  });
