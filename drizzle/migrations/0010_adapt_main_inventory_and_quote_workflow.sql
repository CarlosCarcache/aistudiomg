CREATE TABLE public.supplies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
 package_cost numeric NOT NULL DEFAULT 0 CHECK (package_cost >= 0 AND package_cost < 'Infinity'::numeric),
 package_quantity numeric NOT NULL DEFAULT 1 CHECK (package_quantity > 0 AND package_quantity < 'Infinity'::numeric),
 unit_cost numeric GENERATED ALWAYS AS (package_cost / package_quantity) STORED,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplies TO authenticated;
GRANT ALL ON public.supplies TO service_role;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplies_read ON public.supplies FOR SELECT TO authenticated USING ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'supplies','read')));
CREATE POLICY supplies_create ON public.supplies FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()) AND (select public.has_perm((select auth.uid()),'supplies','create')));
CREATE POLICY supplies_update ON public.supplies FOR UPDATE TO authenticated USING ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'supplies','update'))) WITH CHECK ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'supplies','update')));
CREATE POLICY supplies_delete ON public.supplies FOR DELETE TO authenticated USING ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'supplies','delete')));
CREATE INDEX supplies_user_created_idx ON public.supplies(user_id,created_at DESC);
CREATE INDEX supplies_category_idx ON public.supplies(category_id);
CREATE TRIGGER supplies_touch_updated BEFORE UPDATE ON public.supplies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.product_recipes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
 supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE RESTRICT,
 quantity_used numeric NOT NULL DEFAULT 1 CHECK (quantity_used > 0 AND quantity_used < 'Infinity'::numeric),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,supply_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.product_recipes TO service_role;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY recipes_read ON public.product_recipes FOR SELECT TO authenticated USING ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'catalog','read')));
CREATE POLICY recipes_create ON public.product_recipes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()) AND (select public.has_perm((select auth.uid()),'catalog','update')));
CREATE POLICY recipes_update ON public.product_recipes FOR UPDATE TO authenticated USING ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'catalog','update'))) WITH CHECK ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'catalog','update')));
CREATE POLICY recipes_delete ON public.product_recipes FOR DELETE TO authenticated USING ((user_id = (select auth.uid()) OR (select public.has_role((select auth.uid()),'admin'))) AND (select public.has_perm((select auth.uid()),'catalog','update')));
CREATE INDEX recipes_user_created_idx ON public.product_recipes(user_id,created_at DESC);
CREATE INDEX recipes_supply_idx ON public.product_recipes(supply_id);
CREATE TRIGGER recipes_touch_updated BEFORE UPDATE ON public.product_recipes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE FUNCTION public.validate_recipe_category() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p_category uuid; s_category uuid;
BEGIN
 SELECT category_id INTO p_category FROM public.products WHERE id=NEW.product_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible'; END IF;
 SELECT category_id INTO s_category FROM public.supplies WHERE id=NEW.supply_id;
 IF NOT FOUND OR p_category IS DISTINCT FROM s_category THEN RAISE EXCEPTION 'Producto e insumo deben compartir categoría'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER recipes_validate_category BEFORE INSERT OR UPDATE ON public.product_recipes FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_category();
