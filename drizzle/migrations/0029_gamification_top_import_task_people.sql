CREATE OR REPLACE FUNCTION public.gamif_import_fix_tasks(_p jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores importam dados do TOP'; END IF;
  UPDATE public.tasks t
  SET created_by = coalesce(x.created_by, t.created_by),
      assigned_to = coalesce(t.assigned_to, x.assigned_to)
  FROM jsonb_to_recordset(coalesce(_p->'task_people', '[]'::jsonb)) AS x(id uuid, created_by uuid, assigned_to uuid)
  WHERE t.id = x.id
    AND ((x.created_by IS NOT NULL AND t.created_by IS DISTINCT FROM x.created_by)
      OR (t.assigned_to IS NULL AND x.assigned_to IS NOT NULL));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.gamif_import_fix_tasks(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamif_import_fix_tasks(jsonb) TO authenticated;