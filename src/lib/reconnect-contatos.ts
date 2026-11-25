/**
 * Unificação dos clientes do Reconnect com o cadastro de Empresas.
 * Os avisos de veículo sem comunicação passam a sair só dos contatos da empresa marcados
 * "Veículo sem comunicação" (Empresas › Contatos). Esta regra leva os telefones/e-mails que
 * estavam no cliente do Reconnect para a empresa: se o número/e-mail já existe num contato,
 * só marca a opção; se não existe, cadastra um contato novo já marcado.
 */
import { digitos, emailValido, notificacoesDoContato } from "./contato-notificacoes";
import { normalizeClientKey } from "./reconnect";

export type RcClienteUnif = { id: string; name: string; company_id: string | null; phones: string[] | null; emails: string[] | null; vehicle_count?: number | null };
export type EmpresaUnif = { id: string; name: string; contacts: unknown; emails?: string[] | null };
type Contato = Record<string, unknown> & { name?: string; phone?: string; email?: string; sector?: string; notificacoes?: string[] };

const SUFIXOS = /\b(ltda|me|epp|eireli|s\s?a|s\/a|cia|comercio|com|ind|industria|servicos|serv|transportes?|transp|logistica)\b/g;

/** Chave "solta" do nome: sem acento, pontuação e sufixos societários (usada só quando aponta para uma única empresa). */
export function chaveNomeSolta(v: string): string {
  return normalizeClientKey(v).replace(/[^a-z0-9/ ]/g, " ").replace(SUFIXOS, " ").replace(/[^a-z0-9]/g, "");
}

export type ResultadoUnificacao = {
  /** Empresa encontrada para cada cliente (inclui os já ligados). */
  vinculos: { clientId: string; companyId: string; como: "ja_ligado" | "nome" | "nome_aproximado" | "manual" }[];
  /** Contatos novos de cada empresa (lista completa para gravar). */
  empresas: { companyId: string; companyName: string; contacts: Contato[]; marcados: string[]; cadastrados: string[] }[];
  /** Clientes sem empresa identificada (evidência para tratar à mão). */
  naoIdentificados: { clientId: string; name: string; phones: string[]; emails: string[]; vehicle_count: number; motivo: string; sugestoes: string[] }[];
  totais: { clientes: number; ligados: number; marcados: number; cadastrados: number; naoIdentificados: number };
};

/**
 * Planeja a unificação (não grava nada). `manuais` liga clientes a empresas escolhidas à mão.
 */
