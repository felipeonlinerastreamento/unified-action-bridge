import { toast } from "sonner";

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) { toast.error("Sem dados para exportar"); return; }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(";"),
    ...data.map((row) => headers.map((h) => `"${row[h] ?? ""}"`).join(";")),
  ].join("\n");
  downloadFile(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
  toast.success("CSV exportado com sucesso");
}

export function exportToXLSX(data: Record<string, unknown>[], filename: string) {
  if (!data.length) { toast.error("Sem dados para exportar"); return; }
  const headers = Object.keys(data[0]);
  const esc = (v: unknown) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body>
    <table border="1">
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${data
        .map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table></body></html>`;
  downloadFile(html, `${filename}.xls`, "application/vnd.ms-excel;charset=utf-8;");
  toast.success("Excel exportado com sucesso");
}


export function exportToPDF(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) { toast.error("Erro ao gerar PDF"); return; }
  const printWindow = window.open("", "_blank");
  if (!printWindow) { toast.error("Popup bloqueado"); return; }
  printWindow.document.write(`
    <html><head><title>${filename}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#f5f5f5;font-weight:bold}.kpi{display:inline-block;margin:0 16px 16px 0;padding:12px;border:1px solid #ddd;border-radius:8px;min-width:150px}h1,h2,h3{margin-bottom:8px}</style>
    </head><body>${el.innerHTML}</body></html>
  `);
  printWindow.document.close();
  printWindow.print();
  toast.success("PDF gerado");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
