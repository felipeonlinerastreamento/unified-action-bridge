import { jsPDF } from "jspdf";
import { format } from "date-fns";
import logoUrl from "@/assets/logo-online-rastreamento.png";

export type PdfField = { label: string; value: string };

export type PdfAlarm = {
  dataHora: string;
  latitude: string;
  longitude: string;
  velocidade: string;
};

export type TreatmentPdfPayload = {
  occurrenceNumber: string;
  situacao: string;
  cliente: string;
  identificador: string;
  imei: string;
  tipo: string;
  responsavelTratativa: string;
  dataTratativa: Date;
  primeiroAlarme: Date;
  ultimoAlarme: Date;
  alarmes: PdfAlarm[];
  motorista: string;
  motoristaSituacao: string;
  observacoes: string;
  eventIdShort: string;
  /** Responsável e data da análise mais recente do evento */
  responsavelAnalise?: string;
  dataAnalise?: Date;
  /** Cerca / ponto de controle associado ao evento */
  pontoControle?: string;
  /** Frota do veículo no momento da tratativa (histórico) */
  frota?: string;
  localAtuacao?: string;
  responsavelFrota?: string;
};

// Legacy signature kept for backwards-compat callers
type LegacyPdfArgs = {
  fields: PdfField[];
  treatment: { description: string; status: string; createdAt: Date; author?: string | null };
  eventIdShort: string;
};

const PAGE_MARGIN = 32;
const CARD_RADIUS = 6;
const HEADER_FILL: [number, number, number] = [225, 225, 228];
const CARD_BORDER: [number, number, number] = [210, 210, 215];

let cachedLogo: string | null = null;
async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        cachedLogo = String(r.result);
        resolve(cachedLogo);
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmt(d: Date) {
  return format(d, "dd/MM/yyyy HH:mm:ss");
}

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setDrawColor(...CARD_BORDER);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, h, CARD_RADIUS, CARD_RADIUS, "S");
}

function drawHeaderRow(
  doc: jsPDF,
  x: number,
  y: number,
  colWidths: number[],
  labels: string[],
  rowHeight = 18,
) {
  doc.setFillColor(...HEADER_FILL);
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(40);
  let cx = x;
  labels.forEach((label, i) => {
    const lines = doc.splitTextToSize(label, colWidths[i] - 10);
    doc.text(lines, cx + 6, y + 12);
    cx += colWidths[i];
  });
}

function drawValueRow(
  doc: jsPDF,
  x: number,
  y: number,
  colWidths: number[],
  values: string[],
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30);
  let maxLines = 1;
  const wrapped = values.map((v, i) => {
    const lines = doc.splitTextToSize(v || "—", colWidths[i] - 10);
    if (lines.length > maxLines) maxLines = lines.length;
    return lines as string[];
  });
  const rowHeight = Math.max(20, maxLines * 11 + 8);
  let cx = x;
  wrapped.forEach((lines, i) => {
    doc.text(lines, cx + 6, y + 12);
    cx += colWidths[i];
  });
  return rowHeight;
}

function splitWidths(total: number, ratios: number[]): number[] {
  const sum = ratios.reduce((a, b) => a + b, 0);
  return ratios.map((r) => (r / sum) * total);
}

function normalizePayload(payload: TreatmentPdfPayload | LegacyPdfArgs): TreatmentPdfPayload {
  return "occurrenceNumber" in payload
    ? payload
    : {
        occurrenceNumber: payload.eventIdShort,
        situacao: "—",
        cliente: "—",
        identificador: "—",
        imei: "—",
        tipo: "—",
        responsavelTratativa: payload.treatment.author ?? "—",
        dataTratativa: payload.treatment.createdAt,
        primeiroAlarme: payload.treatment.createdAt,
        ultimoAlarme: payload.treatment.createdAt,
        alarmes: [],
        motorista: "Não Definido",
        motoristaSituacao: "—",
        observacoes: payload.treatment.description,
        eventIdShort: payload.eventIdShort,
      };
}

