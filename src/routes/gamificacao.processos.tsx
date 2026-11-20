import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readingStatus } from "@/lib/gamif-rules";
import { useMyRoles, useMyUserId, useRanking, useSectors, fmtDate, fmtDateTime, MD_CLASS } from "@/components/gamificacao/gamif-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gamificacao/processos")({
  head: () => ({ meta: [{ title: "Processos da Gamificação | GS Hub" }, { name: "description", content: "Processos por setor com versões, histórico de mudanças e confirmação de leitura." }, { property: "og:title", content: "Processos da Gamificação | GS Hub" }, { property: "og:description", content: "Processos, versões e confirmação de leitura." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProcessosPage,
});

const READ_LABEL = { lido: "Lido", desatualizado: "Nova versão para ler", pendente: "Leitura pendente" } as const;

function ProcessosPage() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const { data: roles = [] } = useMyRoles();
  const isManager = roles.includes("admin") || roles.includes("gestor");
  const { data: sectors = [] } = useSectors();
  const [sector, setSector] = useState("todos");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { id: string | null; title: string; content: string; sector_id: string; summary: string }>(null);
  const [suggestion, setSuggestion] = useState("");

  const { data: processes = [] } = useQuery({
    queryKey: ["gamif-processes"],
    queryFn: async () => (await supabase.from("gamif_processes").select("*").order("title")).data ?? [],
  });
  const { data: myReads = [] } = useQuery({
    queryKey: ["gamif-my-reads", me],
    enabled: !!me,
    queryFn: async () => (await supabase.from("gamif_reading_confirmations").select("process_id, version").eq("user_id", me!)).data ?? [],
  });
  const readVersion = (pid: string) => Math.max(0, ...myReads.filter((r) => r.process_id === pid).map((r) => r.version ?? 0)) || null;
  const filtered = processes.filter((p) => sector === "todos" || p.sector_id === sector || (sector === "geral" && !p.sector_id));
  const current = processes.find((p) => p.id === selected) ?? filtered[0] ?? null;
  const sectorName = (id: string | null) => sectors.find((s) => s.id === id)?.name ?? "Geral";

  const confirm = async () => {
    if (!current) return;
    const { error } = await supabase.from("gamif_reading_confirmations").insert({ process_id: current.id, user_id: me, version: current.version });
    if (error) return toast.error(error.message);
    toast.success("Leitura confirmada"); qc.invalidateQueries({ queryKey: ["gamif-my-reads"] }); qc.invalidateQueries({ queryKey: ["gamif-process-reads"] });
  };
  const suggest = async () => {
    if (!current || !suggestion.trim()) return;
    const { error } = await supabase.from("gamif_process_suggestions").insert({ process_id: current.id, user_id: me, content: suggestion.trim(), status: "nova" });
    if (error) return toast.error(error.message);
    setSuggestion(""); toast.success("Sugestão enviada"); qc.invalidateQueries({ queryKey: ["gamif-process-suggestions"] });
  };
  const save = async () => {
    if (!editing) return;
    const { data, error } = await supabase.rpc("gamif_save_process", {
      _id: editing.id as string, _title: editing.title, _content: editing.content,
      _sector_id: (editing.sector_id === "geral" ? null : editing.sector_id) as string, _summary: editing.summary,
    });
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Nova versão publicada" : "Processo criado");
    setEditing(null); setSelected(data); qc.invalidateQueries({ queryKey: ["gamif-processes"] }); qc.invalidateQueries({ queryKey: ["gamif-process-changelog"] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardContent className="space-y-2 pt-4">
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos os setores</SelectItem><SelectItem value="geral">Geral</SelectItem>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          {isManager && <Button className="w-full" variant="outline" onClick={() => setEditing({ id: null, title: "", content: "", sector_id: "geral", summary: "" })}>Novo processo</Button>}
          <div className="divide-y">
            {filtered.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhum processo.</p>}
            {filtered.map((p) => {
              const st = readingStatus(readVersion(p.id), p.version);
              return (
                <button key={p.id} type="button" onClick={() => setSelected(p.id)} className={cn("w-full py-2 text-left text-sm", current?.id === p.id && "font-semibold")}>
                  <div>{p.title}</div>
                  <div className="text-xs text-muted-foreground">{sectorName(p.sector_id)} · v{p.version} · {READ_LABEL[st]}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {current ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>{current.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{sectorName(current.sector_id)} · versão {current.version} · atualizado {fmtDate(current.updated_at)}</p>
              </div>
              <div className="flex gap-2">
                {(() => {
                  const st = readingStatus(readVersion(current.id), current.version);
                  return st === "lido" ? <Badge variant="secondary">Leitura confirmada</Badge> : <Button size="sm" onClick={confirm}>Confirmar leitura</Button>;
                })()}
                {isManager && <Button size="sm" variant="outline" onClick={() => setEditing({ id: current.id, title: current.title, content: current.content ?? "", sector_id: current.sector_id ?? "geral", summary: "" })}>Editar</Button>}
              </div>
            </CardHeader>
            <CardContent className={MD_CLASS}>
              {current.content ? <ReactMarkdown>{current.content}</ReactMarkdown> : <p className="text-muted-foreground">Sem conteúdo.</p>}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Changelog processId={current.id} />
            <Card>
              <CardHeader><CardTitle className="text-base">Sugerir melhoria</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Textarea placeholder="O que pode melhorar neste processo?" value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
                <Button size="sm" onClick={suggest} disabled={!suggestion.trim()}>Enviar sugestão</Button>
              </CardContent>
            </Card>
          </div>
          {isManager && <ManagerPanel processId={current.id} version={current.version} sectorId={current.sector_id} />}
        </div>
      ) : (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Nenhum processo cadastrado ainda.</CardContent></Card>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Publicar nova versão" : "Novo processo"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-2">
              <Input placeholder="Título" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <Select value={editing.sector_id} onValueChange={(v) => setEditing({ ...editing, sector_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="geral">Geral (todos)</SelectItem>{sectors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea rows={12} placeholder="Conteúdo (aceita Markdown: # títulos, - listas, **negrito**)" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              {editing.id && <Input placeholder="O que mudou nesta versão?" value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />}
              {editing.id && <p className="text-xs text-muted-foreground">Ao publicar, todos precisam confirmar a leitura da nova versão.</p>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Changelog({ processId }: { processId: string }) {
  const { data: users = [] } = useRanking();
  const { data = [] } = useQuery({
    queryKey: ["gamif-process-changelog", processId],
    queryFn: async () => (await supabase.from("gamif_process_changelog").select("*").eq("process_id", processId).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de mudanças</CardTitle></CardHeader>
      <CardContent className="divide-y text-sm">
        {data.length === 0 && <p className="text-muted-foreground">Sem registros.</p>}
        {data.map((c) => (
          <div key={c.id} className="py-2"><span className="font-medium">v{c.version}</span> · {c.summary} <div className="text-xs text-muted-foreground">{users.find((u) => u.user_id === c.changed_by)?.name ?? ""} · {fmtDateTime(c.created_at)}</div></div>
        ))}
      </CardContent>
    </Card>
  );
}

function ManagerPanel({ processId, version, sectorId }: { processId: string; version: number; sectorId: string | null }) {
  const qc = useQueryClient();
  const { data: users = [] } = useRanking();
  const { data: reads = [] } = useQuery({
    queryKey: ["gamif-process-reads", processId],
    queryFn: async () => (await supabase.from("gamif_reading_confirmations").select("user_id, version, confirmed_at").eq("process_id", processId)).data ?? [],
  });
  const { data: suggestions = [] } = useQuery({
    queryKey: ["gamif-process-suggestions", processId],
    queryFn: async () => (await supabase.from("gamif_process_suggestions").select("*").eq("process_id", processId).order("created_at", { ascending: false })).data ?? [],
  });
  const audience = users.filter((u) => !sectorId || u.sector_id === sectorId);
  const readIds = new Set(reads.filter((r) => (r.version ?? 0) >= version).map((r) => r.user_id));
  const missing = audience.filter((u) => !readIds.has(u.user_id));
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("gamif_process_suggestions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gamif-process-suggestions", processId] });
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Leitura da versão {version}: {audience.length - missing.length} de {audience.length}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {missing.length === 0 ? <p className="text-muted-foreground">Todos confirmaram.</p> : (
            <><p className="mb-1 text-muted-foreground">Faltam confirmar:</p><div className="flex flex-wrap gap-1">{missing.map((u) => <Badge key={u.user_id} variant="outline">{u.name}</Badge>)}</div></>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Sugestões recebidas</CardTitle></CardHeader>
        <CardContent className="divide-y text-sm">
          {suggestions.length === 0 && <p className="text-muted-foreground">Nenhuma sugestão.</p>}
          {suggestions.map((s) => (
            <div key={s.id} className="space-y-1 py-2">
              <p className="whitespace-pre-wrap">{s.content}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{users.find((u) => u.user_id === s.user_id)?.name ?? "—"} · {fmtDate(s.created_at)}</span>
                <Select value={s.status} onValueChange={(v) => setStatus(s.id, v)}>
                  <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="nova">Nova</SelectItem><SelectItem value="aplicada">Aplicada</SelectItem><SelectItem value="descartada">Descartada</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
