import { useCallback, useEffect, useMemo, useState } from "react";
import {
  activeFilterCount, applyColumnFilters, defaultVisibleIds, resolveVisibleIds,
  type ColumnFilter, type ColumnFilters, type TableColumn,
} from "@/lib/table-columns";

/**
 * Column visibility (saved per browser) + per-column header filters for a table.
 * Visibility is read from localStorage only after mount to avoid hydration mismatch.
 */
export function useTableColumns<T>(storageKey: string, columns: TableColumn<T>[], rows: T[]) {
  const key = `table-columns:${storageKey}`;
  const [visibleIds, setVisibleIds] = useState<string[]>(() => defaultVisibleIds(columns));
  const [filters, setFilters] = useState<ColumnFilters>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setVisibleIds(resolveVisibleIds(columns, JSON.parse(raw)));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback((ids: string[]) => {
    setVisibleIds(ids);
    try { window.localStorage.setItem(key, JSON.stringify(ids)); } catch { /* ignore */ }
  }, [key]);

  const toggleColumn = useCallback((id: string) => {
    const next = visibleIds.includes(id) ? visibleIds.filter((x) => x !== id) : [...visibleIds, id];
    persist(resolveVisibleIds(columns, next));
  }, [visibleIds, columns, persist]);

  const showAll = useCallback(() => persist(columns.map((c) => c.id)), [columns, persist]);
  const resetColumns = useCallback(() => persist(defaultVisibleIds(columns)), [columns, persist]);

  const setFilter = useCallback((id: string, f: ColumnFilter | undefined) => {
    setFilters((prev) => ({ ...prev, [id]: f }));
  }, []);
  const clearFilters = useCallback(() => setFilters({}), []);

  const visibleColumns = useMemo(() => columns.filter((c) => visibleIds.includes(c.id)), [columns, visibleIds]);
  const filteredRows = useMemo(() => applyColumnFilters(rows, columns, filters), [rows, columns, filters]);

  return {
    columns, rows, visibleIds, visibleColumns, toggleColumn, showAll, resetColumns,
    filters, setFilter, clearFilters, filteredRows, activeFilters: activeFilterCount(filters),
  };
}

export type TableColumnsState<T> = ReturnType<typeof useTableColumns<T>>;
