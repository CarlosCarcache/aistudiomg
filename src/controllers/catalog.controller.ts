// Controller: catálogo (categorías y productos).
import { supabase } from "@/integrations/supabase/client";
import type {
  NewProduct,
  NewProductCategory,
  Product,
  ProductCategory,
  UpdateProduct,
  UpdateProductCategory,
} from "@/models/types";

export const catalogController = {
  async listCategories(): Promise<ProductCategory[]> {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async createCategory(input: NewProductCategory): Promise<ProductCategory> {
    const { data, error } = await supabase
      .from("product_categories")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateCategory(
    id: string,
    input: UpdateProductCategory,
  ): Promise<ProductCategory> {
    const { data, error } = await supabase
      .from("product_categories")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeCategory(id: string) {
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async listProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return this.withSignedUrls(data ?? []);
  },

  // Sube una imagen local al bucket privado "products" y devuelve su ruta.
  async uploadProductImage(userId: string, file: File): Promise<string> {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage
      .from("products")
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  },

  // Convierte rutas del bucket en URLs firmadas (válidas 1 hora).
  async withSignedUrls(products: Product[]): Promise<Product[]> {
    return Promise.all(
      products.map(async (p) => {
        if (!p.image_url || /^(https?:|data:)/.test(p.image_url)) return p;
        const { data } = await supabase.storage
          .from("products")
          .createSignedUrl(p.image_url, 3600);
        return { ...p, image_url: data?.signedUrl ?? p.image_url };
      }),
    );
  },

  async createProduct(input: NewProduct): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, input: UpdateProduct): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeProduct(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
};
