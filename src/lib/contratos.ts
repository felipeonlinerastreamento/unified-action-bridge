/**
 * Regras puras do gestor de Contratos (testadas em contratos.test.ts):
 * campos dos modelos, qualificação do contratante, montagem do texto, vigência/situação,
 * máscara de dados e trilha de auditoria.
 */

export type StatusContrato = "rascunho" | "enviado" | "assinado" | "cancelado";
export type SituacaoContrato = StatusContrato | "vigente" | "vencendo" | "encerrado";

export type Veiculo = { placa: string; chassi?: string; renavam?: string; marca?: string; modelo?: string; ano?: string };

/** Dados preenchidos no editor (ficam em contratos.dados). */
export type DadosContrato = {
  tipo_pessoa: "PJ" | "PF";
  cliente_nome: string;
  cliente_documento: string;
  endereco: string;
  representante_nome?: string;
  representante_rg?: string;
  representante_cpf?: string;
  estado_civil?: string;
  profissao?: string;
  rg?: string;
  planos: string[];          // simples, porta, monitriip, frotas, video
  instalacao: "credenciado" | "cliente";
  vigencia_meses: number;
  vigencia_inicio: string;   // AAAA-MM-DD
  remuneracao?: string;
  veiculos: Veiculo[];
  equipamentos?: string;
  kit_instalacao?: string;
  valor_implantacao?: string;
  valor_mensalidade?: string;
  valor_visita_frustrada?: string;
  valor_telemetria?: string;
  valor_identificador?: string;
  valor_modulo_camera?: string;
  valor_camera_motorista?: string;
  valor_cracha?: string;
  email_cobranca?: string;
  local?: string;
  data_documento?: string;   // AAAA-MM-DD
};

export const PLANOS = [
  { key: "simples", label: "Rastreamento Simples" },
  { key: "porta", label: "Simples com Alerta de Porta Aberta" },
  { key: "monitriip", label: "Rastreamento com Monitriip" },
  { key: "frotas", label: "Rastreamento de Frotas" },
  { key: "video", label: "Rastreamento com Vídeo Monitoramento" },
] as const;

export const STATUS_LABEL: Record<SituacaoContrato, string> = {
  rascunho: "Rascunho", enviado: "Aguardando assinatura", assinado: "Assinado", cancelado: "Cancelado",
  vigente: "Vigente", vencendo: "Vencendo", encerrado: "Encerrado",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const NUMEROS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze",
  "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte"];

export const soDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

