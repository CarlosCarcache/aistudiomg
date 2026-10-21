CREATE OR REPLACE FUNCTION public.create_shared_gallery_order(_token text,_client_name text,_phone text,_notes text,_image_ids uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.gallery_shares%ROWTYPE; total numeric(12,2); items jsonb; n integer; oid uuid;
BEGIN
IF _token IS NULL OR _token !~* '^[a-f0-9-]{32,36}$' THEN RAISE EXCEPTION 'Enlace no válido'; END IF;
SELECT * INTO s FROM public.gallery_shares WHERE replace(token,'-','')=replace(_token,'-','');
IF NOT FOUND THEN RAISE EXCEPTION 'Enlace no válido'; END IF;
IF _client_name IS NULL OR length(trim(_client_name)) NOT BETWEEN 1 AND 100 OR length(coalesce(_phone,'')) > 40 OR length(coalesce(_notes,'')) > 1000 THEN RAISE EXCEPTION 'Datos no válidos'; END IF;
IF coalesce(cardinality(_image_ids),0) NOT BETWEEN 1 AND 100 OR (SELECT count(DISTINCT x) FROM unnest(_image_ids) x) <> cardinality(_image_ids) THEN RAISE EXCEPTION 'Selecciona imágenes válidas'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(s.id::text,0));
IF (SELECT count(*) FROM public.orders WHERE client_id=s.client_id AND user_id=s.user_id AND selected_images IS NOT NULL AND created_at > now()-interval '1 minute') >= 5 THEN RAISE EXCEPTION 'Espera un minuto antes de enviar otro pedido'; END IF;
SELECT count(*),coalesce(sum(coalesce(price,0)),0),jsonb_agg(jsonb_build_object('id',id,'title',title,'image_url',image_url,'price',coalesce(price,0))) INTO n,total,items FROM public.gallery_images WHERE id=ANY(_image_ids) AND client_id=s.client_id AND user_id=s.user_id;
IF n <> cardinality(_image_ids) THEN RAISE EXCEPTION 'Las imágenes no pertenecen a este enlace'; END IF;
IF EXISTS(SELECT 1 FROM public.gallery_images WHERE id=ANY(_image_ids) AND price < 0) THEN RAISE EXCEPTION 'Precio no válido'; END IF;
INSERT INTO public.orders(user_id,client_id,title,description,notes,price,quantity,currency,status,selected_images) VALUES(s.user_id,s.client_id,'Pedido desde enlace: '||trim(_client_name),'Imágenes seleccionadas: '||(SELECT string_agg(value->>'title',', ') FROM jsonb_array_elements(items)),concat_ws(E'\n','Teléfono: '||nullif(trim(_phone),''),nullif(trim(_notes),'')),total,1,'NIO','nuevo',items) RETURNING id INTO oid;
RETURN oid;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_shared_gallery_order(text,text,text,text,uuid[]) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.create_order_from_share(_token uuid,_client_name text,_phone text,_notes text,_image_ids uuid[]) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.create_shared_gallery_order(_token::text,_client_name,_phone,_notes,_image_ids); $$;
ALTER POLICY "gallery objects read" ON storage.objects TO authenticated USING (bucket_id='gallery' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.gallery_images gi WHERE gi.image_url=name AND public.has_perm(auth.uid(),'gallery','read'))));