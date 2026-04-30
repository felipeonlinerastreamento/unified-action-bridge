// Pure utilities for OKR scoring (client-safe)

export function computeKrScore(
  initial: number,
  current: number,
  target: number,
  direction: "increase" | "decrease",
): number {
  if (target === initial) return current === target ? 1 : 0;
  let pct: number;
  if (direction === "increase") {
    pct = (current - initial) / (target - initial);
  } else {
    pct = (initial - current) / (initial - target);
  }
  return Math.max(0, Math.min(1, pct));
}

export function computeObjectiveScore(krs: Array<{
  initial_value: number;
  current_value: number;
  target_value: number;
  direction: "increase" | "decrease";
}>): number {
  if (!krs.length) return 0;
  const sum = krs.reduce(
    (acc, k) => acc + computeKrScore(k.initial_value, k.current_value, k.target_value, k.direction),
    0,
  );
  return sum / krs.length;
}

export function confidenceColor(c: "verde" | "amarelo" | "vermelho"): string {
  if (c === "verde") return "bg-green-500";
  if (c === "amarelo") return "bg-yellow-500";
  return "bg-red-500";
}

export function confidenceLabel(c: "verde" | "amarelo" | "vermelho"): string {
  return c === "verde" ? "No prazo" : c === "amarelo" ? "Atenção" : "Em risco";
}

export function levelLabel(l: string): string {
  if (l === "empresa") return "Empresa";
  if (l === "setor") return "Setor";
  return "Individual";
}