function drawTreatmentPdf(doc: jsPDF, data: TreatmentPdfPayload, logo: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  let y = PAGE_MARGIN;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", PAGE_MARGIN, y, 110, 55);
    } catch {
      /* ignore */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  const headerRight = pageWidth - PAGE_MARGIN;
  doc.text(`Data de Exportação: ${fmt(new Date())}`, headerRight, y + 22, { align: "right" });
  doc.text(`Nº da Ocorrência: ${data.occurrenceNumber}`, headerRight, y + 42, { align: "right" });

  y += 75;

  const cardX = PAGE_MARGIN;
  const cardInnerPad = 12;
  const innerX = cardX + cardInnerPad;
  const innerW = contentWidth - cardInnerPad * 2;

  let cardStartY = y;
  let cy = cardStartY + cardInnerPad;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Detalhes da Ocorrência:", innerX, cy + 4);
  cy += 18;

  const r1 = splitWidths(innerW, [1, 1.4, 1.2, 1.4, 1]);
  drawHeaderRow(doc, innerX, cy, r1, ["Situação", "Cliente", "Identificador", "IMEI", "Tipo"]);
  cy += 18;
  const r1h = drawValueRow(doc, innerX, cy, r1, [
    data.situacao,
    data.cliente,
    data.identificador,
    data.imei,
    data.tipo,
  ]);
  cy += r1h;

  const r2 = splitWidths(innerW, [1.6, 1.2, 1.1, 1.1]);
  drawHeaderRow(doc, innerX, cy, r2, [
    "Responsável Tratativa",
    "Data da Tratativa",
    "Primeiro Alarme",
    "Último Alarme",
  ]);
  cy += 18;
  const r2h = drawValueRow(doc, innerX, cy, r2, [
    data.responsavelTratativa,
    fmt(data.dataTratativa),
    fmt(data.primeiroAlarme),
    fmt(data.ultimoAlarme),
  ]);
  cy += r2h;

  const r2b = splitWidths(innerW, [1.4, 1.4, 1.2]);
  drawHeaderRow(doc, innerX, cy, r2b, ["Ponto de Controle", "Responsável Análise", "Data da Análise"]);
  cy += 18;
  const r2bh = drawValueRow(doc, innerX, cy, r2b, [
    data.pontoControle || "—",
    data.responsavelAnalise || "—",
    data.dataAnalise ? fmt(data.dataAnalise) : "—",
  ]);
  cy += r2bh;

  if (data.frota || data.localAtuacao || data.responsavelFrota) {
    const r3 = splitWidths(innerW, [1.2, 1.4, 1.6]);
    drawHeaderRow(doc, innerX, cy, r3, ["Frota", "Local de Atuação", "Responsável(is) pela Frota"]);
    cy += 18;
    const r3h = drawValueRow(doc, innerX, cy, r3, [
      data.frota || "—",
      data.localAtuacao || "—",
      data.responsavelFrota || "—",
    ]);
    cy += r3h;
  }

  cy += cardInnerPad;

  drawCard(doc, cardX, cardStartY, contentWidth, cy - cardStartY);
  y = cy + 14;

  cardStartY = y;
  cy = cardStartY + cardInnerPad;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Alarmes:", innerX, cy + 4);
  cy += 18;
  const ra = splitWidths(innerW, [1.3, 1.3, 1.3, 1]);
  drawHeaderRow(doc, innerX, cy, ra, ["Data / Hora", "Latitude", "Longitude", "Velocidade"]);
  cy += 18;
  const alarms = data.alarmes.length
    ? data.alarmes
    : [{ dataHora: "—", latitude: "—", longitude: "—", velocidade: "—" }];
  for (const a of alarms) {
    const h = drawValueRow(doc, innerX, cy, ra, [a.dataHora, a.latitude, a.longitude, a.velocidade]);
    cy += h;
  }
  cy += cardInnerPad - 4;
  drawCard(doc, cardX, cardStartY, contentWidth, cy - cardStartY);
  y = cy + 14;

  cardStartY = y;
  cy = cardStartY + cardInnerPad;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Motorista", innerX, cy + 4);
  cy += 18;
  const rm = splitWidths(innerW, [1.2, 1, 2]);
  drawHeaderRow(doc, innerX, cy, rm, ["Motorista", "Situação", "Observações"]);
  cy += 18;
  const rmh = drawValueRow(doc, innerX, cy, rm, [
    data.motorista,
    data.motoristaSituacao,
    data.observacoes,
  ]);
  cy += rmh + cardInnerPad - 4;
  drawCard(doc, cardX, cardStartY, contentWidth, cy - cardStartY);
  y = cy + 14;

  cardStartY = y;
  cy = cardStartY + cardInnerPad;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  const colW = innerW / 2;
  doc.text("Responsável da Tratativa:", innerX, cy + 4);
  doc.text("Motorista Apontado:", innerX + colW, cy + 4);
  cy += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text("Assinatura ______________________________", innerX, cy + 4);
  doc.text("Assinatura ______________________________", innerX + colW, cy + 4);
  cy += 20;
  drawCard(doc, cardX, cardStartY, contentWidth, cy - cardStartY);
}

