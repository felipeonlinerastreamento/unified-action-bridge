/**
 * Fornecedores do Financeiro (server-only, service role): contagens do mês (GSystem e serviços técnicos),
 * conferência das cobranças com evidências, leitura da caixa financeiro@, aprovação e importação do DDA.
 * As regras puras ficam em finance-fornecedores.ts.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  acharFornecedor, aumentoVsAnteriores, calcularEsperado, casarDda, competenciaDaCobranca, conferirCobranca, contarEquipamentos,
  contarServicos, lerXmlNota, normalizarRegras, soDigitos, type CanalServico, type ItemDda, type NotaXml, type ServicoConcluido,
} from "@/lib/finance-fornecedores";

const db = supabaseAdmin as any;
const brl = (n: number | null | undefined) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function lerTudo(table: string, cols: string, filtro?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function evidencia(e: { fornecedor_id?: string | null; lancamento_id?: string | null; tipo: string; titulo: string; descricao?: string | null; dados?: unknown; user_id?: string | null }) {
  await db.from("fin_evidencias").insert({ ...e, dados: e.dados ?? {} });
}

// ------------------------------------------------------------------ contagens do mês
const fimDoMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 1)).toISOString(); };

export async function contagensDoMes(mes: string) {
  const [equip, tickets] = await Promise.all([
    lerTudo("gsystem_equipamentos", "raw"),
    lerTudo("service_tickets", "id, closed_at", (q) => q.eq("tech_stage", "concluido").gte("closed_at", `${mes}-01T03:00:00Z`).lt("closed_at", fimDoMes(mes).replace("T00:00:00.000Z", "T03:00:00Z"))),
  ]);
  const raws = equip.map((e) => e.raw || {});
  const servicos: ServicoConcluido[] = [];
  const ids = tickets.map((t) => t.id);
  const fechado = new Map(tickets.map((t) => [t.id, t.closed_at]));
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from("technical_service_terms").select("ticket_id, service_type, schedule_kind, status, superseded_by").in("ticket_id", ids.slice(i, i + 300));
    const porTicket = new Map<string, any>();
    for (const t of data || []) if (!t.superseded_by && t.status !== "cancelado") porTicket.set(t.ticket_id, t);
    for (const [tid, t] of porTicket) servicos.push({ service_type: t.service_type, schedule_kind: t.schedule_kind, concluido_em: fechado.get(tid) ?? null });
  }
  const cache = new Map<string, number>();
  return {
    veiculos: (f?: string) => { const k = `v:${f ?? ""}`; if (!cache.has(k)) cache.set(k, contarEquipamentos(raws, "veiculo", f)); return cache.get(k)!; },
    chips: (f?: string) => { const k = `c:${f ?? ""}`; if (!cache.has(k)) cache.set(k, contarEquipamentos(raws, "chip", f)); return cache.get(k)!; },
    servicos: (canal: CanalServico) => contarServicos(servicos, mes, canal),
    resumo: { equipamentos: raws.length, servicosConcluidos: servicos.length },
  };
}

/** Simulação da cobrança de um fornecedor num mês (tela Fornecedores). */
export async function simularCobranca(fornecedorId: string, mes: string) {
  const { data: f } = await db.from("fin_fornecedores").select("*").eq("id", fornecedorId).maybeSingle();
  if (!f) throw new Error("Fornecedor não encontrado.");
  const c = await contagensDoMes(mes);
  return { mes, ...calcularEsperado(normalizarRegras(f.regras), c, mes), base: c.resumo };
}

