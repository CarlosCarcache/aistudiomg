ALTER TABLE public.gallery_images ADD COLUMN price numeric(12,2);

CREATE OR REPLACE FUNCTION public.create_order_from_share(
  _token uuid,
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
  _share public.gallery_shares%ROWTYPE;
  _total numeric(12,2);
  _titles text;
  _order_id uuid;
BEGIN
  SELECT * INTO _share FROM public.gallery_shares WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;

  SELECT COALESCE(SUM(COALESCE(price, 0)), 0), string_agg(title, ', ')
  INTO _total, _titles
  FROM public.gallery_images
  WHERE id = ANY(_image_ids) AND client_id = _share.client_id;

  INSERT INTO public.orders (user_id, client_id, title, description, notes, price, quantity, status)
  VALUES (
    _share.user_id,
    _share.client_id,
    'Pedido desde enlace: ' || _client_name,
    'Imágenes seleccionadas: ' || COALESCE(_titles, 'sin imágenes'),
    CONCAT_WS(E'\n', 'Teléfono: ' || NULLIF(_phone, ''), NULLIF(_notes, '')),
    _total,
    COALESCE(array_length(_image_ids, 1), 1),
    'nuevo'
  )
  RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_from_share(uuid, text, text, text, uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.create_order_from_share(uuid, text, text, text, uuid[]) TO authenticated;