import { test } from "node:test";
import assert from "node:assert/strict";
import { basePublica, DOMINIO_PUBLICO } from "./public-url";

test("basePublica usa o domínio oficial no lugar de endereços internos ou vazios", () => {
  assert.equal(basePublica(""), DOMINIO_PUBLICO);
  assert.equal(basePublica(null), DOMINIO_PUBLICO);
  assert.equal(basePublica("https://gs-hub.lovable.app/"), DOMINIO_PUBLICO);
  assert.equal(basePublica("https://id-preview--abc.lovable.app"), DOMINIO_PUBLICO);
  assert.equal(basePublica("https://abc.lovableproject.com"), DOMINIO_PUBLICO);
  assert.equal(basePublica("http://localhost:3000"), DOMINIO_PUBLICO);
  assert.equal(basePublica("https://gestao.onlinerastreamento.com.br/"), DOMINIO_PUBLICO);
  assert.equal(basePublica("https://outro.dominio.com.br"), "https://outro.dominio.com.br");
});
