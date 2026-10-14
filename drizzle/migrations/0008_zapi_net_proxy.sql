CREATE OR REPLACE FUNCTION public.zapi_net_request(_url text, _method text, _headers jsonb, _body jsonb, _timeout_ms int DEFAULT 30000)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rid bigint;
  t int := GREATEST(1000, LEAST(_timeout_ms, 120000));
BEGIN
  IF _url NOT LIKE 'https://api.z-api.io/%' THEN
    RAISE EXCEPTION 'host not allowed';
  END IF;
  IF _method = 'GET' THEN
    SELECT net.http_get(url := _url, headers := COALESCE(_headers, '{}'::jsonb), timeout_milliseconds := t) INTO rid;
  ELSIF _method = 'POST' THEN
    SELECT net.http_post(url := _url, body := COALESCE(_body, '{}'::jsonb), headers := COALESCE(_headers, '{}'::jsonb), timeout_milliseconds := t) INTO rid;
  ELSIF _method = 'DELETE' THEN
    SELECT net.http_delete(url := _url, headers := COALESCE(_headers, '{}'::jsonb), timeout_milliseconds := t) INTO rid;
  ELSE
    RAISE EXCEPTION 'method not supported';
  END IF;
  RETURN rid;
END;
$$;

CREATE OR REPLACE FUNCTION public.zapi_net_result(_id bigint)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, net
AS $$
  SELECT jsonb_build_object('status', status_code, 'body', content, 'timed_out', timed_out, 'error', error_msg)
  FROM net._http_response WHERE id = _id
$$;

REVOKE ALL ON FUNCTION public.zapi_net_request(text, text, jsonb, jsonb, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zapi_net_result(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zapi_net_request(text, text, jsonb, jsonb, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.zapi_net_result(bigint) TO service_role;