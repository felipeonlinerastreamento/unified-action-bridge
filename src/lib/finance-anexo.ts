/**
 * Nome e pasta dos anexos do Financeiro no Google Drive, no mesmo padrão dos comprovantes
 * lançados pela conversa: pasta "00-Comprovantes Gerais" › subpasta do mês (nov26) ›
 * FORNECEDOR_tipo_DDMM.ext. Testes em finance-anexo.test.ts.
 */
export const PASTA_COMPROVANTES_PADRAO = "10bZF4ba3aNuJHAE9VBLuoz7FqDI8au1l";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TIPO_CURTO: Record<string, string> = { nota_fiscal: "nf", cupom_fiscal: "cupom", boleto: "boleto", recibo: "recibo", guia: "guia", fatura: "fatura", outro: "doc" };

/** Subpasta do mês: "nov26". */
export function pastaDoMes(iso: string): string {
  const [a, m] = iso.slice(0, 7).split("-");
  return `${MESES[Number(m) - 1]}${a.slice(2)}`;
}

export function extensaoDe(nomeOriginal: string, mime: string): string {
  const m = nomeOriginal.match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (/pdf/.test(mime)) return "pdf";
  if (/png/.test(mime)) return "png";
  if (/jpe?g/.test(mime)) return "jpg";
  if (/xml/.test(mime)) return "xml";
  return "bin";
}

/** FORNECEDOR_tipo_DDMM.ext (fornecedor em maiúsculas, sem acento, espaço nem símbolo). */
export function nomeArquivoAnexo(d: { contraparte?: string | null; tipoDocumento?: string | null; data: string; nomeOriginal: string; mime: string }): string {
  const forn = (d.contraparte || "SEMFORNECEDOR").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40) || "SEMFORNECEDOR";
  const tipo = TIPO_CURTO[d.tipoDocumento ?? ""] ?? "doc";
  const ddmm = `${d.data.slice(8, 10)}${d.data.slice(5, 7)}`;
  return `${forn}_${tipo}_${ddmm}.${extensaoDe(d.nomeOriginal, d.mime)}`;
}
