import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Zap, Settings2 } from "lucide-react";
import { useState } from "react";
import { QuickRepliesManagerDialog } from "./quick-replies-manager-dialog";

interface Props {
  onPick: (text: string) => void;
  size?: "sm" | "icon";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function QuickRepliesPopover({ onPick, size = "icon", open: openProp, onOpenChange, hideTrigger }: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => {
    setOpenInternal(v);
    onOpenChange?.(v);
  };
  const { data: replies = [] } = useQuery({
    queryKey: ["zapi-quick-replies"],
    queryFn: async () => {
      const { data } = await supabase.from("zapi_quick_replies").select("*").order("shortcut");
      return data || [];
    },
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {hideTrigger ? (
          <button type="button" aria-hidden className="sr-only" tabIndex={-1} />
        ) : (
          <Button size={size === "icon" ? "icon" : "sm"} variant="outline" className="shrink-0" title="Respostas rápidas">
            <Zap className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80" align="end">
        <Command>
          <CommandInput placeholder="Buscar atalho ou rótulo..." />
          <CommandList>
            <CommandEmpty>Nenhuma resposta rápida.</CommandEmpty>
            <CommandGroup>
              {replies.map((r) => (
                <CommandItem
                  key={r.id}
                  onSelect={() => {
                    onPick(r.content);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-mono text-muted-foreground">{r.shortcut} · {r.label}</span>
                    <span className="text-sm line-clamp-2">{r.content}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
