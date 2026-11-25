ALTER TABLE public.orders
  ADD COLUMN request_type text NOT NULL DEFAULT 'order';

ALTER TABLE public.orders
  ADD CONSTRAINT orders_request_type_check CHECK (request_type IN ('order', 'quote'));

COMMENT ON COLUMN public.orders.request_type IS 'Distingue pedidos con precio definido de solicitudes de cotización.';

CREATE OR REPLACE FUNCTION public.get_shared_gallery_client(_token text)
RETURNS TABLE (
  owner_id uuid,
  client_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gs.user_id AS owner_id,
    c.id AS client_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone
  FROM public.gallery_shares gs
  JOIN public.clients c
    ON c.id = gs.client_id AND c.user_id = gs.user_id
  WHERE replace(gs.token, '-', '') = replace(_token, '-', '')
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_gallery_client(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_gallery_client(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_shared_gallery_quote(
  _token text,
  _notes text,
  _image_path text,
  _image_name text,
  _image_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.gallery_shares%ROWTYPE;
  c public.clients%ROWTYPE;
  items jsonb;
  selected_count integer;
  order_id uuid;
  safe_image_name text;
  display_name text;
BEGIN
  IF _token IS NULL OR _token !~* '^[a-f0-9-]{32,36}$' THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;

  SELECT * INTO s
  FROM public.gallery_shares
  WHERE replace(token, '-', '') = replace(_token, '-', '');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;

  SELECT * INTO c
  FROM public.clients
  WHERE id = s.client_id AND user_id = s.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no válido';
  END IF;

  IF length(coalesce(_notes, '')) > 1000
     OR length(coalesce(_image_name, '')) > 160
     OR coalesce(cardinality(_image_ids), 0) > 100
     OR (
       _image_ids IS NOT NULL
       AND (SELECT count(DISTINCT value) FROM unnest(_image_ids) AS value) <> cardinality(_image_ids)
     ) THEN
    RAISE EXCEPTION 'Datos no válidos';
  END IF;

  IF coalesce(cardinality(_image_ids), 0) = 0 AND nullif(trim(_image_path), '') IS NULL THEN
    RAISE EXCEPTION 'Adjunta una imagen o selecciona una imagen compartida';
  END IF;

  IF nullif(trim(_image_path), '') IS NOT NULL AND (
    length(_image_path) > 500
    OR _image_path !~ ('^quote-uploads/' || s.user_id::text || '/' || s.client_id::text || '/[a-f0-9-]+\.(jpg|png|webp)$')
  ) THEN
    RAISE EXCEPTION 'Imagen adjunta no válida';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(s.id::text, 0));

  IF (
    SELECT count(*)
    FROM public.orders
    WHERE client_id = s.client_id
      AND user_id = s.user_id
      AND request_type = 'quote'
      AND created_at > now() - interval '1 minute'
  ) >= 5 THEN
    RAISE EXCEPTION 'Espera un minuto antes de enviar otra cotización';
  END IF;

  SELECT
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', gi.id,
          'title', gi.title,
          'image_url', gi.image_url,
          'price', gi.price
        )
      ),
      '[]'::jsonb
    )
  INTO selected_count, items
  FROM public.get_shared_gallery(_token) gi
  WHERE gi.id = ANY(coalesce(_image_ids, '{}'::uuid[]));

  IF selected_count <> coalesce(cardinality(_image_ids), 0) THEN
    RAISE EXCEPTION 'Las imágenes no pertenecen a este enlace';
  END IF;

  safe_image_name := regexp_replace(
    coalesce(nullif(trim(_image_name), ''), 'Imagen adjunta'),
    '[[:cntrl:]]',
    ' ',
    'g'
  );
  display_name := nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '');
  display_name := coalesce(display_name, nullif(trim(c.email), ''), 'Cliente');

  INSERT INTO public.orders (
    user_id,
    client_id,
    category_id,
    title,
    description,
    notes,
    price,
    quantity,
    currency,
    status,
    selected_images,
    image_url,
    request_type
  ) VALUES (
    s.user_id,
    s.client_id,
    CASE WHEN s.is_category_scoped THEN s.category_id ELSE NULL END,
    'Cotización desde enlace: ' || display_name,
    concat_ws(
      E'\n',
      'Solicitud de cotización de precio.',
      CASE
        WHEN nullif(trim(_image_path), '') IS NOT NULL THEN 'Imagen propia: ' || safe_image_name
        ELSE NULL
      END,
      CASE
        WHEN selected_count > 0 THEN 'Imágenes compartidas seleccionadas: ' || selected_count::text
        ELSE NULL
      END
    ),
    concat_ws(
      E'\n',
      'Teléfono: ' || nullif(trim(c.phone), ''),
      'Email: ' || nullif(trim(c.email), ''),
      nullif(trim(_notes), '')
    ),
    NULL,
    1,
    'NIO',
    'nuevo',
    CASE WHEN selected_count > 0 THEN items ELSE NULL END,
    nullif(trim(_image_path), ''),
    'quote'
  ) RETURNING id INTO order_id;

  RETURN order_id;
END
$$;

REVOKE EXECUTE ON FUNCTION public.create_shared_gallery_quote(text, text, text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shared_gallery_quote(text, text, text, text, uuid[]) TO anon, authenticated, service_role;