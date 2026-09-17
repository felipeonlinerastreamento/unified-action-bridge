import { formatDateTime, osPhotos, pick } from "./shared";

async function loadImage(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("img"));
      img.src = dataUrl;
    });
    return { dataUrl, ...size };
  } catch {
    return null;
  }
}

/** Gera o PDF completo da OS (dados, descrição, histórico e fotos). */
export async function gerarPdfOsCompleta(activity: any, history: any[] = []) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 48;
  const right = 547;
  const maxY = 780;
  let y = 60;

  const identifier = pick(activity, ["identifier", "code", "os"], "—");

  const ensureSpace = (needed: number) => {
    if (y + needed > maxY) {
      doc.addPage();
      y = 60;
    }
  };

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Ordem de Serviço", left, y);
  y += 10;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 24;

  doc.setFontSize(11);
  const fields: [string, string][] = [
    ["Identificador", identifier],
    ["Título", pick(activity, ["title", "serviceTypeName", "serviceType"], "—")],
    ["Status", pick(activity, ["statusName", "status"], "—")],
    ["Cliente", pick(activity, ["clientName", "client", "companyName"], "—")],
    ["Técnico", pick(activity, ["technicianName", "technician"], "Sem técnico")],
    ["Tipo de OS", pick(activity, ["serviceTypeName", "serviceType"], "—")],
    ["Agendamento", formatDateTime(activity?.scheduledAt)],
    ["Duração estimada", `${activity?.durationMinutes || 60} min`],
    ["Endereço", pick(activity, ["address", "endereco"], "—")],
    ["Criada em", formatDateTime(activity?.createdAt)],
  ];

  for (const [label, value] of fields) {
    const text = doc.splitTextToSize(String(value || "—"), 360) as string[];
    ensureSpace(text.length * 14 + 8);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(text, left + 110, y);
    y += Math.max(22, text.length * 14 + 6);
  }

  const description = pick(activity, ["description", "observacao", "notes"], "");
  if (description) {
    ensureSpace(40);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("Descrição:", left, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    const body = doc.splitTextToSize(description, 470) as string[];
    for (const line of body) {
      ensureSpace(16);
      doc.text(line, left, y);
      y += 14;
    }
  }

  if (history.length > 0) {
    ensureSpace(48);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Histórico da OS", left, y);
    doc.setFontSize(11);
    y += 18;
    for (const h of history) {
      const title = pick(h, ["action", "event", "status", "title"], "Evento");
      const when = formatDateTime(h?.createdAt || h?.date || h?.at);
      const detail = pick(h, ["description", "notes", "message"], "");
      const author = pick(h, ["actorName", "userName", "user", "author"], "");
      ensureSpace(46);
      doc.setFont("helvetica", "bold");
      doc.text(`${when} — ${title}`, left, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      if (detail) {
        const lines = doc.splitTextToSize(detail, 470) as string[];
        for (const line of lines) {
          ensureSpace(16);
          doc.text(line, left + 10, y);
          y += 13;
        }
      }
      if (author) {
        ensureSpace(16);
        doc.setTextColor(120);
        doc.text(`por ${author}`, left + 10, y);
        doc.setTextColor(0);
        y += 14;
      }
      y += 6;
    }
  }

  const photos = osPhotos(activity);
  if (photos.length > 0) {
    doc.addPage();
    y = 60;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Fotos da OS (${photos.length})`, left, y);
    doc.setFontSize(11);
    y += 20;
    for (const photo of photos) {
      const img = await loadImage(photo.url);
      if (!img) continue;
      const width = Math.min(360, right - left);
      const height = Math.max(60, (img.height / img.width) * width);
      ensureSpace(height + 26);
      try {
        doc.addImage(img.dataUrl, left, y, width, height);
      } catch {
        continue;
      }
      y += height + 6;
      if (photo.caption) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120);
        doc.text(doc.splitTextToSize(photo.caption, width) as string[], left, y);
        doc.setTextColor(0);
        y += 14;
      }
      y += 10;
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, left, 800);
  doc.save(`OS-${identifier !== "—" ? identifier : activity?.id || "detalhe"}.pdf`);
}
