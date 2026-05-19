ALTER TABLE public.sector_groups
  ADD COLUMN IF NOT EXISTS allowed_menus text[],
  ADD COLUMN IF NOT EXISTS can_finalize_without_message boolean NOT NULL DEFAULT false;