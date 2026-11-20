import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Search, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listTicketCategories, syncTicketCategoriesNow } from "@/lib/technical-terms.functions";
import { categoryRequirementOptions, serviceTypeLabel } from "@/lib/technical-terms";
import { useTechnicalTermTypes } from "@/hooks/use-technical-term-types";
import { TICKET_CATEGORIES_QUERY_KEY } from "@/hooks/use-ticket-categories";

const ADMIN_KEY = ["ticket-categories-admin"] as const;

function slugify(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Catálogo de categorias de chamado: o nosso sistema decide o que aparece; o GSystem só alimenta. */
export function TicketCategoriesConfig() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("gestor");
  const list = useServerFn(listTicketCategories);
  const sync = useServerFn(syncTicketCategoriesNow);
  const [search, setSearch] = useState("");
  const [newLabel, setNewLabel] = useState("");
  // Opções de "Exige termo" vêm dos tipos cadastrados em Configurações > CRM.
  const { all: termTypes } = useTechnicalTermTypes();
  const requirementOptions = useMemo(() => categoryRequirementOptions(termTypes), [termTypes]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: async () => (await list({ data: { includeInactive: true } })) as any[],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ADMIN_KEY });
    qc.invalidateQueries({ queryKey: TICKET_CATEGORIES_QUERY_KEY });
  };

  const syncMutation = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: any) => {
      toast.success(`Sincronizado: ${r?.synced ?? 0} categorias do GSystem${r?.added ? `, ${r.added} novas` : ""}${r?.removed ? `, ${r.removed} desativadas` : ""}.`);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao sincronizar"),
  });

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("ticket_categories").update(patch as any).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const addLocal = async () => {
    const label = newLabel.trim();
    if (label.length < 2) return toast.error("Informe o nome da categoria");
    const key = `local-${slugify(label)}`;
    const { error } = await supabase.from("ticket_categories").insert({ key, label, source: "local" });
    if (error) return toast.error(error.message.includes("duplicate") ? "Já existe uma categoria com esse nome" : error.message);
    setNewLabel("");
    toast.success("Categoria criada");
    refresh();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => String(r.label).toLowerCase().includes(q) || String(r.key).includes(q)) : rows;
  }, [rows, search]);
  const lastSync = rows.map((r) => r.last_synced_at).filter(Boolean).sort().pop();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Tags className="h-4 w-4" /> Categorias de chamado</CardTitle>
            <CardDescription>
              As telas de atendimento usam esta lista. Novas categorias do GSystem entram sozinhas (a cada 30 min); ativar, desativar e exigir termo técnico é decisão daqui.
              {lastSync && <> Última sincronização: {new Date(lastSync).toLocaleString("pt-BR")}.</>}
            </CardDescription>
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar com GSystem
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar categoria" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Input placeholder="Nova categoria local" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="sm:w-56" />
              <Button onClick={addLocal}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Código GSystem</TableHead>
                  <TableHead>Termo técnico</TableHead>
                  <TableHead className="text-center">Ativa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={r.is_active ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>
                      <Badge variant={r.source === "gsystem" ? "secondary" : "outline"}>{r.source === "gsystem" ? "GSystem" : "Local"}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.source === "local" && canManage ? (
                        <Input
                          className="h-8 w-24"
                          defaultValue={r.gsystem_key || ""}
                          placeholder="186"
                          title="Tipo de pendência usado ao sincronizar com o GSystem"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && !/^\d+$/.test(v)) return toast.error("Use só números do código do GSystem");
                            if (v !== (r.gsystem_key || "")) update(r.id, { gsystem_key: v || null });
                          }}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{r.gsystem_key || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.technical_term_type}
                        onValueChange={(v) => update(r.id, { technical_term_type: v })}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {requirementOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          {!requirementOptions.some((o) => o.value === r.technical_term_type) && (
                            <SelectItem value={r.technical_term_type}>{serviceTypeLabel(r.technical_term_type, termTypes)} (inativo)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} disabled={!canManage} />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhuma categoria.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
