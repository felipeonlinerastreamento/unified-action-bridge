// Regras puras para localizar arquivos do acervo do Assistente IA a partir de uma pergunta.
export interface AiCatalogFile {
  id: string;
  file_name: string;
  description: string | null;
}

const STOP = new Set([
  "qual","quais","como","onde","para","pelo","pela","dos","das","com","sem","uma","que",
  "voce","tem","temos","pode","poderia","favor","preciso","quero","sobre","esse","este","essa","esta",
  "arquivo","arquivos","documento","documentos","baixar","download","envie","enviar","manda","mande","passe","passa",
]);

export function normalizeText(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function tokens(t: string): string[] {
  return normalizeText(t).replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

const FILE_INTENT = /\b(arquivo|catalogo|documento|planilha|pdf|manual|tabela|baixar|download|anexo|envie|mande|passe|link)\b/;

export function asksForFile(question: string): boolean {
  return FILE_INTENT.test(normalizeText(question));
}

/** Retorna os arquivos cujo nome/descrição compartilham palavras com a pergunta, ordenados por relevância. */
export function matchFiles<T extends AiCatalogFile>(question: string, files: T[], limit = 3): T[] {
  const q = new Set(tokens(question));
  if (q.size === 0) return [];
  return files
    .map((f) => {
      const ft = new Set(tokens(`${f.file_name.replace(/\.[a-z0-9]+$/i, "")} ${f.description ?? ""}`));
      let score = 0;
      for (const w of q) if (ft.has(w)) score++;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}
