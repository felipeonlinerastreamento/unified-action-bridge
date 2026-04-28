/**
 * Converte um identificador de protocolo (hexadecimal vindo do GSystem,
 * ou qualquer string) em um número decimal de 5 dígitos.
 *
 * Estratégia:
 *  - Remove caracteres não alfanuméricos.
 *  - Tenta interpretar como hex (BigInt) e pega o módulo 100000.
 *  - Se não for hex válido, usa um hash simples da string.
 *  - Resultado é zero-padded para 5 dígitos (00000–99999).
 *
 * O mapeamento é determinístico: o mesmo ID original sempre vira o mesmo
 * protocolo de 5 dígitos.
 */
export function formatProtocol(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "00000";
  const s = String(raw).trim().replace(/[^0-9a-zA-Z]/g, "");
  if (!s) return "00000";

  // Caso já seja um número decimal puro com até 5 dígitos, mantém.
  if (/^\d+$/.test(s) && s.length <= 5) {
    return s.padStart(5, "0");
  }

  // Tenta hex
  let n: bigint | null = null;
  if (/^[0-9a-fA-F]+$/.test(s)) {
    try {
      n = BigInt("0x" + s);
    } catch {
      n = null;
    }
  }

  // Fallback: hash simples (djb2)
  if (n === null) {
    let h = 5381n;
    for (let i = 0; i < s.length; i++) {
      h = (h * 33n + BigInt(s.charCodeAt(i))) & 0xffffffffn;
    }
    n = h;
  }

  const mod = Number(n % 100000n);
  return String(mod).padStart(5, "0");
}
