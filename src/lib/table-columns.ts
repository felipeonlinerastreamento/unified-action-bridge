// Pure rules for configurable tables: per-column filters, column visibility
// and export rows. No React or browser APIs here so it stays testable.

export type CellValue = string | number | boolean | null | undefined;

export type TableColumn<T> = {
  id: string;
  label: string;
  /** Raw value used for filtering, sorting distinct values and export. */
  value: (row: T) => CellValue;
  /** Hidden until the user turns it on in the column picker. */
  defaultHidden?: boolean;
  /** Set false for action columns that must not be filtered or exported. */
  data?: boolean;
};

/** `text` = "contém"; `values` = lista marcada (undefined = todos). */
export type ColumnFilter = { text?: string; values?: string[] };
export type ColumnFilters = Record<string, ColumnFilter | undefined>;

export const EMPTY_LABEL = "(Vazio)";

export function cellText(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v).trim();
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Value shown/selected in the checkbox list for a cell. */
export function optionKey(v: CellValue): string {
  const t = cellText(v);
  return t === "" ? EMPTY_LABEL : t;
}

export function isFilterActive(f: ColumnFilter | undefined): boolean {
  if (!f) return false;
  return !!(f.text && f.text.trim()) || Array.isArray(f.values);
}

export function activeFilterCount(filters: ColumnFilters): number {
  return Object.values(filters).filter(isFilterActive).length;
}

export function matchesFilter(v: CellValue, f: ColumnFilter | undefined): boolean {
  if (!isFilterActive(f)) return true;
  const text = cellText(v);
  if (f!.text && f!.text.trim() && !normalize(text).includes(normalize(f!.text))) return false;
  if (Array.isArray(f!.values) && !f!.values.includes(optionKey(v))) return false;
  return true;
}

/** Keeps rows that pass every active column filter (AND between columns). */
export function applyColumnFilters<T>(
  rows: T[],
  columns: TableColumn<T>[],
  filters: ColumnFilters,
  skipColumnId?: string,
): T[] {
  const active = columns.filter((c) => c.id !== skipColumnId && c.data !== false && isFilterActive(filters[c.id]));
  if (!active.length) return rows;
  return rows.filter((r) => active.every((c) => matchesFilter(c.value(r), filters[c.id])));
}

/**
 * Distinct options for a column's checkbox list, counted over rows that pass
 * the OTHER columns' filters (like Excel), sorted with "(Vazio)" last.
 */
export function distinctOptions<T>(
  rows: T[],
  columns: TableColumn<T>[],
  filters: ColumnFilters,
  columnId: string,
): { value: string; count: number }[] {
  const col = columns.find((c) => c.id === columnId);
  if (!col) return [];
  const base = applyColumnFilters(rows, columns, filters, columnId);
  const counts = new Map<string, number>();
  for (const r of base) {
    const k = optionKey(col.value(r));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.value === EMPTY_LABEL) return 1;
      if (b.value === EMPTY_LABEL) return -1;
      return a.value.localeCompare(b.value, "pt-BR", { numeric: true, sensitivity: "base" });
    });
}

export function defaultVisibleIds<T>(columns: TableColumn<T>[]): string[] {
  return columns.filter((c) => !c.defaultHidden).map((c) => c.id);
}

/** Restores saved visibility, ignoring unknown ids and never returning zero data columns. */
export function resolveVisibleIds<T>(columns: TableColumn<T>[], saved: unknown): string[] {
  if (!Array.isArray(saved)) return defaultVisibleIds(columns);
  const known = new Set(columns.map((c) => c.id));
  const ids = saved.filter((x): x is string => typeof x === "string" && known.has(x));
  const hasData = columns.some((c) => c.data !== false && ids.includes(c.id));
  return hasData ? ids : defaultVisibleIds(columns);
}

/** Header row + data rows with only visible data columns, in column order. */
export function buildExportSheet<T>(
  rows: T[],
  columns: TableColumn<T>[],
  visibleIds: string[],
): { headers: string[]; rows: (string | number)[][] } {
  const cols = columns.filter((c) => c.data !== false && visibleIds.includes(c.id));
  return {
    headers: cols.map((c) => c.label),
    rows: rows.map((r) =>
      cols.map((c) => {
        const v = c.value(r);
        return typeof v === "number" && Number.isFinite(v) ? v : cellText(v);
      }),
    ),
  };
}
