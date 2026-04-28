import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, MessageSquare, ListOrdered, ArrowRight, Hash, Square, Loader2, Eye, Receipt, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

type NodeType = "message" | "menu" | "route_to_sector" | "route_to_least_loaded" | "end" | "gsystem_boleto" | "gsystem_boleto_by_doc" | "ask_input";

interface FlowNode {
  id: string;
  type: NodeType;
  text?: string;
  options?: Array<{ key: string; label: string; next: string }>;
  next?: string;
  target_sector?: string;
  // gsystem_boleto specific
  fallback_sector?: string;
  text_success?: string;
  text_no_boletos?: string;
  text_no_client?: string;
}

const TYPE_META: Record<NodeType, { label: string; icon: any; color: string }> = {
  message: { label: "Mensagem", icon: MessageSquare, color: "text-blue-600" },
  menu: { label: "Menu de opções", icon: ListOrdered, color: "text-purple-600" },
  route_to_sector: { label: "Encaminhar p/ setor", icon: ArrowRight, color: "text-emerald-600" },
  route_to_least_loaded: { label: "Encaminhar p/ atendente menos ocupado", icon: Hash, color: "text-amber-600" },
  end: { label: "Finalizar", icon: Square, color: "text-rose-600" },
  gsystem_boleto: { label: "Consultar boletos (GSystem)", icon: Receipt, color: "text-cyan-600" },
  gsystem_boleto_by_doc: { label: "Consultar boletos por CPF/CNPJ", icon: Receipt, color: "text-cyan-700" },
  ask_input: { label: "Solicitar entrada do usuário", icon: MessageSquare, color: "text-indigo-600" },
};

const FALLBACK_META = { label: "Tipo desconhecido", icon: Square, color: "text-muted-foreground" };
function getTypeMeta(t: string) {
  return (TYPE_META as Record<string, { label: string; icon: any; color: string }>)[t] ?? FALLBACK_META;
}

function genId() {
  return `n_${Math.random().toString(36).slice(2, 8)}`;
}

