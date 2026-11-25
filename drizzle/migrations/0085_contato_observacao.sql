-- Observação por contato da empresa (companies.contacts[].observacao).
-- O UPDATE em companies continua só para admin/gestor; qualquer usuário ativo pode alterar
-- APENAS a observação de um contato por esta função. O contato é localizado pela posição
-- e conferido pelo nome/telefone/e-mail, para não gravar no contato errado se a lista mudou.
CREATE OR REPLACE FUNCTION public.salvar_observacao_contato(
  _company_id uuid, _indice int, _nome text, _telefone text, _email text, _observacao text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _contatos jsonb;
  _c jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  IF length(coalesce(_observacao, '')) > 2000 THEN
    RAISE EXCEPTION 'Observação muito longa (máx. 2000 caracteres).';
  END IF;
  SELECT contacts INTO _contatos FROM public.companies WHERE id = _company_id FOR UPDATE;
  IF _contatos IS NULL OR jsonb_typeof(_contatos) <> 'array' OR _indice < 0 OR _indice >= jsonb_array_length(_contatos) THEN
    RAISE EXCEPTION 'Contato não encontrado. Recarregue a empresa e tente de novo.';
  END IF;
  _c := _contatos -> _indice;
  IF coalesce(trim(_c->>'name'), '') <> coalesce(trim(_nome), '')
     OR regexp_replace(coalesce(_c->>'phone', ''), '\D', '', 'g') <> regexp_replace(coalesce(_telefone, ''), '\D', '', 'g')
     OR lower(coalesce(trim(_c->>'email'), '')) <> lower(coalesce(trim(_email), '')) THEN
    RAISE EXCEPTION 'O contato foi alterado por outra pessoa. Recarregue a empresa e tente de novo.';
  END IF;
  UPDATE public.companies
     SET contacts = jsonb_set(_contatos, ARRAY[_indice::text, 'observacao'], to_jsonb(coalesce(trim(_observacao), '')))
   WHERE id = _company_id;
END $$;

REVOKE ALL ON FUNCTION public.salvar_observacao_contato(uuid, int, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.salvar_observacao_contato(uuid, int, text, text, text, text) TO authenticated;
