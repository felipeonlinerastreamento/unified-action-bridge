/**
 * Fornecedores do Financeiro: regra de cobrança, cobrança esperada (com memória de cálculo),
 * conferência, aumento em relação às cobranças anteriores, leitura de XML de NF-e/NFS-e e DDA.
 * Regras puras, testadas em finance-fornecedores.test.ts.
 */

export type TipoServico = "instalacao" | "retirada" | "manutencao";
export type CanalServico = "todos" | "seu_instalador" | "terceiro";

export type Regra =
  | { tipo: "fixo"; descricao?: string; valor: number }
  | { tipo: "por_veiculo"; descricao?: string; valor_unit: number; filtro?: string; minimo?: number }
  | { tipo: "por_chip"; descricao?: string; valor_unit: number; filtro?: string; minimo?: number }
  | { tipo: "por_servico"; descricao?: string; precos: Partial<Record<TipoServico, number>>; canal?: CanalServico };

export const TIPO_REGRA_LABEL: Record<Regra["tipo"], string> = {
  fixo: "Valor fixo mensal",
  por_veiculo: "Por veículo ativo",
  por_chip: "Por linha de chip",
  por_servico: "Por instalação / retirada / manutenção",
};
export const SERVICO_LABEL: Record<TipoServico, string> = { instalacao: "Instalação", retirada: "Retirada", manutencao: "Manutenção" };
export const CANAL_LABEL: Record<CanalServico, string> = { todos: "Todos os serviços técnicos", seu_instalador: "Só Seu Instalador", terceiro: "Só técnico terceiro" };

const r2 = (n: number) => Math.round(n * 100) / 100;
export const soDigitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Lê a lista de regras salva (jsonb), descartando o que estiver incompleto. */
export function normalizarRegras(raw: unknown): Regra[] {
  const out: Regra[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    if (r?.tipo === "fixo") out.push({ tipo: "fixo", descricao: r.descricao || undefined, valor: n(r.valor) });
    else if (r?.tipo === "por_veiculo" || r?.tipo === "por_chip") out.push({ tipo: r.tipo, descricao: r.descricao || undefined, valor_unit: n(r.valor_unit), filtro: String(r.filtro || "").trim() || undefined, minimo: n(r.minimo) || undefined });
    else if (r?.tipo === "por_servico") {
      const precos: Partial<Record<TipoServico, number>> = {};
      for (const k of ["instalacao", "retirada", "manutencao"] as TipoServico[]) if (n(r.precos?.[k])) precos[k] = n(r.precos[k]);
      out.push({ tipo: "por_servico", descricao: r.descricao || undefined, precos, canal: (["todos", "seu_instalador", "terceiro"].includes(r.canal) ? r.canal : "todos") as CanalServico });
    }
  }
  return out;
}

// ------------------------------------------------------------------ contagens
/** Equipamento do espelho do GSystem (gsystem_equipamentos.raw). */
type RawEquip = { Status?: string | null; Chip?: unknown; Placa?: string | null; [k: string]: unknown };
const casaFiltro = (raw: unknown, filtro?: string) => !filtro || JSON.stringify(raw ?? {}).toLowerCase().includes(filtro.toLowerCase());

/** Veículos ativos = equipamentos vinculados a uma placa. Chips ativos = equipamentos vinculados com chip. */
export function contarEquipamentos(raws: RawEquip[], tipo: "veiculo" | "chip", filtro?: string): number {
  let n = 0;
  for (const r of raws) {
    if (!String(r?.Status ?? "").toLowerCase().includes("vincul")) continue;
    if (tipo === "chip" && !r.Chip) continue;
    const alvo = tipo === "chip" ? r.Chip : r;
    if (!casaFiltro(alvo, filtro)) continue;
    n++;
  }
  return n;
}

/** Serviço técnico concluído: tipo (instalação/retirada/manutenção) e como foi agendado. */
export type ServicoConcluido = { service_type: string | null; schedule_kind: string | null; concluido_em: string | null };

