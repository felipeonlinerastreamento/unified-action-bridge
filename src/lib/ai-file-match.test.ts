import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFiles, asksForFile } from "./ai-file-match.ts";

const files = [
  { id: "1", file_name: "Catalogo Equipamentos 2026.pdf", description: "rastreadores e acessórios" },
  { id: "2", file_name: "Tabela de precos.xlsx", description: null },
];

test("pedido do catálogo encontra o arquivo do catálogo", () => {
  assert.deepEqual(matchFiles("Me passe o catálogo de equipamentos", files).map((f) => f.id), ["1"]);
});
test("palavra da descrição também encontra", () => {
  assert.deepEqual(matchFiles("tem algo sobre rastreadores?", files).map((f) => f.id), ["1"]);
});
test("pergunta sem relação não retorna arquivo", () => {
  assert.equal(matchFiles("quantos pontos eu tenho?", files).length, 0);
});
test("detecta pedido de arquivo", () => {
  assert.equal(asksForFile("pode baixar o catálogo?"), true);
  assert.equal(asksForFile("quantos pontos eu tenho?"), false);
});
