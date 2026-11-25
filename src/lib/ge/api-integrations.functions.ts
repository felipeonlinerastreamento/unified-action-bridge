import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geAdmin as supabaseAdmin } from "@/lib/ge/db.server";
import { moviasLogin, runSyncForConfig, yuvGetWithBody, normalizeYuvBase } from "./api-sync.server";

const idSchema = z.object({ configId: z.string().uuid() });

async function loadConfigAsAdmin(configId: string, userId: string) {
  const { data: cfg, error } = await supabaseAdmin
    .from("ge_api_configurations")
    .select("*")
    .eq("id", configId)
    .maybeSingle();
  if (error || !cfg) throw new Error(error?.message ?? "Configuração não encontrada");

  if (cfg.client_id === null) {
    const { data: isAdmin } = await supabaseAdmin.rpc("ge_is_platform_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Apenas admin de plataforma pode operar configurações globais");
  } else {
    const { data: ok } = await supabaseAdmin.rpc("ge_user_can_access_client", {
      _user_id: userId,
      _client_id: cfg.client_id,
    });
    if (!ok) throw new Error("Sem permissão para esta configuração");
  }
  return cfg;
}

export const testApiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const cfg = await loadConfigAsAdmin(data.configId, context.userId);
    const started = Date.now();
    let ok = false;
    let message = "";
    try {
      if (cfg.api_type === "movias") {
        await moviasLogin(cfg.base_url, cfg.username, cfg.password_encrypted);
        ok = true;
        message = "Autenticação Movias bem-sucedida";
      } else if (cfg.api_type === "yuv") {
        const token = cfg.bearer_token_encrypted ?? cfg.api_key_encrypted;
        if (!token) throw new Error("Bearer token ou API key necessários para YUV");
        const base = normalizeYuvBase(cfg.base_url);
        const res = await yuvGetWithBody(`${base}/device`, token, { page: 1 }, 10000);
        ok = res.status >= 200 && res.status < 300;
        message = ok
          ? "Conexão YUV bem-sucedida"
          : `HTTP ${res.status}: ${res.text.slice(0, 200)}`;
      } else {
        throw new Error(`Tipo de API desconhecido: ${cfg.api_type}`);
      }
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    const latencyMs = Date.now() - started;

    await supabaseAdmin
      .from("ge_api_configurations")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: ok ? "success" : "failed",
        connection_status: ok ? "active" : "error",
        error_message: ok ? null : message,
      })
      .eq("id", cfg.id);

    return { ok, message, latencyMs };
  });

export const syncApiNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const cfg = await loadConfigAsAdmin(data.configId, context.userId);
    return runSyncForConfig(cfg);
  });
