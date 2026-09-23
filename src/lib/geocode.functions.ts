import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeocodeResult = { address: string; lat: number | null; lng: number | null };

function normalizeKey(address: string): string {
  return address
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function nominatim(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "GSystemHub/1.0 (agenda-mapa)",
        "Accept-Language": "pt-BR",
      },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const first = Array.isArray(json) ? json[0] : null;
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Converte endereços em coordenadas, guardando o resultado em cache no banco.
 * Aceita até 40 endereços por chamada.
 */
export const geocodificarEnderecos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ addresses: z.array(z.string().min(5)).max(40) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<GeocodeResult[]> => {
    const unique = Array.from(new Set(data.addresses.map((a) => a.trim()).filter(Boolean)));
    if (unique.length === 0) return [];

    const keys = unique.map(normalizeKey);
    const { data: cached } = await context.supabase
      .from("geocode_cache")
      .select("address_key, lat, lng, not_found")
      .in("address_key", keys);

    const byKey = new Map<string, { lat: number | null; lng: number | null; not_found: boolean }>();
    for (const row of (cached as any[]) ?? []) {
      byKey.set(row.address_key, { lat: row.lat, lng: row.lng, not_found: row.not_found });
    }

    const out: GeocodeResult[] = [];
    for (const address of unique) {
      const key = normalizeKey(address);
      const hit = byKey.get(key);
      if (hit) {
        out.push({ address, lat: hit.not_found ? null : hit.lat, lng: hit.not_found ? null : hit.lng });
        continue;
      }
      // Nominatim exige no máximo 1 requisição por segundo.
      const found = await nominatim(address);
      await context.supabase.from("geocode_cache").upsert(
        {
          address_key: key,
          address,
          lat: found?.lat ?? null,
          lng: found?.lng ?? null,
          not_found: !found,
        },
        { onConflict: "address_key" },
      );
      byKey.set(key, { lat: found?.lat ?? null, lng: found?.lng ?? null, not_found: !found });
      out.push({ address, lat: found?.lat ?? null, lng: found?.lng ?? null });
      await new Promise((r) => setTimeout(r, 1100));
    }
    return out;
  });
