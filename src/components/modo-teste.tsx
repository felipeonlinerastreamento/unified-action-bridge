import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHAVE_MODO_TESTE } from "@/lib/modo-teste.middleware";

const db = supabase as any;

/** Estado do modo teste do admin logado (tabela modo_teste), espelhado no navegador para o cabeçalho. */
function useModoTeste() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["modo-teste", user?.id],
    enabled: !!user?.id && isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("modo_teste").select("ativo, desde").eq("user_id", user!.id).maybeSingle();
      if (error) return { ativo: false, desde: null as string | null, indisponivel: true };
      return { ativo: !!data?.ativo, desde: (data?.desde as string | null) ?? null, indisponivel: false };
    },
  });
  const ativo = isAdmin && !!q.data?.ativo;
  useEffect(() => {
    try {
      if (ativo) localStorage.setItem(CHAVE_MODO_TESTE, "1");
      else localStorage.removeItem(CHAVE_MODO_TESTE);
    } catch { /* navegador sem storage */ }
  }, [ativo]);
  const alternar = async (ligar: boolean) => {
    const { error } = await db.from("modo_teste").upsert({ user_id: user!.id, ativo: ligar, desde: ligar ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    try { if (ligar) localStorage.setItem(CHAVE_MODO_TESTE, "1"); else localStorage.removeItem(CHAVE_MODO_TESTE); } catch { /* */ }
    await qc.invalidateQueries({ queryKey: ["modo-teste"] });
  };
  return { isAdmin, ativo, desde: q.data?.desde ?? null, indisponivel: !!q.data?.indisponivel, alternar };
}

/** Botão no cabeçalho (só admin) + faixa amarela quando ligado. */
export function ModoTesteBotao() {
  const m = useModoTeste();
  const [abrir, setAbrir] = useState(false);
  if (!m.isAdmin || m.indisponivel) return null;
  return (
    <>
      <Button size="sm" variant={m.ativo ? "default" : "ghost"} className={m.ativo ? "bg-amber-500 hover:bg-amber-600 text-black" : ""} onClick={() => setAbrir(true)} title="Modo teste (simulação)">
        <FlaskConical className="h-4 w-4 mr-1" />{m.ativo ? "Modo teste ligado" : "Modo teste"}
      </Button>
      {abrir && <ModoTesteDialog m={m} onClose={() => setAbrir(false)} />}
    </>
  );
}

export function ModoTesteFaixa() {
  const m = useModoTeste();
  const [abrir, setAbrir] = useState(false);
  if (!m.ativo) return null;
  return (
    <div className="bg-amber-400 text-black text-xs px-4 py-1.5 flex flex-wrap items-center gap-2 justify-between">
      <span><b>MODO TESTE</b> — nada sai para clientes: WhatsApp e e-mail viram prévia; GSystem e Autentique não são alterados. O que você criar fica marcado como teste.</span>
      <Button size="sm" variant="outline" className="h-6 text-xs bg-white/70" onClick={() => setAbrir(true)}>Prévias e opções</Button>
      {abrir && <ModoTesteDialog m={m} onClose={() => setAbrir(false)} />}
    </div>
  );
}

const CANAL: Record<string, string> = { whatsapp: "WhatsApp", email: "E-mail", gsystem: "GSystem", autentique: "Autentique" };

function ModoTesteDialog({ m, onClose }: { m: ReturnType<typeof useModoTeste>; onClose: () => void }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const previas = useQuery({
    queryKey: ["modo-teste-previas"],
    queryFn: async () => {
      const { data } = await db.from("teste_envios").select("*").order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as any[];
    },
  });
  const alternar = async () => {
    setOcupado(true);
    try {
      await m.alternar(!m.ativo);
      toast.success(m.ativo ? "Modo teste desligado: envios voltaram ao normal." : "Modo teste ligado: nada sai para clientes.");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao alterar o modo teste."); }
    finally { setOcupado(false); }
  };
  const limpar = async () => {
    if (!window.confirm("Apagar todos os registros marcados como teste (chamados, termos, oportunidades, tarefas, propostas, contratos) e as prévias? Não dá para desfazer.")) return;
    setOcupado(true);
    try {
      const { data, error } = await db.rpc("limpar_dados_teste");
      if (error) throw new Error(error.message);
      const partes = Object.entries(data ?? {}).filter(([, v]) => v !== 0).map(([k, v]) => `${k}: ${v}`);
      toast.success(partes.length ? `Dados de teste apagados — ${partes.join(", ")}` : "Não havia dados de teste.");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao limpar."); }
    finally { setOcupado(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5" />Modo teste (simulação)</DialogTitle>
          <DialogDescription>
            Vale só para você e só neste navegador enquanto estiver ligado. Rotinas automáticas (lembretes, cobrança, sincronizações) continuam normais.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>WhatsApp e e-mail: <b>não são enviados</b>; aparecem aqui como prévia.</li>
          <li>GSystem e Autentique: <b>nenhuma gravação</b>; a tela mostra o aviso e a prévia fica aqui.</li>
          <li>Chamados, termos, oportunidades, tarefas, propostas e contratos que você criar ficam marcados como <b>teste</b> e podem ser apagados no botão abaixo.</li>
        </ul>
        <div className="border rounded-md max-h-[45vh] overflow-auto">
          {previas.isLoading ? <div className="p-3 text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Carregando…</div>
            : previas.data?.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nenhuma prévia ainda.</p>
            : previas.data?.map((p) => (
              <div key={p.id} className="p-3 border-b last:border-0 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{CANAL[p.canal] ?? p.canal}</Badge>
                  {p.bloqueado && <Badge variant="secondary">bloqueado</Badge>}
                  <span className="font-medium">{p.resumo}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {p.destino && <div className="text-xs text-muted-foreground">Para: {p.destino}</div>}
                {p.conteudo && <pre className="text-xs whitespace-pre-wrap bg-muted rounded p-2 max-h-40 overflow-auto">{p.conteudo}</pre>}
              </div>
            ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={limpar} disabled={ocupado}><Trash2 className="h-4 w-4 mr-1" />Limpar dados de teste</Button>
          <Button onClick={alternar} disabled={ocupado} className={m.ativo ? "" : "bg-amber-500 hover:bg-amber-600 text-black"}>
            {ocupado && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{m.ativo ? "Desligar modo teste" : "Ligar modo teste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
