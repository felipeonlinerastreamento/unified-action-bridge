/**
 * Validates the incoming request against the CRON_SECRET env var.
 * The secret can be supplied via:
 *   - Authorization: Bearer <secret>
 *   - x-cron-secret: <secret>
 *   - ?cron_secret=<secret> query param (for cron services that can't set headers)
 * If CRON_SECRET is not configured, returns false (deny by default).
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  let querySecret = "";
  try {
    const url = new URL(request.url);
    querySecret = url.searchParams.get("cron_secret") || "";
  } catch {
    // ignore
  }
  // Preferir o cabeçalho (x-cron-secret ou Authorization). O ?cron_secret= fica só por compatibilidade
  // com agendamentos antigos e deve ser removido quando todos enviarem o cabeçalho.
  return safeEqual(bearer, expected) || safeEqual(headerSecret, expected) || safeEqual(querySecret, expected);
}

export function unauthorizedCronResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

/** Comparação em tempo constante, para não vazar o segredo por diferença de tempo de resposta. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < y.length; i++) diff |= (x[i % (x.length || 1)] ?? 0) ^ y[i];
  return diff === 0;
}
