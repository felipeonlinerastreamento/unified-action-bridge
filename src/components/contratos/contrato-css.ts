/** Estilo do texto do contrato (tela, página pública e impressão). */
export const CONTRATO_CSS = `
.contrato-doc { font-family: Georgia, "Times New Roman", serif; font-size: 14px; line-height: 1.55; color: #111827; text-align: justify; }
.contrato-doc h2 { font-size: 16px; font-weight: 700; text-align: center; margin: 28px 0 12px; }
.contrato-doc h3 { font-size: 14px; font-weight: 700; margin: 18px 0 8px; }
.contrato-doc p { margin: 0 0 10px; }
.contrato-doc .anexo { margin-top: 32px; border-top: 1px dashed #9ca3af; padding-top: 8px; }
.registro { font-family: Arial, sans-serif; font-size: 12px; margin-top: 32px; border-top: 2px solid #111827; padding-top: 12px; }
.registro table { width: 100%; border-collapse: collapse; }
.registro td, .registro th { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; vertical-align: top; }
@media print { .contrato-doc .anexo { break-before: page; } .registro { break-before: page; } }
`;
