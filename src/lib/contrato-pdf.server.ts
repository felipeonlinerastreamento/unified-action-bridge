/**
 * Gera o PDF do contrato a partir do texto congelado (para enviar ao Autentique).
 * Usa pdf-lib com Helvetica (funciona no servidor sem navegador).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { htmlParaBlocos, textoSeguroPdf } from "@/lib/contratos";

export async function gerarPdfContrato(opts: { html: string; titulo: string; rodape: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.titulo);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [L, A] = [595.28, 841.89]; // A4
  const M = 56;
  const largura = L - 2 * M;
  let pagina = pdf.addPage([L, A]);
  let y = A - M;
  let nPag = 1;

  const rodape = () => {
    pagina.drawText(textoSeguroPdf(`${opts.rodape} — página ${nPag}`), { x: M, y: 28, size: 8, font: fonte, color: rgb(0.4, 0.4, 0.4) });
  };
  const novaPagina = () => { rodape(); pagina = pdf.addPage([L, A]); nPag++; y = A - M; };

  const quebrar = (texto: string, f: typeof fonte, tam: number): string[] => {
    const linhas: string[] = [];
    for (const par of texto.split("\n")) {
      let atual = "";
      for (const palavra of par.split(/\s+/).filter(Boolean)) {
        const teste = atual ? `${atual} ${palavra}` : palavra;
        if (f.widthOfTextAtSize(teste, tam) <= largura) { atual = teste; continue; }
        if (atual) linhas.push(atual);
        atual = palavra;
        while (f.widthOfTextAtSize(atual, tam) > largura) { // palavra maior que a linha (ex.: hash)
          let corte = atual.length - 1;
          while (corte > 1 && f.widthOfTextAtSize(atual.slice(0, corte), tam) > largura) corte--;
          linhas.push(atual.slice(0, corte));
          atual = atual.slice(corte);
        }
      }
      linhas.push(atual);
    }
    return linhas;
  };

  for (const b of htmlParaBlocos(opts.html)) {
    const f = b.tipo === "p" ? fonte : negrito;
    const tam = b.tipo === "h2" ? 13 : b.tipo === "h3" ? 10.5 : 10;
    const alt = tam * 1.4;
    if (b.tipo === "h2" && y < A - M) novaPagina(); // Anexo começa em página nova
    const linhas = quebrar(textoSeguroPdf(b.texto), f, tam);
    if (b.tipo !== "p" && y - alt * (linhas.length + 2) < M) novaPagina(); // título não fica sozinho no fim
    y -= b.tipo === "p" ? 2 : 8;
    for (const linha of linhas) {
      if (y - alt < M) novaPagina();
      const x = b.tipo === "h2" ? M + (largura - f.widthOfTextAtSize(linha, tam)) / 2 : M;
      pagina.drawText(linha, { x, y: y - tam, size: tam, font: f, color: rgb(0.07, 0.09, 0.15) });
      y -= alt;
    }
    y -= 4;
  }
  rodape();
  return pdf.save();
}
