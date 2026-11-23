import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeArquivoAnexo, pastaDoMes, extensaoDe } from "./finance-anexo";

test("pasta do mês", () => {
  assert.equal(pastaDoMes("2026-11-23"), "nov26");
  assert.equal(pastaDoMes("2027-01-05"), "jan27");
});

test("nome do arquivo", () => {
  assert.equal(nomeArquivoAnexo({ contraparte: "Supermercado Paranaíba Ltda.", tipoDocumento: "cupom_fiscal", data: "2026-11-23", nomeOriginal: "IMG_1.JPEG", mime: "image/jpeg" }), "SUPERMERCADOPARANAIBALTDA_cupom_2311.jpeg");
  assert.equal(nomeArquivoAnexo({ contraparte: null, tipoDocumento: null, data: "2026-02-03", nomeOriginal: "arquivo", mime: "application/pdf" }), "SEMFORNECEDOR_doc_0302.pdf");
  assert.equal(extensaoDe("x", "image/png"), "png");
});
