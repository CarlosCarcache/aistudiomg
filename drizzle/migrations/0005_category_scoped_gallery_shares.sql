ALTER TABLE public.gallery_shares
  ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  ADD COLUMN is_category_scoped boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_shared_gallery(_token text)
RETURNS SETOF public.gallery_images
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gi.*
  FROM public.gallery_images gi
  JOIN public.gallery_shares gs
    ON gs.user_id = gi.user_id
   AND (
     (gs.is_category_scoped AND gi.category_id IS NOT DISTINCT FROM gs.category_id)
     OR (NOT gs.is_category_scoped AND gi.client_id = gs.client_id)
   )
  WHERE gs.token = _token
  ORDER BY gi.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.create_shared_gallery_order(
  _token text,
  _client_name text,
  _phone text,
  _notes text,
  _image_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.gallery_shares%ROWTYPE;
  total numeric(12,2);
  items jsonb;
  n integer;
  oid uuid;
BEGIN
  IF _token IS NULL OR _token !~* '^[a-f0-9-]{32,36}$' THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;

  SELECT *
    INTO s
    FROM public.gallery_shares
   WHERE replace(token, '-', '') = replace(_token, '-', '');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;
  IF _client_name IS NULL
     OR length(trim(_client_name)) NOT BETWEEN 1 AND 100
     OR length(coalesce(_phone, '')) > 40
     OR length(coalesce(_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Datos no válidos';
  END IF;
  IF coalesce(cardinality(_image_ids), 0) NOT BETWEEN 1 AND 100
     OR (SELECT count(DISTINCT x) FROM unnest(_image_ids) x) <> cardinality(_image_ids) THEN
    RAISE EXCEPTION 'Selecciona imágenes válidas';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(s.id::text, 0));
  IF (
    SELECT count(*)
      FROM public.orders
     WHERE client_id = s.client_id
       AND user_id = s.user_id
       AND selected_images IS NOT NULL
       AND created_at > now() - interval '1 minute'
  ) >= 5 THEN
    RAISE EXCEPTION 'Espera un minuto antes de enviar otro pedido';
  END IF;

  SELECT count(*),
         coalesce(sum(coalesce(gi.price, 0)), 0),
         jsonb_agg(jsonb_build_object(
           'id', gi.id,
           'title', gi.title,
           'image_url', gi.image_url,
           'price', coalesce(gi.price, 0)
         ))
    INTO n, total, items
    FROM public.gallery_images gi
   WHERE gi.id = ANY(_image_ids)
     AND gi.user_id = s.user_id
     AND (
       (s.is_category_scoped AND gi.category_id IS NOT DISTINCT FROM s.category_id)
       OR (NOT s.is_category_scoped AND gi.client_id = s.client_id)
     );

  IF n <> cardinality(_image_ids) THEN
    RAISE EXCEPTION 'Las imágenes no pertenecen a este enlace';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.gallery_images
     WHERE id = ANY(_image_ids)
       AND price < 0
  ) THEN
    RAISE EXCEPTION 'Precio no válido';
  END IF;

  INSERT INTO public.orders(
    user_id, client_id, title, description, notes, price, quantity,
    currency, status, selected_images
  )
  VALUES (
    s.user_id,
    s.client_id,
    'Pedido desde enlace: ' || trim(_client_name),
    'Imágenes seleccionadas: ' || (
      SELECT string_agg(value ->> 'title', ', ')
        FROM jsonb_array_elements(items)
    ),
    concat_ws(E'\n', 'Teléfono: ' || nullif(trim(_phone), ''), nullif(trim(_notes), '')),
    total,
    1,
    'NIO',
    'nuevo',
    items
  )
  RETURNING id INTO oid;

  RETURN oid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_gallery(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shared_gallery_order(text, text, text, text, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_order_from_share(
  _token uuid,
  _client_name text,
  _phone text,
  _notes text,
  _image_ids uuid[]
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.create_shared_gallery_order(_token::text, _client_name, _phone, _notes, _image_ids)
$$;

GRANT EXECUTE ON FUNCTION public.create_order_from_share(uuid, text, text, text, uuid[]) TO anon, authenticated;
