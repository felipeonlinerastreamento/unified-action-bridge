ALTER TABLE public.ticket_comments
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

DROP POLICY IF EXISTS "Auth users update own comments" ON public.ticket_comments;
CREATE POLICY "Auth users update own comments"
ON public.ticket_comments
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
