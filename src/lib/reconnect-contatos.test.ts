import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { chaveNomeSolta, motivoSemEnvio, planejarUnificacao } from "./reconnect-contatos";

const empresas = [
  { id: "e1", name: "Transportes ABC Ltda", contacts: [{ name: "Ana", phone: "(31) 99999-0000", email: "ana@abc.com", notificacoes: ["financeiro"] }] },
  { id: "e2", name: "Mineração Beta S/A", contacts: [] },
  { id: "e3", name: "Gama Log", contacts: [] },
  { id: "e4", name: "Gama Log", contacts: [] },
];

describe("unificação Reconnect → Empresas", () => {
  it("nome solto ignora acento, pontuação e sufixos", () => {
    assert.equal(chaveNomeSolta("Transportes ABC Ltda."), chaveNomeSolta("ABC"));
    assert.equal(chaveNomeSolta("MINERACAO BETA SA"), chaveNomeSolta("Mineração Beta S/A"));
  });

  it("número existente só ganha a marcação; novo é cadastrado marcado", () => {
    const r = planejarUnificacao([
      { id: "c1", name: "ABC", company_id: null, phones: ["31999990000", "31988887777"], emails: ["ANA@abc.com"] },
    ], empresas);
    assert.deepEqual(r.vinculos, [{ clientId: "c1", companyId: "e1", como: "nome_aproximado" }]);
    const e = r.empresas[0];
    assert.equal(e.contacts.length, 2);
    assert.deepEqual(e.contacts[0].notificacoes, ["financeiro", "sem_comunicacao"]);
    assert.equal(e.contacts[1].phone, "31988887777");
    assert.deepEqual(e.contacts[1].notificacoes, ["sem_comunicacao"]);
    assert.deepEqual(e.marcados, ["31999990000"]);
    assert.deepEqual(e.cadastrados, ["31988887777"]);
    assert.equal(r.totais.marcados, 1);
    assert.equal(r.totais.cadastrados, 1);
  });

  it("já marcado não conta de novo; empresa sem mudança fica de fora", () => {
    const r = planejarUnificacao([{ id: "c1", name: "x", company_id: "e1", phones: [], emails: [] }],
      [{ ...empresas[0], contacts: [{ phone: "31999990000", notificacoes: ["sem_comunicacao"] }] }]);
    assert.equal(r.vinculos[0].como, "ja_ligado");
    assert.equal(r.empresas.length, 0);
  });

  it("nome ambíguo ou desconhecido vira evidência; manual resolve", () => {
    const clientes = [
      { id: "c2", name: "Gama Log", company_id: null, phones: ["31977776666"], emails: [], vehicle_count: 3 },
      { id: "c3", name: "Empresa Fantasma", company_id: null, phones: [], emails: [] },
    ];
    const r = planejarUnificacao(clientes, empresas);
    assert.equal(r.naoIdentificados.length, 2);
    assert.match(r.naoIdentificados[0].motivo, /Mais de uma/);
    assert.match(r.naoIdentificados[1].motivo, /Nenhuma empresa/);
    const m = planejarUnificacao(clientes, empresas, { c2: "e4" });
    assert.deepEqual(m.vinculos, [{ clientId: "c2", companyId: "e4", como: "manual" }]);
    assert.equal(m.naoIdentificados.length, 1);
  });

  it("motivo de não envio", () => {
    assert.match(motivoSemEnvio({ company_id: null }, ["whatsapp"]), /Sem empresa/);
    assert.match(motivoSemEnvio({ company_id: "e1", empresa_emails: ["a@b.com"] }, ["whatsapp"]), /sem contato/);
    assert.equal(motivoSemEnvio({ company_id: "e1", empresa_emails: ["a@b.com"] }, ["whatsapp", "email"]), "");
  });
});