export function contarServicos(servicos: ServicoConcluido[], mes: string, canal: CanalServico = "todos"): Record<TipoServico, number> {
  const out: Record<TipoServico, number> = { instalacao: 0, retirada: 0, manutencao: 0 };
  for (const s of servicos) {
    if (!s.concluido_em || s.concluido_em.slice(0, 7) !== mes) continue;
    const t = s.service_type as TipoServico;
    if (!(t in out)) continue;
    const terceiro = s.schedule_kind === "terceiro";
    if (canal === "terceiro" && !terceiro) continue;
    if (canal === "seu_instalador" && terceiro) continue;
    out[t]++;
  }
  return out;
}

/** Mês de competência da cobrança: o anterior à emissão (padrão: cobra o mês fechado) ou o próprio mês. */
export function competenciaDaCobranca(data: string | null | undefined, ref: "anterior" | "atual" = "anterior"): string | null {
  if (!data || !/^\d{4}-\d{2}/.test(data)) return null;
  const [y, m] = data.slice(0, 7).split("-").map(Number);
  if (ref === "atual") return `${y}-${String(m).padStart(2, "0")}`;
  const t = y * 12 + (m - 1) - 1;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ cobrança esperada
export type ItemConferencia = { descricao: string; quantidade: number; unitario: number; subtotal: number; fonte: string };
export type Contagens = {
  veiculos: (filtro?: string) => number;
  chips: (filtro?: string) => number;
  servicos: (canal: CanalServico) => Record<TipoServico, number>;
};

/** Soma as regras do fornecedor com as quantidades do mês e devolve a memória de cálculo. */
export function calcularEsperado(regras: Regra[], c: Contagens, mes: string): { total: number; itens: ItemConferencia[] } {
  const itens: ItemConferencia[] = [];
  for (const r of regras) {
    if (r.tipo === "fixo") {
      itens.push({ descricao: r.descricao || "Valor fixo mensal", quantidade: 1, unitario: r.valor, subtotal: r2(r.valor), fonte: "valor combinado" });
    } else if (r.tipo === "por_veiculo" || r.tipo === "por_chip") {
      const qtd = r.tipo === "por_veiculo" ? c.veiculos(r.filtro) : c.chips(r.filtro);
      const cobravel = Math.max(qtd, r.minimo ?? 0);
      itens.push({
        descricao: r.descricao || (r.tipo === "por_veiculo" ? "Veículos ativos" : "Linhas de chip ativas") + (r.filtro ? ` (${r.filtro})` : ""),
        quantidade: cobravel, unitario: r.valor_unit, subtotal: r2(cobravel * r.valor_unit),
        fonte: `${qtd} no GSystem (espelho do Estoque)${r.minimo && qtd < r.minimo ? `; mínimo contratado ${r.minimo}` : ""}`,
      });
    } else {
      const qtd = c.servicos(r.canal ?? "todos");
      for (const t of ["instalacao", "retirada", "manutencao"] as TipoServico[]) {
        const preco = r.precos[t];
        if (!preco) continue;
        itens.push({ descricao: `${SERVICO_LABEL[t]}${r.descricao ? ` — ${r.descricao}` : ""}`, quantidade: qtd[t], unitario: preco, subtotal: r2(qtd[t] * preco), fonte: `serviços técnicos concluídos em ${mes.split("-").reverse().join("/")} (${CANAL_LABEL[r.canal ?? "todos"].toLowerCase()})` });
      }
    }
  }
  return { total: r2(itens.reduce((s, i) => s + i.subtotal, 0)), itens };
}

export type StatusConferencia = "ok" | "acima" | "abaixo" | "sem_regra";
export function conferirCobranca(valor: number, esperado: number | null, tolPct: number): { status: StatusConferencia; diferenca: number | null; pct: number | null } {
  if (esperado == null || esperado <= 0) return { status: "sem_regra", diferenca: null, pct: null };
  const dif = r2(valor - esperado);
  const pct = r2((dif / esperado) * 100);
  return { status: Math.abs(pct) <= tolPct ? "ok" : dif > 0 ? "acima" : "abaixo", diferenca: dif, pct };
}

/** Aumento em relação à média das últimas cobranças do mesmo fornecedor (evidência de alteração de valor). */
export function aumentoVsAnteriores(valor: number, anteriores: number[], tolPct: number): { media: number; pct: number; aumentou: boolean } | null {
  const v = anteriores.filter((x) => Number(x) > 0).slice(0, 6);
  if (!v.length) return null;
  const media = r2(v.reduce((s, x) => s + x, 0) / v.length);
  const pct = r2(((valor - media) / media) * 100);
  return { media, pct, aumentou: pct > tolPct };
}

// ------------------------------------------------------------------ fornecedor pelo documento ou remetente
export type FornecedorBase = { id: string; documento: string | null; emails: string[] | null; ativo?: boolean };
export function acharFornecedor<T extends FornecedorBase>(lista: T[], documento: string | null | undefined, remetente: string | null | undefined): T | null {
  const doc = soDigitos(documento);
  const ativos = lista.filter((f) => f.ativo !== false);
  if (doc.length >= 11) {
    const porDoc = ativos.find((f) => soDigitos(f.documento) === doc) ?? (doc.length === 14 ? ativos.find((f) => soDigitos(f.documento).slice(0, 8) === doc.slice(0, 8)) : undefined);
    if (porDoc) return porDoc;
  }
  const email = String(remetente || "").trim().toLowerCase();
  if (email.includes("@")) {
    const dominio = email.slice(email.indexOf("@"));
    for (const f of ativos) {
      for (const e of f.emails || []) {
        const x = e.trim().toLowerCase();
        if (!x) continue;
        if (x === email || (x.startsWith("@") && x === dominio) || (!x.includes("@") && dominio === `@${x}`)) return f;
      }
    }
  }
  return null;
}

// ------------------------------------------------------------------ XML de NF-e / NFS-e
export type NotaXml = {
  tipo: "nfe" | "nfse";
  chave: string | null;
  numero: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  destinatario_cnpj: string | null;
  valor: number;
  emissao: string | null;
  vencimentos: { data: string; valor: number }[];
};

const tag = (xml: string, nome: string) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, "i"));
  return m ? m[1].trim() : null;
};
const bloco = (xml: string, nomes: string[]) => { for (const n of nomes) { const b = tag(xml, n); if (b) return b; } return null; };
const num = (s: string | null) => (s == null ? 0 : Number(s.replace(",", ".")) || 0);
const dataIso = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

