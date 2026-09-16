import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// E-mails com exceção de acesso, para contornar a restrição global de provedor de e-mail.
const ALLOWED_EMERGENCY_EMAILS = [
  "patricia@onlinerastreamento",
  "contato.pats@gmail.com",
];

function isEmergencyAllowed(email: string): boolean {
  const normalized = email.toLowerCase();
  return ALLOWED_EMERGENCY_EMAILS.some((allowed) => normalized.startsWith(allowed));
}

// Exceção de acesso gerada via painel administrativo para contornar a restrição global de provedor.
export const executeEmergencyLogin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string(),
      redirectTo: z.string(),
    }).parse
  )
  .handler(async ({ data }) => {
    if (!isEmergencyAllowed(data.email)) {
      throw new Error("Exceção não autorizada.");
    }

    const { data: linkInfo, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: {
        redirectTo: data.redirectTo,
      },
    });

    if (error || !linkInfo?.properties?.action_link) {
      throw new Error(`Falha ao gerar bypass: ${error?.message || "Sem link"}`);
    }

    return { url: linkInfo.properties.action_link };
  });
