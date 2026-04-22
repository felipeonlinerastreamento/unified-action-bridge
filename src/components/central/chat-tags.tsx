import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

export interface ChatTag {
  name: string;
  color: string;
}

interface Props {
  chatRowId?: string; // zapi_chats.id (when present, persists)
  initialTags?: ChatTag[];
  size?: "sm" | "xs";
}

const PALETTE = [
  "#a78bfa", // violet
  "#f472b6", // pink
  "#34d399", // emerald
  "#fbbf24", // amber
  "#60a5fa", // blue
  "#f87171", // red
  "#a3e635", // lime
  "#22d3ee", // cyan
];

export function ChatTags({ chatRowId, initialTags = [], size = "sm" }: Props) {
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<ChatTag[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [open, setOpen] = useState(false);

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

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setNewName("");
      return;
    }
    const next = [...tags, { name, color }];
    setTags(next);
    setNewName("");
    persist.mutate(next);
  };

  const handleRemove = (name: string) => {
    const next = tags.filter((t) => t.name !== name);
    setTags(next);
    persist.mutate(next);
  };

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={size === "xs" ? "h-4 w-4" : "h-5 w-5"}
            title="Adicionar tag"
          >
            <Plus className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <TagIcon className="h-3.5 w-3.5" /> Nova tag
            </div>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da tag"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                  setOpen(false);
                }
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full transition-transform ${color === c ? "ring-2 ring-foreground scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => {
                handleAdd();
                setOpen(false);
              }}
              disabled={!newName.trim()}
            >
              Adicionar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