/** Lê os dados de cobrança de um XML de NF-e (modelo 55) ou NFS-e (padrão nacional ou ABRASF). */
export function lerXmlNota(xml: string): NotaXml | null {
  if (!xml || !/<\/?(\w+:)?(infNFe|NFe|nfeProc)\b/i.test(xml) && !/nfse|InfNfse|CompNfse/i.test(xml)) return null;
  if (/<(\w+:)?infNFe\b/i.test(xml)) {
    const id = xml.match(/<(?:\w+:)?infNFe[^>]*\bId="NFe(\d{44})"/i)?.[1] ?? null;
    const emit = tag(xml, "emit") ?? "";
    const dest = tag(xml, "dest") ?? "";
    const ide = tag(xml, "ide") ?? "";
    const total = tag(xml, "ICMSTot") ?? "";
    const vencimentos = [...xml.matchAll(/<(?:\w+:)?dup>([\s\S]*?)<\/(?:\w+:)?dup>/gi)]
      .map((m) => ({ data: dataIso(tag(m[1], "dVenc")) ?? "", valor: num(tag(m[1], "vDup")) }))
      .filter((d) => d.data);
    return {
      tipo: "nfe", chave: id, numero: tag(ide, "nNF"),
      emitente_cnpj: soDigitos(tag(emit, "CNPJ") ?? tag(emit, "CPF")) || null, emitente_nome: tag(emit, "xNome"),
      destinatario_cnpj: soDigitos(tag(dest, "CNPJ") ?? tag(dest, "CPF")) || null,
      valor: num(tag(total, "vNF")), emissao: dataIso(tag(ide, "dhEmi") ?? tag(ide, "dEmi")), vencimentos,
    };
  }
  // NFS-e padrão nacional (infNFSe/emit/valores) ou ABRASF (InfNfse/PrestadorServico/ValoresNfse)
  const nacional = /<(\w+:)?infNFSe\b/.test(xml); // ABRASF usa "InfNfse" (outra grafia)
  if (nacional) {
    const id = xml.match(/<(?:\w+:)?infNFSe[^>]*\bId="NFS(\w+)"/i)?.[1] ?? null;
    const emit = tag(xml, "emit") ?? "";
    const toma = tag(xml, "toma") ?? "";
    const valores = tag(xml, "valores") ?? "";
    return {
      tipo: "nfse", chave: id, numero: tag(xml, "nNFSe"),
      emitente_cnpj: soDigitos(tag(emit, "CNPJ") ?? tag(emit, "CPF")) || null, emitente_nome: tag(emit, "xNome"),
      destinatario_cnpj: soDigitos(tag(toma, "CNPJ") ?? tag(toma, "CPF")) || null,
      valor: num(tag(valores, "vLiq") ?? tag(xml, "vServ")), emissao: dataIso(tag(xml, "dhProc") ?? tag(xml, "dhEmi")), vencimentos: [],
    };
  }
  const inf = bloco(xml, ["InfNfse", "infNfse"]);
  if (!inf) return null;
  const prest = bloco(inf, ["PrestadorServico", "Prestador"]) ?? "";
  const tomador = bloco(xml, ["TomadorServico", "Tomador"]) ?? "";
  const valores = bloco(inf, ["ValoresNfse"]) ?? bloco(xml, ["Valores"]) ?? "";
  return {
    tipo: "nfse", chave: tag(inf, "CodigoVerificacao"), numero: tag(inf, "Numero"),
    emitente_cnpj: soDigitos(tag(prest, "Cnpj") ?? tag(prest, "Cpf")) || null, emitente_nome: tag(prest, "RazaoSocial"),
    destinatario_cnpj: soDigitos(tag(tomador, "Cnpj") ?? tag(tomador, "Cpf")) || null,
    valor: num(tag(valores, "ValorLiquidoNfse") ?? tag(valores, "ValorServicos")), emissao: dataIso(tag(inf, "DataEmissao")), vencimentos: [],
  };
}

