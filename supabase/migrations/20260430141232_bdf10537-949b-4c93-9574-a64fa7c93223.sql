CREATE SEQUENCE IF NOT EXISTS public.service_ticket_protocol_seq AS integer START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

ALTER TABLE public.service_tickets
ADD COLUMN IF NOT EXISTS protocol_number integer;

UPDATE public.service_tickets
SET protocol_number = nextval('public.service_ticket_protocol_seq')
WHERE protocol_number IS NULL;

SELECT setval(
  'public.service_ticket_protocol_seq',
  GREATEST((SELECT COALESCE(MAX(protocol_number), 0) FROM public.service_tickets), 1),
  true
);

ALTER TABLE public.service_tickets
ALTER COLUMN protocol_number SET DEFAULT nextval('public.service_ticket_protocol_seq'),
ALTER COLUMN protocol_number SET NOT NULL;

ALTER SEQUENCE public.service_ticket_protocol_seq OWNED BY public.service_tickets.protocol_number;

CREATE UNIQUE INDEX IF NOT EXISTS service_tickets_protocol_number_key
ON public.service_tickets (protocol_number);