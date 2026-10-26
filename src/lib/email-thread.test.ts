import { describe, expect, test } from "bun:test";
import { normalizeSubject, isReplySubject, extractProtocol, stripQuotedReply } from "./email-thread";

describe("email threading", () => {
  test("respostas com RES:/Re:/ENC: casam com o assunto original", () => {
    expect(normalizeSubject("RES: Re: Cadastro no Sistema")).toBe("cadastro no sistema");
    expect(normalizeSubject("ENC: Cadastro no Sistema")).toBe(normalizeSubject("Cadastro no Sistema"));
  });
  test("assunto sem prefixo não é resposta", () => {
    expect(isReplySubject("Cadastro no Sistema")).toBe(false);
    expect(isReplySubject("RES: Cadastro")).toBe(true);
  });
  test("reconhece protocolo do sistema no assunto", () => {
    expect(extractProtocol("Re: [EM-MVPSIEOQ-SHEJ] monitoramento").attendanceId).toBe("EM-MVPSIEOQ-SHEJ");
    expect(extractProtocol("Re: chamado #09135").protocol).toBe("09135");
  });
  test("remove histórico citado", () => {
    expect(stripQuotedReply("Obrigado!\n\nDe: Suporte\nEnviado: ontem")).toBe("Obrigado!");
  });
});
