ALTER TABLE public.bot_auto_reply_rules ADD COLUMN IF NOT EXISTS reply_text_complete text;

UPDATE public.bot_auto_reply_rules
SET required_fields = (
  SELECT COALESCE(array_agg(DISTINCT mapped), '{}')
  FROM (
    SELECT CASE
      WHEN lower(unaccent_field) LIKE '%cpf%' OR lower(unaccent_field) LIKE '%cnpj%' OR lower(unaccent_field) LIKE '%documento%' THEN 'cpf_cnpj'
      WHEN lower(unaccent_field) LIKE '%placa%' THEN 'placa'
      WHEN lower(unaccent_field) LIKE '%periodo%' OR lower(unaccent_field) LIKE '%período%' OR lower(unaccent_field) LIKE '%data%' THEN 'periodo'
      WHEN lower(unaccent_field) LIKE '%cidade%' THEN 'cidade'
      WHEN lower(unaccent_field) LIKE '%mail%' OR lower(unaccent_field) LIKE '%usuario%' OR lower(unaccent_field) LIKE '%usuário%' THEN 'email'
      ELSE NULL
    END AS mapped
    FROM unnest(COALESCE(required_fields, '{}')) AS unaccent_field
  ) m
  WHERE mapped IS NOT NULL
)
WHERE required_fields IS NOT NULL AND array_length(required_fields, 1) > 0;