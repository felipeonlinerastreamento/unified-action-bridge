import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rhEnviarArquivo, rhLinkArquivo } from "@/lib/rh.functions";
import type { Ausencia, Colaborador, Documento, Ferias, LancHoras } from "@/lib/rh";

// As tabelas rh_* ainda não estão nos tipos gerados.
export const rh = supabase as any;

export type ColabRh = Colaborador & {
  cpf?: string | null; gestor_user_id?: string | null; motivo_desligamento?: string | null; jornada?: string | null;
  telefone?: string | null; email?: string | null; endereco?: string | null; contato_emergencia?: string | null; observacao?: string | null;
};
export type AusenciaRh = Ausencia & { arquivo_path?: string | null; arquivo_nome?: string | null; observacao?: string | null; created_at: string };
export type FeriasRh = Ferias & { observacao?: string | null };
export type HorasRh = LancHoras & { id: string; observacao?: string | null };
export type DocumentoRh = Documento & { numero?: string | null; emissao?: string | null; arquivo_path?: string | null; arquivo_nome?: string | null; observacao?: string | null };
export type OcorrenciaRh = { id: string; colaborador_id: string; tipo: string; data: string; motivo: string; descricao?: string | null; dias_suspensao?: number | null; ciente_em?: string | null; arquivo_path?: string | null; arquivo_nome?: string | null };
export type ChecklistRh = { id: string; colaborador_id: string; tipo: "admissao" | "desligamento"; itens: { texto: string; feito: boolean; feito_em?: string | null }[]; concluido_em?: string | null };

async function lerTudo(tabela: string, ordem = "created_at") {
  const out: any[] = [];
  for (let de = 0; de < 100_000; de += 1000) {
    const { data, error } = await rh.from(tabela).select("*").order(ordem, { ascending: false }).range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useRhDados() {
  const q = useQuery({
    queryKey: ["rh-dados"],
    queryFn: async () => {
      const [colabs, ausencias, ferias, horas, documentos, ocorrencias, checklists, cfg, setores, perfis] = await Promise.all([
        lerTudo("rh_colaboradores"), lerTudo("rh_ausencias"), lerTudo("rh_ferias"), lerTudo("rh_banco_horas"),
        lerTudo("rh_documentos"), lerTudo("rh_ocorrencias"), lerTudo("rh_checklists"),
        rh.from("rh_config").select("*").eq("id", 1).maybeSingle(),
        rh.from("sectors").select("id, name").order("name"),
        rh.from("profiles").select("user_id, name, is_active").order("name"),
      ]);
      return {
        colabs: colabs as ColabRh[], ausencias: ausencias as AusenciaRh[], ferias: ferias as FeriasRh[], horas: horas as HorasRh[],
        documentos: documentos as DocumentoRh[], ocorrencias: ocorrencias as OcorrenciaRh[], checklists: checklists as ChecklistRh[],
        config: cfg.data as any, setores: (setores.data ?? []) as { id: string; name: string }[], perfis: (perfis.data ?? []) as { user_id: string; name: string; is_active: boolean }[],
      };
    },
    retry: false,
  });
  return q;
}

export function useRhRecarregar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["rh-dados"] });
}

const paraBase64 = (file: File) => new Promise<string>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] ?? "");
  r.onerror = () => erro(r.error ?? new Error("Falha ao ler o arquivo."));
  r.readAsDataURL(file);
});

/** Envia um arquivo ao armazenamento privado do RH e devolve o caminho. */
export function useEnviarArquivoRh() {
  const enviar = useServerFn(rhEnviarArquivo);
  return async (pasta: "ausencias" | "documentos" | "ocorrencias", colaboradorId: string, file: File) => {
    if (file.size > 15 * 1024 * 1024) throw new Error("Arquivo maior que 15 MB.");
    return enviar({ data: { pasta, colaboradorId, nome: file.name, mime: file.type || "application/octet-stream", base64: await paraBase64(file) } });
  };
}

export function useAbrirArquivoRh() {
  const link = useServerFn(rhLinkArquivo);
  return async (path?: string | null) => {
    if (!path) return;
    try { const { url } = await link({ data: { path } }); window.open(url, "_blank", "noopener"); }
    catch (e: any) { toast.error(e?.message ?? "Não foi possível abrir o arquivo."); }
  };
}

export const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const brl = (v?: number | null) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