// ------------------------------------------------------------------ conferência de uma cobrança
export async function conferirLancamento(lancId: string, userId: string | null = null) {
  const { data: l } = await db.from("fin_lancamentos").select("*").eq("id", lancId).maybeSingle();
  if (!l || !l.fornecedor_id) return null;
  const { data: f } = await db.from("fin_fornecedores").select("*").eq("id", l.fornecedor_id).maybeSingle();
  if (!f) return null;
  const regras = normalizarRegras(f.regras);
  const mes = (l.competencia ? String(l.competencia).slice(0, 7) : null) ?? competenciaDaCobranca(l.data_emissao || l.vencimento || new Date().toISOString().slice(0, 10), f.competencia_ref);
  let esperado: { total: number; itens: any[] } | null = null;
  if (regras.length && mes) esperado = calcularEsperado(regras, await contagensDoMes(mes), mes);
  const conf = conferirCobranca(Number(l.valor), esperado?.total ?? null, Number(f.tolerancia_pct) || 0);
  const { data: ant } = await db.from("fin_lancamentos").select("valor, vencimento").eq("fornecedor_id", f.id).eq("tipo", "pagar").neq("status", "cancelado").neq("id", l.id)
    .lt("vencimento", l.vencimento || "9999-12-31").order("vencimento", { ascending: false }).limit(6);
  const aumento = aumentoVsAnteriores(Number(l.valor), (ant || []).map((a: any) => Number(a.valor)), Number(f.tolerancia_pct) || 0);
  const conferencia = { mes, status: conf.status, diferenca: conf.diferenca, pct: conf.pct, itens: esperado?.itens ?? [], anteriores: aumento, em: new Date().toISOString() };
  await db.from("fin_lancamentos").update({ valor_esperado: esperado?.total ?? null, conferencia }).eq("id", l.id);
  const ja = new Set(((await db.from("fin_evidencias").select("tipo").eq("lancamento_id", l.id)).data || []).map((e: any) => e.tipo));
  if ((conf.status === "acima" || conf.status === "abaixo") && !ja.has("valor_divergente")) {
    await evidencia({
      fornecedor_id: f.id, lancamento_id: l.id, tipo: "valor_divergente", user_id: userId,
      titulo: `Cobrança ${conf.status === "acima" ? "acima" : "abaixo"} do esperado`,
      descricao: `${f.nome}: cobrado ${brl(l.valor)}, esperado ${brl(esperado?.total)} (${conf.pct?.toLocaleString("pt-BR")}%, tolerância ${f.tolerancia_pct}%) — competência ${mes?.split("-").reverse().join("/")}.`,
      dados: { valor: Number(l.valor), esperado: esperado?.total, itens: esperado?.itens, regras, tolerancia_pct: f.tolerancia_pct, mes },
    });
  }
  if (aumento?.aumentou && !ja.has("aumento_valor")) {
    await evidencia({
      fornecedor_id: f.id, lancamento_id: l.id, tipo: "aumento_valor", user_id: userId,
      titulo: "Valor maior que as cobranças anteriores",
      descricao: `${f.nome}: ${brl(l.valor)} contra média de ${brl(aumento.media)} nas últimas ${(ant || []).length} cobrança(s) (+${aumento.pct.toLocaleString("pt-BR")}%).`,
      dados: { valor: Number(l.valor), anteriores: ant, media: aumento.media, pct: aumento.pct },
    });
  }
  return conferencia;
}

// ------------------------------------------------------------------ aprovação
export async function decidirAprovacao(id: string, decisao: "aprovado" | "reprovado", obs: string | null, userId: string) {
  const { data: l } = await db.from("fin_lancamentos").select("id, valor, valor_esperado, conferencia, fornecedor_id, contraparte, vencimento, aprovacao").eq("id", id).maybeSingle();
  if (!l) throw new Error("Lançamento não encontrado.");
  const { data: perfil } = await db.from("profiles").select("name").eq("user_id", userId).maybeSingle();
  const { error } = await db.from("fin_lancamentos").update({ aprovacao: decisao, aprovado_por: userId, aprovado_em: new Date().toISOString(), aprovacao_obs: obs, revisado: true }).eq("id", id);
  if (error) throw new Error(error.message);
  await evidencia({
    fornecedor_id: l.fornecedor_id, lancamento_id: l.id, tipo: "aprovacao", user_id: userId,
    titulo: decisao === "aprovado" ? "Aprovado para pagamento" : "Pagamento reprovado",
    descricao: `${perfil?.name ?? "Usuário"} ${decisao === "aprovado" ? "aprovou" : "reprovou"} ${l.contraparte ?? ""} ${brl(l.valor)}${l.valor_esperado != null ? ` (esperado ${brl(l.valor_esperado)})` : ""}${obs ? ` — ${obs}` : ""}.`,
    dados: { valor: l.valor, esperado: l.valor_esperado, conferencia: l.conferencia, anterior: l.aprovacao, vencimento: l.vencimento },
  });
  return { ok: true };
}

// ------------------------------------------------------------------ e-mail do financeiro
type Leitura = { contraparte: string | null; documento_contraparte: string | null; descricao: string | null; valor: number; data_emissao: string | null; vencimento: string | null; tipo_documento: string | null; numero_documento: string | null; linha_digitavel: string | null; categoria: string | null; empresa: string | null; confianca: number };

