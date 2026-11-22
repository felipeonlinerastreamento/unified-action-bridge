import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Autentique (cadastrar no painel do Autentique: eventos signature.* e document.finished).
 * Não confia no conteúdo: usa só o id do documento para consultar a API e atualizar o contrato.
 * Se AUTENTIQUE_WEBHOOK_SECRET estiver definido, confere o X-Autentique-Signature.
 */
export const Route = createFileRoute("/api/public/hooks/autentique")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = await request.text();
        const { webhookValido } = await import("@/lib/autentique.server");
        if (!(await webhookValido(corpo, request.headers.get("x-autentique-signature")))) {
          return new Response("assinatura inválida", { status: 401 });
        }
        let ev: any = null;
        try { ev = JSON.parse(corpo); } catch { return new Response("json inválido", { status: 400 }); }
        const { documentoDoWebhook } = await import("@/lib/contratos");
        const { tipo, docId } = documentoDoWebhook(ev);
        if (!docId || !/^(signature|document)\./.test(tipo)) return new Response("ignorado", { status: 200 });
        try {
          const { sincronizarPorDocumento } = await import("@/lib/contratos-autentique.server");
          const r = await sincronizarPorDocumento(String(docId));
          return new Response(JSON.stringify({ ok: true, contrato: !!r }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
