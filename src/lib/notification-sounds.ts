// Shared notification sound presets for operator alerts.
// Each preset is a small synthesized pattern via WebAudio (no asset files needed).

export type SoundKind = "message" | "forward";

export interface SoundPreset {
  id: string;
  label: string;
  // Pattern: list of beeps {freq, start (s), duration (s), gain?}
  pattern: Array<{ freq: number; start: number; duration: number; gain?: number; type?: OscillatorType }>;
}

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: "beep-high",
    label: "Bip agudo",
    pattern: [{ freq: 880, start: 0, duration: 0.18 }],
  },
  {
    id: "beep-low-double",
    label: "Bip duplo grave",
    pattern: [
      { freq: 520, start: 0, duration: 0.18 },
      { freq: 380, start: 0.22, duration: 0.25 },
    ],
  },
  {
    id: "chime",
    label: "Sino",
    pattern: [
      { freq: 1320, start: 0, duration: 0.12 },
      { freq: 1760, start: 0.10, duration: 0.18 },
    ],
  },
  {
    id: "ding-dong",
    label: "Ding-dong",
    pattern: [
      { freq: 988, start: 0, duration: 0.22 },
      { freq: 740, start: 0.24, duration: 0.32 },
    ],
  },
  {
    id: "pop",
    label: "Pop",
    pattern: [{ freq: 660, start: 0, duration: 0.08, type: "triangle" }],
  },
  {
    id: "alert-triple",
    label: "Alerta triplo",
    pattern: [
      { freq: 1000, start: 0, duration: 0.12 },
      { freq: 1000, start: 0.18, duration: 0.12 },
      { freq: 1200, start: 0.36, duration: 0.20 },
    ],
  },
  {
    id: "soft-blip",
    label: "Blip suave",
    pattern: [
      { freq: 600, start: 0, duration: 0.10, type: "sine" },
      { freq: 800, start: 0.12, duration: 0.12, type: "sine" },
    ],
  },
  {
    id: "buzzer",
    label: "Buzzer",
    pattern: [{ freq: 220, start: 0, duration: 0.35, type: "square", gain: 0.7 }],
  },
];

const VOL_KEY = "operator_notification_volume";
const PRESET_KEY_PREFIX = "operator_notification_sound_"; // + kind

export function getVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v) && v >= 0 && v <= 1) return v;
  } catch {}
  return 0.6;
}

export function getPresetId(kind: SoundKind): string {
  try {
    const v = localStorage.getItem(PRESET_KEY_PREFIX + kind);
    if (v && SOUND_PRESETS.some((p) => p.id === v)) return v;
  } catch {}
  return kind === "message" ? "beep-high" : "beep-low-double";
}

export function setPresetId(kind: SoundKind, id: string) {
  try { localStorage.setItem(PRESET_KEY_PREFIX + kind, id); } catch {}
}

export function playPreset(presetId: string, volumeOverride?: number) {
  const preset = SOUND_PRESETS.find((p) => p.id === presetId) ?? SOUND_PRESETS[0];
  const vol = typeof volumeOverride === "number" ? volumeOverride : getVolume();
  if (vol <= 0) return;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    let maxEnd = 0;
    for (const b of preset.pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = b.type ?? "sine";
      osc.frequency.value = b.freq;
      gain.gain.value = Math.min(1, (b.gain ?? 1) * 0.5 * vol);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + b.start);
      osc.stop(ctx.currentTime + b.start + b.duration);
      maxEnd = Math.max(maxEnd, b.start + b.duration);
    }
    setTimeout(() => ctx.close().catch(() => {}), (maxEnd + 0.2) * 1000);
  } catch {}
}

export function playForKind(kind: SoundKind) {
  playPreset(getPresetId(kind));
}