async function lerComIA(base64: string, mime: string, nome: string, categorias: string[], empresas: any[]): Promise<Leitura | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  const { promptLeitura, normalizarLeitura } = await import("@/lib/finance.functions");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: promptLeitura(categorias, empresas) },
        { role: "user", content: [{ type: "text", text: `Arquivo: ${nome} (recebido por e-mail no financeiro)` }, { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }] },
      ],
    }),
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  const txt = String(json?.choices?.[0]?.message?.content ?? "{}").replace(/^```json\s*|```$/g, "");
  try { return normalizarLeitura(JSON.parse(txt), categorias) as Leitura; } catch { return null; }
}

const ext = (n: string) => n.toLowerCase().split(".").pop() || "";
const mimeDe = (n: string, ct: string) => (ext(n) === "pdf" ? "application/pdf" : ext(n) === "png" ? "image/png" : ext(n) === "webp" ? "image/webp" : /jpe?g/.test(ext(n)) ? "image/jpeg" : ct);
const nomeSeguro = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-100);

export async function lerEmailFinanceiro(limiteMs = 50_000) {
  const inicio = Date.now();
  const { data: cfg } = await db.from("fin_email_config").select("*").eq("id", 1).maybeSingle();
  if (!cfg?.ativo) return { ok: false, motivo: "Leitura do e-mail desligada (Financeiro › Aprovações › E-mail).", lidos: 0, lancados: 0 };
  const { getOutlookProfile, listMessagesSince, listFileAttachments } = await import("@/lib/outlook.server");
  const me = await getOutlookProfile(cfg.connection_key);
  const ctx = { connectionKey: cfg.connection_key, mailbox: cfg.mailbox, connectedEmail: me.mail || me.userPrincipalName || null };
  const { data: ult } = await db.from("fin_email_mensagens").select("recebido_em").order("recebido_em", { ascending: false }).limit(1).maybeSingle();
  const desde = ult?.recebido_em && ult.recebido_em > cfg.ler_desde ? ult.recebido_em : cfg.ler_desde;
  const msgs = await listMessagesSince(ctx, desde, 30);

  const [fornecedores, { data: cats }, { data: emps }] = await Promise.all([
    lerTudo("fin_fornecedores", "*"),
    db.from("fin_categorias").select("id, nome").eq("ativo", true),
    db.from("fin_empresas").select("id, codigo, nome, cnpj").eq("ativo", true),
  ]);
  const nomesCat = (cats || []).map((c: any) => c.nome);
  const nossosCnpj = new Set((emps || []).map((e: any) => soDigitos(e.cnpj)).filter(Boolean));
  let lidos = 0, lancados = 0, ignorados = 0, erros = 0;

  for (const m of msgs) {
    if (Date.now() - inicio > limiteMs) break;
    const { data: ja } = await db.from("fin_email_mensagens").select("id").eq("message_id", m.id).maybeSingle();
    if (ja) continue;
    lidos++;
    const remetente = m.from?.emailAddress?.address ?? null;
    const registro = { message_id: m.id, remetente, assunto: m.subject ?? null, recebido_em: m.receivedDateTime ?? null };
    try {
      const anexos = (await listFileAttachments(ctx, m.id)).filter((a) => ["pdf", "xml", "png", "jpg", "jpeg", "webp"].includes(ext(a.name)) && !(a.isInline && a.size < 30_000));
      const notas: NotaXml[] = [];
      for (const a of anexos.filter((x) => ext(x.name) === "xml")) {
        const n = lerXmlNota(Buffer.from(a.contentBytes, "base64").toString("utf8"));
        if (n) notas.push(n);
      }
      const docs = anexos.filter((x) => ext(x.name) !== "xml").sort((a, b) => Number(/boleto|fatura|cobran/i.test(b.name)) - Number(/boleto|fatura|cobran/i.test(a.name)));
      if (!notas.length && !docs.length) {
        await db.from("fin_email_mensagens").insert({ ...registro, status: "ignorado", anexos: anexos.length, motivo: "sem nota, boleto ou fatura em anexo" });
        ignorados++; continue;
      }
      const nota = notas.find((n) => !n.destinatario_cnpj || !nossosCnpj.size || nossosCnpj.has(n.destinatario_cnpj)) ?? notas[0] ?? null;
      const leitura = docs[0] ? await lerComIA(docs[0].contentBytes, mimeDe(docs[0].name, docs[0].contentType), docs[0].name, nomesCat, emps || []) : null;
      const docForn = nota?.emitente_cnpj || soDigitos(leitura?.documento_contraparte) || null;
      const forn = acharFornecedor(fornecedores, docForn, remetente);
      const valor = leitura?.valor || nota?.vencimentos[0]?.valor || nota?.valor || 0;
      const vencimento = leitura?.vencimento || nota?.vencimentos[0]?.data || null;
      const linha = soDigitos(leitura?.linha_digitavel) || null;

      // Duplicadas: mesma nota ou mesmo boleto já lançados.
      if (nota?.chave) {
        const { data: d } = await db.from("fin_lancamentos").select("id").eq("nota_chave", nota.chave).maybeSingle();
        if (d) { await db.from("fin_email_mensagens").insert({ ...registro, status: "duplicado", anexos: anexos.length, lancamento_id: d.id, motivo: "nota já lançada" }); continue; }
      }
      if (linha && linha.length >= 44) {
        const { data: d } = await db.from("fin_lancamentos").select("id").eq("linha_digitavel", leitura!.linha_digitavel).maybeSingle();
        if (d) { await db.from("fin_email_mensagens").insert({ ...registro, status: "duplicado", anexos: anexos.length, lancamento_id: d.id, motivo: "boleto já lançado" }); continue; }
      }

      // Guarda os anexos no Financeiro.
      const pasta = `email/${(m.receivedDateTime || new Date().toISOString()).slice(0, 7)}/${soDigitos(m.receivedDateTime) || Date.now()}-${m.id.slice(-10).replace(/[^A-Za-z0-9]/g, "")}`;
      const caminhos: string[] = [];
      for (const a of anexos) {
        const path = `${pasta}/${nomeSeguro(a.name)}`;
        const { error } = await db.storage.from("fin-comprovantes").upload(path, Buffer.from(a.contentBytes, "base64"), { contentType: mimeDe(a.name, a.contentType), upsert: true });
        if (!error) caminhos.push(path);
      }
      const principal = caminhos.find((p) => docs[0] && p.endsWith(nomeSeguro(docs[0].name))) ?? caminhos[0] ?? null;
      const categoria = forn?.categoria_id ?? (cats || []).find((c: any) => c.nome === leitura?.categoria)?.id ?? null;
      const empresa = forn?.empresa_id ?? (emps || []).find((e: any) => e.codigo === leitura?.empresa || (nota?.destinatario_cnpj && soDigitos(e.cnpj) === nota.destinatario_cnpj))?.id ?? null;
      const comp = competenciaDaCobranca(nota?.emissao || leitura?.data_emissao || (m.receivedDateTime ?? "").slice(0, 10), forn?.competencia_ref ?? "anterior");

      const { data: novo, error } = await db.from("fin_lancamentos").insert({
        tipo: "pagar", origem: "email", email_message_id: m.id, fornecedor_id: forn?.id ?? null,
        empresa_id: empresa, categoria_id: categoria,
        contraparte: forn?.nome || nota?.emitente_nome || leitura?.contraparte || remetente,
        documento_contraparte: docForn, descricao: leitura?.descricao || m.subject || "Cobrança recebida por e-mail",
        valor, data_emissao: nota?.emissao || leitura?.data_emissao || null, vencimento,
        competencia: comp ? `${comp}-01` : null,
        tipo_documento: linha ? "boleto" : nota ? "nota_fiscal" : leitura?.tipo_documento || "fatura",
        numero_documento: nota?.numero || leitura?.numero_documento || null, linha_digitavel: leitura?.linha_digitavel || null,
        nota_chave: nota?.chave ?? null, arquivo_nome: principal?.split("/").pop() ?? null, arquivo_path: principal,
        ia_confianca: leitura?.confianca ?? (nota ? 1 : null), revisado: false,
        aprovacao: forn && forn.exige_aprovacao === false ? null : "pendente",
        observacao: `E-mail de ${remetente ?? "?"} em ${(m.receivedDateTime ?? "").slice(0, 16).replace("T", " ")}: "${m.subject ?? ""}". Anexos: ${caminhos.map((c) => c.split("/").pop()).join(", ")}${!forn ? ". Fornecedor não cadastrado: cadastre em Financeiro › Fornecedores para conferir a cobrança." : ""}`,
      }).select("id").single();
      if (error) throw new Error(error.message);
      if (forn) await conferirLancamento(novo.id);
      await db.from("fin_email_mensagens").insert({ ...registro, status: "lancado", anexos: anexos.length, lancamento_id: novo.id });
      lancados++;
    } catch (e: any) {
      erros++;
      await db.from("fin_email_mensagens").insert({ ...registro, status: "erro", motivo: String(e?.message ?? e).slice(0, 500) });
    }
  }
  const resumo = { em: new Date().toISOString(), lidos, lancados, ignorados, erros, mais: msgs.length === 30 };
  await db.from("fin_email_config").update({ ultima_leitura_em: new Date().toISOString(), ultimo_resumo: resumo }).eq("id", 1);
  return { ok: true, ...resumo };
}

