import { useEffect, useState } from "react";
import { Circle, Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SOUND_PRESETS, getPresetId, setPresetId, playPreset } from "@/lib/notification-sounds";

const VOLUME_KEY = "operator_notification_volume";

function loadVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch {}
  return 0.6;
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { logAuditEvent } = await import("@/lib/audit.functions");
      await (logAuditEvent as any)({
        data: {
          event_category: "presence",
          event_type: next ? "set_online" : "set_offline",
          target_type: "user",
          target_id: user.id,
        },
        headers: { authorization: `Bearer ${session?.access_token}` },
      }).catch(() => {});
    } catch {}
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
      <PopoverContent className="w-80" align="end">
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
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                Volume das notificações
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{Math.round(volume * 100)}%</span>
            </div>
            <Slider
              value={[Math.round(volume * 100)]}
              max={100}
              step={5}
              onValueChange={handleVolumeChange}
              onValueCommit={(vals) => playPreset(getPresetId("message"), ((vals?.[0] ?? 0) / 100))}
            />
          </div>
          <SoundSelector kind="message" label="Som: nova mensagem" volume={volume} />
          <SoundSelector kind="forward" label="Som: chamado atribuído" volume={volume} />
          <p className="text-[11px] text-muted-foreground pt-1 border-t">
            Ajustes são salvos por dispositivo.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SoundSelector({
  kind,
  label,
  volume,
}: {
  kind: "message" | "forward";
  label: string;
  volume: number;
}) {
  const [presetId, setPresetIdState] = useState<string>(() => getPresetId(kind));

  const onChange = (id: string) => {
    setPresetIdState(id);
    setPresetId(kind, id);
    playPreset(id, volume);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Select value={presetId} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOUND_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => playPreset(presetId, volume)}
          title="Ouvir"
        >
          <Play className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

