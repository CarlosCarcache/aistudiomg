ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'order';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'orders_request_type_check'
       AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_request_type_check CHECK (request_type IN ('order', 'quote'));
  END IF;
END;
$$;

ALTER TABLE public.orders
  ADD COLUMN quote_status text CHECK (
    quote_status IN ('solicitada', 'enviada', 'aceptada', 'denegada', 'rechazada')
  ),
  ADD COLUMN quote_share_id uuid REFERENCES public.gallery_shares(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_quote_status ON public.orders(quote_status)
  WHERE quote_status IS NOT NULL;

UPDATE public.orders o
   SET title = regexp_replace(o.title, '^Pedido desde enlace: ', 'Solicitud de cotización: '),
       price = NULL,
      request_type = 'quote',
      quote_status = 'solicitada',
       quote_share_id = (
         SELECT gs.id
           FROM public.gallery_shares gs
          WHERE gs.client_id = o.client_id
            AND gs.user_id = o.user_id
            AND (NOT gs.is_category_scoped OR gs.category_id IS NOT DISTINCT FROM o.category_id)
          ORDER BY gs.created_at DESC
          LIMIT 1
       )
 WHERE o.selected_images IS NOT NULL
   AND o.status = 'nuevo'
   AND o.quote_status IS NULL
   AND EXISTS (
     SELECT 1
       FROM public.gallery_shares gs
      WHERE gs.client_id = o.client_id
        AND gs.user_id = o.user_id
   );

UPDATE public.orders o
   SET quote_status = 'solicitada',
       quote_share_id = (
         SELECT gs.id
           FROM public.gallery_shares gs
          WHERE gs.client_id = o.client_id
            AND gs.user_id = o.user_id
            AND (NOT gs.is_category_scoped OR gs.category_id IS NOT DISTINCT FROM o.category_id)
          ORDER BY gs.is_category_scoped DESC, gs.created_at DESC
          LIMIT 1
       )
 WHERE o.request_type = 'quote'
   AND o.quote_status IS NULL
   AND EXISTS (
     SELECT 1
       FROM public.gallery_shares gs
      WHERE gs.client_id = o.client_id
        AND gs.user_id = o.user_id
        AND (NOT gs.is_category_scoped OR gs.category_id IS NOT DISTINCT FROM o.category_id)
   );

CREATE OR REPLACE FUNCTION public.create_shared_gallery_order_quote(
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
  share_id uuid;
  order_id uuid;
BEGIN
  IF _token IS NULL OR _token !~* '^[a-f0-9-]{32,36}$' THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;

  SELECT id INTO share_id
    FROM public.gallery_shares
   WHERE replace(token, '-', '') = replace(_token, '-', '');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;

  order_id := public.create_shared_gallery_order(
    _token, _client_name, _phone, _notes, _image_ids
  );

  UPDATE public.orders
     SET title = 'Solicitud de cotización: ' || trim(_client_name),
         price = NULL,
         request_type = 'quote',
         quote_status = 'solicitada',
         quote_share_id = share_id
   WHERE id = order_id;

  RETURN order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_shared_gallery_order(text, text, text, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_order_from_share(uuid, text, text, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shared_gallery_order_quote(text, text, text, text, uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.initialize_shared_quote_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_id uuid;
BEGIN
  IF NEW.request_type IS DISTINCT FROM 'quote' THEN
    RETURN NEW;
  END IF;

  SELECT gs.id INTO share_id
    FROM public.gallery_shares gs
   WHERE gs.client_id = NEW.client_id
     AND gs.user_id = NEW.user_id
     AND (NOT gs.is_category_scoped OR gs.category_id IS NOT DISTINCT FROM NEW.category_id)
   ORDER BY gs.is_category_scoped DESC, gs.created_at DESC
   LIMIT 1;

  IF share_id IS NOT NULL THEN
    NEW.quote_status := coalesce(NEW.quote_status, 'solicitada');
    NEW.quote_share_id := coalesce(NEW.quote_share_id, share_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_initialize_shared_quote_status
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.initialize_shared_quote_status();

CREATE OR REPLACE FUNCTION public.get_shared_quotes(_token text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  notes text,
  price numeric,
  quantity integer,
  currency text,
  quote_status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.title, o.description, o.notes, o.price, o.quantity,
         o.currency, o.quote_status, o.created_at
    FROM public.orders o
    JOIN public.gallery_shares gs ON gs.id = o.quote_share_id
  WHERE replace(gs.token, '-', '') = replace(_token, '-', '')
     AND o.quote_status IS NOT NULL
   ORDER BY o.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.respond_to_shared_quote(
  _token text,
  _order_id uuid,
  _accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quote_record public.orders%ROWTYPE;
BEGIN
  IF _token IS NULL OR _token !~* '^[a-f0-9-]{32,36}$' THEN
    RAISE EXCEPTION 'Enlace no válido';
  END IF;
  IF _accept IS NULL THEN
    RAISE EXCEPTION 'Respuesta no válida';
  END IF;

  SELECT o.* INTO quote_record
    FROM public.orders o
    JOIN public.gallery_shares gs ON gs.id = o.quote_share_id
   WHERE o.id = _order_id
    AND replace(gs.token, '-', '') = replace(_token, '-', '')
   FOR UPDATE OF o;

  IF NOT FOUND OR quote_record.quote_status IS DISTINCT FROM 'enviada' THEN
    RAISE EXCEPTION 'La cotización no está disponible para responder';
  END IF;

  UPDATE public.orders
     SET quote_status = CASE WHEN _accept THEN 'aceptada' ELSE 'rechazada' END,
         status = CASE WHEN _accept THEN 'en_proceso'::public.order_status ELSE status END
   WHERE id = _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shared_quotes(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_to_shared_quote(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quotes(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_shared_quote(text, uuid, boolean) TO anon, authenticated;