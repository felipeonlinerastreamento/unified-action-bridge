/**
 * Cliente da API do Autentique (GraphQL v2). Server-only.
 * Variáveis do projeto: AUTENTIQUE_API_TOKEN (obrigatória), AUTENTIQUE_SANDBOX=true para testes
 * (documentos não consomem créditos), AUTENTIQUE_WEBHOOK_SECRET para conferir a assinatura do webhook.
 */
const URL_API = "https://api.autentique.com.br/v2/graphql";

export const autentiqueConfigurado = () => !!process.env.AUTENTIQUE_API_TOKEN;
export const autentiqueSandbox = () => /^(1|true|sim|yes)$/i.test(process.env.AUTENTIQUE_SANDBOX || "");

function token(): string {
  const t = process.env.AUTENTIQUE_API_TOKEN;
  if (!t) throw new Error("Chave do Autentique não configurada (AUTENTIQUE_API_TOKEN).");
  return t;
}

async function lerResposta(res: Response) {
  const txt = await res.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* resposta não-JSON */ }
  if (!res.ok || json?.errors?.length) {
    const msg = json?.errors?.map((e: any) => e.message).join("; ") || txt.slice(0, 300) || `HTTP ${res.status}`;
    throw new Error(`Autentique: ${msg}`);
  }
  return json?.data;
}

export type SignatarioAutentique = {
  nome: string;
  email?: string | null;
  telefone?: string | null; // +55...
  acao: "SIGN" | "SIGN_AS_A_WITNESS";
  cpf?: string | null;
  verificacao?: "LIVE" | "PF_FACIAL" | "UPLOAD" | null;
};

const CRIAR = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!, $sandbox: Boolean) {
  createDocument(document: $document, signers: $signers, file: $file, sandbox: $sandbox) {
    id name created_at
    signatures { public_id name email action { name } link { short_link } }
  }
}`;

export async function criarDocumentoAutentique(opts: { nome: string; pdf: Uint8Array; arquivo: string; signatarios: SignatarioAutentique[] }) {
  const signers = opts.signatarios.map((s) => {
    const base: any = { name: s.nome, action: s.acao };
    if (s.email) base.email = s.email;
    else if (s.telefone) { base.phone = s.telefone; base.delivery_method = "DELIVERY_METHOD_WHATSAPP"; }
    if (s.cpf) base.configs = { cpf: s.cpf };
    if (s.verificacao) base.security_verifications = [{ type: s.verificacao }];
    return base;
  });
  const form = new FormData();
  form.append("operations", JSON.stringify({
    query: CRIAR,
    variables: { document: { name: opts.nome }, signers, file: null, sandbox: autentiqueSandbox() },
  }));
  form.append("map", JSON.stringify({ file: ["variables.file"] }));
  form.append("file", new Blob([new Uint8Array(opts.pdf)], { type: "application/pdf" }), opts.arquivo);
  const res = await fetch(URL_API, { method: "POST", headers: { Authorization: `Bearer ${token()}` }, body: form });
  const data = await lerResposta(res);
  return data.createDocument as { id: string; signatures: { public_id: string; name: string | null; email: string | null; action: { name: string } | null; link: { short_link: string } | null }[] };
}

const CONSULTAR = `query ($id: UUID!) {
  document(id: $id) {
    id name
    files { original signed }
    signatures {
      public_id name email
      action { name }
      user { name email phone }
      viewed { ...ev } signed { ...ev } rejected { ...ev }
    }
  }
}
fragment ev on Event { ip reason created_at geolocation { city state country } }`;

export async function consultarDocumentoAutentique(id: string) {
  const res = await fetch(URL_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: CONSULTAR, variables: { id } }),
  });
  const data = await lerResposta(res);
  return data.document as any;
}

/** Confere o cabeçalho X-Autentique-Signature (HMAC-SHA256 do corpo bruto, hex). */
export async function webhookValido(corpo: string, assinatura: string | null): Promise<boolean> {
  const segredo = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  if (!segredo) return true; // sem segredo configurado, o webhook só dispara uma consulta à API (não confia no corpo)
  if (!assinatura) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(corpo)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = assinatura.trim().toLowerCase();
  if (a.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ a.charCodeAt(i);
  return diff === 0;
}

async function consulta(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(URL_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return lerResposta(res);
}

/** Conta ligada à chave (para a tela de Integrações). */
export async function contaAutentique() {
  const data = await consulta(`query { me { name email organization { name cnpj } subscription { has_premium_features documents credits } } }`);
  return data.me as { name: string; email: string; organization?: { name: string; cnpj: string | null } | null; subscription?: { has_premium_features: boolean; documents: number | null; credits: number | null } | null };
}

/** Lista documentos da conta (página começa em 1). */
export async function listarDocumentosAutentique(page: number, limit = 60) {
  const data = await consulta(`query ($limit: Int!, $page: Int!) {
    documents(limit: $limit, page: $page) {
      total
      data {
        id name created_at
        files { original signed }
        signatures {
          public_id name email created_at
          action { name }
          link { short_link }
          user { name email }
          viewed { created_at ip }
          signed { created_at ip }
          rejected { created_at ip reason }
        }
      }
    }
  }`, { limit, page });
  return data.documents as { total: number; data: any[] };
}
