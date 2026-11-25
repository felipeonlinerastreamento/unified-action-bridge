import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CHAVE_CONFLITO,
  ORDEM_TABELAS,
  chaveEmpresa,
  remapearUsuarios,
  type TabelaGe,
} from "@/lib/ge/importacao";

const db = supabaseAdmin as any;

async function exigirAdmin(userId: string) {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").limit(1);
  if (!data?.length) throw new Error("Só administradores do Gestão podem importar a Gestão de eventos.");
}

async function lerMigracao() {
  const { data } = await db.from("ge_migracao").select("*").eq("id", 1).maybeSingle();
  if (!data) throw new Error("Tabela ge_migracao ausente: aplique a migração 0084 no Lovable.");
  return data as { usuarios: Record<string, string>; totais: Record<string, number>; sync_ativo: boolean };
}

/** E-mail → id de todos os usuários do Auth do Gestão. */
async function usuariosPorEmail(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let page = 1; page < 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users ?? []) if (u.email) m.set(u.email.toLowerCase(), u.id);
    if ((data.users ?? []).length < 1000) break;
  }
  return m;
}

/**
 * Perfis do projeto antigo: quem já é usuário do Gestão (mesmo e-mail) reaproveita o id e,
 * se for da equipe, não ganha perfil de cliente; os demais viram usuários novos do tipo
 * ge_cliente com senha aleatória (o admin define a senha em Gestão de eventos › Usuários).
 */
async function importarPerfis(linhas: Record<string, unknown>[], mapa: Record<string, string>) {
  const existentes = await usuariosPorEmail();
  const { data: equipe } = await db.from("user_roles").select("user_id");
  const ehEquipe = new Set<string>((equipe ?? []).map((r: any) => r.user_id));
  let criados = 0, reaproveitados = 0;
  const perfis: Record<string, unknown>[] = [];
  for (const l of linhas) {
    const antigo = String(l.id ?? "");
    const email = String(l.email ?? "").trim().toLowerCase();
    if (!antigo || !email) continue;
    let novo = mapa[antigo] ?? existentes.get(email);
    if (novo) reaproveitados++;
    else {
      const senha = crypto.randomUUID() + "Aa1!";
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { full_name: l.full_name ?? email, name: l.full_name ?? email, tipo: "ge_cliente" },
      });
      if (error || !data?.user) throw new Error(`Falha ao criar ${email}: ${error?.message ?? "sem retorno"}`);
      novo = data.user.id as string;
      existentes.set(email, novo);
      criados++;
    }
    mapa[antigo] = novo;
    if (!ehEquipe.has(novo)) perfis.push({ ...l, id: novo, email });
  }
  return { perfis, criados, reaproveitados, equipe: ehEquipe };
}

export const geImportarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      tabela: z.enum(ORDEM_TABELAS),
      linhas: z.array(z.record(z.string(), z.unknown())).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const mig = await lerMigracao();
    const mapa = { ...(mig.usuarios ?? {}) };
    const tabela = data.tabela as TabelaGe;
    let linhas = data.linhas;
    const extra: Record<string, number> = {};

    if (tabela === "profiles") {
      const r = await importarPerfis(linhas, mapa);
      linhas = r.perfis;
      extra.usuarios_criados = r.criados;
      extra.usuarios_existentes = r.reaproveitados;
    } else {
      linhas = remapearUsuarios(tabela, linhas, mapa);
      if (tabela === "user_roles") {
        // Equipe do Gestão não recebe papel de cliente.
        const { data: equipe } = await db.from("user_roles").select("user_id");
        const ehEquipe = new Set<string>((equipe ?? []).map((r: any) => r.user_id));
        linhas = linhas.filter((l) => !ehEquipe.has(String(l.user_id)));
      }
    }

    let gravadas = 0;
    const erros: string[] = [];
    for (let i = 0; i < linhas.length; i += 200) {
      const bloco = linhas.slice(i, i + 200);
      const { error } = await db.from(`ge_${tabela}`).upsert(bloco, { onConflict: CHAVE_CONFLITO[tabela] });
      if (!error) { gravadas += bloco.length; continue; }
      // Bloco recusado: grava linha a linha para isolar o problema.
      for (const l of bloco) {
        const { error: e } = await db.from(`ge_${tabela}`).upsert([l], { onConflict: CHAVE_CONFLITO[tabela] });
        if (e) { if (erros.length < 5) erros.push(e.message); } else gravadas++;
      }
    }

    const totais = { ...(mig.totais ?? {}), [tabela]: ((mig.totais ?? {})[tabela] ?? 0) + gravadas };
    await db.from("ge_migracao").update({
      usuarios: mapa,
      totais,
      tabela,
      etapa: "importando",
      iniciado_em: (mig as any).iniciado_em ?? new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      ultimo_erro: erros[0] ?? null,
    }).eq("id", 1);

    return { tabela, recebidas: data.linhas.length, gravadas, ignoradas: data.linhas.length - linhas.length, erros, ...extra };
  });

/** Liga cada cliente da Gestão de eventos ao cliente (empresa) do Gestão de mesmo nome. */
export const geVincularEmpresas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.userId);
    const { data: clientes } = await db.from("ge_clients").select("id,name,company_id");
    const { data: empresas } = await db.from("companies").select("id,name").limit(10000);
    const porChave = new Map<string, string>();
    for (const e of empresas ?? []) {
      const k = chaveEmpresa(e.name);
      if (k && !porChave.has(k)) porChave.set(k, e.id);
    }
    let vinculados = 0;
    const semPar: string[] = [];
    for (const c of clientes ?? []) {
      if (c.company_id) continue;
      const id = porChave.get(chaveEmpresa(c.name));
      if (!id) { semPar.push(c.name); continue; }
      await db.from("ge_clients").update({ company_id: id }).eq("id", c.id);
      vinculados++;
    }
    return { vinculados, semPar };
  });

export const geStatusMigracao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.userId);
    const mig = await lerMigracao();
    return {
      totais: mig.totais ?? {},
      usuariosMapeados: Object.keys(mig.usuarios ?? {}).length,
      syncAtivo: !!mig.sync_ativo,
      ultimoErro: (mig as any).ultimo_erro ?? null,
      atualizadoEm: (mig as any).atualizado_em ?? null,
    };
  });

/** Virada: liga a busca automática nas APIs (Movias/YUV) a partir do Gestão. */
export const geDefinirSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.userId);
    const { error } = await db.from("ge_migracao").update({
      sync_ativo: data.ativo,
      etapa: data.ativo ? "concluida" : "importando",
      concluido_em: data.ativo ? new Date().toISOString() : null,
    }).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
