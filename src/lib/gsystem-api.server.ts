/**
 * GSystem Management API Client (api.gsystem.com.br)
 * Server-only — handles JWT authentication and API calls
 */

const GSYSTEM_API_BASE = "https://api.gsystem.com.br/api";

let cachedToken: string | null = null;
let tokenExpiry = 0;

/**
 * Validate OTP code after initial authentication (2FA step)
 * Tries common GSystem OTP endpoints. If no OTP code is configured, skips validation.
 */
async function validateOtp(initialToken: string): Promise<string> {
  const otpCode = process.env.GSYSTEM_OTP_CODE;
  if (!otpCode) {
    console.log("[GSystem Auth] No OTP code configured, skipping validation step");
    return initialToken;
  }

  console.log("[GSystem Auth] Attempting OTP validation...");

  // Try common OTP validation endpoints
  const endpoints = [
    "/Auth/Validate",
    "/Auth/ValidateOTP",
    "/Auth/OTP",
    "/Auth/Confirm",
    "/Auth/TwoFactor",
    "/Auth/2FA",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${GSYSTEM_API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${initialToken}`,
        },
        body: JSON.stringify({ Code: otpCode, Codigo: otpCode, OTP: otpCode }),
      });

      console.log(`[GSystem OTP] ${endpoint} => ${res.status}`);

      if (res.ok) {
        const text = await res.text();
        console.log(`[GSystem OTP] Success on ${endpoint}:`, text.substring(0, 300));
        // Try to extract a new token from the response
        try {
          const data = JSON.parse(text);
          const newToken =
            data?.JWT?.Token ?? data?.JWT ?? data?.token ?? data?.Token ??
            data?.accessToken ?? data?.access_token;
          if (typeof newToken === "string" && newToken.length > 10) {
            console.log("[GSystem OTP] Got new token from OTP validation");
            return newToken;
          }
        } catch {}
        // If no new token, the initial token is now validated
        return initialToken;
      }

      if (res.status === 404) continue; // endpoint doesn't exist, try next
      // Non-404 error — log and continue
      const errText = await res.text();
      console.log(`[GSystem OTP] ${endpoint} error [${res.status}]:`, errText.substring(0, 200));
    } catch (err) {
      console.log(`[GSystem OTP] ${endpoint} fetch error:`, String(err).substring(0, 200));
    }
  }

  console.log("[GSystem Auth] No OTP endpoint found, using initial token");
  return initialToken;
}

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

  console.log("[GSystem Auth] Response keys:", Object.keys(data));

  // Helper: extract a JWT string from a value that may be string or object
  function extractJwt(val: unknown): string | null {
    if (typeof val === "string" && val.length > 10) {
      return val.replace(/^["']|["']$/g, "").trim();
    }
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      console.log("[GSystem Auth] JWT field is object with keys:", Object.keys(obj));
      // Try common sub-fields
      for (const k of ["token", "Token", "accessToken", "AccessToken", "access_token", "jwt", "JWT", "value", "Value"]) {
        if (typeof obj[k] === "string" && (obj[k] as string).length > 10) {
          return (obj[k] as string).trim();
        }
      }
      // If object has a single string value, use it
      const vals = Object.values(obj).filter((v) => typeof v === "string" && (v as string).length > 10);
      if (vals.length === 1) return (vals[0] as string).trim();
    }
    return null;
  }

  // Try known top-level fields in priority order
  const fieldCandidates = [
    data?.JWT, data?.jwt, data?.token, data?.Token,
    data?.access_token, data?.AccessToken, data?.accessToken,
    data?.resultado, data?.Resultado, data?.result, data?.Result,
    data?.data?.token, data?.data?.Token, data?.data?.access_token,
  ];

  for (const candidate of fieldCandidates) {
    const extracted = extractJwt(candidate);
    if (extracted) {
      // Step 2: Validate OTP if configured
      const validatedToken = await validateOtp(extracted);
      cachedToken = validatedToken;
      tokenExpiry = now + 55 * 60 * 1000;
      return validatedToken;
    }
  }

  // If data itself is a string token
  if (typeof data === "string" && data.length > 10) {
    const validatedToken = await validateOtp(data);
    cachedToken = validatedToken;
    tokenExpiry = now + 55 * 60 * 1000;
    return validatedToken;
  }

  console.error("[GSystem Auth] Could not extract token. Keys:", Object.keys(data), "Data:", JSON.stringify(data).substring(0, 500));
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
      const detail =
        data?.message || data?.Message || data?.error || data?.Error ||
        data?.detail || data?.Detail || data?.errors || data?.Errors;
      const detailStr = typeof detail === "string" ? detail : JSON.stringify(detail || data);
      console.error(`[GSystem API] ${method} ${endpoint} => ${res.status}`, detailStr.substring(0, 1000));
      throw new Error(`GSystem API error [${res.status}]: ${detailStr}`);
    }
    return data;
  } catch (err) {
    if (err instanceof SyntaxError) {
      if (!res.ok) {
        console.error(`[GSystem API] ${method} ${endpoint} => ${res.status}`, text.substring(0, 1000));
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

function unwrapGsystemList(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ["Items", "items", "Data", "data", "Dados", "dados", "Resultado", "resultado", "Results", "results"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function pickGsystemKey(entity: any): string | null {
  if (!entity || typeof entity !== "object") return null;
  for (const key of ["Key", "key", "Id", "id", "ID", "Codigo", "codigo", "Código", "Code", "code"]) {
    const value = entity[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|eireli|me|epp|s\.?a\.?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getClientName(client: any) {
  return String(
    client?.Nome || client?.nome || client?.RazaoSocial || client?.razaoSocial ||
      client?.DisplayName || client?.displayName || client?.NomeFantasia || client?.nomeFantasia || ""
  );
}

let cachedColaboradorKey: string | null = null;
let cachedColaboradorAt = 0;

/**
 * Resolve a default Colaborador Key from GSystem.
 * Tries multiple endpoints/shapes and picks the first active colaborador.
 * Cached for 30 minutes.
 */
export async function getDefaultColaboradorKey(): Promise<string | null> {
  const now = Date.now();
  if (cachedColaboradorKey && now - cachedColaboradorAt < 30 * 60 * 1000) {
    return cachedColaboradorKey;
  }

  const endpoints = ["/colaboradores", "/Colaboradores", "/usuarios", "/Usuarios"];
  for (const ep of endpoints) {
    try {
      const data = await gsystemApiFetch(ep, "GET");
      const list = Array.isArray(data) ? data : (data?.Items || data?.items || data?.Data || data?.data || []);
      if (Array.isArray(list) && list.length > 0) {
        const first = list.find((x: any) => (x?.Ativo ?? x?.ativo ?? true)) || list[0];
        const key = pickGsystemKey(first);
        if (key) {
          cachedColaboradorKey = String(key);
          cachedColaboradorAt = now;
          console.log(`[GSystem] Default Colaborador resolved from ${ep}:`, cachedColaboradorKey);
          return cachedColaboradorKey;
        }
      }
    } catch (err) {
      console.log(`[GSystem] ${ep} lookup failed:`, String(err).substring(0, 200));
    }
  }
  return null;
}

/**
 * Try to resolve a GSystem cliente Key for a local company.
 * Strategy:
 *   1. CNPJ exact match (/clientes/{cnpj})
 *   2. List /clientes and match by name (case-insensitive) or telefone (digits only)
 *   3. Create a basic cliente with the available data
 * Returns the cliente Key (string) or null if everything fails.
 */
export async function findOrCreateGSystemClientByCompany(params: {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const cleanCnpj = (params.cnpj || "").replace(/\D/g, "");
  const cleanPhone = (params.phone || "").replace(/\D/g, "");
  const normalizedName = (params.name || "").trim();

  // 1) CNPJ exact match
  if (cleanCnpj) {
    try {
      const result = await gsystemApiFetch(`/clientes/${encodeURIComponent(cleanCnpj)}`, "GET");
      const key = Array.isArray(result)
        ? result[0]?.Key || result[0]?.key
        : (result as any)?.Key || (result as any)?.key;
      if (key) return String(key);
    } catch (err) {
      console.log("[GSystem] cliente by CNPJ not found:", String(err).substring(0, 200));
    }
  }

  // 2) Search by name / phone in the listing
  if (normalizedName || cleanPhone) {
    try {
      const list = await gsystemApiFetch("/clientes", "GET");
      const arr = Array.isArray(list) ? list : ((list as any)?.Items || (list as any)?.items || []);
      if (Array.isArray(arr)) {
        const lowerName = normalizedName.toLowerCase();
        const match = arr.find((c: any) => {
          const cName = String(c?.Nome || c?.nome || c?.RazaoSocial || c?.razaoSocial || "").toLowerCase();
          const cPhone = String(c?.Telefone || c?.telefone || c?.Celular || c?.celular || "").replace(/\D/g, "");
          if (lowerName && cName && (cName === lowerName || cName.includes(lowerName) || lowerName.includes(cName))) return true;
          if (cleanPhone && cPhone && (cPhone === cleanPhone || cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone))) return true;
          return false;
        });
        const key = match?.Key || match?.key || match?.Id || match?.id;
        if (key) return String(key);
      }
    } catch (err) {
      console.log("[GSystem] cliente listing failed:", String(err).substring(0, 200));
    }
  }

  // 3) Create a basic cliente
  try {
    const body: Record<string, unknown> = { Nome: normalizedName || "Cliente" };
    if (cleanCnpj) body.CNPJ = cleanCnpj;
    if (cleanPhone) body.Telefone = cleanPhone;
    const created = await gsystemApiFetch("/clientes", "POST", body);
    const key = (created as any)?.Key || (created as any)?.key || (created as any)?.Id || (created as any)?.id;
    if (key) return String(key);
  } catch (err) {
    console.error("[GSystem] failed to create cliente:", String(err).substring(0, 300));
  }

  return null;
}
