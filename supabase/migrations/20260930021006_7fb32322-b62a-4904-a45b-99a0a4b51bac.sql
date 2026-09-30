CREATE OR REPLACE FUNCTION public.has_perm(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(_user_id, 'admin') or coalesce((
    select case _action when 'create' then can_create when 'read' then can_read
      when 'update' then can_update when 'delete' then can_delete else false end
    from public.user_permissions where user_id = _user_id and module = _module
  ), true)
$$;
REVOKE EXECUTE ON FUNCTION public.has_perm(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_perm(uuid,text,text) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('clients','clients'),('employees','employees'),('orders','orders'),
    ('projects','projects'),('products','catalog'),('product_categories','catalog'),
    ('gallery_images','gallery'),('gallery_shares','gallery')) v(t,m) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "perm create" ON public.%I', r.t);
    EXECUTE format('DROP POLICY IF EXISTS "perm read" ON public.%I', r.t);
    EXECUTE format('DROP POLICY IF EXISTS "perm update" ON public.%I', r.t);
    EXECUTE format('DROP POLICY IF EXISTS "perm delete" ON public.%I', r.t);
    EXECUTE format('CREATE POLICY "perm create" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(), %L, ''create''))', r.t, r.m);
    EXECUTE format('CREATE POLICY "perm read" ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), %L, ''read''))', r.t, r.m);
    EXECUTE format('CREATE POLICY "perm update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(), %L, ''update''))', r.t, r.m);
    EXECUTE format('CREATE POLICY "perm delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_perm(auth.uid(), %L, ''delete''))', r.t, r.m);
  END LOOP;
END $$;