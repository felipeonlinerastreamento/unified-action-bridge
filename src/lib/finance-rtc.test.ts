import { test } from "node:test";
import assert from "node:assert/strict";
import { lerTributosRtc, resumoRtc } from "./finance-rtc";

const item = (vBC: string, pCBS: string, vCBS: string, pUF: string, vUF: string, extra = "") => `
<det nItem="1"><imposto><IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib>
  <gIBSCBS><vBC>${vBC}</vBC>
    <gIBSUF><pIBSUF>${pUF}</pIBSUF><vIBSUF>${vUF}</vIBSUF></gIBSUF>
    <gIBSMun><pIBSMun>0.00</pIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun>
    <vIBS>${vUF}</vIBS>
    <gCBS><pCBS>${pCBS}</pCBS>${extra}<vCBS>${vCBS}</vCBS></gCBS>
  </gIBSCBS></IBSCBS></imposto></det>`;

test("lê CBS/IBS por item e pelos totais da NF-e (ano-teste 0,9% e 0,1%)", () => {
  const xml = `<nfeProc><NFe><infNFe Id="NFe123">${item("1000.00", "0.90", "9.00", "0.10", "1.00")}${item("500.00", "0.90", "4.50", "0.10", "0.50")}
    <total><IBSCBSTot><vBCIBSCBS>1500.00</vBCIBSCBS><gIBS><gIBSUF><vIBSUF>1.50</vIBSUF></gIBSUF><gIBSMun><vIBSMun>0.00</vIBSMun></gIBSMun><vIBS>1.50</vIBS></gIBS>
    <gCBS><vCBS>13.50</vCBS></gCBS></IBSCBSTot></total></infNFe></NFe></nfeProc>`;
  const t = lerTributosRtc(xml)!;
  assert.equal(t.itens.length, 2);
  assert.equal(t.base, 1500);
  assert.equal(t.cbs, 13.5);
  assert.equal(t.ibs, 1.5);
  assert.deepEqual(t.classificacoes, ["000/000001"]);
  assert.equal(t.divergencias.length, 0);
});

test("aponta divergência entre base × alíquota e o valor informado", () => {
  const t = lerTributosRtc(`<NFe>${item("1000.00", "0.90", "12.00", "0.10", "1.00")}</NFe>`)!;
  assert.equal(t.cbs, 12);
  assert.deepEqual(t.divergencias, [{ item: 1, tributo: "CBS", esperado: 9, informado: 12 }]);
  assert.match(resumoRtc(t), /informado R\$ 12.00, esperado R\$ 9.00/);
});

test("usa a alíquota efetiva quando há redução e ignora notas sem a reforma", () => {
  const t = lerTributosRtc(`<NFe>${item("1000.00", "0.90", "5.40", "0.10", "1.00", "<pAliqEfetCBS>0.54</pAliqEfetCBS>")}</NFe>`)!;
  assert.equal(t.divergencias.length, 0);
  assert.equal(lerTributosRtc("<NFe><ICMSTot><vNF>10</vNF></ICMSTot></NFe>"), null);
});
