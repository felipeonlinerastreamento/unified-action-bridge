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
  return bearer === expected || headerSecret === expected || querySecret === expected;
}

export function unauthorizedCronResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}
