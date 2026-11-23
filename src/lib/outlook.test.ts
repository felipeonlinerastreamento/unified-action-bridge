import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { listOutlookConnectionKeys, DEFAULT_CONNECTION_KEY } from "./outlook.server";

const TODAS = [
  "MICROSOFT_OUTLOOK_API_KEY",
  "MICROSOFT_OUTLOOK_API_KEY_1",
  "MICROSOFT_OUTLOOK_API_KEY_2",
  "MICROSOFT_OUTLOOK_API_KEY_3",
  "MICROSOFT_OUTLOOK_API_KEY_4",
  "MICROSOFT_OUTLOOK_API_KEY_5",
];

function comChaves(ativas: string[], fn: () => void) {
  const anterior = new Map<string, string | undefined>();
  for (const nome of TODAS) anterior.set(nome, process.env[nome]);
  try {
    for (const nome of TODAS) {
      if (ativas.includes(nome)) process.env[nome] = "chave-de-teste";
      else delete process.env[nome];
    }
    fn();
  } finally {
    for (const [nome, valor] of anterior) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
  }
}

describe("chaves de conexão do Outlook", () => {
  it("inclui a chave _1 quando ela existe no servidor", () => {
    comChaves(["MICROSOFT_OUTLOOK_API_KEY", "MICROSOFT_OUTLOOK_API_KEY_1"], () => {
      assert.deepEqual(listOutlookConnectionKeys(), [
        "MICROSOFT_OUTLOOK_API_KEY",
        "MICROSOFT_OUTLOOK_API_KEY_1",
      ]);
    });
  });

  it("não devolve chaves que não estão no servidor", () => {
    comChaves(["MICROSOFT_OUTLOOK_API_KEY_1"], () => {
      assert.deepEqual(listOutlookConnectionKeys(), ["MICROSOFT_OUTLOOK_API_KEY_1"]);
    });
  });

  it("mantém a chave padrão como escolha inicial", () => {
    assert.equal(DEFAULT_CONNECTION_KEY, "MICROSOFT_OUTLOOK_API_KEY");
  });
});
