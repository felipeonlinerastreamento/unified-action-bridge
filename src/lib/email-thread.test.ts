import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeSubject, isReplySubject, extractProtocol, stripQuotedReply } from "./email-thread";

describe("email threading", () => {
  test("respostas com RES:/Re:/ENC: casam com o assunto original", () => {
    assert.equal(normalizeSubject("RES: Re: Cadastro no Sistema"), "cadastro no sistema");
    assert.equal(normalizeSubject("ENC: Cadastro no Sistema"), normalizeSubject("Cadastro no Sistema"));
  });
  test("assunto sem prefixo não é resposta", () => {
    assert.equal(isReplySubject("Cadastro no Sistema"), false);
    assert.equal(isReplySubject("RES: Cadastro"), true);
  });
  test("reconhece protocolo do sistema no assunto", () => {
    assert.equal(extractProtocol("Re: [EM-MVPSIEOQ-SHEJ] monitoramento").attendanceId, "EM-MVPSIEOQ-SHEJ");
    assert.equal(extractProtocol("Re: chamado #09135").protocol, "09135");
  });
  test("remove histórico citado", () => {
    assert.equal(stripQuotedReply("Obrigado!\n\nDe: Suporte\nEnviado: ontem"), "Obrigado!");
  });
});
