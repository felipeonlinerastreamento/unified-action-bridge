import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** RH é só para administradores (rh_allowed() = has_role admin). */
async function assertRh(supabase: any) {
  const { data, error } = await supabase.rpc("rh_allowed");
  if (error) throw new Error(`RH indisponível (${error.message}). Confira se a migração 0072 foi aplicada.`);
  if (data !== true) throw new Error("O RH é liberado somente para administradores.");
}

export const rhEnviarArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pasta: z.enum(["ausencias", "documentos", "ocorrencias"]),
    colaboradorId: z.string().uuid(),
    nome: z.string().min(1).max(200),
    mime: z.string().max(120),
    base64: z.string().min(10).max(20_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertRh(supabase);
    const { adminDb, garantirBucket, BUCKET_RH } = await import("@/lib/rh.server");
    const db = await adminDb();
    await garantirBucket(db);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 15 * 1024 * 1024) throw new Error("Arquivo maior que 15 MB.");
    const limpo = data.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${data.pasta}/${data.colaboradorId}/${Date.now()}_${limpo}`;
    const { error } = await db.storage.from(BUCKET_RH).upload(path, bytes, { contentType: data.mime || "application/octet-stream" });
    if (error) throw new Error(`Falha ao guardar o arquivo: ${error.message}`);
    return { path, nome: data.nome };
  });

export const rhLinkArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertRh(supabase);
    const { adminDb, BUCKET_RH } = await import("@/lib/rh.server");
    const { data: s, error } = await (await adminDb()).storage.from(BUCKET_RH).createSignedUrl(data.path, 600);
    if (error) throw new Error(error.message);
    return { url: s.signedUrl as string };
  });

/** Cria a ficha de cada usuário ativo do sistema que ainda não está no RH e mantém nome/nascimento em dia. */
export const rhImportarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertRh(supabase);
    const { adminDb } = await import("@/lib/rh.server");
    const db = await adminDb();
    const { data: perfis, error } = await db.from("profiles").select("user_id, name, birth_date, is_active").eq("is_active", true);
    if (error) throw error;
    const { data: ja } = await db.from("rh_colaboradores").select("id, user_id, nome, data_nascimento");
    const tem = new Set((ja || []).map((x: any) => x.user_id).filter(Boolean));
    // Mantém nome e nascimento iguais aos do usuário do sistema.
    const perfilDe = new Map((perfis || []).map((p: any) => [p.user_id, p]));
    let atualizados = 0;
    for (const c of ja || []) {
      const p: any = c.user_id ? perfilDe.get(c.user_id) : null;
      if (!p) continue;
      const mud: any = {};
      if (p.name && p.name !== c.nome) mud.nome = p.name;
      if (p.birth_date && !c.data_nascimento) mud.data_nascimento = p.birth_date;
      if (Object.keys(mud).length) { await db.from("rh_colaboradores").update({ ...mud, updated_at: new Date().toISOString() }).eq("id", c.id); atualizados++; }
    }
    const { data: setores } = await db.from("user_sector_assignments").select("user_id, sector_id");
    const setorDe = new Map((setores || []).map((s: any) => [s.user_id, s.sector_id]));
    const novos = (perfis || []).filter((p: any) => !tem.has(p.user_id)).map((p: any) => ({
      user_id: p.user_id, nome: p.name || "Sem nome", data_nascimento: p.birth_date ?? null, setor_id: setorDe.get(p.user_id) ?? null, situacao: "ativo",
    }));
    if (novos.length) {
      const { error: e2 } = await db.from("rh_colaboradores").insert(novos);
      if (e2) throw e2;
    }
    return { criados: novos.length, existentes: tem.size, atualizados };
  });

/** Desativa o acesso ao sistema do colaborador desligado (profiles.is_active = false). */
export const rhDesativarAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ colaboradorId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertRh(supabase);
    const { adminDb } = await import("@/lib/rh.server");
    const db = await adminDb();
    const { data: c } = await db.from("rh_colaboradores").select("user_id, nome").eq("id", data.colaboradorId).maybeSingle();
    if (!c?.user_id) throw new Error("Este colaborador não está ligado a um usuário do sistema.");
    if (c.user_id === userId) throw new Error("Você não pode desativar o seu próprio acesso.");
    const { error } = await db.from("profiles").update({ is_active: false, is_chat_available: false }).eq("user_id", c.user_id);
    if (error) throw error;
    return { ok: true, nome: c.nome };
  });

/** Envia agora o resumo de avisos para o e-mail/WhatsApp configurado. */
export const rhEnviarResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertRh(supabase);
    const { rotinaRh } = await import("@/lib/rh.server");
    return rotinaRh({ manual: true });
  });