export async function generateTreatmentPdf(payload: TreatmentPdfPayload | LegacyPdfArgs) {
  const data = normalizePayload(payload);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const logo = await loadLogoDataUrl();
  drawTreatmentPdf(doc, data, logo);
  const filename = `tratativa-${data.eventIdShort}-${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(filename);
}

export async function generateCombinedTreatmentPdf(
  payloads: TreatmentPdfPayload[],
  filename?: string,
) {
  if (payloads.length === 0) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const logo = await loadLogoDataUrl();
  payloads.forEach((p, idx) => {
    if (idx > 0) doc.addPage();
    drawTreatmentPdf(doc, p, logo);
  });
  const name = filename ?? `tratativas-consolidadas-${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(name);
}

export type ReportSummary = {
  periodo: string;
  filtros: string;
  total: number;
  tratados: number;
  naoTratados: number;
  analisados: number;
  pendentesAnalise: number;
  porRisco: { label: string; count: number }[];
};

function pct(n: number, total: number) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : "0%";
}

export async function generateReportPdf(
  summary: ReportSummary,
  columns: string[],
  rows: string[][],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: columns.length > 6 ? "landscape" : "portrait" });
  const logo = await loadLogoDataUrl();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  const header = () => {
    let y = PAGE_MARGIN;
    if (logo) {
      try { doc.addImage(logo, "PNG", PAGE_MARGIN, y, 100, 50); } catch { /* ignore */ }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text("Relatório Operacional", pageWidth - PAGE_MARGIN, y + 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Exportado em ${fmt(new Date())}`, pageWidth - PAGE_MARGIN, y + 36, { align: "right" });
    y += 66;
    return y;
  };

  let y = header();
  // Resumo
  const cardStart = y;
  let cy = y + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Resumo do relatório", PAGE_MARGIN + 12, cy + 4);
  cy += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = [
    `Período: ${summary.periodo}`,
    `Filtros: ${summary.filtros}`,
    `Total de eventos: ${summary.total}`,
    `Tratados: ${summary.tratados} (${pct(summary.tratados, summary.total)})  ·  Não tratados: ${summary.naoTratados} (${pct(summary.naoTratados, summary.total)})`,
    `Analisados: ${summary.analisados} (${pct(summary.analisados, summary.total)})  ·  Pendente análise: ${summary.pendentesAnalise} (${pct(summary.pendentesAnalise, summary.total)})`,
    `Por grau de risco: ${summary.porRisco.map((r) => `${r.label}: ${r.count}`).join("  ·  ")}`,
  ];
  for (const l of lines) {
    const w = doc.splitTextToSize(l, contentWidth - 24) as string[];
    doc.text(w, PAGE_MARGIN + 12, cy);
    cy += w.length * 13;
  }
  cy += 6;
  drawCard(doc, PAGE_MARGIN, cardStart, contentWidth, cy - cardStart);
  y = cy + 16;

  // Tabela
  if (columns.length === 0) { doc.save(`relatorio-${format(new Date(), "yyyyMMdd_HHmm")}.pdf`); return; }
  const widths = columns.map(() => contentWidth / columns.length);
  const drawHead = () => { drawHeaderRow(doc, PAGE_MARGIN, y, widths, columns); y += 18; };
  drawHead();
  rows.forEach((r, i) => {
    doc.setFontSize(8.5);
    const maxLines = Math.max(1, ...r.map((v, j) => (doc.splitTextToSize(v || "—", widths[j] - 10) as string[]).length));
    const h = Math.max(20, maxLines * 11 + 8);
    if (y + h > pageHeight - PAGE_MARGIN) { doc.addPage(); y = header(); drawHead(); }
    if (i % 2 === 1) { doc.setFillColor(245, 245, 247); doc.rect(PAGE_MARGIN, y, contentWidth, h, "F"); }
    drawValueRow(doc, PAGE_MARGIN, y, widths, r);
    y += h;
  });
  doc.save(`relatorio-operacional-${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
