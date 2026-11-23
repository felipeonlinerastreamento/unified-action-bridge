import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
const expect = (v: unknown) => ({ toBe: (e: unknown) => assert.equal(v, e), toEqual: (e: unknown) => assert.deepEqual(v, e) });
import { computeKpis, summaryByModel, isReady, isAwaitingChip, normalizePlate } from "./estoque-kpis";

describe("estoque KPIs", () => {
  it("pronto para instalação = Disponível com chip", () => {
    expect(isReady({ Status: "Disponível", Chip: "8955 - (11) 9" })).toBe(true);
    expect(isReady({ Status: "Disponível", Chip: "" })).toBe(false);
    expect(isReady({ Status: "Vinculado", Chip: "8955" })).toBe(false);
  });
  it("aguardando chip = Sem_Chip ou Disponível sem chip", () => {
    expect(isAwaitingChip({ Status: "Sem_Chip" })).toBe(true);
    expect(isAwaitingChip({ Status: "Disponível", Chip: null })).toBe(true);
    expect(isAwaitingChip({ Status: "Extraviado" })).toBe(false);
  });
  it("conta técnicos e vinculados", () => {
    const k = computeKpis([
      { Status: "Vinculado", Tecnico: null },
      { Status: "Disponível", Chip: "x", Tecnico: "João" },
      { Status: "Sem_Chip" },
    ]);
    expect(k).toEqual({ ready: 1, awaiting: 1, tecnico: 1, linked: 1 });
  });
  it("resumo por modelo ignora vinculados", () => {
    const s = summaryByModel([
      { Modelo: "J16", Status: "Disponível", Chip: "x" },
      { Modelo: "J16", Status: "Sem_Chip" },
      { Modelo: "J16", Status: "Vinculado", Chip: "x" },
    ]);
    expect(s).toEqual([{ modelo: "J16", ready: 1, awaiting: 1 }]);
  });
  it("normaliza placa", () => {
    expect(normalizePlate("tzb-8b08")).toBe("TZB8B08");
  });
});

import { classificarStatusEstoque } from "./estoque-kpis";
describe("classificarStatusEstoque", () => {
  it("equipamento sem chip e chip sem equipamento contam como disponíveis", () => {
    for (const st of ["Disponível", "Sem_Chip", "Sem Equipamento", "Sem_Equipamento", "Estoque", "Desvinculado", "Ativo", "Ativado"]) {
      expect(classificarStatusEstoque(st)).toBe("disponivel");
    }
  });
  it("vinculado, inativo e vazio", () => {
    expect(classificarStatusEstoque("Vinculado")).toBe("vinculado");
    expect(classificarStatusEstoque("Em uso")).toBe("vinculado");
    expect(classificarStatusEstoque("Inativo")).toBe("inativo");
    expect(classificarStatusEstoque("Cancelado")).toBe("inativo");
    expect(classificarStatusEstoque("")).toBe("outro");
  });
});

