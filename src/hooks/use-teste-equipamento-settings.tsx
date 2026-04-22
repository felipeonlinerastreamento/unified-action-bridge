import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TesteEquipamentoSettings {
  id: string;
  is_enabled: boolean;
  trigger_category_key: string;
  trigger_category_label: string;
  target_sector_name: string;
  target_status: string;
  auto_sync_gsystem: boolean;
  require_subtipo: boolean;
  require_motivo_when_cobrar: boolean;
  require_garantia: boolean;
  updated_at: string;
}

export const DEFAULT_TESTE_EQUIPAMENTO_SETTINGS: TesteEquipamentoSettings = {
  id: "",
  is_enabled: true,
  trigger_category_key: "Teste de Equipamento",
  trigger_category_label: "Teste de Equipamento",
  target_sector_name: "Administrativo",
  target_status: "aberto",
  auto_sync_gsystem: true,
  require_subtipo: true,
  require_motivo_when_cobrar: true,
  require_garantia: true,
  updated_at: "",
};

export function useTesteEquipamentoSettings() {
  return useQuery({
    queryKey: ["teste-equipamento-settings"],
    queryFn: async (): Promise<TesteEquipamentoSettings> => {
      const { data, error } = await (supabase as any)
        .from("teste_equipamento_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as TesteEquipamentoSettings) || DEFAULT_TESTE_EQUIPAMENTO_SETTINGS;
    },
    staleTime: 30_000,
  });
}

export function isTesteEquipamentoCategory(
  category: string | null | undefined,
  settings?: Pick<TesteEquipamentoSettings, "trigger_category_key" | "trigger_category_label" | "is_enabled"> | null
) {
  if (!category) return false;
  const enabled = settings?.is_enabled ?? true;
  if (!enabled) return false;
  const c = category.trim().toLowerCase();
  const a = (settings?.trigger_category_key || "teste de equipamento").trim().toLowerCase();
  const b = (settings?.trigger_category_label || "teste de equipamento").trim().toLowerCase();
  return c === a || c === b || c.includes("teste de equipamento");
}

export interface TesteEquipamentoData {
  subtipo: "" | "Instalação" | "Retirada" | "Manutenção";
  necessario_cobrar: "" | "Sim" | "Não";
  motivo: string;
  garantia: "" | "Sim" | "Não";
}

export const EMPTY_TESTE_EQUIPAMENTO: TesteEquipamentoData = {
  subtipo: "",
  necessario_cobrar: "",
  motivo: "",
  garantia: "",
};

const BLOCK_START = "[Teste de Equipamento]";
const BLOCK_END = "---";

export function buildTesteEquipamentoNotes(data: TesteEquipamentoData, baseNotes: string): string {
  const lines = [BLOCK_START];
  if (data.subtipo) lines.push(`Subtipo: ${data.subtipo}`);
  if (data.subtipo === "Manutenção") {
    if (data.necessario_cobrar) lines.push(`Necessário cobrar: ${data.necessario_cobrar}`);
    if (data.necessario_cobrar === "Sim" && data.motivo)
      lines.push(`Motivo: ${data.motivo}`);
    if (data.garantia) lines.push(`Garantia: ${data.garantia}`);
  }
  lines.push(BLOCK_END);
  const cleanedBase = stripTesteEquipamentoBlock(baseNotes || "").trim();
  return cleanedBase ? `${lines.join("\n")}\n${cleanedBase}` : lines.join("\n");
}

export function stripTesteEquipamentoBlock(notes: string): string {
  if (!notes) return "";
  const idx = notes.indexOf(BLOCK_START);
  if (idx === -1) return notes;
  const after = notes.indexOf(BLOCK_END, idx);
  if (after === -1) return notes.substring(0, idx).trim();
  return (notes.substring(0, idx) + notes.substring(after + BLOCK_END.length)).trim();
}

export function parseTesteEquipamentoNotes(notes: string | null | undefined): TesteEquipamentoData {
  const out = { ...EMPTY_TESTE_EQUIPAMENTO };
  if (!notes) return out;
  const idx = notes.indexOf(BLOCK_START);
  if (idx === -1) return out;
  const end = notes.indexOf(BLOCK_END, idx);
  const block = notes.substring(idx, end === -1 ? notes.length : end);
  const grab = (label: string) => {
    const m = block.match(new RegExp(`${label}:\\s*(.+)`));
    return m ? m[1].trim() : "";
  };
  const sub = grab("Subtipo");
  if (["Instalação", "Retirada", "Manutenção"].includes(sub)) out.subtipo = sub as any;
  const cob = grab("Necessário cobrar");
  if (["Sim", "Não"].includes(cob)) out.necessario_cobrar = cob as any;
  out.motivo = grab("Motivo");
  const gar = grab("Garantia");
  if (["Sim", "Não"].includes(gar)) out.garantia = gar as any;
  return out;
}

export function validateTesteEquipamento(
  data: TesteEquipamentoData,
  settings?: TesteEquipamentoSettings | null
): string | null {
  const reqSub = settings?.require_subtipo ?? true;
  const reqMotivo = settings?.require_motivo_when_cobrar ?? true;
  const reqGar = settings?.require_garantia ?? true;
  if (reqSub && !data.subtipo) return "Selecione o subtipo (Instalação, Retirada ou Manutenção).";
  if (data.subtipo === "Manutenção") {
    if (!data.necessario_cobrar) return "Informe se é necessário cobrar.";
    if (reqMotivo && data.necessario_cobrar === "Sim" && !data.motivo.trim())
      return "Informe o motivo da cobrança.";
    if (reqGar && !data.garantia) return "Informe se há garantia.";
  }
  return null;
}
