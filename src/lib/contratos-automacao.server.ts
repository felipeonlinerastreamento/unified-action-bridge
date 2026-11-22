/**
 * Regras automáticas de Contratos (server-only, service role). As regras puras ficam em contratos-automacao.ts.
 * - rotinaDiariaContratos: lembretes de assinatura, avisos de vencimento e de reajuste, índices do Banco Central;
 * - criarRascunhoDaProposta: chamado quando o cliente aceita a proposta no CRM;
 * - financeiroDosContratos: valor do contrato × faturado (clientes) ou pago (fornecedores);
 * - aplicarReajuste: grava o novo valor e avisa o cliente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hojeSP } from "@/lib/finance";
import {
  CONFIG_PADRAO, INDICE_LABEL, SERIE_BCB, acumulado12, avisosVencimento, conferirValor, lembretesDevidos, mensagemReajuste,
  percentualReajuste, rascunhoDaProposta, reajustesPendentes, valorMensalVigente, type ConfigContratos, type Indice,
} from "@/lib/contratos-automacao";
import { soDigitos } from "@/lib/contratos";

const db = supabaseAdmin as any;

export async function lerConfigContratos(): Promise<ConfigContratos & { ultima_rotina_em?: string | null; ultima_rotina_resumo?: any }> {
  const { data } = await db.from("contratos_config").select("*").eq("id", 1).maybeSingle();
  return { ...CONFIG_PADRAO, ...(data || {}), financeiro_tolerancia_pct: Number(data?.financeiro_tolerancia_pct ?? CONFIG_PADRAO.financeiro_tolerancia_pct), reajuste_fixo_pct: Number(data?.reajuste_fixo_pct ?? 0) };
}

async function notificar(usuarios: (string | null | undefined)[], titulo: string, mensagem: string, contratoId: string) {
  const ids = [...new Set(usuarios.filter(Boolean) as string[])];
  if (!ids.length) return 0;
  await db.from("notifications").insert(ids.map((user_id) => ({ user_id, type: "contrato", title: titulo, message: mensagem, metadata: { contrato_id: contratoId } })));
  return ids.length;
}

/** Busca no Banco Central a variação acumulada de 12 meses dos índices (guardada em contratos_config.indices). */
export async function atualizarIndices(forcar = false) {
  const cfg = await lerConfigContratos();
  const hoje = hojeSP();
  const out: ConfigContratos["indices"] = { ...(cfg.indices || {}) };
  const erros: string[] = [];
  for (const [ind, serie] of Object.entries(SERIE_BCB) as [Exclude<Indice, "FIXO">, number][]) {
    if (!forcar && out[ind]?.atualizado_em?.slice(0, 10) === hoje) continue;
    try {
      const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/13?formato=json`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const a = acumulado12(await res.json());
      if (!a) throw new Error("série incompleta");
      out[ind] = { pct: a.pct, ate: a.ate, atualizado_em: new Date().toISOString() };
    } catch (e: any) { erros.push(`${INDICE_LABEL[ind]}: ${e?.message ?? e}`); }
  }
  await db.from("contratos_config").update({ indices: out }).eq("id", 1);
  return { indices: out, erros };
}

const COLS = "id, numero, status, categoria, cliente_nome, cliente_documento, dados, provedor, provedor_signatarios, provedor_link, token, signatario_nome, signatario_email, signatario_telefone, enviado_em, lembretes_enviados, vigencia_inicio, vigencia_meses, renovacao_automatica, avisos_enviados, valor_mensal, valor_mensal_atual, reajustes, created_by";

async function lerContratos(status: string[]) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("contratos").select(COLS).in("status", status).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Rotina diária (pg_cron 08:20 ou botão em Configurações › Contratos). Para no tempo limite e segue no dia seguinte. */
export async function rotinaDiariaContratos(limiteMs = 50_000) {
  const inicio = Date.now();
  const cfg = await lerConfigContratos();
  const hoje = hojeSP();
  const resumo: { [k: string]: string | number | string[] } = { hoje };
  const erros: string[] = [];

  // 1) índices (uma vez por dia)
  if (cfg.reajuste_ativo && cfg.reajuste_indice !== "FIXO") {
    const r = await atualizarIndices(false);
    cfg.indices = r.indices;
    if (r.erros.length) erros.push(...r.erros.map((e) => `índice ${e}`));
  }

  // 2) lembretes de assinatura
  let lembretes = 0, lembretesFalha = 0;
  if (cfg.lembrete_ativo && cfg.lembrete_dias.length) {
    const pend = lembretesDevidos(await lerContratos(["enviado"]), cfg.lembrete_dias, hoje);
    if (pend.length) {
      const { marcaContratos, reenviarUmContrato } = await import("@/lib/contratos-envio.server");
      const brand = await marcaContratos(db);
      for (const { contrato: c, etapa, diasDesdeEnvio } of pend) {
        if (Date.now() - inicio > limiteMs) break;
        let ok = false;
        let motivo = "";
        try {
          await reenviarUmContrato(db, brand, c, cfg.lembrete_modo, null, true);
          lembretes++; ok = true;
        } catch (e: any) {
          lembretesFalha++; motivo = String(e?.message ?? e);
          erros.push(`lembrete nº ${c.numero}: ${motivo}`);
        }
        // Conta a etapa mesmo com falha, para não insistir todo dia; o responsável é avisado.
        await db.from("contratos").update({ lembretes_enviados: etapa, ultimo_lembrete_em: new Date().toISOString() }).eq("id", c.id);
        if (cfg.lembrete_avisar_responsavel) {
          await notificar([c.created_by], "⏳ Contrato sem assinatura",
            `O contrato nº ${c.numero} (${c.cliente_nome}) está há ${diasDesdeEnvio} dias sem assinatura. ${ok ? `Lembrete ${etapa} enviado ao cliente.` : `O lembrete ${etapa} não pôde ser enviado: ${motivo}.`}`, c.id);
        }
      }
    }
  }
  resumo.lembretes = lembretes;
  resumo.lembretesFalha = lembretesFalha;

  // 3) vencimento e reajuste (contratos assinados)
  const assinados = await lerContratos(["assinado"]);
  let vencimentos = 0;
  if (cfg.vencimento_ativo && cfg.vencimento_dias.length) {
    for (const a of avisosVencimento(assinados, cfg.vencimento_dias, hoje, cfg.vencimento_fornecedores)) {
      if (Date.now() - inicio > limiteMs) break;
      const c = a.contrato;
      const tipo = c.categoria === "fornecedor" ? "fornecedor" : "cliente";
      await notificar([cfg.vencimento_avisar_responsavel ? c.created_by : null, ...cfg.vencimento_avisar_usuarios],
        `📅 Contrato vence em ${a.diasAteFim} dia(s)`,
        `Contrato nº ${c.numero} com ${tipo} ${c.cliente_nome} termina em ${a.fim.split("-").reverse().join("/")}${c.renovacao_automatica !== false ? " (renovação automática)" : ""}. ${tipo === "fornecedor" ? "Decida se renova, renegocia ou cancela." : "Combine a renovação com o cliente."}`, c.id);
      const avisos = { ...(c.avisos_enviados || {}) };
      for (const k of a.chaves) avisos[k] = new Date().toISOString();
      await db.from("contratos").update({ avisos_enviados: avisos }).eq("id", c.id);
      vencimentos++;
    }
  }
  resumo.vencimentos = vencimentos;

  let reajustes = 0;
  if (cfg.reajuste_ativo) {
    const pct = percentualReajuste(cfg);
    for (const r of reajustesPendentes(assinados.filter((c) => c.categoria !== "fornecedor"), hoje, cfg.reajuste_aviso_dias, pct)) {
      if (Date.now() - inicio > limiteMs) break;
      const c = r.contrato;
      const chave = `reaj:${r.data}`;
      if ((c.avisos_enviados || {})[chave]) continue;
      await notificar([c.created_by, ...cfg.vencimento_avisar_usuarios], "📈 Reajuste de contrato",
        `Contrato nº ${c.numero} (${c.cliente_nome}) faz aniversário em ${r.data.split("-").reverse().join("/")}. ${pct != null && r.valorAtual != null ? `${INDICE_LABEL[cfg.reajuste_indice]} ${pct.toLocaleString("pt-BR")}%: de R$ ${r.valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para R$ ${r.valorNovo!.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` : "Confira o valor."} Aplique em Contratos › Reajustes.`, c.id);
      await db.from("contratos").update({ avisos_enviados: { ...(c.avisos_enviados || {}), [chave]: new Date().toISOString() } }).eq("id", c.id);
      reajustes++;
    }
  }
  resumo.reajustes = reajustes;
  resumo.erros = erros.slice(0, 20);
  resumo.duracaoMs = Date.now() - inicio;
  await db.from("contratos_config").update({ ultima_rotina_em: new Date().toISOString(), ultima_rotina_resumo: resumo }).eq("id", 1);
  return resumo;
}

/** Proposta aceita no CRM → rascunho de contrato (uma vez por proposta). Nunca derruba o aceite. */
export async function criarRascunhoDaProposta(linkId: string, snapshot: any, donoId: string | null) {
  try {
    const cfg = await lerConfigContratos();
    if (!cfg.proposta_cria_rascunho) return null;
    const r = rascunhoDaProposta(snapshot || {}, hojeSP());
    const { data, error } = await db.from("contratos").insert({
      status: "rascunho", categoria: "cliente", proposta_link_id: linkId, created_by: donoId,
      cliente_nome: r.cliente_nome, cliente_documento: r.cliente_documento, dados: r.dados,
      vigencia_inicio: r.vigencia_inicio, vigencia_meses: r.vigencia_meses, valor_mensal: r.valor_mensal, valor_implantacao: r.valor_implantacao,
      signatario_nome: r.signatario_nome, signatario_email: r.signatario_email, signatario_telefone: r.signatario_telefone,
    }).select("id, numero").single();
    if (error) { if (!/duplicate|unique/i.test(error.message)) console.error("[contratos] rascunho da proposta:", error.message); return null; }
    await db.from("contratos_eventos").insert({ contrato_id: data.id, tipo: "criado", descricao: "Rascunho criado a partir da proposta aceita no CRM", user_id: donoId });
    if (donoId) await notificar([donoId], "📝 Contrato pronto para revisar", `A proposta aceita de ${r.cliente_nome} virou o rascunho do contrato nº ${data.numero}. Confira os dados e envie para assinatura.`, data.id);
    return data;
  } catch (e: any) {
    console.error("[contratos] rascunho da proposta:", e?.message ?? e);
    return null;
  }
}

/** Primeiro dia do mês `meses` antes do mês de hoje. */
function inicioMes(hoje: string, meses: number) {
  const [y, m] = hoje.split("-").map(Number);
  const t = y * 12 + (m - 1) - meses;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

/**
 * Valor do contrato × realizado: clientes pela receita mensal da carteira do Pós-venda (média de 3 meses
 * das faturas do GSystem); fornecedores pela média dos pagamentos dos últimos 3 meses fechados (contas a pagar).
 */
export async function financeiroDosContratos() {
  const cfg = await lerConfigContratos();
  const contratos = await lerContratos(["assinado", "enviado"]);
  const docs = [...new Set(contratos.map((c) => soDigitos(c.cliente_documento)).filter((d) => d.length >= 11))];
  const receita = new Map<string, number>();
  const pagos = new Map<string, number>();
  for (let i = 0; i < docs.length; i += 300) {
    const parte = docs.slice(i, i + 300);
    const { data } = await db.from("crm_posvenda_carteira").select("documento, receita_mensal").in("documento", parte);
    for (const x of data || []) receita.set(x.documento, Number(x.receita_mensal) || 0);
  }
  const hoje = hojeSP();
  const de = inicioMes(hoje, 3), ate = inicioMes(hoje, 0);
  const fornecedores = contratos.filter((c) => c.categoria === "fornecedor");
  const docsForn = [...new Set(fornecedores.map((c) => soDigitos(c.cliente_documento)).filter((d) => d.length >= 11))];
  for (let i = 0; i < docsForn.length; i += 300) {
    const { data } = await db.from("fin_lancamentos").select("documento_contraparte, valor, valor_pago, status, data_pagamento")
      .eq("tipo", "pagar").eq("status", "pago").in("documento_contraparte", docsForn.slice(i, i + 300)).gte("data_pagamento", de).lt("data_pagamento", ate);
    for (const l of data || []) pagos.set(l.documento_contraparte, (pagos.get(l.documento_contraparte) ?? 0) + Number(l.valor_pago ?? l.valor ?? 0));
  }
  const out: Record<string, ReturnType<typeof conferirValor> & { origem: "faturas" | "pagamentos" }> = {};
  for (const c of contratos) {
    const doc = soDigitos(c.cliente_documento);
    const forn = c.categoria === "fornecedor";
    const realizado = forn ? (pagos.has(doc) ? Math.round((pagos.get(doc)! / 3) * 100) / 100 : null) : (receita.has(doc) ? receita.get(doc)! : null);
    out[c.id] = { ...conferirValor(valorMensalVigente(c), realizado, cfg.financeiro_tolerancia_pct), origem: forn ? "pagamentos" : "faturas" };
  }
  return { porContrato: out, tolerancia: cfg.financeiro_tolerancia_pct };
}

/** Reajustes pendentes para a aba Reajustes. */
export async function listarReajustes() {
  const cfg = await lerConfigContratos();
  const pct = percentualReajuste(cfg);
  const assinados = (await lerContratos(["assinado"])).filter((c) => c.categoria !== "fornecedor");
  const pend = reajustesPendentes(assinados, hojeSP(), Math.max(cfg.reajuste_aviso_dias, 1), pct);
  return {
    indice: cfg.reajuste_indice, indiceLabel: INDICE_LABEL[cfg.reajuste_indice], pct, info: cfg.reajuste_indice === "FIXO" ? null : cfg.indices?.[cfg.reajuste_indice] ?? null,
    itens: pend.map((p) => ({ id: p.contrato.id, numero: p.contrato.numero, cliente: p.contrato.cliente_nome, data: p.data, diasAte: p.diasAte, valorAtual: p.valorAtual, valorNovo: p.valorNovo, temWhatsapp: !!soDigitos(p.contrato.signatario_telefone), temEmail: String(p.contrato.signatario_email || "").includes("@") })),
  };
}

/** Grava o reajuste (valor novo e histórico) e, se pedido, avisa o cliente com a mensagem configurada. */
export async function aplicarReajuste(opts: { id: string; data: string; pct: number; avisar: { whatsapp: boolean; email: boolean }; userId: string }) {
  const cfg = await lerConfigContratos();
  const { data: c } = await db.from("contratos").select("*").eq("id", opts.id).maybeSingle();
  if (!c || c.status !== "assinado") throw new Error("Contrato não encontrado ou não assinado.");
  if ((c.reajustes || []).some((r: any) => r.data === opts.data)) throw new Error("Este aniversário já foi reajustado.");
  const atual = valorMensalVigente(c);
  if (!atual) throw new Error("O contrato não tem valor mensal. Complete o valor antes de reajustar.");
  const novo = Math.round(atual * (1 + opts.pct / 100) * 100) / 100;
  const indice = cfg.reajuste_indice === "FIXO" ? "percentual fixo" : INDICE_LABEL[cfg.reajuste_indice];
  const registro = { data: opts.data, indice, pct: opts.pct, de: atual, para: novo, por: opts.userId, em: new Date().toISOString() };
  const { error } = await db.from("contratos").update({ valor_mensal_atual: novo, reajustes: [...(c.reajustes || []), registro] }).eq("id", c.id);
  if (error) throw new Error(error.message);
  const desc = `Reajuste de ${opts.pct.toLocaleString("pt-BR")}% (${indice}) a partir de ${opts.data.split("-").reverse().join("/")}: R$ ${atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} → R$ ${novo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  await db.from("contratos_eventos").insert({ contrato_id: c.id, tipo: "reajuste", descricao: desc, user_id: opts.userId });
  let enviados: string[] = [];
  let erros: Record<string, string> = {};
  if (opts.avisar.whatsapp || opts.avisar.email) {
    const { marcaContratos, mandarAoSignatario } = await import("@/lib/contratos-envio.server");
    const brand = await marcaContratos(db);
    const texto = mensagemReajuste(cfg.reajuste_mensagem, { contato: c.signatario_nome || c.cliente_nome, cliente: c.cliente_nome, numero: c.numero, percentual: opts.pct, indice, data: opts.data, valorAtual: atual, valorNovo: novo });
    const r = await mandarAoSignatario(db, brand, c, opts.avisar, `Reajuste do contrato nº ${c.numero} — ${brand.company_name || "Online Rastreamento"}`, texto);
    enviados = r.enviados; erros = r.erros;
    if (enviados.length) await db.from("contratos_eventos").insert({ contrato_id: c.id, tipo: "reajuste_avisado", descricao: `Cliente avisado do reajuste por ${enviados.join(" e ")}`, user_id: opts.userId });
  }
  return { de: atual, para: novo, enviados, erros };
}

/** PDF de um contrato para o download em lote: o assinado do Autentique ou o gerado do texto congelado. */
export async function pdfDoContrato(id: string): Promise<{ nome: string; base64: string } | { erro: string }> {
  const { data: c } = await db.from("contratos").select("id, numero, cliente_nome, provedor, provedor_documento_id, arquivo_assinado_url, conteudo_html, hash_sha256, status").eq("id", id).maybeSingle();
  if (!c) return { erro: "não encontrado" };
  const { nomeArquivoContrato } = await import("@/lib/contratos-automacao");
  const nome = nomeArquivoContrato(c.numero, c.cliente_nome);
  const b64 = (u8: Uint8Array) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  if (c.provedor === "autentique" && c.provedor_documento_id) {
    let url = c.arquivo_assinado_url as string | null;
    try {
      const { consultarDocumentoAutentique } = await import("@/lib/autentique.server");
      const doc = await consultarDocumentoAutentique(c.provedor_documento_id);
      url = doc?.files?.signed || doc?.files?.original || url;
    } catch { /* usa o link guardado */ }
    if (!url) return { erro: "sem PDF no Autentique" };
    const res = await fetch(url);
    if (!res.ok) return { erro: `Autentique respondeu ${res.status}` };
    return { nome, base64: b64(new Uint8Array(await res.arrayBuffer())) };
  }
  if (!c.conteudo_html) return { erro: "rascunho sem texto" };
  const { gerarPdfContrato } = await import("@/lib/contrato-pdf.server");
  const pdf = await gerarPdfContrato({ html: c.conteudo_html, titulo: `Contrato nº ${c.numero}`, rodape: `Contrato nº ${c.numero} — ${c.cliente_nome}${c.hash_sha256 ? ` — SHA-256 do texto ${String(c.hash_sha256).slice(0, 16)}…` : ""}` });
  return { nome, base64: b64(pdf) };
}
