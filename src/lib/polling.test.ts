import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { POLL, QUERY_DEFAULTS } from "./polling";

describe("atualizações automáticas globais", () => {
  test("contadores do menu atualizam a cada 60 segundos", () => {
    assert.equal(POLL.sidebarCounters, 60_000);
  });

  test("nada é atualizado com a aba em segundo plano", () => {
    assert.equal(QUERY_DEFAULTS.refetchIntervalInBackground, false);
  });

  test("ao voltar para a aba, os dados são atualizados", () => {
    assert.equal(QUERY_DEFAULTS.refetchOnWindowFocus, true);
  });
});
