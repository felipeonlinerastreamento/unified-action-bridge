CREATE OR REPLACE FUNCTION public.normalize_zapi_phone(raw text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  IF raw ~ '@g\.us' OR raw ~ '-\d{8,}' THEN
    RETURN raw;
  END IF;
  -- LID markers (suffix @lid / prefix lid:) sempre viram lid:<digits>
  IF raw ~* '@lid$' OR raw ~* '^lid:' THEN
    digits := regexp_replace(raw, '\D', '', 'g');
    RETURN CASE WHEN digits = '' THEN NULL ELSE 'lid:' || digits END;
  END IF;
  digits := regexp_replace(raw, '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  -- BR phones are at most 13 digits (55 + DDD + 9 + 8). 14+ é LID.
  IF length(digits) >= 14 THEN
    RETURN 'lid:' || digits;
  END IF;
  IF length(digits) BETWEEN 10 AND 11 THEN
    digits := '55' || digits;
  END IF;
  IF digits ~ '^55[1-9][0-9][6-9][0-9]{7}$' THEN
    digits := substring(digits, 1, 4) || '9' || substring(digits, 5);
  END IF;
  RETURN digits;
END;
$function$;