export function formatarDoc(doc: string): string {
  const d = soDigitos(doc);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

/** CPF mascarado para a trilha pública: ***.456.789-** */
export function mascararCpf(cpf: string): string {
  const d = soDigitos(cpf);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "***";
}

/** Telefone/e-mail mascarados para dizer onde o código foi enviado. */
export function mascararDestino(destino: string): string {
  if (destino.includes("@")) {
    const [u, dom] = destino.split("@");
    return `${u.slice(0, 2)}***@${dom}`;
  }
  const d = soDigitos(destino);
  return d.length >= 4 ? `(**) *****-${d.slice(-4)}` : "***";
}

export function dataExtenso(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function mesesExtenso(n: number): string {
  return `${String(n).padStart(2, "0")} (${n <= 20 ? NUMEROS[n] : String(n)}) meses`;
}

/** Qualificação do contratante: PJ com representante; PF com estado civil, profissão, RG e CPF. */
export function qualificacao(d: DadosContrato): string {
  const doc = formatarDoc(d.cliente_documento);
  if (d.tipo_pessoa === "PF") {
    const partes = [d.cliente_nome, d.estado_civil, d.profissao, d.rg ? `RG nº ${d.rg}` : "", `inscrito(a) no CPF sob nº ${doc}`, `residente à ${d.endereco}`];
    return partes.filter((p) => p && p.trim()).join(", ");
  }
  const rep = d.representante_nome
    ? `, representada por ${d.representante_nome}${d.representante_rg ? `, RG nº ${d.representante_rg}` : ""}${d.representante_cpf ? `, inscrito(a) no CPF sob nº ${formatarDoc(d.representante_cpf)}` : ""}`
    : "";
  return `${d.cliente_nome}, inscrita no CNPJ sob nº ${doc}, situada à ${d.endereco}${rep}`;
}

export function textoVeiculos(vs: Veiculo[]): string {
  if (!vs.length) return "Conforme relação de veículos a ser instalada.";
  return vs.map((v, i) => {
    const campos = [
      `Placa ${v.placa.toUpperCase()}`,
      v.chassi ? `Chassi ${v.chassi}` : "",
      v.renavam ? `Renavam ${v.renavam}` : "",
      [v.marca, v.modelo].filter(Boolean).join(" "),
      v.ano ? `Ano ${v.ano}` : "",
    ].filter(Boolean);
    return `${i + 1}. ${campos.join(" — ")}`;
  }).join("\n");
}

/** Valores de cada campo {{...}} dos modelos a partir dos dados. */
export function variaveisDe(d: DadosContrato, extras: { assinaturas?: string } = {}): Record<string, string> {
  const x = (cond: boolean) => (cond ? "(X)" : "( )");
  const hoje = d.data_documento || d.vigencia_inicio;
  return {
    cliente_qualificacao: qualificacao(d),
    "x:plano_simples": x(d.planos.includes("simples")),
    "x:plano_porta": x(d.planos.includes("porta")),
    "x:plano_monitriip": x(d.planos.includes("monitriip")),
    "x:plano_frotas": x(d.planos.includes("frotas")),
    "x:plano_video": x(d.planos.includes("video")),
    "x:instalacao_credenciado": x(d.instalacao === "credenciado"),
    "x:instalacao_cliente": x(d.instalacao === "cliente"),
    vigencia_texto: mesesExtenso(d.vigencia_meses || 12),
    vigencia_inicio_extenso: d.vigencia_inicio ? dataExtenso(d.vigencia_inicio) : "",
    remuneracao: d.remuneracao?.trim() || remuneracaoPadrao(d),
    veiculos: textoVeiculos(d.veiculos || []),
    equipamentos: d.equipamentos ?? "",
    kit_instalacao: d.kit_instalacao ?? "",
    valor_implantacao: d.valor_implantacao ?? "",
    valor_mensalidade: d.valor_mensalidade ?? "",
    valor_visita_frustrada: d.valor_visita_frustrada ?? "",
    valor_telemetria: d.valor_telemetria ?? "",
    valor_identificador: d.valor_identificador ?? "",
    valor_modulo_camera: d.valor_modulo_camera ?? "",
    valor_camera_motorista: d.valor_camera_motorista ?? "",
    valor_cracha: d.valor_cracha ?? "",
    email_cobranca: d.email_cobranca ?? "",
    local: d.local || "São José da Lapa, MG",
    data_extenso: hoje ? dataExtenso(hoje) : "",
    assinaturas: extras.assinaturas ?? "Assinado eletronicamente pelas partes, conforme página de registro de assinaturas.",
  };
}

export function remuneracaoPadrao(d: DadosContrato): string {
  const partes = [];
  if (d.valor_implantacao) partes.push(`Implantação de R$ ${d.valor_implantacao}`);
  if (d.valor_mensalidade) partes.push(`mensalidade de R$ ${d.valor_mensalidade}`);
  return partes.length ? `${partes.join("; ")}, conforme Termo de Adesão (Anexo I).` : "Conforme Termo de Adesão (Anexo I).";
}

/** Troca {{campo}} pelo valor; campo vazio vira linha em branco para não sumir do texto. */
export function preencher(modelo: string, vars: Record<string, string>): string {
  return modelo.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v != null && String(v).trim() !== "" ? String(v) : "__________";
  });
}

/** Campos do modelo que ficaram sem valor (para avisar antes de enviar). */
export function camposFaltando(modelo: string, vars: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const m of modelo.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    const v = vars[m[1]];
    if (v == null || String(v).trim() === "") out.add(m[1]);
  }
  return [...out];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Texto preenchido → HTML simples. Linha curta toda em maiúsculas vira título. */
export function textoParaHtml(texto: string): string {
  return texto.split(/\n{2,}/).map((bloco) => {
    const t = bloco.trim();
    if (!t) return "";
    const semNum = t.replace(/[\d.\-–—()IVX ]/g, "");
    const titulo = t.length <= 90 && !t.includes("\n") && semNum.length > 3 && semNum === semNum.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(semNum);
    const html = esc(t).replace(/\n/g, "<br/>");
    return titulo ? `<h3>${html}</h3>` : `<p>${html}</p>`;
  }).filter(Boolean).join("\n");
}

