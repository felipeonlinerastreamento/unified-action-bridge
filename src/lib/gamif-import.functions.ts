import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildImportReport, parseTopExport, prepareTopImport, type ApplyResult, type Directory, type ImportReport } from "@/lib/gamif-import";

const TOP_EXPORT_URL = "https://jyukercrhruslahpqlqi.supabase.co/functions/v1/public-api/export";

/** Importa (ou reimporta) os dados do TOP Gamific. Só admin; pode repetir sem duplicar. */
export const importTopGamific = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportReport> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Somente administradores podem importar os dados do TOP.");
    const apiKey = process.env["TOPGAMIFIC_API_KEY"];
    if (!apiKey) throw new Error("A chave de acesso do TOP Gamific não está configurada.");

    const res = await fetch(TOP_EXPORT_URL, { headers: { "x-api-key": apiKey, Accept: "application/json" } });
    if (!res.ok) throw new Error(`O TOP Gamific não entregou a exportação (código ${res.status}).`);
    const exp = parseTopExport(await res.json());

    const { data: dir, error: dirErr } = await supabase.rpc("gamif_import_directory");
    if (dirErr) throw new Error(dirErr.message);
    const prep = prepareTopImport(exp, dir as unknown as Directory, userId);

    const { data: applied, error: applyErr } = await supabase.rpc("gamif_import_top_apply", { _p: prep.payload as never });
    if (applyErr) throw new Error(`Falha ao gravar a importação: ${applyErr.message}`);

    const report = buildImportReport(exp, prep, applied as unknown as ApplyResult);
    const { error: runErr } = await supabase.from("gamif_import_runs").insert({ ran_by: userId, exported_at: exp.exported_at, report: report as never });
    if (runErr) throw new Error(runErr.message);
    return report;
  });
