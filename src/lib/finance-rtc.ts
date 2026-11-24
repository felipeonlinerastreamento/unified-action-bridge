/**
 * Reforma tributária do consumo (CBS/IBS) nas notas de fornecedores — leitura do XML e conferência.
 * Empresa no Lucro Real: CBS e IBS destacados nas compras viram CRÉDITO (não cumulatividade), então
 * cada nota recebida guarda o valor de crédito e a conferência da conta (base × alíquota = valor).
 * Lê os grupos IBSCBS da NF-e/NFC-e (NT 2025.002) e da NFS-e nacional; tolerante a prefixos e a
 * campos ausentes. Não decide a classificação tributária (cClassTrib/CST): isso é do emitente/contador.
 * Regras puras, testadas em finance-rtc.test.ts.
 */

export type ItemRtc = {
  cst: string | null;
  cClassTrib: string | null;
  base: number;
  pCBS: number | null;
  vCBS: number;
  pIBSUF: number | null;
  vIBSUF: number;
  pIBSMun: number | null;
  vIBSMun: number;
};

export type Divergencia = { item: number; tributo: "CBS" | "IBS UF" | "IBS Mun"; esperado: number; informado: number };

export type TributosRtc = {
  base: number;
  cbs: number;
  ibs: number;
  ibs_uf: number;
  ibs_mun: number;
  itens: ItemRtc[];
  classificacoes: string[];
  divergencias: Divergencia[];
};

const tag = (xml: string, nome: string) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, "i"));
  return m ? m[1].trim() : null;
};
const todos = (xml: string, nome: string) =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, "gi"))].map((m) => m[1]);
const n = (v: string | null | undefined) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const nOuNull = (v: string | null | undefined) => (v == null || v === "" ? null : n(v));
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Tolerância de arredondamento por tributo/item (R$). */
export const TOLERANCIA_RTC = 0.05;

/** Alíquota efetiva: usa a efetiva informada (com redução) quando existir. */
function aliquota(grupo: string, sufixo: "CBS" | "IBSUF" | "IBSMun"): number | null {
  return nOuNull(tag(grupo, `pAliqEfet${sufixo}`)) ?? nOuNull(tag(grupo, `pAliqEfet`)) ?? nOuNull(tag(grupo, `p${sufixo}`));
}

/** Lê CBS/IBS do XML. Devolve null quando a nota não traz os grupos da reforma. */
export function lerTributosRtc(xml: string): TributosRtc | null {
  if (!xml || !/IBSCBS/i.test(xml)) return null;
  // Grupos por item (NF-e: det/imposto/IBSCBS). Ignora o bloco de totais (IBSCBSTot).
  const blocos = todos(xml.replace(/<(?:\w+:)?IBSCBSTot[\s\S]*?<\/(?:\w+:)?IBSCBSTot>/gi, ""), "IBSCBS");
  const itens: ItemRtc[] = blocos.map((b) => {
    const g = tag(b, "gIBSCBS") ?? b;
    const uf = tag(g, "gIBSUF") ?? "";
    const mun = tag(g, "gIBSMun") ?? "";
    const cbs = tag(g, "gCBS") ?? "";
    return {
      cst: tag(b, "CST"),
      cClassTrib: tag(b, "cClassTrib"),
      base: n(tag(g, "vBC")),
      pCBS: aliquota(cbs, "CBS"),
      vCBS: n(tag(cbs, "vCBS")),
      pIBSUF: aliquota(uf, "IBSUF"),
      vIBSUF: n(tag(uf, "vIBSUF")),
      pIBSMun: aliquota(mun, "IBSMun"),
      vIBSMun: n(tag(mun, "vIBSMun")),
    };
  });

  // Totais: prefere o bloco de totais da nota; senão soma os itens.
  const tot = tag(xml, "IBSCBSTot");
  const soma = (k: keyof ItemRtc) => r2(itens.reduce((s, i) => s + (Number(i[k]) || 0), 0));
  let base = soma("base"), cbs = soma("vCBS"), ibsUf = soma("vIBSUF"), ibsMun = soma("vIBSMun");
  if (tot) {
    base = n(tag(tot, "vBCIBSCBS")) || base;
    const gCbs = tag(tot, "gCBS"); if (gCbs) cbs = n(tag(gCbs, "vCBS"));
    const gIbs = tag(tot, "gIBS") ?? "";
    const gUf = tag(gIbs, "gIBSUF"); if (gUf) ibsUf = n(tag(gUf, "vIBSUF"));
    const gMun = tag(gIbs, "gIBSMun"); if (gMun) ibsMun = n(tag(gMun, "vIBSMun"));
  }
  const ibsTot = tot ? n(tag(tag(tot, "gIBS") ?? "", "vIBS")) : 0;

  const divergencias: Divergencia[] = [];
  itens.forEach((i, idx) => {
    const conferir = (tributo: Divergencia["tributo"], p: number | null, v: number) => {
      if (p == null || !i.base) return;
      const esperado = r2((i.base * p) / 100);
      if (Math.abs(esperado - v) > TOLERANCIA_RTC) divergencias.push({ item: idx + 1, tributo, esperado, informado: r2(v) });
    };
    conferir("CBS", i.pCBS, i.vCBS);
    conferir("IBS UF", i.pIBSUF, i.vIBSUF);
    conferir("IBS Mun", i.pIBSMun, i.vIBSMun);
  });

  const classificacoes = [...new Set(itens.map((i) => [i.cst, i.cClassTrib].filter(Boolean).join("/")).filter(Boolean))];
  return {
    base: r2(base), cbs: r2(cbs), ibs_uf: r2(ibsUf), ibs_mun: r2(ibsMun),
    ibs: r2(ibsTot || ibsUf + ibsMun), itens, classificacoes, divergencias,
  };
}

/** Texto curto para evidência/observação. */
export function resumoRtc(t: TributosRtc): string {
  const base = `Base R$ ${t.base.toFixed(2)} · CBS R$ ${t.cbs.toFixed(2)} · IBS R$ ${t.ibs.toFixed(2)}`;
  if (!t.divergencias.length) return base;
  return `${base} · ${t.divergencias.length} divergência(s): ` +
    t.divergencias.slice(0, 5).map((d) => `item ${d.item} ${d.tributo} informado R$ ${d.informado.toFixed(2)}, esperado R$ ${d.esperado.toFixed(2)}`).join("; ");
}