export function planejarUnificacao(clientes: RcClienteUnif[], empresas: EmpresaUnif[], manuais: Record<string, string> = {}): ResultadoUnificacao {
  const porId = new Map(empresas.map((e) => [e.id, e]));
  const porNome = new Map<string, EmpresaUnif[]>();
  const porSolta = new Map<string, EmpresaUnif[]>();
  for (const e of empresas) {
    const k = normalizeClientKey(e.name);
    porNome.set(k, [...(porNome.get(k) ?? []), e]);
    const s = chaveNomeSolta(e.name);
    if (s) porSolta.set(s, [...(porSolta.get(s) ?? []), e]);
  }

  const contatosDe = new Map<string, Contato[]>();
  const marcados = new Map<string, Set<string>>();
  const cadastrados = new Map<string, Set<string>>();
  const out: ResultadoUnificacao = { vinculos: [], empresas: [], naoIdentificados: [], totais: { clientes: clientes.length, ligados: 0, marcados: 0, cadastrados: 0, naoIdentificados: 0 } };

  for (const c of clientes) {
    let emp: EmpresaUnif | undefined;
    let como: ResultadoUnificacao["vinculos"][number]["como"] = "ja_ligado";
    let motivo = "";
    if (manuais[c.id] && porId.has(manuais[c.id])) { emp = porId.get(manuais[c.id]); como = "manual"; }
    else if (c.company_id && porId.has(c.company_id)) emp = porId.get(c.company_id);
    else {
      const exatos = porNome.get(normalizeClientKey(c.name)) ?? [];
      const soltos = porSolta.get(chaveNomeSolta(c.name)) ?? [];
      if (exatos.length === 1) { emp = exatos[0]; como = "nome"; }
      else if (exatos.length > 1) motivo = `Mais de uma empresa com o mesmo nome (${exatos.length})`;
      else if (soltos.length === 1) { emp = soltos[0]; como = "nome_aproximado"; }
      else if (soltos.length > 1) motivo = `Nome parecido com ${soltos.length} empresas`;
      else motivo = "Nenhuma empresa com esse nome no cadastro";
    }
    const phones = (c.phones || []).map(String).filter((p) => digitos(p).length >= 10);
    const emails = (c.emails || []).map((e) => String(e).trim()).filter(emailValido);
    if (!emp) {
      const s = chaveNomeSolta(c.name);
      const sugestoes = s.length >= 4
        ? empresas.filter((e) => { const k = chaveNomeSolta(e.name); return k.length >= 4 && (k.includes(s) || s.includes(k)); }).slice(0, 5).map((e) => e.name)
        : [];
      out.naoIdentificados.push({ clientId: c.id, name: c.name, phones, emails, vehicle_count: Number(c.vehicle_count ?? 0), motivo, sugestoes });
      continue;
    }
    out.vinculos.push({ clientId: c.id, companyId: emp.id, como });

    if (!contatosDe.has(emp.id)) {
      const base = Array.isArray(emp.contacts) ? (emp.contacts as Contato[]).map((x) => ({ ...x })) : [];
      contatosDe.set(emp.id, base);
      marcados.set(emp.id, new Set());
      cadastrados.set(emp.id, new Set());
    }
    const lista = contatosDe.get(emp.id)!;
    const marcar = (ct: Contato) => {
      const n = notificacoesDoContato(ct);
      if (!n.includes("sem_comunicacao")) { ct.notificacoes = [...n, "sem_comunicacao"]; return true; }
      return false;
    };
    for (const p of phones) {
      const d = digitos(p);
      const ex = lista.find((ct) => { const x = digitos(ct.phone); return x && (x === d || x.slice(-10) === d.slice(-10)); });
      if (ex) { if (marcar(ex)) marcados.get(emp.id)!.add(p); }
      else { lista.push({ name: "Contato Reconnect", sector: "", phone: p, email: "", is_prime: false, notificacoes: ["sem_comunicacao"] }); cadastrados.get(emp.id)!.add(p); }
    }
    for (const e of emails) {
      const ex = lista.find((ct) => String(ct.email ?? "").trim().toLowerCase() === e.toLowerCase());
      if (ex) { if (marcar(ex)) marcados.get(emp.id)!.add(e); }
      else { lista.push({ name: "Contato Reconnect", sector: "", phone: "", email: e, is_prime: false, notificacoes: ["sem_comunicacao"] }); cadastrados.get(emp.id)!.add(e); }
    }
  }

  for (const [id, contacts] of contatosDe) {
    const m = [...marcados.get(id)!], n = [...cadastrados.get(id)!];
    if (!m.length && !n.length) continue;
    out.empresas.push({ companyId: id, companyName: porId.get(id)!.name, contacts, marcados: m, cadastrados: n });
  }
  out.totais.ligados = out.vinculos.length;
  out.totais.marcados = out.empresas.reduce((s, e) => s + e.marcados.length, 0);
  out.totais.cadastrados = out.empresas.reduce((s, e) => s + e.cadastrados.length, 0);
  out.totais.naoIdentificados = out.naoIdentificados.length;
  return out;
}

// ---------------------------------------------------------------------------
// Envio: só os contatos da empresa marcados "Veículo sem comunicação".

export type DestinoCliente = { company_id: string | null; empresa_phones?: string[]; empresa_emails?: string[] };

/** Motivo de um cliente não poder receber pelos canais escolhidos (ou "" se pode). */
export function motivoSemEnvio(c: DestinoCliente, canais: ("whatsapp" | "email")[]): string {
  if (!c.company_id) return "Sem empresa ligada no cadastro de Empresas";
  const ok = canais.some((x) => (x === "whatsapp" ? (c.empresa_phones || []).length : (c.empresa_emails || []).length));
  return ok ? "" : "Empresa sem contato marcado \"Veículo sem comunicação\" para os canais escolhidos";
}