// ------------------------------------------------------------------ DDA
export async function importarDda(itens: ItemDda[], userId: string) {
  if (!itens.length) return { casados: 0, criados: 0, foraDoDda: 0 };
  const venc = itens.map((i) => i.vencimento!).filter(Boolean).sort();
  const lancs = await lerTudo("fin_lancamentos", "id, tipo, status, valor, vencimento, linha_digitavel, documento_contraparte, dda_chave, tipo_documento, fornecedor_id, contraparte, origem",
    (q) => q.eq("tipo", "pagar").gte("vencimento", venc[0]).lte("vencimento", venc[venc.length - 1]));
  const { casados, semCobranca, foraDoDda } = casarDda(itens, lancs);
  for (const { item, lanc } of casados) {
    if (lanc.dda_chave !== item.chave) await db.from("fin_lancamentos").update({ dda_chave: item.chave, ...(lanc.linha_digitavel || !item.linha ? {} : { linha_digitavel: item.linha }) }).eq("id", lanc.id);
  }
  const fornecedores = await lerTudo("fin_fornecedores", "*");
  let criados = 0;
  for (const it of semCobranca) {
    const { data: existe } = await db.from("fin_lancamentos").select("id").eq("dda_chave", it.chave).maybeSingle();
    if (existe) continue;
    const forn = acharFornecedor(fornecedores, it.documento, null);
    const { data: novo, error } = await db.from("fin_lancamentos").insert({
      tipo: "pagar", origem: "dda", dda_chave: it.chave, fornecedor_id: forn?.id ?? null, categoria_id: forn?.categoria_id ?? null, empresa_id: forn?.empresa_id ?? null,
      contraparte: forn?.nome || it.beneficiario || "Boleto do DDA", documento_contraparte: it.documento, descricao: "Boleto registrado no DDA",
      valor: it.valor, vencimento: it.vencimento, tipo_documento: "boleto", linha_digitavel: it.linha, revisado: false, aprovacao: "pendente",
      competencia: (() => { const c = competenciaDaCobranca(it.vencimento, forn?.competencia_ref ?? "anterior"); return c ? `${c}-01` : null; })(),
      observacao: "Boleto encontrado no DDA do banco sem cobrança recebida por e-mail. Confira antes de aprovar.",
    }).select("id").single();
    if (error) continue;
    criados++;
    await evidencia({ fornecedor_id: forn?.id ?? null, lancamento_id: novo.id, tipo: "dda_sem_cobranca", user_id: userId, titulo: "Boleto no DDA sem cobrança recebida", descricao: `${it.beneficiario || it.documento || "?"}: ${brl(it.valor)} vence ${it.vencimento?.split("-").reverse().join("/")}.`, dados: it });
    if (forn) await conferirLancamento(novo.id, userId);
  }
  for (const l of foraDoDda) {
    const { data: ja } = await db.from("fin_evidencias").select("id").eq("lancamento_id", l.id).eq("tipo", "boleto_fora_dda").maybeSingle();
    if (ja) continue;
    await evidencia({ fornecedor_id: l.fornecedor_id, lancamento_id: l.id, tipo: "boleto_fora_dda", user_id: userId, titulo: "Boleto não aparece no DDA",
      descricao: `${l.contraparte ?? "?"}: ${brl(l.valor)} vence ${l.vencimento?.split("-").reverse().join("/")}. Boleto ${l.origem === "email" ? "recebido por e-mail " : ""}que não está registrado no DDA do banco: confirme com o fornecedor antes de pagar (pode ser boleto falso).`,
      dados: { lancamento: l, periodo: { de: venc[0], ate: venc[venc.length - 1] } } });
  }
  return { casados: casados.length, criados, foraDoDda: foraDoDda.length };
}
