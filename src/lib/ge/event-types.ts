// Normalização de nomes de tipos de evento.
// As APIs (YUV/Movias) entregam nomes exibidos ("Excesso de velocidade"),
// enquanto as regras de Categorização de Risco podem estar cadastradas com o
// nome técnico ("speeding"). Sem esta normalização, eventos de telemetria são
// filtrados indevidamente do painel de Eventos.

export function normalizeEventName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function aliasEventKey(name: string | null | undefined): string {
  const n = normalizeEventName(name);
  if (
    n === "speeding" ||
    n === "excesso de velocidade" ||
    n === "over speed" ||
    n === "overspeed" ||
    n === "velocidade excessiva"
  ) {
    return "speeding";
  }
  if (n === "yawning") return "bocejo";
  if (n === "eyes closed" || n === "closed eyes") return "olhos fechados";
  if (n === "phone" || n === "phone call" || n === "using phone") return "uso de celular";
  if (n === "smoking") return "fumando";
  if (n === "fatigue") return "fadiga";
  if (n === "distraction") return "distracao";
  if (n === "no face detected") return "nenhum rosto detectado";
  if (n === "camera covered" || n === "camera blocked") return "camera coberta";
  if (n === "collision") return "colisao";
  if (n === "no seatbelt" || n === "seatbelt") return "sem cinto";
  return n;
}

/** Chave usada para casar evento com regra de risco do mesmo cliente. */
export function eventRuleKey(clientId: string, eventType: string | null | undefined): string {
  return `${clientId}|${aliasEventKey(eventType)}`;
}
