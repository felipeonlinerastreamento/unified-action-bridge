/**
 * GSystem Management API Client (api.gsystem.com.br)
 * Server-only — handles JWT authentication and API calls
 */

const GSYSTEM_API_BASE = "https://api.gsystem.com.br/api";

let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Authenticate with GSystem and get a JWT token
 */
async function authenticate(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const cnpj = process.env.GSYSTEM_CNPJ;
  const login = process.env.GSYSTEM_LOGIN;
  const passwordHash = process.env.GSYSTEM_PASSWORD_HASH;

  if (!cnpj || !login || !passwordHash) {
    throw new Error("Credenciais do GSystem não configuradas (GSYSTEM_CNPJ, GSYSTEM_LOGIN, GSYSTEM_PASSWORD_HASH)");
  }

  const res = await fetch(`${GSYSTEM_API_BASE}/Auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CNPJ: cnpj,
      Login: login,
      PasswordHash: passwordHash,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha na autenticação GSystem [${res.status}]: ${text}`);
  }

  const text = await res.text();
  console.log("[GSystem Auth] Raw response:", text.substring(0, 500));

  // Try parsing as JSON first
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // Response is plain text — treat as token directly
    if (text && text.length > 10) {
      // Remove surrounding quotes if present
      const cleaned = text.replace(/^["']|["']$/g, "").trim();
      cachedToken = cleaned;
      tokenExpiry = now + 55 * 60 * 1000;
      return cleaned;
    }
    throw new Error("Formato de token inesperado do GSystem (resposta não-JSON)");
  }

  // Extract token from various possible response shapes
  const token =
    data?.token ?? data?.Token ?? data?.access_token ?? data?.AccessToken ??
    data?.accessToken ?? data?.jwt ?? data?.JWT ?? data?.resultado ?? data?.Resultado ??
    data?.data?.token ?? data?.data?.Token ?? data?.data?.access_token ??
    data?.result ?? data?.Result;

  if (typeof token === "string" && token.length > 10) {
    cachedToken = token;
    tokenExpiry = now + 55 * 60 * 1000;
    return token;
  }

  // If data itself is a string token
  if (typeof data === "string" && data.length > 10) {
    cachedToken = data;
    tokenExpiry = now + 55 * 60 * 1000;
    return data;
  }

  console.error("[GSystem Auth] Unexpected token format. Keys:", Object.keys(data), "Data:", JSON.stringify(data).substring(0, 500));
  throw new Error(`Formato de token inesperado do GSystem. Chaves: ${Object.keys(data).join(", ")}`);
}

/**
 * Make an authenticated request to the GSystem Management API
 */
export async function gsystemApiFetch(
  endpoint: string,
  method = "GET",
  body?: unknown
): Promise<any> {
  const token = await authenticate();
  const url = `${GSYSTEM_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { success: true };
  }

  const text = await res.text();
  if (!text) return { success: true };

  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      throw new Error(
        `GSystem API error [${res.status}]: ${data?.message || data?.Message || text}`
      );
    }
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      if (!res.ok) {
        throw new Error(`GSystem API error [${res.status}]: ${text}`);
      }
      return text;
    }
    throw err;
  }
}

/**
 * Clear the cached token (useful if we get 401 errors)
 */
export function clearGsystemToken() {
  cachedToken = null;
  tokenExpiry = 0;
}
