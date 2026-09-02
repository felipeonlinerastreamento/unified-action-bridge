/**
 * Shared helpers for chat classification.
 *
 * WhatsApp groups expose a longer numeric "phone" identifier than personal
 * chats: typically a creator-phone + "-" + creation-timestamp (e.g.
 * `5511999999999-1620000000`) which collapses to a digit-only string longer
 * than 15 chars. GSystem also forwards the raw `@g.us` suffix when present,
 * and some channels (`channel.type === 4`) map to group conversations.
 */
/**
 * Garante o DDI brasileiro (55) em números BR digitados sem código do país.
 * Números com 10 dígitos (DDD + fixo) ou 11 dígitos (DDD + 9 + celular)
 * recebem o prefixo "55". Números já internacionais ficam intactos.
 */
export function withBrazilianDdi(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (/^[1-9][0-9](9[0-9]{8}|[6-9][0-9]{7})$/.test(digits)) return `55${digits}`;
  return digits;
}

export interface GroupishChat {
  contact?: { number?: string; secondaryName?: string; name?: string } | null;
  channel?: { type?: number; identifier?: string } | null;
  description?: string;
}

export function isGroupPhoneIdentifier(value: string | null | undefined): boolean {
  const raw = value || "";
  if (/@g\.us/i.test(raw)) return true;
  if (/-\d{8,}/.test(raw)) return true;

  const phone = raw.replace(/\D/g, "");
  return phone.length > 15;
}

export function isGroupChat(chat: GroupishChat | null | undefined): boolean {
  if (!chat) return false;

  const raw = `${chat.contact?.number ?? ""} ${chat.contact?.secondaryName ?? ""} ${chat.channel?.identifier ?? ""}`;
  if (isGroupPhoneIdentifier(raw)) return true;

  const phone = (chat.contact?.number || chat.contact?.secondaryName || "").replace(/\D/g, "");
  if (phone.length > 15) return true;

  // Some GSystem payloads label group chats as type 4
  if (chat.channel?.type === 4) return true;

  return false;
}
