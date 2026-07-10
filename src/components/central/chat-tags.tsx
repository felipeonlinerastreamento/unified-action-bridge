import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Plus, X, Tag as TagIcon, Check } from "lucide-react";
import { toast } from "sonner";

export interface ChatTag {
  name: string;
  color: string;
}

interface Props {
  chatRowId?: string;
  initialTags?: ChatTag[];
  size?: "sm" | "xs";
}

const PALETTE = [
  "#a78bfa", "#f472b6", "#34d399", "#fbbf24",
  "#60a5fa", "#f87171", "#a3e635", "#22d3ee",
];

export function ChatTags({ chatRowId, initialTags = [], size = "sm" }: Props) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<ChatTag[]>(initialTags);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [open, setOpen] = useState(false);

  const { data: catalog = [] } = useQuery({
    queryKey: ["chat-tag-catalog", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_tag_catalog" as any)
        .select("id, name, color, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as { id: string; name: string; color: string }[];
    },
    staleTime: 60_000,
  });

  const persist = useMutation({
    mutationFn: async (next: ChatTag[]) => {
      if (!chatRowId) return;
      const { error } = await supabase
        .from("zapi_chats")
        .update({ tags: next as any })
        .eq("id", chatRowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapi-chats"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar tags"),
  });

  const createCatalog = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("chat_tag_catalog" as any)
        .insert({ name, color })
        .select("id, name, color")
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-tag-catalog"] }),
  });

  const toggle = (name: string, color: string) => {
    const exists = tags.some((t) => t.name.toLowerCase() === name.toLowerCase());
    const next = exists
      ? tags.filter((t) => t.name.toLowerCase() !== name.toLowerCase())
      : [...tags, { name, color }];
    setTags(next);
    persist.mutate(next);
  };

  const handleRemove = (name: string) => {
    const next = tags.filter((t) => t.name !== name);
    setTags(next);
    persist.mutate(next);
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    try {
      await createCatalog.mutateAsync({ name, color: newColor });
      toggle(name, newColor);
      setSearch("");
      setCreating(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar etiqueta");
    }
  };

  const filtered = catalog.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const canCreate =
    search.trim().length > 0 &&
    !catalog.some((c) => c.name.toLowerCase() === search.trim().toLowerCase());

  const badgeSize = size === "xs" ? "text-[9px] h-4 px-1.5" : "text-[10px] h-5 px-2";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((t) => (
        <Badge
          key={t.name}
          className={`${badgeSize} gap-1 border-0 text-white`}
          style={{ backgroundColor: t.color }}
        >
          {t.name}
          {chatRowId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(t.name);
              }}
              className="hover:bg-black/20 rounded-sm"
              aria-label={`Remover tag ${t.name}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </Badge>
      ))}

      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCreating(false); setSearch(""); } }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={size === "xs" ? "h-4 w-4" : "h-5 w-5"}
            title="Adicionar etiqueta"
          >
            <Plus className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground px-1">
              <TagIcon className="h-3.5 w-3.5" /> Etiquetas
            </div>
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ou criar..."
              className="h-8 text-xs"
            />

            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filtered.length === 0 && !canCreate && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  Nenhuma etiqueta encontrada
                </div>
              )}
              {filtered.map((c) => {
                const active = tags.some((t) => t.name.toLowerCase() === c.name.toLowerCase());
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.name, c.color)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-accent text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-xs truncate">{c.name}</span>
                    </div>
                    {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>

            {canCreate && (
              <div className="border-t pt-2 space-y-1.5">
                {creating ? (
                  <>
                    <div className="text-[10px] text-muted-foreground px-1">Cor</div>
                    <div className="flex flex-wrap gap-1 px-1">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          className={`h-5 w-5 rounded-full ${newColor === c ? "ring-2 ring-foreground" : ""}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={handleCreate}
                      disabled={createCatalog.isPending}
                    >
                      Criar "{search.trim()}"
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs"
                    onClick={() => setCreating(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Criar "{search.trim()}"
                  </Button>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
