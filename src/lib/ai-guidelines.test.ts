import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { buildAiGuidelines, normalizeTemperature, parseTopicList } from "./ai-guidelines";

describe("normalizeTemperature", () => {
  it("clamps to 0..1 and falls back to 0.4 when invalid", () => {
    assert.equal(normalizeTemperature(1.7), 1);
    assert.equal(normalizeTemperature(-2), 0);
    assert.equal(normalizeTemperature("0.3"), 0.3);
    assert.equal(normalizeTemperature("abc"), 0.4);
    assert.equal(normalizeTemperature(null), 0.4);
  });
});

describe("parseTopicList", () => {
  it("splits by line or semicolon and strips bullets", () => {
    assert.deepEqual(parseTopicList("- desconto\n• senha do rastreador; cancelar débito\n\n"), [
      "desconto",
      "senha do rastreador",
      "cancelar débito",
    ]);
  });
});

describe("buildAiGuidelines", () => {
  it("lists every forbidden topic", () => {
    const g = buildAiGuidelines({ forbidden_topics: "desconto\nsenha" });
    assert.ok(g.includes("PROIBIDO"));
    assert.ok(g.includes("• desconto"));
    assert.ok(g.includes("• senha"));
  });
  it("adds the strict rule only when creativity is strict (<= 0.25)", () => {
    assert.ok(buildAiGuidelines({ temperature: 0.2 }).includes("ESTRITAMENTE"));
    assert.ok(!buildAiGuidelines({ temperature: 0.7 }).includes("ESTRITAMENTE"));
  });
  it("includes the fallback conduct only when configured", () => {
    assert.ok(buildAiGuidelines({ fallback_message: "Transfira ao setor responsável" }).includes("Transfira ao setor responsável"));
    assert.ok(!buildAiGuidelines({}).includes("conduta"));
  });
  it("uses the chosen tone and defaults to consultivo", () => {
    assert.ok(buildAiGuidelines({ tone: "formal" }).includes("formal e corporativa"));
    assert.ok(buildAiGuidelines({ tone: "xyz" }).includes("consultivo e empático"));
  });
  it("edge function copy stays identical to this module", () => {
    const edge = readFileSync("supabase/functions/ai-assistant/index.ts", "utf8");
    const local = readFileSync("src/lib/ai-guidelines.ts", "utf8");
    const block = (src: string) => src.slice(src.indexOf("// >>> guidelines"), src.indexOf("// <<< guidelines"));
    const edgeBlock = block(edge);
    assert.ok(edgeBlock.length > 100, "edge function must contain the guidelines block");
    assert.equal(edgeBlock, block(local));
  });
});