export function ZapiBotFlowEditor() {
  const qc = useQueryClient();
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const { data: flows = [] } = useQuery({
    queryKey: ["zapi-bot-flows"],
    queryFn: async () => {
      const { data } = await supabase.from("zapi_bot_flows").select("*").order("updated_at", { ascending: false });
      return data || [];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors-active"],
    queryFn: async () => {
      const { data } = await supabase.from("sectors").select("name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  useEffect(() => {
    if (flows.length > 0 && !selectedFlowId) setSelectedFlowId(flows[0].id);
  }, [flows, selectedFlowId]);

  const current = flows.find((f) => f.id === selectedFlowId);
  useEffect(() => {
    if (current) {
      setName(current.name);
      setIsActive(current.is_active);
      setNodes(Array.isArray(current.nodes) ? (current.nodes as unknown as FlowNode[]) : []);
    }
  }, [current?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("zapi_bot_flows")
        .update({ name, is_active: isActive, nodes: nodes as any })
        .eq("id", selectedFlowId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Fluxo salvo");
      qc.invalidateQueries({ queryKey: ["zapi-bot-flows"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("zapi_bot_flows")
        .insert({ name: "Novo fluxo", is_active: false, nodes: [] as any })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data: any) => {
      toast.success("Fluxo criado");
      qc.invalidateQueries({ queryKey: ["zapi-bot-flows"] });
      if (data?.id) setSelectedFlowId(data.id);
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const deleteFlow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("zapi_bot_flows").delete().eq("id", selectedFlowId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Fluxo removido");
      setSelectedFlowId("");
      qc.invalidateQueries({ queryKey: ["zapi-bot-flows"] });
    },
  });

  const addNode = (type: NodeType): FlowNode => {
    const newNode: FlowNode = {
      id: genId(),
      type,
      ...(type === "menu" ? { text: "Escolha uma opção:", options: [{ key: "1", label: "Opção 1", next: "" }] } : {}),
      ...(type === "message" ? { text: "Sua mensagem aqui", next: "" } : {}),
      ...(type === "route_to_sector" || type === "route_to_least_loaded" ? { target_sector: "Atendimento" } : {}),
      ...(type === "end" ? { text: "Atendimento finalizado, obrigado!" } : {}),
      ...(type === "gsystem_boleto"
        ? {
            fallback_sector: "Financeiro",
            text_success: "Encontrei {{count}} boleto(s) em aberto no seu cadastro:",
            text_no_boletos: "Não encontrei boletos em aberto no seu cadastro. Vou te encaminhar para o Financeiro.",
            text_no_client: "Não consegui identificar seu cadastro pelo seu telefone. Vou te encaminhar para o Financeiro.",
          }
        : {}),
    };
    setNodes((prev) => [...prev, newNode]);
    return newNode;
  };

  /** Cria um novo nó e conecta automaticamente como "next" da opção indicada de um menu. */
  const addNodeAndLinkToOption = (menuId: string, optionIndex: number, type: NodeType) => {
    setNodes((prev) => {
      const newNode: FlowNode = {
        id: genId(),
        type,
        ...(type === "menu" ? { text: "Escolha uma opção:", options: [{ key: "1", label: "Opção 1", next: "" }] } : {}),
        ...(type === "message" ? { text: "Sua mensagem aqui", next: "" } : {}),
        ...(type === "gsystem_boleto"
          ? {
              fallback_sector: "Financeiro",
              text_success: "Encontrei {{count}} boleto(s) em aberto no seu cadastro:",
              text_no_boletos: "Não encontrei boletos em aberto no seu cadastro. Vou te encaminhar para o Financeiro.",
              text_no_client: "Não consegui identificar seu cadastro pelo seu telefone. Vou te encaminhar para o Financeiro.",
            }
          : {}),
      };
      return prev.map((n) => {
        if (n.id !== menuId || n.type !== "menu" || !n.options) return n;
        const opts = [...n.options];
        opts[optionIndex] = { ...opts[optionIndex], next: newNode.id };
        return { ...n, options: opts };
      }).concat(newNode);
    });
  };

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeNode = (id: string) => setNodes(nodes.filter((n) => n.id !== id));

  const moveNode = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= nodes.length) return;
    const next = [...nodes];
    [next[idx], next[target]] = [next[target], next[idx]];
    setNodes(next);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fluxo do Bot</CardTitle>
            <CardDescription>Desenhe o menu de boas-vindas e roteamento por setor.</CardDescription>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> Novo fluxo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2 space-y-1">
            <Label>Fluxo</Label>
            <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
              <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
              <SelectContent>
                {flows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} {f.is_active ? "✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Ativo</Label>
          </div>
        </div>

        {current && (
          <>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* Bloco de ajuda colapsável */}
            <Card className="bg-muted/40 border-dashed">
              <CardContent className="pt-3 pb-3">
                <button
                  type="button"
                  onClick={() => setShowHelp((s) => !s)}
                  className="flex w-full items-center gap-2 text-sm font-medium"
                >
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <span>Como criar mensagens personalizadas e submenus por opção</span>
                  {showHelp ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
                </button>
                {showHelp && (
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <p>
                      Cada opção do menu tem um campo <strong>"Próximo nó"</strong>. Aponte para qualquer outro nó para definir o que acontece quando o cliente escolhe essa opção:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Mensagem personalizada</strong>: aponte a opção para um nó tipo <em>Mensagem</em>. Use o atalho <Badge variant="outline" className="text-[10px]">+ Mensagem</Badge> ao lado da opção para criar e conectar de uma vez.</li>
                      <li><strong>Submenu</strong>: aponte para outro nó tipo <em>Menu</em> com novas opções. Use o atalho <Badge variant="outline" className="text-[10px]">+ Submenu</Badge>.</li>
                      <li><strong>Encaminhar para setor</strong>: aponte para um nó <em>Encaminhar p/ setor</em>.</li>
                      <li><strong>Consultar boletos no GSystem</strong>: aponte para o novo nó <em>Consultar boletos</em>. O bot identifica o cliente pelo telefone, busca os boletos em aberto e envia automaticamente.</li>
                    </ul>
                    <pre className="mt-2 p-2 rounded bg-background text-[11px] overflow-x-auto">{`Menu inicial
 1 → "Falar com vendas"        (Encaminhar p/ setor: Vendas)
 2 → "Agora é só aguardar..."  (Mensagem → Encaminhar p/ Atendimento)
 3 → Submenu Financeiro
       1 → Setor Financeiro    (Encaminhar p/ setor)
       2 → Boletos em aberto   (Consultar boletos GSystem)`}</pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Nós do fluxo ({nodes.length})</h3>
                <div className="flex gap-1 flex-wrap">
                  {(Object.keys(TYPE_META) as NodeType[]).map((t) => {
                    const Icon = TYPE_META[t].icon;
                    return (
                      <Button key={t} size="sm" variant="outline" onClick={() => addNode(t)}>
                        <Icon className="h-3.5 w-3.5 mr-1" /> {TYPE_META[t].label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {nodes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sem nós ainda. Clique em "Mensagem" ou "Menu" acima para começar.
                </p>
              )}

              {nodes.map((node, idx) => {
                const meta = getTypeMeta(node.type);
                const Icon = meta.icon;
                return (
                  <Card key={node.id} className="border-l-4" style={{ borderLeftColor: "currentColor" }}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                        <Badge variant="secondary" className="text-xs">{meta.label}</Badge>
                        <code className="text-[10px] text-muted-foreground">id: {node.id}</code>
                        <div className="ml-auto flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveNode(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveNode(idx, 1)} disabled={idx === nodes.length - 1}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeNode(node.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {(node.type === "message" || node.type === "menu" || node.type === "end") && (
                        <div className="space-y-1">
                          <Label className="text-xs">Texto (use <code>{`{{contactName}}`}</code> para o nome)</Label>
                          <Textarea
                            rows={3}
                            value={node.text || ""}
                            onChange={(e) => updateNode(node.id, { text: e.target.value })}
                          />
                        </div>
                      )}

                      {node.type === "menu" && (
                        <div className="space-y-2">
                          <Label className="text-xs">Opções do menu</Label>
                          {(node.options || []).map((opt, oi) => {
                            const targetNode = nodes.find((n) => n.id === opt.next);
                            const targetMeta = targetNode ? getTypeMeta(targetNode.type) : null;
                            return (
                              <div key={oi} className="space-y-1 rounded border p-2 bg-muted/20">
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <Input
                                    className="col-span-2"
                                    placeholder="1"
                                    value={opt.key}
                                    onChange={(e) => {
                                      const opts = [...(node.options || [])];
                                      opts[oi] = { ...opts[oi], key: e.target.value };
                                      updateNode(node.id, { options: opts });
                                    }}
                                  />
                                  <Input
                                    className="col-span-5"
                                    placeholder="Rótulo"
                                    value={opt.label}
                                    onChange={(e) => {
                                      const opts = [...(node.options || [])];
                                      opts[oi] = { ...opts[oi], label: e.target.value };
                                      updateNode(node.id, { options: opts });
                                    }}
                                  />
                                  <Select
                                    value={opt.next}
                                    onValueChange={(v) => {
                                      const opts = [...(node.options || [])];
                                      opts[oi] = { ...opts[oi], next: v };
                                      updateNode(node.id, { options: opts });
                                    }}
                                  >
                                    <SelectTrigger className="col-span-4"><SelectValue placeholder="Próximo nó" /></SelectTrigger>
                                    <SelectContent>
                                      {nodes.filter((n) => n.id !== node.id).map((n) => (
                                        <SelectItem key={n.id} value={n.id}>{n.id} ({getTypeMeta(n.type).label})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="col-span-1 h-8 w-8 text-destructive"
                                    onClick={() => {
                                      const opts = (node.options || []).filter((_, i) => i !== oi);
                                      updateNode(node.id, { options: opts });
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  {targetMeta ? (
                                    <Badge variant="outline" className="gap-1">
                                      <targetMeta.icon className={`h-3 w-3 ${targetMeta.color}`} />
                                      → {targetMeta.label}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground italic">Sem destino · use os atalhos para criar:</span>
                                  )}
                                  {!opt.next && (
                                    <>
                                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                        onClick={() => addNodeAndLinkToOption(node.id, oi, "message")}>
                                        <Plus className="h-3 w-3 mr-1" /> Mensagem
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                        onClick={() => addNodeAndLinkToOption(node.id, oi, "menu")}>
                                        <Plus className="h-3 w-3 mr-1" /> Submenu
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                                        onClick={() => addNodeAndLinkToOption(node.id, oi, "gsystem_boleto")}>
                                        <Plus className="h-3 w-3 mr-1" /> Boletos GSystem
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <Button size="sm" variant="outline" onClick={() => {
                            const opts = [...(node.options || []), { key: String((node.options?.length || 0) + 1), label: "Nova opção", next: "" }];
                            updateNode(node.id, { options: opts });
                          }}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar opção
                          </Button>
                        </div>
                      )}

                      {node.type === "message" && (
                        <div className="space-y-1">
                          <Label className="text-xs">Próximo nó</Label>
                          <Select value={node.next || ""} onValueChange={(v) => updateNode(node.id, { next: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {nodes.filter((n) => n.id !== node.id).map((n) => (
                                <SelectItem key={n.id} value={n.id}>{n.id} ({TYPE_META[n.type].label})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(node.type === "route_to_sector" || node.type === "route_to_least_loaded") && (
                        <div className="space-y-1">
                          <Label className="text-xs">Setor de destino</Label>
                          <Select value={node.target_sector || ""} onValueChange={(v) => updateNode(node.id, { target_sector: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
                            <SelectContent>
                              {sectors.map((s) => (
                                <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {node.type === "gsystem_boleto" && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-muted-foreground">
                            O bot busca automaticamente o cliente no GSystem pelo telefone do WhatsApp e envia os boletos em aberto.
                            Use <code>{`{{count}}`}</code> no texto de sucesso para o número de boletos encontrados.
                          </p>
                          <div className="space-y-1">
                            <Label className="text-xs">Mensagem quando há boletos</Label>
                            <Textarea rows={2} value={node.text_success || ""}
                              onChange={(e) => updateNode(node.id, { text_success: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Mensagem quando não há boletos em aberto</Label>
                            <Textarea rows={2} value={node.text_no_boletos || ""}
                              onChange={(e) => updateNode(node.id, { text_no_boletos: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Mensagem quando o cliente não é identificado</Label>
                            <Textarea rows={2} value={node.text_no_client || ""}
                              onChange={(e) => updateNode(node.id, { text_no_client: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Setor de fallback (encaminhar após responder ou em caso de erro)</Label>
                            <Select value={node.fallback_sector || ""} onValueChange={(v) => updateNode(node.id, { fallback_sector: v })}>
                              <SelectTrigger><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
                              <SelectContent>
                                {sectors.map((s) => (
                                  <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar fluxo
              </Button>
              <Button variant="outline" onClick={() => setShowPreview((s) => !s)}>
                <Eye className="h-4 w-4 mr-2" /> {showPreview ? "Ocultar" : "Pré-visualizar"}
              </Button>
              <Button variant="destructive" onClick={() => deleteFlow.mutate()}>
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </Button>
            </div>

            {showPreview && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-2">
                  <h4 className="text-sm font-semibold">Pré-visualização (texto bruto)</h4>
                  {nodes.map((n) => (
                    <div key={n.id} className="text-xs border rounded p-2 bg-background">
                      <p className="font-mono text-[10px] text-muted-foreground">[{n.type}] {n.id}</p>
                      {n.text && <p className="whitespace-pre-wrap mt-1">{n.text.replace(/\{\{contactName\}\}/g, "João")}</p>}
                      {n.target_sector && <p className="text-emerald-600 mt-1">→ Setor: {n.target_sector}</p>}
                      {n.next && <p className="text-blue-600 mt-1">→ próximo: {n.next}</p>}
                      {n.options && n.options.map((o) => (
                        <p key={o.key} className="text-purple-600 mt-1">[{o.key}] {o.label} → {o.next}</p>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
