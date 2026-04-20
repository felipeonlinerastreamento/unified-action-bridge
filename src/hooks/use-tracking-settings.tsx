import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrackingSettings {
  id: string;
  auto_refresh_enabled: boolean;
  refresh_interval_minutes: number;
  notify_on_delivered: boolean;
  notify_on_exception: boolean;
  notify_sector_members: boolean;
  notify_assigned_only: boolean;
  auto_close_ticket_on_delivery: boolean;
  require_tracking_code: boolean;
  tracking_code_pattern: string;
  whatsapp_notify_client: boolean;
  updated_at: string;
}

export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
  id: "",
  auto_refresh_enabled: true,
  refresh_interval_minutes: 60,
  notify_on_delivered: true,
  notify_on_exception: true,
  notify_sector_members: true,
  notify_assigned_only: false,
  auto_close_ticket_on_delivery: false,
  require_tracking_code: true,
  tracking_code_pattern: "^[A-Z]{2}\\d{9}[A-Z]{2}$",
  whatsapp_notify_client: false,
  updated_at: "",
};

export function useTrackingSettings() {
  return useQuery({
    queryKey: ["tracking-settings"],
    queryFn: async (): Promise<TrackingSettings> => {
      const { data, error } = await supabase
        .from("tracking_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as TrackingSettings) || DEFAULT_TRACKING_SETTINGS;
    },
    staleTime: 30_000,
  });
}
