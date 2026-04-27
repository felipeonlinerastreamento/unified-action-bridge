CREATE TABLE public.zapi_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zapi_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view zapi templates"
ON public.zapi_message_templates FOR SELECT
TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage zapi templates"
ON public.zapi_message_templates FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_zapi_message_templates_updated_at
BEFORE UPDATE ON public.zapi_message_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.zapi_message_templates (key, label, content) VALUES
('finalizacao', 'Mensagem de finalização do atendimento',
'Seu atendimento foi finalizado e desde já agradecemos pela atenção.

Se você precisar de suporte no futuro, fique à vontade para falar conosco.

Tenha um ótimo dia!

Protocolo desse atendimento: {protocolo}

Esta é uma mensagem automática e não precisa responder.');