/** Documento final: contrato + Anexo I (Termo de Adesão). */
export function montarDocumento(modeloContrato: string, modeloTermo: string, d: DadosContrato, extras: { assinaturas?: string } = {}) {
  const vars = variaveisDe(d, extras);
  const contrato = preencher(modeloContrato, vars);
  const termo = preencher(modeloTermo, vars);
  const html = `<section class="contrato">${textoParaHtml(contrato)}</section>\n<section class="anexo"><h2>ANEXO I</h2>\n${textoParaHtml(termo)}</section>`;
  const faltando = [...new Set([...camposFaltando(modeloContrato, vars), ...camposFaltando(modeloTermo, vars)])];
  return { html, faltando };
}

export function somaMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const total = y * 12 + (m - 1) + meses;
  const ny = Math.floor(total / 12), nm = total % 12;
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/** Fim do período atual. Com renovação automática, avança de período em período até passar de hoje. */
export function fimVigencia(inicio: string, meses: number, renovacao: boolean, hoje: string): string {
  let fim = somaMeses(inicio, meses);
  if (!renovacao) return fim;
  let guarda = 0;
  while (fim < hoje && guarda++ < 100) fim = somaMeses(fim, meses);
  return fim;
}

/** Situação para a lista: depois de assinado, vira vigente / vencendo (≤ 60 dias) / encerrado. */
export function situacao(c: { status: StatusContrato; vigencia_inicio?: string | null; vigencia_meses?: number | null; renovacao_automatica?: boolean | null }, hoje: string, aviso = 60): SituacaoContrato {
  if (c.status !== "assinado" || !c.vigencia_inicio) return c.status;
  const fim = fimVigencia(c.vigencia_inicio, c.vigencia_meses || 12, c.renovacao_automatica !== false, hoje);
  if (fim < hoje) return "encerrado";
  const dias = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
  return dias <= aviso ? "vencendo" : "vigente";
}

export const EVENTO_LABEL: Record<string, string> = {
  criado: "Contrato criado",
  enviado: "Enviado para assinatura",
  reenviado: "Link reenviado",
  visualizado: "Aberto pelo signatário (CPF conferido)",
  codigo_enviado: "Código de verificação enviado",
  codigo_invalido: "Código de verificação incorreto",
  assinado_contratante: "Assinado pelo CONTRATANTE",
  assinado_contratada: "Assinado pela CONTRATADA",
  assinado_testemunha: "Assinado por testemunha",
  cancelado: "Contrato cancelado",
  recusado: "Recusado pelo signatário",
};

/** Código de 6 dígitos. */
export function gerarCodigo(rand: () => number = Math.random): string {
  return String(Math.floor(rand() * 1_000_000)).padStart(6, "0");
}

export const MAX_TENTATIVAS_CODIGO = 5;
export const VALIDADE_CODIGO_MIN = 10;

export type BlocoTexto = { tipo: "h2" | "h3" | "p"; texto: string };

/** Volta o HTML gerado por textoParaHtml/montarDocumento para blocos de texto (usado no PDF). */
export function htmlParaBlocos(html: string): BlocoTexto[] {
  const des = (s: string) => s.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const out: BlocoTexto[] = [];
  for (const m of html.matchAll(/<(h2|h3|p)>([\s\S]*?)<\/\1>/g)) {
    const texto = des(m[2]).trim();
    if (texto) out.push({ tipo: m[1] as BlocoTexto["tipo"], texto });
  }
  return out;
}

/** Troca caracteres que a fonte padrão do PDF (WinAnsi) não tem. */
export function textoSeguroPdf(s: string): string {
  return s
    .replace(/[‐-‒]/g, "-")
    .replace(/[-▪-●•]/g, "•")
    .replace(/ /g, " ")
    .replace(/[^\n\t\x20-\x7E¡-ÿ–—‘’“”•…€]/g, "");
}

/** Telefone em formato internacional para o Autentique (+55...). */
export function telefoneInternacional(tel: string): string | null {
  const d = soDigitos(tel);
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
}
