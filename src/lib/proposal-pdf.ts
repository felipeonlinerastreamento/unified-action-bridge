import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import proposalTemplate from "@/assets/modelo-proposta-online-rastreamento.pdf.asset.json";

export type ProposalItem = {
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  activationValue: number;
  monthlyValue: number;
};

export type ProposalInput = {
  title: string;
  quoteNumber?: number | null;
  companyName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  cnpj?: string | null;
  ownerName?: string | null;
  notes?: string | null;
  items: ProposalItem[];
};

const INVESTMENT_PAGE_INDEX = 26;
const TABLE = {
  x: 78,
  top: 608,
  width: 1022,
  height: 330,
  headerHeight: 66,
  columns: [85, 362, 114, 120, 170, 171],
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const drawCenteredLines = (
  page: PDFPage,
  lines: string[],
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const lineHeight = size * 1.18;
  const firstBaseline = y + height / 2 + ((lines.length - 1) * lineHeight) / 2 - size * 0.34;
  lines.forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: x + Math.max(5, (width - textWidth) / 2),
      y: firstBaseline - index * lineHeight,
      size,
      font,
      color: rgb(0.04, 0.04, 0.04),
    });
  });
};

const drawInvestmentTable = async (pdf: PDFDocument, items: ProposalItem[]) => {
  if (items.length > 9) {
    throw new Error("O modelo comporta no máximo 9 itens na tabela de investimento.");
  }
  const page = pdf.getPages()[INVESTMENT_PAGE_INDEX];
  if (!page) throw new Error("O modelo da proposta não contém a página de investimento esperada.");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bottom = TABLE.top - TABLE.height;
  const lineColor = rgb(0.42, 0.42, 0.42);
  const background = rgb(0.87, 0.87, 0.87);

  // Remove apenas a tabela original; todo o restante do modelo permanece intacto.
  page.drawRectangle({ x: TABLE.x - 2, y: bottom - 2, width: TABLE.width + 4, height: TABLE.height + 4, color: background });

  const safeItems = items;
  const bodyHeight = TABLE.height - TABLE.headerHeight;
  const rowHeight = safeItems.length <= 4 ? 66 : bodyHeight / safeItems.length;
  const tableBottom = TABLE.top - TABLE.headerHeight - rowHeight * safeItems.length;

  page.drawRectangle({
    x: TABLE.x,
    y: tableBottom,
    width: TABLE.width,
    height: TABLE.top - tableBottom,
    borderColor: lineColor,
    borderWidth: 0.8,
  });

  let cursorX = TABLE.x;
  TABLE.columns.slice(0, -1).forEach((columnWidth) => {
    cursorX += columnWidth;
    page.drawLine({ start: { x: cursorX, y: tableBottom }, end: { x: cursorX, y: TABLE.top }, thickness: 0.8, color: lineColor });
  });

  const headerBottom = TABLE.top - TABLE.headerHeight;
  page.drawLine({ start: { x: TABLE.x, y: headerBottom }, end: { x: TABLE.x + TABLE.width, y: headerBottom }, thickness: 0.8, color: lineColor });
  safeItems.slice(0, -1).forEach((_, index) => {
    const y = headerBottom - rowHeight * (index + 1);
    page.drawLine({ start: { x: TABLE.x, y }, end: { x: TABLE.x + TABLE.width, y }, thickness: 0.8, color: lineColor });
  });

  const headers = ["Item", "Especificação", "Unidade", "Quantidade", "Ativação", "Mensalidade"];
  cursorX = TABLE.x;
  headers.forEach((header, index) => {
    const width = TABLE.columns[index] ?? 0;
    drawCenteredLines(page, wrapText(header, bold, 20, width - 10), bold, 20, cursorX, headerBottom, width, TABLE.headerHeight);
    cursorX += width;
  });

  const fontSize = safeItems.length <= 4 ? 18 : safeItems.length <= 6 ? 15 : 12;
  safeItems.forEach((item, rowIndex) => {
    const rowY = headerBottom - rowHeight * (rowIndex + 1);
    const cells = [
      String(rowIndex + 1),
      item.name,
      item.unit || "Serviço",
      String(item.quantity || 1),
      brl(Number(item.activationValue) || 0),
      brl(Number(item.monthlyValue) || 0),
    ];
    cursorX = TABLE.x;
    cells.forEach((cell, columnIndex) => {
      const width = TABLE.columns[columnIndex] ?? 0;
      const maxLines = Math.max(1, Math.floor((rowHeight - 8) / (fontSize * 1.18)));
      const lines = wrapText(cell, bold, fontSize, width - 12).slice(0, maxLines);
      drawCenteredLines(page, lines, bold, fontSize, cursorX, rowY, width, rowHeight);
      cursorX += width;
    });
  });

  // Keep the regular font embedded for consistent compatibility in PDF readers.
  void regular;
};

export async function generateProposalPDF(input: ProposalInput) {
  if (!input.items.length) throw new Error("Adicione ao menos um item à proposta.");

  const response = await fetch(proposalTemplate.url);
  if (!response.ok) throw new Error("Não foi possível carregar o modelo da proposta.");

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  await drawInvestmentTable(pdf, input.items);

  const slug = (input.companyName || input.contactName || "proposta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Proposta_Online_Rastreamento_${slug}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}