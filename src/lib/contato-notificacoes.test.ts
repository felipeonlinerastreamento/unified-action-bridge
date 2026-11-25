import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { destinatariosPorNotificacao, notificacoesDoContato, unirEmails, unirTelefones } from "./contato-notificacoes";

describe("notificações dos contatos de empresa", () => {
  it("ignora chaves desconhecidas, repetidas e valores que não são lista", () => {
    assert.deepEqual(notificacoesDoContato({ notificacoes: ["financeiro", "x", "financeiro"] }), ["financeiro"]);
    assert.deepEqual(notificacoesDoContato({ notificacoes: "financeiro" }), []);
    assert.deepEqual(notificacoesDoContato({}), []);
  });

  it("junta todos os contatos marcados com o tipo, sem repetir", () => {
    const contatos = [
      { name: "Ana", phone: "(31) 99999-0000", email: "ana@cli.com", notificacoes: ["sem_comunicacao"] },
      { name: "Bia", phone: "31999990000", email: "ANA@cli.com", notificacoes: ["sem_comunicacao", "financeiro"] },
      { name: "Caio", phone: "31988887777", email: "caio@cli.com", notificacoes: ["financeiro"] },
      { name: "Dani", phone: "123", email: "sem-arroba", notificacoes: ["sem_comunicacao"] },
    ];
    const r = destinatariosPorNotificacao(contatos, "sem_comunicacao");
    assert.deepEqual(r.nomes, ["Ana", "Bia", "Dani"]);
    assert.deepEqual(r.phones, ["(31) 99999-0000"]);
    assert.deepEqual(r.emails, ["ana@cli.com"]);
    assert.deepEqual(destinatariosPorNotificacao(contatos, "financeiro").emails, ["ANA@cli.com", "caio@cli.com"]);
    assert.deepEqual(destinatariosPorNotificacao(null, "geral"), { nomes: [], phones: [], emails: [] });
  });

  it("une listas de origens diferentes", () => {
    assert.deepEqual(unirTelefones(["31999990000"], ["(31) 99999-0000", "31977776666"]), ["31999990000", "31977776666"]);
    assert.deepEqual(unirEmails(["a@b.com"], ["A@B.com", "c@d.com", ""]), ["a@b.com", "c@d.com"]);
  });
});
