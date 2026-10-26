// Regras puras para reconhecer respostas de e-mail a chamados já existentes.

/** Remove prefixos de resposta/encaminhamento (Re:, RES:, ENC:, Fwd:, TR:...) repetidos. */
export function normalizeSubject(subject: string | null | undefined): string {
  let s = (subject || "").trim();
  const prefix = /^\s*(re|res|resp|enc|fw|fwd|tr|aw|wg)\s*(\[\d+\])?\s*:\s*/i;
  while (prefix.test(s)) s = s.replace(prefix, "");
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Indica se o assunto tem cara de resposta/encaminhamento. */
export function isReplySubject(subject: string | null | undefined): boolean {
  return /^\s*(re|res|resp|enc|fw|fwd|tr|aw|wg)\s*(\[\d+\])?\s*:/i.test(subject || "");
}

/** Extrai um protocolo do sistema (EM-XXXX-XXXX ou #12345) do texto. */
export function extractProtocol(text: string | null | undefined): { attendanceId?: string; protocol?: string } {
  const t = text || "";
  const em = t.match(/\bEM-[A-Z0-9]{6,}-[A-Z0-9]{3,}\b/i);
  if (em) return { attendanceId: em[0].toUpperCase() };
  const hash = t.match(/#\s?(\d{4,6})\b/);
  if (hash) return { protocol: hash[1] };
  return {};
}

/** Corta o histórico citado de uma resposta (mantém só o texto novo). */
export function stripQuotedReply(body: string): string {
  const markers = [
    /^\s*-{2,}\s*Mensagem original\s*-{2,}/im,
    /^\s*-{2,}\s*Original Message\s*-{2,}/im,
    /^\s*_{5,}\s*$/m,
    /^\s*(De|From)\s*:\s.+$/im,
    /^\s*Em .{5,120} escreveu:\s*$/im,
    /^\s*On .{5,120} wrote:\s*$/im,
  ];
  let cut = body.length;
  for (const m of markers) {
    const r = m.exec(body);
    if (r && r.index > 0 && r.index < cut) cut = r.index;
  }
  return body.slice(0, cut).trim() || body.trim();
}