ALTER TABLE public.products ADD COLUMN manual_discount_pct numeric CHECK (manual_discount_pct BETWEEN 0 AND 100);
ALTER TABLE public.orders ADD COLUMN quote_status text CHECK (quote_status IN ('solicitada','enviada','aceptada','denegada','rechazada'));
ALTER TABLE public.orders ADD COLUMN quote_share_id uuid REFERENCES public.gallery_shares(id) ON DELETE SET NULL;
CREATE INDEX orders_quote_share_idx ON public.orders(quote_share_id,created_at DESC);
UPDATE public.orders SET quote_status='solicitada' WHERE request_type='quote';
UPDATE public.orders o SET quote_share_id=(SELECT min(s.id::text)::uuid FROM public.gallery_shares s WHERE s.user_id=o.user_id AND s.client_id=o.client_id AND (NOT s.is_category_scoped OR s.category_id IS NOT DISTINCT FROM o.category_id) HAVING count(*)=1) WHERE o.request_type='quote';
CREATE POLICY enforce_quote_permissions ON public.orders AS RESTRICTIVE FOR ALL TO authenticated USING (quote_status IS NULL OR (select public.has_perm((select auth.uid()),'quotes',CASE current_setting('request.method',true) WHEN 'DELETE' THEN 'delete' WHEN 'PATCH' THEN 'update' ELSE 'read' END))) WITH CHECK (quote_status IS NULL OR (select public.has_perm((select auth.uid()),'quotes',CASE current_setting('request.method',true) WHEN 'POST' THEN 'create' ELSE 'update' END)));
CREATE FUNCTION public.initialize_shared_quote() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.request_type='quote' AND NEW.quote_status IS NULL THEN
  NEW.quote_status:='solicitada';
  IF NEW.quote_share_id IS NULL THEN
   SELECT min(s.id::text)::uuid INTO NEW.quote_share_id FROM public.gallery_shares s WHERE s.user_id=NEW.user_id AND s.client_id=NEW.client_id AND (NOT s.is_category_scoped OR s.category_id IS NOT DISTINCT FROM NEW.category_id) HAVING count(*)=1;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_shared_quote BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.initialize_shared_quote();
CREATE FUNCTION public.get_shared_quotes(_token text) RETURNS TABLE(id uuid,title text,description text,notes text,price numeric,quantity integer,currency text,quote_status text,created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT o.id,o.title,o.description,o.notes,o.price,o.quantity,o.currency,o.quote_status,o.created_at
 FROM public.orders o JOIN public.gallery_shares s ON s.id=o.quote_share_id AND s.client_id=o.client_id AND s.user_id=o.user_id
 WHERE replace(s.token,'-','')=replace(_token,'-','') AND public.has_perm(s.user_id,'gallery','read') AND o.quote_status IS NOT NULL
 ORDER BY o.created_at DESC LIMIT 100
$$;
REVOKE EXECUTE ON FUNCTION public.get_shared_quotes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quotes(text) TO anon,authenticated,service_role;
CREATE FUNCTION public.respond_to_shared_quote(_token text,_order_id uuid,_accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _accept IS NULL THEN RAISE EXCEPTION 'Respuesta no válida'; END IF;
 UPDATE public.orders o SET quote_status=CASE WHEN _accept THEN 'aceptada' ELSE 'rechazada' END,status=CASE WHEN _accept THEN 'en_proceso'::public.order_status ELSE o.status END
 FROM public.gallery_shares s WHERE o.id=_order_id AND o.quote_share_id=s.id AND o.client_id=s.client_id AND o.user_id=s.user_id AND replace(s.token,'-','')=replace(_token,'-','') AND public.has_perm(s.user_id,'gallery','read') AND o.quote_status='enviada' AND o.price>=0 AND o.price<'Infinity'::numeric;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no disponible para responder'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.respond_to_shared_quote(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_shared_quote(text,uuid,boolean) TO anon,authenticated,service_role;
CREATE FUNCTION public.create_shared_gallery_order_quote(_token text,_client_name text,_phone text,_notes text,_image_ids uuid[]) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT public.create_shared_gallery_quote(_token,_notes,'','',_image_ids)
$$;
REVOKE EXECUTE ON FUNCTION public.create_shared_gallery_order_quote(text,text,text,text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shared_gallery_order_quote(text,text,text,text,uuid[]) TO anon,authenticated,service_role;
CREATE FUNCTION public.validate_quote_price() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.quote_status IN ('enviada','aceptada') AND (NEW.price IS NULL OR NEW.price<0 OR NEW.price>='Infinity'::numeric OR NEW.currency NOT IN ('USD','NIO') OR NEW.quantity<>1) THEN RAISE EXCEPTION 'Precio total o moneda no válidos'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_quote_price BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_quote_price();