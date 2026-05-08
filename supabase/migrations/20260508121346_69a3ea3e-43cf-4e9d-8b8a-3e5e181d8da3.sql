
-- 1) Normalization function
CREATE OR REPLACE FUNCTION public.normalize_zapi_phone(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  -- Group identifiers stay as-is (allow coexistence)
  IF raw ~ '@g\.us' OR raw ~ '-\d{8,}' THEN
    RETURN raw;
  END IF;
  digits := regexp_replace(raw, '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  -- LID-like: 15+ digits → never collide with real phone
  IF length(digits) >= 15 THEN
    RETURN 'lid:' || digits;
  END IF;
  -- BR with DDI
  IF digits ~ '^55[0-9]{10,11}$' THEN
    RETURN digits;
  END IF;
  -- BR without DDI (10 or 11 digits) → prefix 55
  IF length(digits) BETWEEN 10 AND 11 THEN
    RETURN '55' || digits;
  END IF;
  RETURN digits;
END;
$$;

-- 2) Deduplicate existing chats by (channel_id, normalized_phone)
DO $$
DECLARE
  grp RECORD;
  canonical_id uuid;
  dup_id uuid;
  total_unread int;
BEGIN
  FOR grp IN
    SELECT channel_id, public.normalize_zapi_phone(phone) AS pn, array_agg(id ORDER BY (CASE WHEN contact_name IS NOT NULL AND contact_name <> '' THEN 0 ELSE 1 END), last_message_at DESC NULLS LAST, created_at) AS ids
    FROM public.zapi_chats
    WHERE phone IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1 AND public.normalize_zapi_phone((array_agg(phone))[1]) NOT LIKE 'lid:%'
  LOOP
    canonical_id := grp.ids[1];
    -- sum unread
    SELECT COALESCE(SUM(unread_count),0) INTO total_unread FROM public.zapi_chats WHERE id = ANY(grp.ids);

    FOREACH dup_id IN ARRAY grp.ids LOOP
      IF dup_id = canonical_id THEN CONTINUE; END IF;
      -- drop messages that already exist on canonical (by zapi_message_id)
      DELETE FROM public.zapi_messages m
      WHERE m.chat_id = dup_id
        AND m.zapi_message_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.zapi_messages m2
          WHERE m2.chat_id = canonical_id AND m2.zapi_message_id = m.zapi_message_id
        );
      -- move remaining
      UPDATE public.zapi_messages SET chat_id = canonical_id WHERE chat_id = dup_id;
      DELETE FROM public.zapi_chats WHERE id = dup_id;
    END LOOP;

    UPDATE public.zapi_chats
    SET unread_count = total_unread,
        last_message_at = (
          SELECT MAX(created_at) FROM public.zapi_messages WHERE chat_id = canonical_id
        )
    WHERE id = canonical_id;
  END LOOP;
END $$;

-- 3) Generated column with normalized phone
ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (public.normalize_zapi_phone(phone)) STORED;

-- 4) Unique partial index — one chat per (channel, normalized phone), excluding LIDs
CREATE UNIQUE INDEX IF NOT EXISTS uniq_zapi_chats_channel_phone_norm
  ON public.zapi_chats (channel_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized NOT LIKE 'lid:%';
