import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo-online-rastreamento.png";

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

const EMPRESA = {
  nome: "ONLINE RASTREAMENTO EIRELI",
  cnpj: "CNPJ 22.632.188/0001-23",
  fone: "(31) 3623-2190",
  end: "Alameda Horacio Picorelli, 297, Jardim Encantado - Vespasiano/MG",
  site: "www.onlinerastreamento.com",
};

const INCLUSOS = [
  "Excesso de velocidade",
  "Funcionamento fora do horário",
  "Saída da regional",
  "Ignição parada superior a 10 min",
  "Parada em região não permitida",
  "Imobilizador remoto (opcional)",
  "Controle de manutenções",
  "Controle de abastecimento",
];

const DIFERENCIAIS: Array<[string, string]> = [
  ["Rastreamento em tempo real", "Localização precisa via GPS com chip multi-operadora 4G, acompanhada em mapa digital no computador ou no celular."],
  ["Alertas e notificações", "Alertas personalizados de manutenção, tempo de operação e cerca eletrônica (geofencing)."],
  ["Perfil de condução", "Sensores de aceleração, frenagem e velocidade para medir o comportamento do motorista."],
  ["Relatórios gerenciais", "Rastreamento, viagens, abastecimentos, manutenções, alertas e auditoria de acessos."],
  ["Controle de abastecimento", "Lançamento por app com foto do comprovante e análise de consumo."],
  ["Gestão de multas", "Acompanhamento de infrações, prazos e contestações, com até 40% de economia."],
  ["Suporte 24 horas", "Central de monitoramento 24x7 e equipe de recuperação em caso de roubo."],
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const loadLogo = async (): Promise<string | null> => {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export async function generateProposalPDF(input: ProposalInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const logo = await loadLogo();

  // ---------- Capa ----------
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, "F");
  if (logo) {
    try {
      doc.addImage(logo, "PNG", W / 2 - 70, 90, 140, 60, undefined, "FAST");
    } catch { /* ignore */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  doc.text("PROPOSTA", W / 2, 250, { align: "center" });
  doc.text("COMERCIAL", W / 2, 292, { align: "center" });

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(3);
  doc.line(W / 2 - 60, 312, W / 2 + 60, 312);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const cliente = input.companyName || input.contactName || "Cliente";
  doc.text(`Preparada para: ${cliente}`, W / 2, 360, { align: "center" });
  if (input.cnpj) doc.text(`CNPJ: ${input.cnpj}`, W / 2, 380, { align: "center" });
  doc.setFontSize(11);
  doc.text(
    new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
    W / 2,
    input.cnpj ? 402 : 382,
    { align: "center" }
  );

  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  const rodape = [EMPRESA.nome, EMPRESA.cnpj, `Telefone: ${EMPRESA.fone}`, EMPRESA.end, EMPRESA.site];
  rodape.forEach((l, i) => doc.text(l, W / 2, H - 120 + i * 16, { align: "center" }));

  // ---------- Página 2: apresentação ----------
  doc.addPage();
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Nossa solução de gestão de frotas", 48, 70);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(2);
  doc.line(48, 80, 200, 80);

  let y = 108;
  DIFERENCIAIS.forEach(([titulo, texto]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(titulo, 48, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(texto, W - 96);
    doc.text(lines, 48, y + 14);
    doc.setTextColor(15, 23, 42);
    y += 22 + lines.length * 12;
  });

  // ---------- Página 3: investimento ----------
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text("Investimento", 48, 70);
  doc.setDrawColor(220, 38, 38);
  doc.line(48, 80, 160, 80);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  const cab = [
    `Proposta: ${input.title}${input.quoteNumber ? ` · Orçamento #${input.quoteNumber}` : ""}`,
    `Cliente: ${cliente}`,
    input.contactName ? `Contato: ${input.contactName}` : "",
    input.contactPhone ? `Telefone: ${input.contactPhone}` : "",
    input.contactEmail ? `E-mail: ${input.contactEmail}` : "",
    input.ownerName ? `Consultor: ${input.ownerName}` : "",
  ].filter(Boolean);
  cab.forEach((l, i) => doc.text(l, 48, 100 + i * 14));

  const totalAtiv = input.items.reduce((s, i) => s + (i.activationValue || 0) * (i.quantity || 0), 0);
  const totalMens = input.items.reduce((s, i) => s + (i.monthlyValue || 0) * (i.quantity || 0), 0);

  autoTable(doc, {
    startY: 100 + cab.length * 14 + 16,
    head: [["Item", "Especificação", "Unidade", "Qtd.", "Ativação", "Mensalidade"]],
    body: input.items.map((it, i) => [
      String(i + 1),
      it.description ? `${it.name}\n${it.description}` : it.name,
      it.unit || "Serviço",
      String(it.quantity ?? 1),
      brl(it.activationValue || 0),
      brl(it.monthlyValue || 0),
    ]),
    foot: [["", "TOTAL", "", "", brl(totalAtiv), brl(totalMens)]],
    styles: { fontSize: 9, cellPadding: 6, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 34, halign: "center" },
      2: { cellWidth: 60, halign: "center" },
      3: { cellWidth: 40, halign: "center" },
      4: { cellWidth: 78, halign: "right" },
      5: { cellWidth: 84, halign: "right" },
    },
    margin: { left: 48, right: 48 },
  });

  let afterY = (doc as any).lastAutoTable?.finalY ?? 400;

  if (input.notes) {
    afterY += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Observações", 48, afterY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const nl = doc.splitTextToSize(input.notes, W - 96);
    doc.text(nl, 48, afterY + 14);
    afterY += 14 + nl.length * 12;
  }

  afterY += 26;
  if (afterY > H - 200) {
    doc.addPage();
    afterY = 70;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Todos os planos incluem", 48, afterY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  INCLUSOS.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.text(`• ${t}`, 48 + col * ((W - 96) / 2), afterY + 18 + row * 14);
  });
  afterY += 18 + Math.ceil(INCLUSOS.length / 2) * 14 + 20;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Proposta válida por 15 dias. Valores sujeitos a análise de crédito e viabilidade técnica.", 48, afterY);

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`${EMPRESA.nome} · ${EMPRESA.fone} · ${EMPRESA.site}`, W / 2, H - 28, { align: "center" });
    doc.text(`${p}/${pages}`, W - 48, H - 28, { align: "right" });
  }

  const slug = (input.companyName || input.contactName || "proposta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
  doc.save(`Proposta_Online_Rastreamento_${slug}.pdf`);
}
