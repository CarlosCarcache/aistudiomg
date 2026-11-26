ALTER TABLE public.products
  ADD COLUMN manual_discount_pct numeric(5,2)
  CHECK (manual_discount_pct BETWEEN 0 AND 100);

CREATE TABLE public.supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  package_cost numeric(12,2) NOT NULL CHECK (package_cost >= 0),
  package_quantity numeric(12,3) NOT NULL CHECK (package_quantity > 0),
  unit_cost numeric(14,4) GENERATED ALWAYS AS (package_cost / package_quantity) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplies_user_category ON public.supplies(user_id, category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplies TO authenticated;
GRANT ALL ON public.supplies TO service_role;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplies select own or admin" ON public.supplies
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplies insert own category" ON public.supplies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.product_categories c
       WHERE c.id = category_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "supplies update own category" ON public.supplies
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) AND EXISTS (
      SELECT 1 FROM public.product_categories c
       WHERE c.id = category_id AND c.user_id = supplies.user_id
    )
  );
CREATE POLICY "supplies delete own or admin" ON public.supplies
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_supplies_touch BEFORE UPDATE ON public.supplies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE RESTRICT,
  quantity_used numeric(12,3) NOT NULL CHECK (quantity_used > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, supply_id)
);

CREATE INDEX idx_product_recipes_user_product ON public.product_recipes(user_id, product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_recipes TO authenticated;
GRANT ALL ON public.product_recipes TO service_role;
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product recipes select own or admin" ON public.product_recipes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "product recipes insert own" ON public.product_recipes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "product recipes update own or admin" ON public.product_recipes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "product recipes delete own or admin" ON public.product_recipes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_product_recipes_touch BEFORE UPDATE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_product_recipe_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_category uuid;
  supply_category uuid;
BEGIN
  SELECT category_id INTO product_category
    FROM public.products
   WHERE id = NEW.product_id AND user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no pertenece a este usuario';
  END IF;

  SELECT category_id INTO supply_category
    FROM public.supplies
   WHERE id = NEW.supply_id AND user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El insumo no pertenece a este usuario';
  END IF;

  IF product_category IS NULL OR product_category IS DISTINCT FROM supply_category THEN
    RAISE EXCEPTION 'El producto y el insumo deben pertenecer a la misma categoría';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_product_recipe_category
  BEFORE INSERT OR UPDATE ON public.product_recipes
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_recipe_category();

CREATE OR REPLACE FUNCTION public.prevent_recipe_category_mismatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'supplies' AND EXISTS (
    SELECT 1
      FROM public.product_recipes r
      JOIN public.products p ON p.id = r.product_id
     WHERE r.supply_id = NEW.id
       AND p.category_id IS DISTINCT FROM NEW.category_id
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la categoría: el insumo está en recetas de otra categoría';
  END IF;

  IF TG_TABLE_NAME = 'products' AND EXISTS (
    SELECT 1
      FROM public.product_recipes r
      JOIN public.supplies s ON s.id = r.supply_id
     WHERE r.product_id = NEW.id
       AND s.category_id IS DISTINCT FROM NEW.category_id
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la categoría: el producto tiene insumos de otra categoría';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_supply_recipe_category_mismatch
  BEFORE UPDATE OF category_id ON public.supplies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_recipe_category_mismatch();
CREATE TRIGGER trg_prevent_product_recipe_category_mismatch
  BEFORE UPDATE OF category_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_recipe_category_mismatch();