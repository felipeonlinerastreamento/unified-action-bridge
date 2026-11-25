/**
 * Correlação Cliente → Motorista → Veículo/ativo → Evento.
 *
 * A base de motoristas (tabela `drivers`) é a fonte única da identificação.
 * Um evento é correlacionado, nesta ordem:
 *  1. `events.driver_ref_id` (vínculo explícito feito na tratativa ou pela sincronização)
 *  2. placa/identificador do ativo do evento vs. `drivers.license_plate` do mesmo cliente
 *  3. nome/CPF vindo da plataforma vs. cadastro do mesmo cliente
 * Sem correspondência, o evento fica "não identificado" — nunca inventamos motorista.
 */

export interface DriverRecord {
  id: string;
  client_id: string;
  full_name: string;
  cpf: string;
  license_plate?: string | null;
  is_active?: boolean;
}

export interface EventDriverSource {
  client_id: string;
  driver_ref_id?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  license_plate?: string | null;
}

export function normalizePlate(value?: string | null): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

/** True quando a placa cadastrada aparece no identificador do ativo do evento (ex.: "Pico-SJH3A59"). */
export function plateMatches(driverPlate?: string | null, eventPlate?: string | null): boolean {
  const dp = normalizePlate(driverPlate);
  const ep = normalizePlate(eventPlate);
  if (dp.length < 5 || ep.length < 5) return false;
  return ep === dp || ep.includes(dp) || dp.includes(ep);
}

export function resolveEventDriver<T extends DriverRecord>(
  event: EventDriverSource,
  drivers: T[] | undefined | null,
): T | null {
  if (!drivers || drivers.length === 0) return null;
  // Isolamento: só considera motoristas do mesmo cliente do evento.
  const scoped = drivers.filter((d) => d.client_id === event.client_id);
  if (scoped.length === 0) return null;

  if (event.driver_ref_id) {
    const direct = scoped.find((d) => d.id === event.driver_ref_id);
    if (direct) return direct;
  }

  if (event.license_plate) {
    const byPlate = scoped.find((d) => plateMatches(d.license_plate, event.license_plate));
    if (byPlate) return byPlate;
  }

  const cpf = onlyDigits(event.driver_id);
  if (cpf.length === 11) {
    const byCpf = scoped.find((d) => onlyDigits(d.cpf) === cpf);
    if (byCpf) return byCpf;
  }

  const name = normalizeName(event.driver_name);
  if (name) {
    const byName = scoped.find((d) => normalizeName(d.full_name) === name);
    if (byName) return byName;
  }

  return null;
}

/** Nome a exibir/imprimir para o motorista do evento (cadastro tem prioridade). */
export function eventDriverName(
  event: EventDriverSource,
  drivers: DriverRecord[] | undefined | null,
): string | null {
  const resolved = resolveEventDriver(event, drivers);
  return resolved?.full_name ?? event.driver_name ?? null;
}
