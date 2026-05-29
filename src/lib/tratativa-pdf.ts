import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo-online-rastreamento.png";

export type AlarmeRow = {
  data_hora: string | null;
  latitude: string | null;
  longitude: string | null;
  velocidade: string | null;
};

export type TratativaPDFInput = {
  categoria: "telemetria" | "fadiga";
  numero_ocorrencia: string;
  situacao?: string | null;
  cliente?: string | null;
  identificador?: string | null;
  imei?: string | null;
  tipo?: string | null;
  responsavel_email?: string | null;
  data_tratativa?: string | null;
  primeiro_alarme?: string | null;
  ultimo_alarme?: string | null;
  motorista_nome?: string | null;
  motorista_situacao?: string | null;
  motorista_observacoes?: string | null;
  alarmes?: AlarmeRow[];
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const fmtDateTimeShort = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("pt-BR")}\n${d.toLocaleTimeString("pt-BR")}`;
  } catch {
    return iso;
  }
};

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateTratativaPDF(t: TratativaPDFInput): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Logo
  const logo = await loadLogoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 30, 110, 55);
    } catch {
      /* ignore */
    }
  }

  // Right-side header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  const exportedAt = fmtDateTime(new Date().toISOString());
  doc.text(`Data de Exportação: ${exportedAt}`, pageW - margin, 45, { align: "right" });
  doc.text(`Nº da Ocorrência: ${t.numero_ocorrencia || "—"}`, pageW - margin, 60, {
    align: "right",
  });
  doc.text(
    `Categoria: ${t.categoria === "fadiga" ? "Fadiga" : "Telemetria"}`,
    pageW - margin,
    75,
    { align: "right" },
  );

  let cursorY = 110;
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes da Ocorrência:", margin, cursorY);
  cursorY += 8;

  autoTable(doc, {
    startY: cursorY,
    head: [["Situação", "Cliente", "Identificador", "IMEI", "Tipo"]],
    body: [
      [
        t.situacao || "—",
        t.cliente || "—",
        t.identificador || "—",
        t.imei || "—",
        t.tipo || "—",
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 12,
    head: [["Responsável Tratativa", "Data da Tratativa", "Primeiro Alarme", "Último Alarme"]],
    body: [
      [
        t.responsavel_email || "—",
        fmtDateTimeShort(t.data_tratativa),
        fmtDateTimeShort(t.primeiro_alarme),
        fmtDateTimeShort(t.ultimo_alarme),
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  // Alarmes
  let y = (doc as any).lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Alarmes:", margin, y);
  y += 8;

  const alarmes = (t.alarmes || []).filter(
    (a) => a.data_hora || a.latitude || a.longitude || a.velocidade,
  );

  autoTable(doc, {
    startY: y,
    head: [["Data / Hora", "Latitude", "Longitude", "Velocidade"]],
    body:
      alarmes.length > 0
        ? alarmes.map((a) => [
            fmtDateTimeShort(a.data_hora),
            a.latitude || "—",
            a.longitude || "—",
            a.velocidade || "—",
          ])
        : [["—", "—", "—", "—"]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });

  // Motorista
  y = (doc as any).lastAutoTable.finalY + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Motorista", margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Motorista", "Situação", "Observações"]],
    body: [
      [
        t.motorista_nome || "Não Definido",
        t.motorista_situacao || "—",
        t.motorista_observacoes || "—",
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    columnStyles: { 2: { cellWidth: 260 } },
    margin: { left: margin, right: margin },
  });

  // Assinaturas — fixar próximo do rodapé se houver espaço, senão logo abaixo
  const pageH = doc.internal.pageSize.getHeight();
  let signY = (doc as any).lastAutoTable.finalY + 80;
  if (signY > pageH - 80) {
    doc.addPage();
    signY = 120;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text("Responsável da Tratativa:", margin, signY);
  doc.text("Motorista Apontado:", pageW / 2 + 10, signY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Assinatura _____________________________", margin, signY + 30);
  doc.text("Assinatura _____________________________", pageW / 2 + 10, signY + 30);

  const safeNumero = (t.numero_ocorrencia || "sem-numero").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  doc.save(`tratativa-${safeNumero}-${today}.pdf`);
}
