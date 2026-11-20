import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePlate } from "@/lib/estoque-kpis";

function listFrom(res: any): any[] {
  if (Array.isArray(res)) return res;
  return res?.Items ?? res?.items ?? res?.Data ?? res?.data ?? [];
}

async function findVeiculoByPlaca(placa: string) {
  const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
  const target = normalizePlate(placa);
  const res = await gsystemApiFetch(`/veiculos?Placa=${encodeURIComponent(target)}`);
  let list = listFrom(res);
  let v = list.find((x: any) => normalizePlate(x?.Placa ?? "") === target);
  if (!v) {
    list = listFrom(await gsystemApiFetch("/veiculos"));
    v = list.find((x: any) => normalizePlate(x?.Placa ?? "") === target);
  }
  return v ?? null;
}

function equipId(e: any): string {
  if (e == null) return "";
  if (typeof e === "object") return String(e.Equipamento ?? e.Serie ?? e.DisplayName ?? e.Codigo ?? "");
  return String(e);
}

export const vincularPlaca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      codigo: z.string().min(1).max(50),
      placa: z.string().min(5).max(12),
      operacao: z.enum(["vincular", "desvincular"]),
      secundario: z.boolean().default(false),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");

    const { data: eq } = await supabase
      .from("gsystem_equipamentos")
      .select("codigo, serie, equipamento, raw")
      .eq("codigo", Number(data.codigo))
      .maybeSingle();
    if (!eq) throw new Error("Equipamento não encontrado no espelho do GSystem.");
    const raw = (eq.raw ?? {}) as any;
    const serie = String(eq.equipamento ?? eq.serie ?? "");
    const { data: prof } = await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle();

    const field = data.secundario ? "EquipamentoSecundario" : "Equipamento";
    const log = {
      operacao: data.operacao,
      equipamento_codigo: data.codigo,
      equipamento_serie: serie,
      equipamento_modelo: raw.Modelo ?? null,
      chip: raw.Chip ?? null,
      placa: normalizePlate(data.placa),
      user_id: userId,
      user_name: prof?.name ?? null,
    };

    try {
      const v = await findVeiculoByPlaca(data.placa);
      if (!v) throw new Error(`Placa ${data.placa} não encontrada no GSystem.`);
      const vKey = String(v.Codigo ?? v.Key ?? v.Id);
      if (data.operacao === "vincular") {
        const atual = equipId(v[field]);
        if (atual && atual !== serie) throw new Error(`A placa já possui o equipamento ${atual}. Desvincule antes.`);
      } else if (equipId(v[field]) !== serie) {
        throw new Error("Este equipamento não está vinculado a essa placa no GSystem.");
      }
      const body = { ...v, [field]: data.operacao === "vincular" ? serie : null };
      await gsystemApiFetch(`/veiculos/${encodeURIComponent(vKey)}`, "PUT", body);

      const newRaw = { ...raw, Status: data.operacao === "vincular" ? "Vinculado" : (raw.Chip ? "Disponível" : "Sem_Chip"), Placa: data.operacao === "vincular" ? log.placa : null };
      await supabaseAdmin.from("gsystem_equipamentos").update({ raw: newRaw }).eq("codigo", Number(data.codigo));
      await supabaseAdmin.from("gsystem_vinculos_historico").insert({ ...log, veiculo_codigo: vKey, sucesso: true });
      return { ok: true };
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 500);
      await supabaseAdmin.from("gsystem_vinculos_historico").insert({ ...log, sucesso: false, erro: msg });
      throw new Error(msg);
    }
  });

/**
 * Desvincula o chip de um equipamento no GSystem (PUT /equipamentos/{Codigo} com Chip = null),
 * atualiza o espelho local e registra no histórico de vínculos.
 */
export const desvincularChip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ codigo: z.string().min(1).max(50) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");

    const { data: eq } = await supabase
      .from("gsystem_equipamentos")
      .select("codigo, serie, equipamento, raw")
      .eq("codigo", Number(data.codigo))
      .maybeSingle();
    if (!eq) throw new Error("Equipamento não encontrado no espelho do GSystem.");
    const raw = (eq.raw ?? {}) as any;
    if (!raw.Chip || !String(raw.Chip).trim()) throw new Error("Este equipamento não tem chip vinculado.");
    if (String(raw.Status ?? "").toLowerCase().includes("vincul")) {
      throw new Error("Equipamento está instalado em um veículo. Desvincule da placa antes de retirar o chip.");
    }
    const { data: prof } = await supabase.from("profiles").select("name").eq("user_id", userId).maybeSingle();
    const log = {
      operacao: "desvincular_chip",
      equipamento_codigo: data.codigo,
      equipamento_serie: String(eq.equipamento ?? eq.serie ?? ""),
      equipamento_modelo: raw.Modelo ?? null,
      chip: String(raw.Chip),
      placa: null,
      user_id: userId,
      user_name: prof?.name ?? null,
    };

    try {
      const atual = await gsystemApiFetch(`/equipamentos/${encodeURIComponent(data.codigo)}`, "GET");
      const base = atual && typeof atual === "object" && !Array.isArray(atual) ? (atual.Data ?? atual.data ?? atual) : raw;
      await gsystemApiFetch(`/equipamentos/${encodeURIComponent(data.codigo)}`, "PUT", { ...base, Chip: null });

      const newRaw = { ...raw, Chip: null, Status: "Sem_Chip" };
      await supabaseAdmin.from("gsystem_equipamentos").update({ raw: newRaw }).eq("codigo", Number(data.codigo));
      await supabaseAdmin.from("gsystem_vinculos_historico").insert({ ...log, sucesso: true });
      return { ok: true };
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 500);
      await supabaseAdmin.from("gsystem_vinculos_historico").insert({ ...log, sucesso: false, erro: msg });
      throw new Error(msg);
    }
  });
