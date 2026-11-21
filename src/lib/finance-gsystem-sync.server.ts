/**
 * Importa as faturas do GSystem para o Financeiro como contas a receber.
 * A API só devolve faturas por cliente (GET /faturas/{cpfCnpj}), então a importação percorre
 * os clientes em lotes com limite de tempo e guarda em fin_gsystem_sync de onde continuar.
 * Server-only (usa a service role).
 */
import { gsystemApiFetch, listGSystemClientes } from "@/lib/gsystem-api.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hojeSP } from "@/lib/finance";
import {
  listaDeFaturas, clienteDoGsystem, converterFatura, atualizacaoDeFatura, formatarDocumento, deveImportar,
  type ClienteGsystem, type FaturaGsystem,
} from "@/lib/finance-gsystem";

const SYNC_ID = "faturas";
const CONCORRENCIA = 4;
const db = supabaseAdmin as any;

export type ResultadoSyncFaturas = {
  ok: boolean;
  concluido: boolean;
  processados: number;
  proximoIndice: number;
  totalClientes: number;
  novas: number;
  atualizadas: number;
  erros: number;
  error?: string;
};

async function faturasDoCliente(c: ClienteGsystem): Promise<any[]> {
  try {
    return listaDeFaturas(await gsystemApiFetch(`/faturas/${encodeURIComponent(c.documento)}`));
  } catch (e: any) {
    // Cliente sem faturas costuma voltar 404.
    if (/\[404\]/.test(String(e?.message ?? e))) return [];
    throw e;
  }
}

/**
 * Roda um lote. `limiteMs` é o tempo máximo antes de parar e salvar o ponto de parada.
 * Chame de novo até `concluido` = true para terminar a rodada completa.
 */
export async function syncFaturasGsystem(limiteMs = 45_000): Promise<ResultadoSyncFaturas> {
  const inicio = Date.now();
  const agora = () => new Date().toISOString();
  const { data: estado } = await db.from("fin_gsystem_sync").select("*").eq("id", SYNC_ID).maybeSingle();
  let indice: number = estado?.proximo_indice ?? 0;
  const novaRodada = indice === 0;
  let novas = novaRodada ? 0 : estado?.faturas_novas ?? 0;
  let atualizadas = novaRodada ? 0 : estado?.faturas_atualizadas ?? 0;
  let erros = novaRodada ? 0 : estado?.erros ?? 0;
  let ultimoErro: string | null = novaRodada ? null : estado?.ultimo_erro ?? null;
  let processados = 0;
  const hoje = hojeSP();

  try {
    const [{ data: cats }, { data: emp }] = await Promise.all([
      db.from("fin_categorias").select("id, nome").eq("tipo", "receita"),
      db.from("fin_empresas").select("id").eq("codigo", "OR").maybeSingle(),
    ]);
    const catId = (nome: string) => (cats || []).find((c: any) => c.nome === nome)?.id ?? null;

    // Ordem estável entre execuções: por documento, sem repetir documento.
    const vistos = new Set<string>();
    const clientes = (await listGSystemClientes())
      .map(clienteDoGsystem)
      .filter((c): c is ClienteGsystem => !!c && !vistos.has(c.documento) && !!vistos.add(c.documento))
      .sort((a, b) => a.documento.localeCompare(b.documento));
    if (indice >= clientes.length) indice = 0;

    await db.from("fin_gsystem_sync").upsert({
      id: SYNC_ID,
      proximo_indice: indice,
      total_clientes: clientes.length,
      ...(indice === 0 ? { rodada_iniciada_em: agora(), faturas_novas: 0, faturas_atualizadas: 0, erros: 0, ultimo_erro: null } : {}),
      ultima_execucao_em: agora(),
      updated_at: agora(),
    });

    const gravar = async (c: ClienteGsystem, faturas: FaturaGsystem[]) => {
      if (!faturas.length) return;
      const { data: existentes, error } = await db
        .from("fin_lancamentos")
        .select("id, gsystem_fatura_key, status, valor, vencimento, data_pagamento, valor_pago")
        .in("gsystem_fatura_key", faturas.map((f) => f.chave));
      if (error) throw error;
      const porChave = new Map<string, any>((existentes || []).map((e: any) => [e.gsystem_fatura_key, e]));
      const inserir: any[] = [];
      for (const f of faturas) {
        const atual = porChave.get(f.chave);
        if (atual) {
          const mud = atualizacaoDeFatura(atual, f);
          if (mud) {
            const { error: e2 } = await db.from("fin_lancamentos").update(mud).eq("id", atual.id);
            if (e2) throw e2;
            atualizadas++;
          }
          continue;
        }
        porChave.set(f.chave, true); // evita repetir a mesma chave na mesma resposta
        inserir.push({
          tipo: "receber",
          empresa_id: emp?.id ?? null,
          categoria_id: catId(f.categoria),
          contraparte: c.nome,
          documento_contraparte: formatarDocumento(c.documento),
          descricao: f.descricao ?? `Fatura GSystem${f.numero ? ` nº ${f.numero}` : ""}`,
          valor: f.valor,
          data_emissao: f.emissao,
          vencimento: f.vencimento,
          status: f.status,
          data_pagamento: f.dataPagamento,
          valor_pago: f.valorPago,
          forma_pagamento: "boleto",
          tipo_documento: "fatura",
          numero_documento: f.numero,
          linha_digitavel: f.linhaDigitavel,
          arquivo_url: f.link,
          origem: "gsystem",
          gsystem_fatura_key: f.chave,
          gsystem_cliente_key: c.key,
          revisado: true,
        });
      }
      if (inserir.length) {
        const { error: e3 } = await db.from("fin_lancamentos").insert(inserir);
        if (e3) throw e3;
        novas += inserir.length;
      }
    };

    while (indice < clientes.length && Date.now() - inicio < limiteMs) {
      const lote = clientes.slice(indice, indice + CONCORRENCIA);
      await Promise.all(
        lote.map(async (c) => {
          try {
            const faturas = (await faturasDoCliente(c))
              .map((f) => converterFatura(f, c))
              .filter((f): f is FaturaGsystem => !!f && deveImportar(f, hoje));
            await gravar(c, faturas);
          } catch (e: any) {
            erros++;
            ultimoErro = `${c.nome}: ${String(e?.message ?? e)}`.slice(0, 500);
          }
        }),
      );
      indice += lote.length;
      processados += lote.length;
    }

    const concluido = indice >= clientes.length;
    await db.from("fin_gsystem_sync").upsert({
      id: SYNC_ID,
      proximo_indice: concluido ? 0 : indice,
      total_clientes: clientes.length,
      faturas_novas: novas,
      faturas_atualizadas: atualizadas,
      erros,
      ultimo_erro: ultimoErro,
      ultima_execucao_em: agora(),
      ...(concluido ? { ultima_rodada_concluida_em: agora() } : {}),
      updated_at: agora(),
    });
    return { ok: true, concluido, processados, proximoIndice: concluido ? 0 : indice, totalClientes: clientes.length, novas, atualizadas, erros };
  } catch (e: any) {
    const msg = String(e?.message ?? e).slice(0, 500);
    await db.from("fin_gsystem_sync").upsert({ id: SYNC_ID, proximo_indice: indice, ultimo_erro: msg, ultima_execucao_em: agora(), updated_at: agora() });
    return { ok: false, concluido: false, processados, proximoIndice: indice, totalClientes: 0, novas, atualizadas, erros, error: msg };
  }
}
