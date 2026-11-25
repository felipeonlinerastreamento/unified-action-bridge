import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveEmpresa, lerArquivo, lerCsv, remapearUsuarios, tabelaDoArquivo, valorCelula } from "./importacao.ts";

test("reconhece a tabela pelo nome do arquivo", () => {
  assert.equal(tabelaDoArquivo("vehicles_rows.csv"), "vehicles");
  assert.equal(tabelaDoArquivo("ge_events (2).csv"), "events");
  assert.equal(tabelaDoArquivo("unmatched_events.csv"), null);
  assert.equal(tabelaDoArquivo("foo.csv"), null);
});
test("lê CSV com aspas, vírgulas e quebras dentro do campo", () => {
  assert.deepEqual(lerCsv('id,name,obs\n1,"ERG, Engenharia","linha1\nlinha2"\n2,Mina,"diz ""oi"""\n'), [
    { id: "1", name: "ERG, Engenharia", obs: "linha1\nlinha2" },
    { id: "2", name: "Mina", obs: 'diz "oi"' },
  ]);
});
test("converte células vazias, JSON e arrays do Postgres", () => {
  assert.equal(valorCelula(""), null);
  assert.deepEqual(valorCelula('{"a":1}'), { a: 1 });
  assert.deepEqual(valorCelula("{a,b}"), ["a", "b"]);
  assert.equal(valorCelula("texto"), "texto");
  assert.deepEqual(lerArquivo("x.json", '[{"id":"1"}]'), [{ id: "1" }]);
});
test("troca ids de usuários e descarta papéis sem usuário", () => {
  const mapa = { a: "A" };
  assert.deepEqual(remapearUsuarios("treatments", [{ id: 1, created_by_user_id: "a", assigned_to_user_id: "z" }], mapa),
    [{ id: 1, created_by_user_id: "A", assigned_to_user_id: null }]);
  assert.deepEqual(remapearUsuarios("user_roles", [{ user_id: "a" }, { user_id: "z" }], mapa), [{ user_id: "A" }]);
});
test("compara nomes de empresas sem acento e sufixo", () => {
  assert.equal(chaveEmpresa("ERG Engenharia LTDA"), chaveEmpresa("erg engenharia"));
  assert.equal(chaveEmpresa("Mineração Fábrica S/A"), "mineracao fabrica");
});