// ------------------------------------------------------------------ DDA (lista exportada do banco)
export type ItemDda = { beneficiario: string; documento: string | null; vencimento: string | null; valor: number; linha: string | null; chave: string };

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const COLS_DDA: Record<keyof Omit<ItemDda, "chave">, string[]> = {
  beneficiario: ["beneficiario", "cedente", "favorecido", "emissor", "sacador", "razao social"],
  documento: ["cnpj", "cpf/cnpj", "cnpj/cpf", "documento", "cpf"],
  vencimento: ["vencimento", "data de vencimento", "dt venc", "venc"],
  valor: ["valor", "valor do titulo", "valor nominal", "valor documento", "valor (r$)"],
  linha: ["linha digitavel", "codigo de barras", "cod barras", "codigo barras", "linha"],
};

const dataBr = (v: unknown): string | null => {
  if (typeof v === "number" && v > 20000 && v < 80000) { // número de série do Excel
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const t = String(v ?? "").trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
export const valorBr = (v: unknown): number => {
  if (typeof v === "number") return Math.abs(v);
  const t = String(v ?? "").replace(/[^\d,.-]/g, "");
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

/** Lê a planilha do DDA (primeira linha com cabeçalho reconhecido) e devolve os boletos. */
export function lerPlanilhaDda(matriz: unknown[][]): { itens: ItemDda[]; cabecalho: Record<string, number> | null } {
  for (let h = 0; h < Math.min(matriz.length, 15); h++) {
    const cab = (matriz[h] || []).map(norm);
    const idx: Record<string, number> = {};
    for (const [campo, nomes] of Object.entries(COLS_DDA)) {
      const i = cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
      if (i >= 0) idx[campo] = i;
    }
    if (idx.valor == null || idx.vencimento == null || (idx.beneficiario == null && idx.linha == null)) continue;
    const itens: ItemDda[] = [];
    for (const row of matriz.slice(h + 1)) {
      if (!row || !row.length) continue;
      const valor = valorBr(row[idx.valor]);
      const venc = dataBr(row[idx.vencimento]);
      if (!valor || !venc) continue;
      const linha = idx.linha != null ? soDigitos(row[idx.linha]) || null : null;
      const documento = idx.documento != null ? soDigitos(row[idx.documento]) || null : null;
      const beneficiario = idx.beneficiario != null ? String(row[idx.beneficiario] ?? "").trim() : "";
      itens.push({ beneficiario, documento, vencimento: venc, valor, linha, chave: chaveDda({ linha, documento, vencimento: venc, valor, beneficiario }) });
    }
    return { itens, cabecalho: idx };
  }
  return { itens: [], cabecalho: null };
}

export function chaveDda(i: { linha: string | null; documento: string | null; vencimento: string | null; valor: number; beneficiario?: string }): string {
  if (i.linha && i.linha.length >= 44) return `ld:${i.linha}`;
  return `dv:${i.documento || norm(i.beneficiario).slice(0, 40)}:${i.vencimento}:${i.valor.toFixed(2)}`;
}

type LancDda = { id: string; status: string; tipo: string; valor: number; vencimento: string | null; linha_digitavel: string | null; documento_contraparte: string | null; dda_chave?: string | null; tipo_documento?: string | null };
const diasEntre = (a: string, b: string) => Math.abs(Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000));

/**
 * Casa os boletos do DDA com as contas a pagar: pela linha digitável; senão pelo CNPJ + valor + vencimento (±3 dias).
 * Devolve os casados, os boletos do DDA sem cobrança no sistema e os boletos lançados (de e-mail) que não estão no DDA.
 */
export function casarDda<L extends LancDda>(dda: ItemDda[], lancs: L[]) {
  const abertos = lancs.filter((l) => l.tipo === "pagar" && l.status !== "cancelado");
  const usados = new Set<string>();
  const casados: { item: ItemDda; lanc: L }[] = [];
  const semCobranca: ItemDda[] = [];
  for (const it of dda) {
    let l = it.linha ? abertos.find((x) => !usados.has(x.id) && soDigitos(x.linha_digitavel) === it.linha) : undefined;
    if (!l) l = abertos.find((x) => !usados.has(x.id) && x.dda_chave === it.chave);
    if (!l && it.vencimento) {
      l = abertos.find((x) => !usados.has(x.id) && Math.abs(x.valor - it.valor) < 0.01 && x.vencimento && diasEntre(x.vencimento, it.vencimento!) <= 3
        && (!it.documento || !x.documento_contraparte || soDigitos(x.documento_contraparte).slice(0, 8) === it.documento.slice(0, 8)));
    }
    if (l) { usados.add(l.id); casados.push({ item: it, lanc: l }); } else semCobranca.push(it);
  }
  const venc = dda.map((i) => i.vencimento!).filter(Boolean).sort();
  const de = venc[0], ate = venc[venc.length - 1];
  const foraDoDda = de ? abertos.filter((l) => l.status === "aberto" && !usados.has(l.id) && (l.tipo_documento === "boleto" || !!l.linha_digitavel)
    && l.vencimento && l.vencimento >= de && l.vencimento <= ate) : [];
  return { casados, semCobranca, foraDoDda };
}
