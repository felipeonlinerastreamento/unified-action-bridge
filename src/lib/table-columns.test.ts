import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  applyColumnFilters, buildExportSheet, distinctOptions, EMPTY_LABEL, resolveVisibleIds, type TableColumn,
} from "./table-columns";

type R = { id: number; modelo: string | null; status: string; placa?: string };
const rows: R[] = [
  { id: 1, modelo: "ST310", status: "Disponível" },
  { id: 2, modelo: "ST310", status: "Vinculado", placa: "ABC1D23" },
  { id: 3, modelo: "GT06", status: "Disponível" },
  { id: 4, modelo: null, status: "Inativo" },
];
const cols: TableColumn<R>[] = [
  { id: "id", label: "ID", value: (r) => r.id },
  { id: "modelo", label: "Modelo", value: (r) => r.modelo },
  { id: "status", label: "Status", value: (r) => r.status },
  { id: "placa", label: "Placa", value: (r) => r.placa, defaultHidden: true },
  { id: "acoes", label: "Ações", value: () => "", data: false },
];

describe("table column filters", () => {
  it("filtra por texto ignorando acentos e maiúsculas", () => {
    assert.deepEqual(applyColumnFilters(rows, cols, { status: { text: "disponivel" } }).map((r) => r.id), [1, 3]);
  });

  it("combina filtros de colunas diferentes (E)", () => {
    const out = applyColumnFilters(rows, cols, { modelo: { values: ["ST310"] }, status: { values: ["Disponível"] } });
    assert.deepEqual(out.map((r) => r.id), [1]);
  });

  it("permite filtrar células vazias", () => {
    assert.deepEqual(applyColumnFilters(rows, cols, { modelo: { values: [EMPTY_LABEL] } }).map((r) => r.id), [4]);
  });

  it("lista de valores considera só os filtros das outras colunas", () => {
    const opts = distinctOptions(rows, cols, { status: { values: ["Disponível"] }, modelo: { values: ["GT06"] } }, "modelo");
    assert.deepEqual(opts, [{ value: "GT06", count: 1 }, { value: "ST310", count: 1 }]);
  });
});

describe("column visibility and export", () => {
  it("colunas ocultas por padrão começam escondidas e ids inválidos são ignorados", () => {
    assert.deepEqual(resolveVisibleIds(cols, undefined), ["id", "modelo", "status", "acoes"]);
    assert.deepEqual(resolveVisibleIds(cols, ["placa", "xyz"]), ["placa"]);
    assert.deepEqual(resolveVisibleIds(cols, ["acoes"]), ["id", "modelo", "status", "acoes"]);
  });

  it("exporta apenas colunas visíveis de dados, na ordem da tabela", () => {
    const sheet = buildExportSheet(rows.slice(0, 2), cols, ["status", "id", "acoes"]);
    assert.deepEqual(sheet.headers, ["ID", "Status"]);
    assert.deepEqual(sheet.rows, [[1, "Disponível"], [2, "Vinculado"]]);
  });
});
