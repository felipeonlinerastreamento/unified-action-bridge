import { useEffect, useState } from "react";
import { Circle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VOLUME_KEY = "operator_notification_volume";

function loadVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch {}
  return 0.6;
}

function playPreviewBeep(vol: number) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx || vol <= 0) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = Math.min(1, 0.5 * vol);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    setTimeout(() => ctx.close().catch(() => {}), 400);
  } catch {}
}

export function ChatAvailabilityToggle() {
  const { user, isAuthenticated } = useAuth();
  const [available, setAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [volume, setVolume] = useState<number>(loadVolume);

  const handleVolumeChange = (vals: number[]) => {
    const v = Math.max(0, Math.min(1, (vals?.[0] ?? 0) / 100));
    setVolume(v);
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch {}
  };

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("is_chat_available")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setAvailable(!!data.is_chat_available);
      });
  }, [user?.id]);

  if (!isAuthenticated || !user?.id) return null;

  const toggle = async (next: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ is_chat_available: next })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setAvailable(next);
    toast.success(next ? "Você está online no chat" : "Você está offline no chat");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8 px-2" title={available ? "Online no chat" : "Offline no chat"}>
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-60",
                available ? "bg-emerald-500 animate-ping" : "bg-muted-foreground"
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                available ? "bg-emerald-500" : "bg-muted-foreground"
              )}
            />
          </span>
          <span className="text-xs font-medium hidden sm:inline">
            {available ? "Online" : "Offline"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium flex items-center gap-2">
              <Circle className={cn("h-2.5 w-2.5 fill-current", available ? "text-emerald-500" : "text-muted-foreground")} />
              Status no chat
            </div>
            <p className="text-xs text-muted-foreground">
              {available
                ? "Você está recebendo novos chamados."
                : "Novos chamados não serão atribuídos a você."}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Disponível</span>
            <Switch checked={available} onCheckedChange={toggle} disabled={loading} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
